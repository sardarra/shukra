'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type AuthContextValue = {
  loggedIn: boolean
  setLoggedIn: (value: boolean) => void
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

const STORAGE_KEY = 'shukra.loggedIn'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === 'true') setLoggedIn(true)
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(loggedIn))
    } catch {
      // ignore
    }
  }, [loggedIn])

  const value = useMemo<AuthContextValue>(() => {
    return {
      loggedIn,
      setLoggedIn,
      signIn: () => setLoggedIn(true),
      signOut: () => setLoggedIn(false),
    }
  }, [loggedIn])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

