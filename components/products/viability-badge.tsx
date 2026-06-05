import { cn } from '@/lib/utils'
import type { ViabilityStatus } from '@/lib/accounting-types'

interface ViabilityBadgeProps {
  status: ViabilityStatus
  className?: string
}

const statusConfig: Record<
  ViabilityStatus,
  { bg: string; text: string; label: string }
> = {
  Profitable: {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-800 dark:text-green-200',
    label: 'Profitable',
  },
  'Break-Even': {
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Break-Even',
  },
  Unprofitable: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-800 dark:text-red-200',
    label: 'Unprofitable',
  },
}

/**
 * Color-coded badge that surfaces a product's viability status.
 *
 * WCAG 2.1 AA: color is never the sole indicator — the text label is always
 * rendered alongside the background color, so the component remains
 * distinguishable in grayscale and for users with color-vision deficiencies.
 */
export function ViabilityBadge({ status, className }: ViabilityBadgeProps) {
  const { bg, text, label } = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        bg,
        text,
        className
      )}
      aria-label={`Viability status: ${label}`}
    >
      {label}
    </span>
  )
}
