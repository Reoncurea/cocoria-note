import { NextRequest, NextResponse } from 'next/server'
import { createPlanningPhotoPath, validatePhotoFile } from '@/lib/uploads/photos'
import { dbError, requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const formData = await request.formData()
  const file = formData.get('file')
  const captionValue = formData.get('caption')
  const caption = typeof captionValue === 'string' && captionValue.trim() ? captionValue.trim() : null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '写真ファイルを選択してください。' }, { status: 400 })
  }

  const validationError = validatePhotoFile(file)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabase
    .from('planning_sessions')
    .select('id')
    .eq('id', id)
    .single()

  if (sessionError || !session) return dbError(sessionError ?? { message: 'Planning session not found' }, 404)

  const { count } = await supabase
    .from('planning_photos')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', id)

  const filePath = createPlanningPhotoPath(user.id, id, file)
  const { error: uploadError } = await supabase.storage
    .from('planning-photos')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return dbError(uploadError)

  const { data: inserted, error: insertError } = await supabase
    .from('planning_photos')
    .insert({
      session_id: id,
      user_id: user.id,
      file_path: filePath,
      caption,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    await supabase.storage.from('planning-photos').remove([filePath])
    return dbError(insertError ?? { message: 'Planning photo insert failed' })
  }

  const { data: signed } = await supabase.storage
    .from('planning-photos')
    .createSignedUrl(inserted.file_path, 60 * 60)

  return NextResponse.json({ ...inserted, signedUrl: signed?.signedUrl })
}
