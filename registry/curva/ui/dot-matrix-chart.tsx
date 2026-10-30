"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatNumber,
  labelStep,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import { ChartDescription, ChartTooltip } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type DotMatrixChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each column. */
  index: keyof T & string
  /** Key of the numeric value for each column. */
  value: keyof T & string
  /** Accessible name of the chart, also the series name in the tooltip. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  /** Dots in each column. */
  rows?: number
  formatValue?: (value: number) => string
  className?: string
  /** Called when the visitor points at, taps or arrows to a column. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const LABELS = 24
/** Columns fill bottom up, one after another, like a matrix display warming up. */
const FILL_COLUMN = 0.035
const FILL_ROW = 0.028
const POP = { type: "spring", stiffness: 520, damping: 24 } as const

export function DotMatrixChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  rows = 12,
  formatValue = formatNumber,
  className,
  onActiveChange,
}: DotMatrixChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Math.max(0, Number(d[value]) || 0))
  const peak = Math.max(1e-9, ...values)
  const n = data.length
  const levels = values.map((v) => (inView ? Math.round((v / peak) * rows) : 0))

  const plotHeight = Math.max(0, size.height - LABELS)
  const pitch = n > 0 ? Math.min(size.width / n, plotHeight / rows) : 0
  const radius = pitch * 0.32
  const left = (size.width - pitch * n) / 2
  const xOf = (k: number) => left + pitch * (k + 0.5)
  const yOf = (i: number) => plotHeight - pitch * (i + 0.5)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const capY = yOf(Math.max(0, (levels[shownIndex] ?? 1) - 1))
  const rightSide = xOf(shownIndex) + pitch / 2 + 8
  const tipLeft = rightSide + tip.width <= size.width ? rightSide : xOf(shownIndex) - pitch / 2 - 8 - tip.width
  const tipX = useFollow(clamp(tipLeft, 0, Math.max(0, size.width - tip.width)), fresh)
  const tipY = useFollow(clamp(capY - tip.height / 2, 0, Math.max(0, plotHeight - tip.height)), fresh)

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || n === 0 || pitch <= 0) return null
    return clamp(Math.floor((clientX - rect.left - left) / pitch), 0, n - 1)
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => select(null)}
      onPointerMove={(e) => select(indexAt(e.clientX))}
      onPointerDown={(e) => select(indexAt(e.clientX))}
      onPointerLeave={() => select(null)}
      className={cn(
        "relative h-64 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          {values.map((_, k) => {
            const level = levels[k]
            return (
              <motion.g
                key={k}
                initial={false}
                animate={{ opacity: activeIndex === null || activeIndex === k ? 1 : 0.4 }}
                transition={{ duration: 0.2 }}
              >
                {Array.from({ length: rows }, (_, i) => {
                  const cap = i === level - 1
                  const on = i < level
                  const delay = reduced
                    ? 0
                    : settled
                      ? k * 0.01 + Math.abs(i - level) * 0.02
                      : k * FILL_COLUMN + i * FILL_ROW
                  return (
                    <g key={i} transform={`translate(${xOf(k)} ${yOf(i)})`}>
                      <circle r={radius} style={{ fill: "color-mix(in oklab, var(--foreground) 8%, transparent)" }} />
                      <motion.circle
                        r={radius}
                        fill={color}
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{
                          opacity: on ? (cap ? 1 : 0.38) : 0,
                          scale: on ? (cap ? 1.15 : 1) : 0.3,
                        }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { opacity: { duration: 0.2, delay }, scale: { ...POP, delay } }
                        }
                      />
                    </g>
                  )
                })}
              </motion.g>
            )
          })}
          {labels.map((text, k) =>
            k % labelStep(n, size.width, 48) === 0 ? (
              <text
                key={k}
                x={xOf(k)}
                y={size.height - 6}
                textAnchor="middle"
                className={cn(
                  "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                  activeIndex === k && "fill-foreground"
                )}
              >
                {text}
              </text>
            ) : null
          )}
        </svg>
      )}

      <ChartTooltip
        ref={tipRef}
        title={labels[shownIndex] ?? ""}
        rows={[{ key: value, label, color, value: values[shownIndex] ?? 0 }]}
        active={activeIndex !== null}
        fresh={fresh}
        format={formatValue}
        style={{ x: tipX, y: tipY }}
      />

      <ChartDescription
        label={label}
        columns={[label]}
        rows={labels.map((text, k) => ({ label: text, values: [formatValue(values[k])] }))}
        live={activeIndex !== null ? `${labels[activeIndex]}: ${formatValue(values[activeIndex])}` : ""}
      />
    </div>
  )
}
