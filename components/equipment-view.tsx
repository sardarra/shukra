'use client'

import { useAccounting } from './accounting-provider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/accounting-store'
import { plantAssetLabel } from '@/lib/depreciation'
import { Trash2 } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

export function EquipmentView() {
  const { plantAssets, deletePlantAsset } = useAccounting()

  const sortedAssets = [...plantAssets].sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
  )

  if (plantAssets.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No equipment on record</EmptyTitle>
          <EmptyDescription>
            Record an equipment or prepaid equipment purchase from the Dashboard to see assets
            here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Asset</TableHead>
            <TableHead className="font-semibold">Account</TableHead>
            <TableHead className="font-semibold">Purchase date</TableHead>
            <TableHead className="font-semibold text-right">Cost</TableHead>
            <TableHead className="font-semibold text-right">Salvage</TableHead>
            <TableHead className="font-semibold text-right">Useful life</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAssets.map((asset) => (
            <TableRow key={asset.id} className="group">
              <TableCell className="font-medium max-w-[200px] truncate">
                {plantAssetLabel(asset)}
              </TableCell>
              <TableCell>{asset.account}</TableCell>
              <TableCell className="font-mono text-sm">
                {new Date(asset.purchaseDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(asset.cost)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(asset.salvageValue)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {asset.usefulLifeYears} yr
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => void deletePlantAsset(asset.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete equipment</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
