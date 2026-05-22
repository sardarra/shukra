import { generateText, Output } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { ACCOUNTS } from '@/lib/accounting-types'

function accountsToString() {
  let result = ''
  for (let i = 0; i < ACCOUNTS.length; i++) {
    result += ACCOUNTS[i].name + ', '
  }
  return result.slice(0, -2)
}

const transactionSchema = z.object({
  date: z
    .string()
    .describe(
      'Purchase/transaction date in YYYY-MM-DD. For plant asset purchases, only use today if the user clearly means today; otherwise leave uncertain and ask.'
    ),
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
      'When debiting Equipment or Prepaid Equipment: short asset label only (e.g. "Delivery Truck"). Null if the user did not give a specific name.'
    ),
  plantAssetDetailsComplete: z
    .boolean()
    .describe(
      'True if this is NOT a plant/equipment purchase, OR the user clearly provided BOTH a specific asset name AND an explicit purchase date. False if either is missing.'
    ),
  messageToUser: z
    .string()
    .nullable()
    .describe(
      'When plantAssetDetailsComplete is false, ask the user specifically for the missing plant asset name and/or purchase date. Use direct questions. Null when no clarification is needed.'
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
- "Bought a delivery truck for $25,000 on 2024-06-01" = Debit Equipment, Credit Cash; plantAssetSpecificName "Delivery Truck"; plantAssetDetailsComplete true; messageToUser null
- "Bought equipment for $5,000" = Debit Equipment, Credit Cash; plantAssetSpecificName null; plantAssetDetailsComplete false; messageToUser MUST ask for name and purchase date

Today's date is ${todayDate}. For non-plant transactions, use this date when no date is mentioned.

PLANT ASSET / EQUIPMENT PURCHASES (debit Equipment or Prepaid Equipment):
- plantAssetSpecificName: concise label ONLY if the user named the asset; otherwise null
- plantAssetDetailsComplete: false unless BOTH (a) a specific asset name and (b) an explicit purchase date appear in the user's text (not guessed)
- When plantAssetDetailsComplete is false:
  - Set confidence below 0.8
  - Set messageToUser to ask ONLY for what is missing, using clear direct questions, for example:
    "What is the specific name of the plant asset or equipment you purchased?"
    "What was the purchase date of the equipment? (Please use YYYY-MM-DD.)"
  - If both are missing, ask for BOTH in messageToUser (two short questions or numbered list)
  - Do NOT use a generic "I'm not sure about this transaction" message for plant assets—always ask about name and/or purchase date
- When plantAssetDetailsComplete is true: messageToUser must be null

Set confidence for other transactions:
- 0.9-1.0: Very clear, unambiguous transaction
- 0.7-0.9: Reasonably clear but some interpretation needed
- 0.5-0.7: Ambiguous, multiple valid interpretations possible
- Below 0.5: Very unclear, mostly guessing

If the transaction involves an account not in the list, create a new account with a descriptive name and add it to the list of accounts.
`

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
