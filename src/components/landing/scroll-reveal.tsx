'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScrollRevealProps {
  children: React.ReactNode
  delay?: number          // ms delay before transition starts
  className?: string
  scale?: boolean         // also animate scale (for the mockup)
}

export function ScrollReveal({ children, delay = 0, className, scale = false }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setTimeout(() => setVisible(true), 0)
      return () => clearTimeout(id)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.12 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const transition = visible
    ? `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`
    : 'none'

  const transform = visible
    ? 'translateY(0) scale(1)'
    : `translateY(16px) ${scale ? 'scale(0.97)' : 'scale(1)'}`

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform,
        transition,
      }}
    >
      {children}
    </div>
  )
}
