'use client'

import { useAccounting } from "@/components/accounting-provider"
import { Button } from '@/components/ui/button'
import { exportIncomeStatementToXlsx } from '@/lib/export-to-xlsx'

export function IncomeStatementExportButton(){

    const {ledgers} = useAccounting();


    function handleDownload(): void {
        // #region agent log
        fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
            body: JSON.stringify({
                sessionId: '2cb0ce',
                hypothesisId: 'E',
                location: 'income-statement-export-button.tsx:handleDownload',
                message: 'export button clicked',
                data: { ledgerCount: ledgers?.length ?? -1 },
                timestamp: Date.now(),
            }),
        }).catch(() => {})
        // #endregion
        try {
            exportIncomeStatementToXlsx(ledgers)
        } catch (err) {
            // #region agent log
            fetch('http://127.0.0.1:7709/ingest/f40f776f-254e-49db-9528-88929ba71b5f', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2cb0ce' },
                body: JSON.stringify({
                    sessionId: '2cb0ce',
                    hypothesisId: 'D',
                    location: 'income-statement-export-button.tsx:handleDownload:catch',
                    message: 'button handler caught error',
                    data: { error: err instanceof Error ? err.message : String(err) },
                    timestamp: Date.now(),
                }),
            }).catch(() => {})
            // #endregion
            console.error(err)
        }
    }
    return (
        <Button onClick={handleDownload}>Export to Excel</Button>
    )
}