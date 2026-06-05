'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/components/auth-provider'

export default function SignInPage() {
  const router = useRouter()
  const { signInWithPassword, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])
  const missingEnv = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_callback_failed') {
      setError('Sign in with Google failed. Please try again.')
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)

    try {
      if (missingEnv) {
        setError('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env and restart the dev server.')
        return
      }
      const result = await signInWithPassword({ email, password })
      if (result.error) {
        setError(result.error)
        return
      }
      router.replace('/')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onGoogleSignIn() {
    setIsGoogleSubmitting(true)
    setError(null)

    try {
      if (missingEnv) {
        setError('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env and restart the dev server.')
        return
      }
      const result = await signInWithGoogle()
      if (result.error) {
        setError(result.error)
      }
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your account to access your books.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error ? <div className="text-sm text-destructive">{error}</div> : null}

            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting || isGoogleSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>

            <div className="text-sm text-muted-foreground text-center">
              New here?{' '}
              <Link href="/signup" className="text-primary hover:underline">
                Create an account
              </Link>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={isSubmitting || isGoogleSubmitting}
            onClick={() => void onGoogleSignIn()}
          >
            {isGoogleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
