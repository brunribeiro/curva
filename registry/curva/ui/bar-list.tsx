"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { formatNumber, formatPercent, useActivePoint } from "@/registry/curva/lib/curva"
import { ChartDescription, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type BarListProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each row. Labels must be unique. */
  index: keyof T & string
  /** Key of the numeric value for each row. */
  value: keyof T & string
  /** Accessible name of the list. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  formatValue?: (value: number) => string
  /** Show each row's share of the total. */
  share?: boolean
  /** Rank rows from the largest value; when values change, rows trade places. */
  sort?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a row. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const GROW = { type: "spring", stiffness: 200, damping: 26 } as const
const REORDER = { type: "spring", stiffness: 380, damping: 36 } as const

export function BarList<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  share = false,
  sort = true,
  className,
  onActiveChange,
}: BarListProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1200)
    return () => clearTimeout(timer)
  }, [inView])

  const rows = React.useMemo(() => {
    const list = data.map((d, k) => ({
      datum: d,
      k,
      label: String(d[index]),
      value: Math.max(0, Number(d[value]) || 0),
    }))
    return sort ? [...list].sort((a, b) => b.value - a.value) : list
  }, [data, index, value, sort])
  const total = rows.reduce((a, r) => a + r.value, 0)
  const peak = Math.max(1e-9, ...rows.map((r) => r.value))
  const shareOf = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  const { activeIndex, select, onKeyDown } = useActivePoint(
    rows.length,
    (i) => onActiveChange?.(i === null ? null : rows[i].datum, i === null ? null : rows[i].k),
    { vertical: true }
  )

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => select(null)}
      className={cn(
        "w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <ul aria-hidden className="space-y-1" onPointerLeave={() => select(null)}>
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((row, i) => {
            const on = activeIndex === i
            const width = inView ? `${(row.value / peak) * 100}%` : "0%"
            return (
              <motion.li
                key={row.label}
                layout={reduced ? false : "position"}
                initial={{ opacity: 0 }}
                animate={{ opacity: activeIndex !== null && !on ? 0.5 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: REORDER, opacity: { duration: 0.2 } }}
                onPointerEnter={() => select(i)}
                onPointerDown={() => select(i)}
                className="flex h-9 items-center gap-3 text-sm select-none"
              >
                <span className="relative flex h-full min-w-0 flex-1 items-center">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-md transition-[background-color] duration-200"
                    style={{ backgroundColor: `color-mix(in oklab, ${color} ${on ? 30 : 15}%, transparent)` }}
                    initial={{ width: "0%" }}
                    animate={{ width }}
                    transition={reduced ? { duration: 0 } : { ...GROW, delay: settled ? 0 : 0.1 + i * 0.07 }}
                  >
                    {/* A solid edge marks where each bar ends. */}
                    <span className="absolute inset-y-2 right-0 w-0.5 rounded-full" style={{ background: color }} />
                  </motion.span>
                  <span className="relative truncate px-3">{row.label}</span>
                </span>
                <Count
                  value={inView ? row.value : 0}
                  format={formatValue}
                  instant={reduced}
                  className="relative font-medium tabular-nums"
                />
                {share && (
                  <Count
                    value={inView ? shareOf(row.value) : 0}
                    format={formatPercent}
                    instant={reduced}
                    className="relative w-9 text-right text-muted-foreground tabular-nums"
                  />
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      <ChartDescription
        label={label}
        columns={share ? ["Value", "Share"] : ["Value"]}
        rows={rows.map((row) => ({
          label: row.label,
          values: share
            ? [formatValue(row.value), formatPercent(shareOf(row.value))]
            : [formatValue(row.value)],
        }))}
        live={
          activeIndex !== null
            ? `${rows[activeIndex].label}: ${formatValue(rows[activeIndex].value)}` +
              (share ? `, ${formatPercent(shareOf(rows[activeIndex].value))}` : "")
            : ""
        }
      />
    </div>
  )
}
