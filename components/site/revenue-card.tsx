"use client"

import * as React from "react"
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react"

import { revenue, type Range, type RevenuePoint } from "@/lib/demo-data"
import { cn } from "@/lib/utils"
import { AreaChart } from "@/registry/curva/ui/area-chart"

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
const formatCurrency = (v: number) => currency.format(v)

const ranges: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
]

export function RevenueCard() {
  const [range, setRange] = React.useState<Range>("week")
  const [hovered, setHovered] = React.useState<RevenuePoint | null>(null)
  const { data, delta, period } = revenue[range]
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.revenue, 0), [data])

  return (
    <div className="rounded-2xl border bg-card p-5 text-card-foreground shadow-sm shadow-black/[0.03] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {hovered ? `Revenue on ${hovered.label}` : "Total revenue"}
          </p>
          <Ticker
            value={hovered ? hovered.revenue : total}
            className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
          />
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">+{delta}%</span>{" "}
            vs {period}
          </p>
        </div>
        <Segmented value={range} onChange={setRange} />
      </div>

      <AreaChart
        data={data}
        index="label"
        value="revenue"
        label="Revenue"
        formatValue={formatCurrency}
        onActiveChange={setHovered}
        className="mt-6 h-64 sm:h-72"
      />
    </div>
  )
}

function Ticker({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const spring = useSpring(value, { stiffness: 140, damping: 24 })
  const text = useTransform(spring, (v) => formatCurrency(v))
  React.useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [spring, value, reduced])
  return <motion.span className={className}>{text}</motion.span>
}

function Segmented({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <div role="radiogroup" aria-label="Range" className="flex rounded-lg bg-muted p-1">
      {ranges.map((r) => {
        const selected = r.value === value
        return (
          <button
            key={r.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(r.value)}
            className={cn(
              "relative rounded-md px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId="range-pill"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{r.label}</span>
          </button>
        )
      })}
    </div>
  )
}
