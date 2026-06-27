import { Mail, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">App information and contact details.</p>
      </div>

      <Separator />

      {/* About */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">About Shukra</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {/* TODO: fill in your about text */}
            Shukra is a vibe accounting tool that lets you record transactions in plain English and
            handles the bookkeeping for you.
          </p>
          <p>
            {/* TODO: version, release notes link, etc. */}
          </p>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {/* TODO: fill in contact details */}
            Have a question or feedback? Reach out at{' '}
            <a
              href="mailto:hello@example.com"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              hello@example.com
            </a>
          </p>
          <p>
            {/* TODO: social links, support URL, etc. */}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
