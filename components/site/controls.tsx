"use client"

import * as React from "react"
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 text-card-foreground shadow-sm shadow-black/[0.03] sm:p-6",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Ticker({
  value,
  format,
  className,
}: {
  value: number
  format: (value: number) => string
  className?: string
}) {
  const reduced = useReducedMotion()
  const spring = useSpring(value, { stiffness: 140, damping: 24 })
  const text = useTransform(spring, (v) => format(v))
  React.useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [spring, value, reduced])
  return <motion.span className={className}>{text}</motion.span>
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const id = React.useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export const rangeOptions = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
export const formatCurrency = (v: number) => currency.format(v)

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
export const formatInteger = (v: number) => integer.format(v)
