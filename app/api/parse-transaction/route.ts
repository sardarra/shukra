import { generateText, Output } from 'ai'
import { z } from 'zod'

const transactionSchema = z.object({
  date: z.string().describe('The date of the transaction in YYYY-MM-DD format, use today if not specified'),
  description: z.string().describe('A clear, professional description of the transaction'),
  debitAccount: z.string().describe('The account to debit. Must be one of: Cash, Accounts Receivable, Office Supplies, Equipment, Accounts Payable, Notes Payable, Bank Loan, Owner\'s Capital, Service Revenue, Sales Revenue, Rent Expense, Utilities Expense, Salaries Expense, Office Supplies Expense'),
  debitAmount: z.number().describe('The amount to debit'),
  creditAccount: z.string().describe('The account to credit. Must be one of: Cash, Accounts Receivable, Office Supplies, Equipment, Accounts Payable, Notes Payable, Bank Loan, Owner\'s Capital, Service Revenue, Sales Revenue, Rent Expense, Utilities Expense, Salaries Expense, Office Supplies Expense'),
  creditAmount: z.number().describe('The amount to credit (should equal debit amount for double-entry)'),
  confidence: z.number().describe('Your confidence in the interpretation from 0 to 1'),
})

export async function POST(request: Request) {
  const { transaction, todayDate } = await request.json()

  const systemPrompt = `You are an expert accountant who converts plain English transaction descriptions into proper double-entry journal entries.

Rules:
1. Always use double-entry accounting: debits must equal credits
2. Use the following account names EXACTLY:
   - Assets: Cash, Accounts Receivable, Office Supplies, Equipment
   - Liabilities: Accounts Payable, Notes Payable, Bank Loan
   - Equity: Owner's Capital
   - Revenue: Service Revenue, Sales Revenue
   - Expenses: Rent Expense, Utilities Expense, Salaries Expense, Office Supplies Expense

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
- Below 0.5: Very unclear, mostly guessing`

  const { output } = await generateText({
    model: 'anthropic/claude-sonnet-4-20250514',
    output: Output.object({
      schema: transactionSchema,
    }),
    system: systemPrompt,
    prompt: `Parse this transaction into a journal entry: "${transaction}"`,
  })

  return Response.json(output)
}
