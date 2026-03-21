import { z } from 'zod'
import { addJournalEntryToSupabase } from '@/app/api/parse-transaction/route'

const persistJournalEntrySchema = z.object({
  userId: z.number().int().nonnegative().nullable().optional(),
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
    return Response.json(result, { status: 500 })
  }

  return Response.json(result)
}
