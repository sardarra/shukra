'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loggedIn && pathname !== '/signin') {
      router.replace('/signin')
    }
  }, [loggedIn, pathname, router])

  if (!loggedIn && pathname !== '/signin') return null
  return children
}

