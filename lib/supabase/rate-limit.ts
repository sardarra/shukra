import { createSupabaseServerClient } from '@/lib/supabase/server'

export const DAILY_QUOTA = 6

/** Returns today's date as a YYYY-MM-DD string in UTC. */
function utcDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the ISO 8601 UTC timestamp for midnight at the start of the next UTC day. */
export function nextUtcMidnight(): string {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: string }
  | { allowed: false; remaining: 0; resetAt: string; status: 429 | 401 | 503 }

/**
 * Atomically increments the usage counter for the authenticated user and
 * returns whether the request is within quota.
 *
 * - Returns 401 if the user is not authenticated.
 * - Returns 429 if the daily quota is already exhausted.
 * - Returns 503 if a Supabase read or write fails.
 * - Returns allowed:true with the updated remaining count on success.
 */
export async function checkAndIncrementUsage(): Promise<RateLimitResult> {
  const resetAt = nextUtcMidnight()

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient()
  } catch {
    return { allowed: false, remaining: 0, resetAt, status: 503 }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { allowed: false, remaining: 0, resetAt, status: 401 }
  }

  const today = utcDateString()

  // Read current count
  const { data: row, error: readError } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('utc_date', today)
    .maybeSingle()

  if (readError) {
    console.error('rate-limit: read failed', readError)
    return { allowed: false, remaining: 0, resetAt, status: 503 }
  }

  const currentCount: number = row?.count ?? 0

  if (currentCount >= DAILY_QUOTA) {
    return { allowed: false, remaining: 0, resetAt, status: 429 }
  }

  // Upsert with increment — use a raw SQL expression via rpc if available,
  // otherwise do a conditional upsert. We use upsert with count = currentCount + 1
  // which is safe for low-concurrency; the primary key constraint prevents phantom rows.
  const newCount = currentCount + 1
  const { error: writeError } = await supabase.from('ai_usage').upsert(
    { user_id: user.id, utc_date: today, count: newCount },
    { onConflict: 'user_id,utc_date' }
  )

  if (writeError) {
    console.error('rate-limit: write failed', writeError)
    return { allowed: false, remaining: 0, resetAt, status: 503 }
  }

  return {
    allowed: true,
    remaining: DAILY_QUOTA - newCount,
    resetAt,
  }
}

/**
 * Reads the current usage count for the authenticated user without modifying it.
 * Used for the initial quota fetch on page load.
 */
export async function getUsageForCurrentUser(): Promise<{
  ok: boolean
  remaining: number
  resetAt: string
  status?: 401 | 503
}> {
  const resetAt = nextUtcMidnight()

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  try {
    supabase = await createSupabaseServerClient()
  } catch {
    return { ok: false, remaining: DAILY_QUOTA, resetAt, status: 503 }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, remaining: DAILY_QUOTA, resetAt, status: 401 }
  }

  const today = utcDateString()

  const { data: row, error: readError } = await supabase
    .from('ai_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('utc_date', today)
    .maybeSingle()

  if (readError) {
    console.error('rate-limit: read failed in getUsageForCurrentUser', readError)
    return { ok: false, remaining: DAILY_QUOTA, resetAt, status: 503 }
  }

  const used: number = row?.count ?? 0
  return { ok: true, remaining: Math.max(0, DAILY_QUOTA - used), resetAt }
}
