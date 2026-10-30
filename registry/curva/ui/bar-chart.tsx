"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatCompact,
  formatNumber,
  frameOf,
  labelStep,
  niceDomain,
  seriesColor,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import {
  ChartDescription,
  ChartGrid,
  ChartTooltip,
  XAxis,
  YAxis,
  type TooltipRow,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type BarSeries<T extends Datum> = {
  /** Key of the numeric value for this series. */
  key: keyof T & string
  label: string
  /** Any CSS color. Defaults to the theme's chart colors in order. */
  color?: string
}

export type BarChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each column (x). */
  index: keyof T & string
  series: readonly BarSeries<T>[]
  /** Accessible name of the chart. */
  label: string
  /** Stack the series in one bar instead of placing them side by side. */
  stacked?: boolean
  /** Formats values in the tooltip and for screen readers. */
  formatValue?: (value: number) => string
  /** Formats the y-axis labels. */
  formatAxis?: (value: number) => string
  showXAxis?: boolean
  showYAxis?: boolean
  showGrid?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a column. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** Bars grow with a hint of overshoot, like something poured. */
const GROW = { type: "spring", stiffness: 240, damping: 24, mass: 0.9 } as const

/** Seconds the entrance wave takes to cross the chart, and to climb a stack. */
const ENTRANCE_WAVE = 0.5
const ENTRANCE_STACK = 0.12
const MORPH_WAVE = 0.16

const RADIUS = 4
const STACK_GAP = 2
const GROUP_GAP = 3
const MAX_GROUP = 64

type Bar = { key: string; x: number; y: number; width: number; height: number; color: string; delay: number }

export function BarChart<T extends Datum>({
  data,
  index,
  series,
  label,
  stacked = false,
  formatValue = formatNumber,
  formatAxis = formatCompact,
  showXAxis = true,
  showYAxis = true,
  showGrid = true,
  className,
  onActiveChange,
}: BarChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  // After the entrance, changes travel faster across the chart.
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1400)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const matrix = React.useMemo(
    () =>
      data.map((d) =>
        series.map((s) => {
          const v = Number(d[s.key]) || 0
          return stacked ? Math.max(0, v) : v
        })
      ),
    [data, series, stacked]
  )
  const totals = React.useMemo(() => matrix.map((row) => row.reduce((a, b) => a + b, 0)), [matrix])
  const domain = React.useMemo(
    () => niceDomain(stacked ? totals : matrix.flat()),
    [matrix, totals, stacked]
  )
  const colors = series.map((s, j) => s.color ?? seriesColor(j))

  const n = data.length
  const frame = frameOf(size.width, size.height, showXAxis, showYAxis)
  const band = n > 0 ? frame.w / n : 0
  const group = Math.min(band * 0.62, MAX_GROUP)
  const py = (v: number) => frame.top + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * frame.h
  const base = py(0)
  const centerOf = (k: number) => frame.left + band * (k + 0.5)
  // With an all-positive domain, bars run past the baseline and are clipped there,
  // so only their tops are rounded.
  const clipped = domain.lo === 0

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const barsOf = (k: number): Bar[] => {
    const u = n <= 1 ? 0 : k / (n - 1)
    const wave = u * (settled ? MORPH_WAVE : ENTRANCE_WAVE)
    const left = centerOf(k) - group / 2

    if (stacked) {
      let sum = 0
      return series.map((s, j) => {
        const lo = sum
        const hi = sum + matrix[k][j]
        sum = hi
        const bottom = lo === 0 ? base + (clipped ? RADIUS : 0) : py(lo) - STACK_GAP
        return {
          key: s.key,
          x: left,
          y: py(hi),
          width: group,
          height: Math.max(0, bottom - py(hi)),
          color: colors[j],
          delay: wave + (settled ? 0 : j * ENTRANCE_STACK),
        }
      })
    }

    const m = series.length
    const width = (group - (m - 1) * GROUP_GAP) / m
    return series.map((s, j) => {
      const v = matrix[k][j]
      const top = Math.min(py(v), base)
      const extra = clipped ? RADIUS : 0
      return {
        key: s.key,
        x: left + j * (width + GROUP_GAP),
        y: top,
        width: Math.max(0, width),
        height: Math.abs(py(v) - base) + extra,
        color: colors[j],
        delay: wave,
      }
    })
  }

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || frame.w <= 0 || n === 0) return 0
    return Math.min(n - 1, Math.floor(clamp((clientX - rect.left - frame.left) / frame.w, 0, 1) * n))
  }

  // The highlight band and the tooltip travel with the active column.
  const isActive = activeIndex !== null
  const peak = stacked ? (totals[shownIndex] ?? 0) : Math.max(0, ...(matrix[shownIndex] ?? [0]))
  const inset = Math.min(6, band * 0.08)
  const bandX = useFollow(centerOf(shownIndex) - band / 2 + inset, fresh)
  const rightSide = centerOf(shownIndex) + group / 2 + 10
  const tipLeft =
    rightSide + tip.width <= size.width ? rightSide : centerOf(shownIndex) - group / 2 - 10 - tip.width
  const tipX = useFollow(clamp(tipLeft, 0, Math.max(0, size.width - tip.width)), fresh)
  const tipY = useFollow(clamp(py(peak), 0, Math.max(0, frame.bottom - tip.height)), fresh)

  const rows: TooltipRow[] = series.map((s, j) => ({
    key: s.key,
    label: s.label,
    color: colors[j],
    value: matrix[shownIndex]?.[j] ?? 0,
  }))
  if (stacked) {
    rows.reverse()
    if (series.length > 1) rows.push({ key: "total", label: "Total", value: totals[shownIndex] ?? 0 })
  }

  const describe = (k: number) =>
    series.map((s, j) => `${s.label} ${formatValue(matrix[k][j])}`).join(", ") +
    (stacked && series.length > 1 ? `, total ${formatValue(totals[k])}` : "")

  const ticks = domain.ticks.map((t) => (inView ? t : 0))

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      tabIndex={0}
      onPointerMove={(e) => n > 0 && select(indexAt(e.clientX))}
      onPointerDown={(e) => n > 0 && select(indexAt(e.clientX))}
      onPointerLeave={() => select(null)}
      onKeyDown={onKeyDown}
      onBlur={() => select(null)}
      className={cn(
        "relative h-60 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0 overflow-visible"
          aria-hidden
        >
          <defs>
            <clipPath id={`${id}-plot`}>
              <rect x={0} y={0} width={size.width} height={Math.max(0, base)} />
            </clipPath>
          </defs>

          <motion.rect
            y={frame.top - 6}
            height={frame.h + 6}
            rx={8}
            width={Math.max(0, band - inset * 2)}
            style={{ x: bandX }}
            className="fill-foreground/[0.045]"
            initial={false}
            animate={{ opacity: isActive ? 1 : 0 }}
            transition={{ duration: 0.18 }}
          />

          {showGrid && <ChartGrid frame={frame} lines={ticks.length} />}
          {showYAxis && <YAxis ticks={ticks} frame={frame} format={formatAxis} />}

          <g clipPath={clipped ? `url(#${id}-plot)` : undefined}>
            <AnimatePresence>
              {data.map((_, k) => (
                <motion.g
                  key={k}
                  initial={false}
                  animate={{ opacity: activeIndex === null || activeIndex === k ? 1 : 0.38 }}
                  transition={{ duration: 0.2 }}
                >
                  <AnimatePresence>
                    {barsOf(k).map((bar) => (
                      <motion.rect
                        key={bar.key}
                        rx={RADIUS}
                        fill={bar.color}
                        initial={{ x: bar.x, width: bar.width, y: base, height: 0 }}
                        animate={
                          inView
                            ? { x: bar.x, width: bar.width, y: bar.y, height: bar.height }
                            : { x: bar.x, width: bar.width, y: base, height: 0 }
                        }
                        exit={{ y: base, height: 0, opacity: 0 }}
                        transition={reduced ? { duration: 0 } : { ...GROW, delay: bar.delay }}
                      />
                    ))}
                  </AnimatePresence>
                </motion.g>
              ))}
            </AnimatePresence>
          </g>

          {showXAxis && (
            <XAxis
              labels={labels}
              xOf={centerOf}
              y={size.height - 8}
              step={labelStep(n, frame.w)}
              activeIndex={activeIndex}
            />
          )}
        </svg>
      )}

      <ChartTooltip
        ref={tipRef}
        title={labels[shownIndex] ?? ""}
        rows={rows}
        active={isActive}
        fresh={fresh}
        format={formatValue}
        style={{ x: tipX, y: tipY }}
      />

      <ChartDescription
        label={label}
        columns={[...series.map((s) => s.label), ...(stacked && series.length > 1 ? ["Total"] : [])]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [
            ...matrix[k].map((v) => formatValue(v)),
            ...(stacked && series.length > 1 ? [formatValue(totals[k])] : []),
          ],
        }))}
        live={activeIndex !== null ? `${labels[activeIndex]}: ${describe(activeIndex)}` : ""}
      />
    </div>
  )
}
