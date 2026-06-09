import { NextRequest, NextResponse } from 'next/server'
import { createVisitPhotoPath, validatePhotoFile } from '@/lib/uploads/photos'
import {
  CUSTOMER_PHOTO_LIMIT,
  canAddCustomerPhoto,
  getCustomerPhotoUsage,
  getPhotoUploadEnabled,
} from '@/lib/uploads/photo-usage'
import { dbError, requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ visitId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { visitId } = await params
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

  const { enabled, error: enabledError } = await getPhotoUploadEnabled(supabase, user!.id)
  if (enabledError) return NextResponse.json({ error: '写真オプションの確認に失敗しました。' }, { status: 500 })
  if (!enabled) return NextResponse.json({ error: '写真アップロードはオプション機能です。' }, { status: 403 })

  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .select('id, customer_id')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) return dbError(visitError ?? { message: 'Visit not found' }, 404)

  const customerId = (visit as { customer_id: string }).customer_id
  const { count, error: usageError } = await getCustomerPhotoUsage(supabase, customerId)
  if (usageError) return NextResponse.json({ error: '写真枚数の確認に失敗しました。' }, { status: 500 })
  if (!canAddCustomerPhoto(count)) {
    return NextResponse.json({ error: `写真は1顧客につき${CUSTOMER_PHOTO_LIMIT}枚まで保存できます。` }, { status: 409 })
  }

  const { count: visitPhotoCount } = await supabase
    .from('visit_photos')
    .select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId)

  const filePath = createVisitPhotoPath(user!.id, visitId, file)
  const { error: uploadError } = await supabase.storage
    .from('visit-photos')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return dbError(uploadError)

  const { data: inserted, error: insertError } = await supabase
    .from('visit_photos')
    .insert({
      visit_id: visitId,
      user_id: user!.id,
      file_path: filePath,
      caption,
      sort_order: visitPhotoCount ?? 0,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    await supabase.storage.from('visit-photos').remove([filePath])
    return dbError(insertError ?? { message: 'Visit photo insert failed' })
  }

  const { data: signed } = await supabase.storage
    .from('visit-photos')
    .createSignedUrl(inserted.file_path, 60 * 60)

  return NextResponse.json({ ...inserted, signedUrl: signed?.signedUrl })
}
