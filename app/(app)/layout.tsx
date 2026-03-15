import { AppSidebar } from '@/components/app-sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { AccountingProvider } from '@/components/accounting-provider'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountingProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <MobileNav />
        <main className="md:pl-64">
          <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AccountingProvider>
  )
}
