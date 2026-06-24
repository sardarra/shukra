'use client'

import { useAccounting } from './accounting-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounting-store'
import { TrendingUp, TrendingDown, DollarSign, Scale, PieChart } from 'lucide-react'
import { PieChartAssets } from './ui/piechart'
import  Script  from 'next/script'

export function DashboardStats() {
  const { incomeStatement, balanceSheet, journalEntries, trialBalance } = useAccounting()

  const totalDebits = trialBalance.reduce((sum, row) => sum + row.debit, 0)
  const totalCredits = trialBalance.reduce((sum, row) => sum + row.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  const cash = balanceSheet.assets.find(asset => asset.account === 'Cash')
  const cashBalance = cash ? cash.amount : 0;
  const stats = [
    {
      title: 'Net Income',
      value: formatCurrency(incomeStatement.netIncome),
      icon: incomeStatement.netIncome >= 0 ? TrendingUp : TrendingDown,
      description: incomeStatement.netIncome >= 0 ? 'Profit' : 'Loss',
      trend: incomeStatement.netIncome >= 0 ? 'positive' : 'negative',
    },

    {
      title: 'Cash',
      value: formatCurrency(cashBalance),
      icon: DollarSign,
      description: 'On hand',
      trend: 'neutral',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(incomeStatement.totalRevenue),
      icon: TrendingUp,
      description: `${incomeStatement.revenues.length} source${incomeStatement.revenues.length !== 1 ? 's' : ''}`,
      trend: 'positive',
    },
    {
      title: 'Trial Balance',
      value: isBalanced ? 'Balanced' : 'Unbalanced',
      icon: Scale,
      description: `${journalEntries.length} entries`,
      trend: isBalanced ? 'positive' : 'negative',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon
              className={`h-4 w-4 ${
                stat.trend === 'positive'
                  ? 'text-success'
                  : stat.trend === 'negative'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="col-span-full md:col-span-2 lg:col-span-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">
            Assets
          </CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent className="pt-0">
          <PieChartAssets />
        </CardContent>
      </Card>
      <Card className="col-span-full md:col-span-2 lg:col-span-4">
        {/** TODO: add an ad here */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold text-foreground">
            Advertisement
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>

        <Script 
          async 
          src={"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6735230075764523"}
          crossOrigin="anonymous">

        </Script>

        <ins className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-6735230075764523"
          data-ad-slot="8448194599"
          data-ad-format="auto"
          data-full-width-responsive="true">
        </ins>
        <Script>
          (adsbygoogle = window.adsbygoogle || []).push({});
        </Script>

      </Card>
      
    </div>
  )
}
