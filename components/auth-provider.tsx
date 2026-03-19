'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type AuthContextValue = {
  isAuthReady: boolean
  session: Session | null
  user: User | null
  loggedIn: boolean
  signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setIsAuthReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsAuthReady(true)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    const loggedIn = Boolean(user)

    return {
      isAuthReady,
      session,
      user,
      loggedIn,
      signInWithPassword: async ({ email, password }) => {
        const supabase = createSupabaseBrowserClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        const supabase = createSupabaseBrowserClient()
        await supabase.auth.signOut()
      },
    }
  }, [isAuthReady, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

