"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  allocate,
  formatNumber,
  formatPercent,
  seriesColor,
  useActivePoint,
  useElementSize,
} from "@/registry/curva/lib/curva"
import { ChartDescription, ChartLegend } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type WaffleChartProps<T extends Datum> = {
  /** The parts of the whole, in order. */
  data: readonly T[]
  /** Key of the label for each part. Labels must be unique. */
  index: keyof T & string
  /** Key of the numeric value for each part. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Key of a CSS color for each part. Defaults to the theme's chart colors in order. */
  color?: keyof T & string
  /** Number of cells in the grid. */
  cells?: number
  /** Cells per row. */
  columns?: number
  formatValue?: (value: number) => string
  /** Show the legend beside the grid (below it in narrow containers). */
  legend?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a part. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const GAP = 3
/** Cells sweep in diagonally from the top left. */
const SWEEP_STEP = 0.022
const POP = { type: "spring", stiffness: 480, damping: 24 } as const

export function WaffleChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color,
  cells = 100,
  columns = 10,
  formatValue = formatNumber,
  legend = true,
  className,
  onActiveChange,
}: WaffleChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const grid = useElementSize(gridRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1600)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Math.max(0, Number(d[value]) || 0))
  const colors = data.map((d, k) => (color ? String(d[color]) : seriesColor(k)))
  const total = values.reduce((a, b) => a + b, 0)
  const share = (k: number) => (total > 0 ? (values[k] / total) * 100 : 0)

  const owner: number[] = []
  allocate(values, cells).forEach((count, k) => {
    for (let i = 0; i < count; i++) owner.push(k)
  })

  const rows = Math.ceil(cells / columns)
  const pitch = columns > 0 ? grid.width / columns : 0
  const cell = Math.max(0, pitch - GAP)

  const n = data.length
  const { activeIndex, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
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
        "@container w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <div className="flex flex-col items-center gap-6 @sm:flex-row @lg:gap-8">
        <div
          ref={gridRef}
          onPointerLeave={() => select(null)}
          className="relative w-full max-w-56 shrink-0 touch-pan-y select-none @sm:max-w-48 @lg:max-w-56"
          style={{ aspectRatio: `${columns} / ${rows}` }}
        >
          {grid.width > 0 && (
            <svg width={grid.width} height={grid.height} className="absolute inset-0 overflow-visible" aria-hidden>
              {Array.from({ length: cells }, (_, i) => {
                const r = Math.floor(i / columns)
                const c = i % columns
                return (
                  <rect
                    key={`track-${i}`}
                    x={c * pitch}
                    y={r * pitch}
                    width={cell}
                    height={cell}
                    rx={cell * 0.24}
                    style={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
                  />
                )
              })}
              <AnimatePresence initial={false}>
                {owner.map((k, i) => {
                  const r = Math.floor(i / columns)
                  const c = i % columns
                  const delay = reduced ? 0 : settled ? i * 0.004 : (r + c) * SWEEP_STEP
                  return (
                    <motion.rect
                      key={`${i}-${labels[k]}`}
                      x={c * pitch}
                      y={r * pitch}
                      width={cell}
                      height={cell}
                      rx={cell * 0.24}
                      fill={colors[k]}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: inView ? (activeIndex === k ? 1.08 : 1) : 0,
                        opacity: inView ? (activeIndex === null || activeIndex === k ? 1 : 0.22) : 0,
                      }}
                      exit={{ scale: 0, opacity: 0, transition: { duration: 0.16 } }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              scale: { ...POP, delay: activeIndex === null ? delay : 0 },
                              opacity: { duration: 0.2, delay: activeIndex === null ? delay : 0 },
                            }
                      }
                      onPointerEnter={() => select(k)}
                      onPointerDown={() => select(k)}
                    />
                  )
                })}
              </AnimatePresence>
            </svg>
          )}
        </div>

        {legend && (
          <ChartLegend
            rows={labels.map((text, k) => ({
              key: text,
              label: text,
              color: colors[k],
              value: values[k],
              format: formatValue,
              percent: share(k),
            }))}
            activeIndex={activeIndex}
            onSelect={select}
          />
        )}
      </div>

      <ChartDescription
        label={label}
        columns={["Value", "Share"]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [formatValue(values[k]), formatPercent(share(k))],
        }))}
        live={
          activeIndex !== null
            ? `${labels[activeIndex]}: ${formatValue(values[activeIndex])}, ${formatPercent(share(activeIndex))}`
            : ""
        }
      />
    </div>
  )
}
