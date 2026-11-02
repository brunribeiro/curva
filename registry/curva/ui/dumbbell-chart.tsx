"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  changeOf,
  formatNumber,
  niceSpan,
  useActivePoint,
  type Rising,
} from "@/registry/curva/lib/curva"
import { ChangeBadge, ChartDescription } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type DumbbellChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each row. */
  index: keyof T & string
  /** Key of the earlier value, drawn as a hollow dot. */
  from: keyof T & string
  /** Key of the later value, drawn as a filled dot. */
  to: keyof T & string
  /** Name of the earlier value, such as "Last week". */
  fromLabel: string
  /** Name of the later value, such as "This week". */
  toLabel: string
  /** Accessible name of the chart. */
  label: string
  /** Any CSS color for the later dot. Defaults to the theme's first chart color. */
  color?: string
  formatValue?: (value: number) => string
  /** Formats the axis labels. Defaults to `formatValue`. */
  formatAxis?: (value: number) => string
  /** The change at the end of each row. Defaults to the percent change. */
  formatChange?: (from: number, to: number) => string
  /** Whether a rise is good news; colors each row's connector and change. */
  rising?: Rising
  className?: string
  /** Called when the visitor points at, taps or arrows to a row. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** The later dot travels out from the earlier one, like time passing. */
const TRAVEL = { type: "spring", stiffness: 120, damping: 20 } as const
const MOVE = { type: "spring", stiffness: 260, damping: 30 } as const

const TONES = {
  good: "bg-emerald-500/50",
  bad: "bg-rose-500/50",
  neutral: "bg-muted-foreground/40",
}

export function DumbbellChart<T extends Datum>({
  data,
  index,
  from,
  to,
  fromLabel,
  toLabel,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  formatAxis,
  formatChange,
  rising = "good",
  className,
  onActiveChange,
}: DumbbellChartProps<T>) {
  const id = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1600)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const before = data.map((d) => Number(d[from]) || 0)
  const after = data.map((d) => Number(d[to]) || 0)
  const domain = niceSpan([...before, ...after])
  const at = (v: number) => ((v - domain.lo) / (domain.hi - domain.lo)) * 100
  const n = data.length

  const { activeIndex, select, onKeyDown } = useActivePoint(
    n,
    (k) => onActiveChange?.(k === null ? null : data[k], k),
    { vertical: true }
  )

  const toneOf = (k: number) => {
    const change = after[k] - before[k]
    if (rising === "neutral" || change === 0) return "neutral"
    return change > 0 === (rising === "good") ? "good" : "bad"
  }

  const describe = (k: number) =>
    `${labels[k]}: ${fromLabel} ${formatValue(before[k])}, ${toLabel} ${formatValue(after[k])}`

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
      <div aria-hidden className="mb-2 flex justify-end gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-muted-foreground/50" />
          {fromLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {toLabel}
        </span>
      </div>

      <div
        aria-hidden
        onPointerLeave={() => select(null)}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 select-none"
      >
        {/* Gridlines run behind every row. */}
        <div className="relative self-stretch" style={{ gridColumn: 2, gridRow: `1 / span ${n}` }}>
          {domain.ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 border-l border-dashed border-border"
              style={{ left: `${at(t)}%` }}
            />
          ))}
        </div>

        <AnimatePresence>
          {activeIndex !== null && (
            <motion.div
              layoutId={`${id}-row`}
              className="-mx-2 h-full rounded-md bg-muted/70"
              style={{ gridColumn: "1 / -1", gridRow: activeIndex + 1 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </AnimatePresence>

        {labels.map((text, k) => {
          const x1 = at(before[k])
          const x2 = at(after[k])
          const on = activeIndex === k
          const quiet = activeIndex !== null && !on
          const delay = settled ? 0 : 0.15 + k * 0.08
          const motionFor = reduced ? { duration: 0 } : settled ? MOVE : { ...TRAVEL, delay: delay + 0.2 }
          return (
            <React.Fragment key={text}>
              <span
                onPointerEnter={() => select(k)}
                onPointerDown={() => select(k)}
                className={cn(
                  "relative max-w-32 truncate py-3 text-sm transition-opacity duration-200",
                  quiet && "opacity-50"
                )}
                style={{ gridColumn: 1, gridRow: k + 1 }}
              >
                {text}
              </span>

              <div
                onPointerEnter={() => select(k)}
                onPointerDown={() => select(k)}
                className={cn("relative h-11 transition-opacity duration-200", quiet && "opacity-40")}
                style={{ gridColumn: 2, gridRow: k + 1 }}
              >
                <motion.span
                  className={cn("absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full", TONES[toneOf(k)])}
                  initial={{ left: `${x1}%`, width: "0%" }}
                  animate={
                    inView
                      ? { left: `${Math.min(x1, x2)}%`, width: `${Math.abs(x2 - x1)}%` }
                      : { left: `${x1}%`, width: "0%" }
                  }
                  transition={motionFor}
                />
                <motion.span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground/50 bg-card"
                  initial={{ left: `${x1}%`, scale: 0 }}
                  animate={{ left: `${x1}%`, scale: inView ? 1 : 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { left: MOVE, scale: { type: "spring", stiffness: 500, damping: 26, delay } }
                  }
                />
                <motion.span
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ background: color }}
                  initial={{ left: `${x1}%`, scale: 0 }}
                  animate={inView ? { left: `${x2}%`, scale: on ? 1.25 : 1 } : { left: `${x1}%`, scale: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { left: motionFor, scale: { type: "spring", stiffness: 500, damping: 26, delay: settled ? 0 : delay } }
                  }
                />
                <motion.span
                  className="pointer-events-none absolute top-0 -translate-x-1/2 text-[11px] leading-3 font-medium whitespace-nowrap tabular-nums"
                  style={{ left: `${x2}%` }}
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, y: on ? 0 : 3 }}
                  transition={{ duration: 0.16 }}
                >
                  {formatValue(after[k])}
                </motion.span>
                <motion.span
                  className="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[11px] leading-3 whitespace-nowrap text-muted-foreground tabular-nums"
                  style={{ left: `${x1}%` }}
                  initial={false}
                  animate={{ opacity: on ? 1 : 0, y: on ? 0 : -3 }}
                  transition={{ duration: 0.16 }}
                >
                  {formatValue(before[k])}
                </motion.span>
              </div>

              <motion.div
                className="relative text-right"
                style={{ gridColumn: 3, gridRow: k + 1 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? (quiet ? 0.5 : 1) : 0 }}
                transition={{ duration: 0.3, delay: settled || reduced ? 0 : delay + 0.6 }}
              >
                <ChangeBadge
                  change={changeOf(after[k], before[k])}
                  rising={rising}
                  text={formatChange?.(before[k], after[k])}
                />
              </motion.div>
            </React.Fragment>
          )
        })}

        <div className="relative mt-1 h-4" style={{ gridColumn: 2, gridRow: n + 1 }}>
          {domain.ticks.map((t, i) => (
            <span
              key={t}
              className={cn(
                "absolute text-[11px] text-muted-foreground tabular-nums",
                i === 0 ? "" : i === domain.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              )}
              style={{ left: `${at(t)}%` }}
            >
              {(formatAxis ?? formatValue)(t)}
            </span>
          ))}
        </div>
      </div>

      <ChartDescription
        label={label}
        columns={[fromLabel, toLabel]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [formatValue(before[k]), formatValue(after[k])],
        }))}
        live={activeIndex !== null ? describe(activeIndex) : ""}
      />
    </div>
  )
}
