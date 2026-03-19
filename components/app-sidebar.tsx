'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Scale,
  TrendingUp,
  PieChart,
  LogOut,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Ledger', href: '/ledger', icon: FileText },
  { name: 'Trial Balance', href: '/trial-balance', icon: Scale },
  { name: 'Income Statement', href: '/income-statement', icon: TrendingUp },
  { name: 'Balance Sheet', href: '/balance-sheet', icon: PieChart },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-sidebar">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-6 border-b border-sidebar-border gap-3">
          <h1 className="text-xl font-semibold text-sidebar-foreground tracking-tight">Shukra</h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
            title={user?.email ?? 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
