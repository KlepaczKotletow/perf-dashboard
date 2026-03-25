'use client'

import { useState } from 'react'
import { Menu, X, Slack } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileNavProps {
  signInUrl: string
  addToSlackUrl: string
}

export function MobileNav({ signInUrl, addToSlackUrl }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 bg-white border-b border-border/60 shadow-lg z-50">
          <nav className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-3">
            <a href="#features" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Features</a>
            <a href="#goals" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Goals</a>
            <a href="#analytics" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Analytics</a>
            <a href="#pricing" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Pricing</a>
            <div className="border-t border-border/60 pt-3 mt-1 flex flex-col gap-2">
              <a href={signInUrl} className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Sign in with Slack</a>
              <Button size="sm" className="w-full" asChild>
                <a href={addToSlackUrl}>
                  <Slack className="h-3.5 w-3.5 mr-1" />
                  Add to Slack
                </a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
