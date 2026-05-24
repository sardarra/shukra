import type { Ledger, PlantAsset } from './accounting-types'
import { calculateBalanceSheet, calculateIncomeStatement } from './accounting-store'
import * as XLSX from 'xlsx'



export function exportBalanceSheetToXlsx(ledgers: Ledger[], plantAssets: PlantAsset[] = []) {
  const incomeStatement = calculateIncomeStatement(ledgers)
  const balanceSheet = calculateBalanceSheet(ledgers, incomeStatement.netIncome, plantAssets)
  const workbook = XLSX.utils.book_new()
  let worksheet = XLSX.utils.json_to_sheet(balanceSheet.assets)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets')
  worksheet = XLSX.utils.json_to_sheet(balanceSheet.liabilities)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Liabilities')
  worksheet = XLSX.utils.json_to_sheet(balanceSheet.equity)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Equity')
  worksheet = XLSX.utils.json_to_sheet(incomeStatement.revenues)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenues')
  worksheet = XLSX.utils.json_to_sheet(incomeStatement.expenses)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses')
  XLSX.writeFile(workbook, 'balance-sheet-export.xlsx')
}

export function exportIncomeStatementToXlsx(ledgers: Ledger[]) {
  // #region agent log
  fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
    body: JSON.stringify({
      sessionId: '2cb0ce',
      hypothesisId: 'C',
      location: 'export-to-xlsx.tsx:exportIncomeStatementToXlsx:entry',
      message: 'export income statement called',
      data: {
        ledgerCount: ledgers.length,
        revenueLedgers: ledgers.filter((l) => l.accountType === 'revenue').length,
        expenseLedgers: ledgers.filter((l) => l.accountType === 'expense').length,
        writeFileType: typeof XLSX.writeFile,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  try {
    const incomeStatement = calculateIncomeStatement(ledgers)

    // #region agent log
    fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
      body: JSON.stringify({
        sessionId: '2cb0ce',
        hypothesisId: 'B',
        location: 'export-to-xlsx.tsx:exportIncomeStatementToXlsx:computed',
        message: 'income statement computed',
        data: {
          revenueRows: incomeStatement.revenues.length,
          expenseRows: incomeStatement.expenses.length,
          totalRevenue: incomeStatement.totalRevenue,
          totalExpenses: incomeStatement.totalExpenses,
          netIncome: incomeStatement.netIncome,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    const workbook = XLSX.utils.book_new()

    let worksheet = XLSX.utils.json_to_sheet(incomeStatement.revenues)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenues')

    worksheet = XLSX.utils.json_to_sheet(incomeStatement.expenses)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses')

    const summary = [
      { Label: 'Total Revenue', Amount: incomeStatement.revenues.reduce((sum, r) => sum + (r.amount ?? 0), 0) },
      { Label: 'Total Expenses', Amount: incomeStatement.expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0) },
      { Label: 'Net Income', Amount: incomeStatement.netIncome },
    ]
    worksheet = XLSX.utils.json_to_sheet(summary)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary')

    // #region agent log
    fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
      body: JSON.stringify({
        sessionId: '2cb0ce',
        hypothesisId: 'A',
        location: 'export-to-xlsx.tsx:exportIncomeStatementToXlsx:beforeWrite',
        message: 'about to writeFile',
        data: { sheetNames: workbook.SheetNames },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    XLSX.writeFile(workbook, 'income-statement-export.xlsx')

    // #region agent log
    fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
      body: JSON.stringify({
        sessionId: '2cb0ce',
        hypothesisId: 'A',
        location: 'export-to-xlsx.tsx:exportIncomeStatementToXlsx:success',
        message: 'writeFile completed',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
      body: JSON.stringify({
        sessionId: '2cb0ce',
        hypothesisId: 'D',
        location: 'export-to-xlsx.tsx:exportIncomeStatementToXlsx:error',
        message: 'export failed',
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    throw err
  }
}