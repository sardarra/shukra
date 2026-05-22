import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { ACCOUNTS } from '@/lib/accounting-types'

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
  plantAssetSpecificName: z
    .string()
    .nullable()
    .describe(
      'When purchasing plant property or equipment (debit Equipment or Prepaid Equipment), the short specific name of that asset only, e.g. "Delivery Truck" or "Office Copier". Otherwise the user must be asked for clarification.'
    ),
    
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
- "Bought a delivery truck for $25,000" = Debit Equipment, Credit Cash; set plantAssetSpecificName to "Delivery Truck"
- "Bought equipment (vaguely)" = Debit Equipment, Credit Cash; set plantAssetSpecificName to null and ask the user for clarification.

Today's date is ${todayDate}. Use this date if no specific date is mentioned.

For equipment or other depreciable plant asset purchases, always set plantAssetSpecificName to a concise asset label (not the full sentence description). If one is not provided (e.g., the user says "bought equipment") then follow up with a question to get the specific name.

Set confidence based on how clear the transaction description is:
- 0.9-1.0: Very clear, unambiguous transaction
- 0.7-0.9: Reasonably clear but some interpretation needed
- 0.5-0.7: Ambiguous, multiple valid interpretations possible
- Below 0.5: Very unclear, mostly guessing

If the transaction involves an account not in the list, create a new account with a descriptive name and add it to the list of accounts.

For further clarification, ask the user for the specific name and purchase date of the plant asset, with something like "What is the specific name of the equipment you bought?" and "What is the purchase date of the equipment you bought?"
`
//use claude haiku 4.5
  const { output } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    output: Output.object({
      schema: transactionSchema,
    }),
    system: systemPrompt,
    prompt: `Parse this transaction into a journal entry: "${transaction}"`,
  })

  return Response.json(output)
}
