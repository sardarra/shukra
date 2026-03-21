import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { addAccount, ACCOUNTS } from '@/lib/accounting-types' 

// get userid from auth context and pass to addAccount when creating new accounts
const userId = getUserIdFromAuthContext();

function getUserIdFromAuthContext() {
  // Implement your logic to get the user ID from the auth context
  
  return 1; // Placeholder
}

// todo later: add accounts manually/ over time as needed
//var allAccounts: string[] = ["Cash", "Accounts Receivable", "Office Supplies", "Equipment", "Accounts Payable", "Notes Payable", "Bank Loan", "Owner\'s Capital", "Service Revenue", "Sales Revenue", "Rent Expense", "Utilities Expense", "Salaries Expense", "Office Supplies Expense"]

function accountsToString(){
  let result = ""
  for (let i = 0; i < ACCOUNTS.length; i++) {
    result += ACCOUNTS[i].name + ", ";
  }
  return result.slice(0, -2); // remove trailing comma and space
}

const transactionSchema = z.object({
  date: z.string().describe('The date of the transaction in YYYY-MM-DD format, use today if not specified'),
  description: z.string().describe('A clear, professional description of the transaction'),
  debitAccount: z.string().describe('The account to debit. Must be one of: ' + accountsToString()),
  debitAmount: z.number().describe('The amount to debit'),
  creditAccount: z.string().describe('The account to credit. Must be one of: ' + accountsToString()),
  creditAmount: z.number().describe('The amount to credit (should equal debit amount for double-entry)'),
  confidence: z.number().describe('Your confidence in the interpretation from 0 to 1'),
})

export async function POST(request: Request) {
  const { transaction, todayDate } = await request.json()

  const systemPrompt = `You are an expert accountant who converts plain English transaction descriptions into proper double-entry journal entries.

Rules:
1. Always use double-entry accounting: debits must equal credits
2. Use the following account names EXACTLY:
${accountsToString()}

3. Remember the accounting equation: Assets = Liabilities + Equity
4. Debits increase assets and expenses, decrease liabilities and equity
5. Credits decrease assets and expenses, increase liabilities and equity

Common patterns:
- "Received cash from client" = Debit Cash, Credit Service Revenue
- "Paid rent" = Debit Rent Expense, Credit Cash
- "Owner invested" = Debit Cash, Credit Owner's Capital
- "Received loan" = Debit Cash, Credit Bank Loan
- "Bought supplies" = Debit Office Supplies Expense, Credit Cash
- "Paid utilities" = Debit Utilities Expense, Credit Cash

Today's date is ${todayDate}. Use this date if no specific date is mentioned.

Set confidence based on how clear the transaction description is:
- 0.9-1.0: Very clear, unambiguous transaction
- 0.7-0.9: Reasonably clear but some interpretation needed
- 0.5-0.7: Ambiguous, multiple valid interpretations possible
- Below 0.5: Very unclear, mostly guessing

If the transaction involves an account not in the list, create a new account with a descriptive name and add it to the list of accounts.
`

  const { output } = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    output: Output.object({
      schema: transactionSchema,
    }),
    system: systemPrompt,
    prompt: `Parse this transaction into a journal entry: "${transaction}"`,
  })

  return Response.json(output)
}



const journalEntryInsertSchema = z.object({
  userId: z.number().int().nonnegative().nullable().optional(),
  debitAccount: z.string().min(1),
  debitAmount: z.number().positive(),
  creditAccount: z.string().min(1),
  creditAmount: z.number().positive(),
})

export type JournalEntryInsertInput = z.infer<typeof journalEntryInsertSchema>

// Inserts one journal entry row into Supabase with server auth context.
// also include user_id in parameters

export async function addJournalEntryToSupabase(input: JournalEntryInsertInput): Promise<{
  ok: boolean
  error: string | null
}> {
  const parsed = journalEntryInsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid journal entry payload' }
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('journalEntries').insert({
      created_at: new Date().toISOString(),
      debit_account: parsed.data.debitAccount,
      debit_amount: parsed.data.debitAmount,
      credit_account: parsed.data.creditAccount,
      credit_amount: parsed.data.creditAmount,
      user_id: parsed.data.userId ?? null,
    })

    if (error) {
      console.error('Failed inserting journalEntries row:', error)
      return { ok: false, error: 'Failed to persist journal entry' }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error('Unexpected insert failure in addJournalEntryToSupabase:', error)
    return { ok: false, error: 'Unexpected error while persisting journal entry' }
  }
}
