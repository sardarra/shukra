import { z } from 'zod'
import { syncDepreciationForCurrentUser } from '@/lib/supabase/depreciation'
import {
  addJournalEntryToSupabase,
  getJournalEntriesByUserId,
} from '@/lib/supabase/journal-entries'

const persistJournalEntrySchema = z.object({
  description: z.string(),
  debitAccount: z.string().min(1),
  debitAmount: z.number().positive(),
  creditAccount: z.string().min(1),
  creditAmount: z.number().positive(),
})

export async function POST(request: Request) {
  const payload = await request.json()
  const parsed = persistJournalEntrySchema.safeParse(payload)

  if (!parsed.success) {
    return Response.json(
      { ok: false, error: 'Invalid request payload' },
      { status: 400 }
    )
  }

  const result = await addJournalEntryToSupabase(parsed.data)
  if (!result.ok) {
    const status = result.error === 'Unauthorized' ? 401 : 500
    return Response.json(result, { status })
  }

  return Response.json(result)
}

export async function GET() {
  await syncDepreciationForCurrentUser()
  const result = await getJournalEntriesByUserId()
  if (!result.ok) {
    const status = result.error === 'Unauthorized' ? 401 : 500
    return Response.json(
      { ok: false, error: result.error, entries: [] },
      { status }
    )
  }

  return Response.json({ ok: true, error: null, entries: result.entries })
}
