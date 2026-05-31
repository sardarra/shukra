import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/'

  if (!next.startsWith('/')) {
    next = '/'
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
