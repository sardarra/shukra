import { getUsageForCurrentUser } from '@/lib/supabase/rate-limit'

export async function GET() {
  const result = await getUsageForCurrentUser()

  if (!result.ok) {
    if (result.status === 401) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json(
      { ok: false, error: 'Could not fetch usage data' },
      { status: result.status ?? 503 }
    )
  }

  return Response.json({ ok: true, remaining: result.remaining, resetAt: result.resetAt })
}
