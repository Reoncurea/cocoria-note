import { NextResponse } from 'next/server'
import { CUSTOMER_PHOTO_LIMIT, getCustomerPhotoUsage, getPhotoUploadEnabled } from '@/lib/uploads/photo-usage'
import { requireAuth } from '@/lib/supabase/api-helpers'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .single()

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const [{ enabled, error: enabledError }, { count, error: usageError }] = await Promise.all([
    getPhotoUploadEnabled(supabase, user!.id),
    getCustomerPhotoUsage(supabase, id),
  ])

  if (enabledError || usageError) {
    return NextResponse.json({ error: 'Photo usage could not be loaded' }, { status: 500 })
  }

  return NextResponse.json({
    enabled,
    count,
    limit: CUSTOMER_PHOTO_LIMIT,
    remaining: Math.max(CUSTOMER_PHOTO_LIMIT - count, 0),
  })
}
