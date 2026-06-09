export const CUSTOMER_PHOTO_LIMIT = 20

type QueryClient = {
  from: (table: string) => {
    select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => QueryFilterBuilder
  }
}

type QueryResult = {
  data: unknown
  count: number | null
  error: { message: string } | null
}

type QueryFilterBuilder = PromiseLike<QueryResult> & {
  eq: (column: string, value: string) => QueryFilterBuilder
  in: (column: string, values: string[]) => QueryFilterBuilder
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
}

type IdRow = { id: string }
type EntitlementRow = { photo_upload_enabled: boolean | null }

export async function getPhotoUploadEnabled(supabase: unknown, userId: string) {
  const client = supabase as QueryClient
  const { data, error } = await client
    .from('user_profiles')
    .select('photo_upload_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { enabled: false, error }
  return { enabled: Boolean((data as EntitlementRow | null)?.photo_upload_enabled), error: null }
}

export async function getCustomerPhotoUsage(supabase: unknown, customerId: string) {
  const client = supabase as QueryClient
  const [{ data: visitRows, error: visitsError }, { data: sessionRows, error: sessionsError }] = await Promise.all([
    client.from('visits').select('id').eq('customer_id', customerId),
    client.from('planning_sessions').select('id').eq('customer_id', customerId),
  ])

  if (visitsError) return { count: 0, error: visitsError }
  if (sessionsError) return { count: 0, error: sessionsError }

  const visitIds = ((visitRows ?? []) as IdRow[]).map(row => row.id)
  const sessionIds = ((sessionRows ?? []) as IdRow[]).map(row => row.id)

  const visitPhotoCountPromise = visitIds.length
    ? client.from('visit_photos').select('id', { count: 'exact', head: true }).in('visit_id', visitIds)
    : Promise.resolve({ count: 0, error: null })

  const planningPhotoCountPromise = sessionIds.length
    ? client.from('planning_photos').select('id', { count: 'exact', head: true }).in('session_id', sessionIds)
    : Promise.resolve({ count: 0, error: null })

  const [{ count: visitPhotoCount, error: visitPhotosError }, { count: planningPhotoCount, error: planningPhotosError }] =
    await Promise.all([visitPhotoCountPromise, planningPhotoCountPromise])

  if (visitPhotosError) return { count: 0, error: visitPhotosError }
  if (planningPhotosError) return { count: 0, error: planningPhotosError }

  return {
    count: (visitPhotoCount ?? 0) + (planningPhotoCount ?? 0),
    error: null,
  }
}

export function canAddCustomerPhoto(currentCount: number) {
  return currentCount < CUSTOMER_PHOTO_LIMIT
}
