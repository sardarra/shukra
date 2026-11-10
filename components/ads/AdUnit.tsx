'use client'

import { useEffect, useRef } from 'react'

interface AdUnitProps {
  slot: string
  format?: string
  className?: string
  fullWidthResponsive?: boolean
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

/**
 * Renders a single AdSense ad unit.
 * The adsbygoogle.js loader is already included globally in app/layout.tsx.
 * Just drop <AdUnit slot="YOUR_SLOT_ID" /> wherever you want an ad.
 */
export function AdUnit({
  slot,
  format = 'auto',
  className,
  fullWidthResponsive = true,
}: AdUnitProps) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // adsbygoogle not ready yet
    }
  }, [])

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ''}`}
      style={{ display: 'block' }}
      data-ad-client="ca-pub-6735230075764523"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={String(fullWidthResponsive)}
    />
  )
}
