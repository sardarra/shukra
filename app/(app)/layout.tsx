import { AppSidebar } from '@/components/app-sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { AccountingProvider } from '@/components/accounting-provider'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) redirect('/signin')
  } catch {
    // If Supabase isn't configured yet, don't crash the app shell.
    redirect('/signin')
  }

  return (
    <AccountingProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <MobileNav />
        <main className="md:pl-64">
          <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </AccountingProvider>
  )
}
