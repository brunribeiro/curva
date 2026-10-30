"use client"

import * as React from "react"
import { area as d3Area, curveBumpX } from "d3-shape"
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatNumber,
  seriesColor,
  springEase,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import {
  ChartDescription,
  ChartTooltip,
  Count,
  type TooltipRow,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type FlowSeries<T extends Datum> = {
  /** Key of the numeric value for this band. */
  key: keyof T & string
  label: string
  /** Any CSS color. Defaults to the theme's chart colors in order. */
  color?: string
}

export type FlowChartProps<T extends Datum> = {
  /** The stages the bands flow through, left to right. */
  data: readonly T[]
  /** Key of the label for each stage. */
  index: keyof T & string
  /** The bands, top to bottom. */
  series: readonly FlowSeries<T>[]
  /** Accessible name of the chart. */
  label: string
  formatValue?: (value: number) => string
  className?: string
  /** Called when the visitor points at, taps or arrows to a stage. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const LABELS = 24
const TOP = 8
/** How much of the width the stages span, after the lead-in on the left. */
const STAGE_START = 0.2
const STAGE_SPAN = 0.74
/** The bands narrow to this share of the first stage as they come in from the left edge. */
const LEAD = 0.3
const FLOW_IN = 1.4
const MORPH = { duration: 0.9, stagger: 0.2 }

type Band = [number, number][]
type Point = [number, number, number]

const AREA = d3Area<Point>()
  .x((d) => d[0])
  .y0((d) => d[1])
  .y1((d) => d[2])
  .curve(curveBumpX)

/** Stacks each stage around the middle; values are in units of the plot height. */
function layoutOf(matrix: readonly number[][], bands: number): Band[] {
  const n = matrix.length
  if (n === 0) return Array.from({ length: bands }, () => [])
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const scale = 0.92 / Math.max(1e-9, ...totals)
  const stages = matrix.map((row, k) => {
    let y = (-totals[k] * scale) / 2
    return row.map((v): [number, number] => {
      const y0 = y
      y += v * scale
      return [y0, y]
    })
  })
  return Array.from({ length: bands }, (_, j) => [
    [stages[0][j][0] * LEAD, stages[0][j][1] * LEAD],
    ...stages.map((stage) => stage[j]),
    stages[n - 1][j],
  ])
}

export function FlowChart<T extends Datum>({
  data,
  index,
  series,
  label,
  formatValue = formatNumber,
  className,
  onActiveChange,
}: FlowChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false
  const [band, setBand] = React.useState<string | null>(null)

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), FLOW_IN * 1000 + 200)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const colors = series.map((s, j) => s.color ?? seriesColor(j))
  const keys = series.map((s) => s.key as string)
  const matrix = React.useMemo(
    () => data.map((d) => series.map((s) => Math.max(0, Number(d[s.key]) || 0))),
    [data, series]
  )
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const target = React.useMemo(() => layoutOf(matrix, series.length), [matrix, series.length])

  const n = data.length
  const plotBottom = Math.max(TOP, size.height - LABELS)
  const mid = (TOP + plotBottom) / 2
  const span = plotBottom - TOP
  const stageX = (k: number) =>
    size.width * (n <= 1 ? STAGE_START + STAGE_SPAN / 2 : STAGE_START + (k / (n - 1)) * STAGE_SPAN)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  // Bands are painted straight into their paths, outside React renders.
  const paths = React.useRef(new Map<string, SVGPathElement>())
  const progress = useMotionValue(1)
  const shape = React.useRef({ keys: [] as string[], from: [] as Band[], to: [] as Band[] })
  const geometry = React.useRef({ width: 0, mid: 0, span: 0, xs: [] as number[] })

  const paint = React.useCallback(() => {
    const { width, mid: m, span: s, xs } = geometry.current
    if (width <= 0) return
    const { keys: bandKeys, from, to } = shape.current
    const p = progress.get()
    const last = xs.length - 1
    bandKeys.forEach((key, j) => {
      const el = paths.current.get(key)
      if (!el || !to[j]) return
      const points = to[j].map(([b0, b1], i): Point => {
        const [a0, a1] = from[j]?.[i] ?? [b0, b1]
        const e = springEase((p - (i / Math.max(1, last)) * MORPH.stagger) / (1 - MORPH.stagger))
        return [xs[i], m + (a0 + (b0 - a0) * e) * s, m + (a1 + (b1 - a1) * e) * s]
      })
      el.setAttribute("d", AREA(points) ?? "")
    })
  }, [progress])

  useMotionValueEvent(progress, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = {
      width: size.width,
      mid,
      span,
      xs: [0, ...Array.from({ length: n }, (_, k) => stageX(k)), size.width],
    }
    paint()
  })

  // New data morphs from what's on screen; a new set of bands or stages simply swaps in.
  React.useLayoutEffect(() => {
    const s = shape.current
    const sameShape =
      s.keys.join("|") === keys.join("|") && s.to[0]?.length === target[0]?.length
    if (!settled || !sameShape || reduced) {
      shape.current = { keys, from: target, to: target }
      progress.jump(1)
      paint()
      return
    }
    const p = progress.get()
    const last = Math.max(1, (s.to[0]?.length ?? 1) - 1)
    const current = s.to.map((bandPoints, j) =>
      bandPoints.map(([b0, b1], i): [number, number] => {
        const [a0, a1] = s.from[j]?.[i] ?? [b0, b1]
        const e = springEase((p - (i / last) * MORPH.stagger) / (1 - MORPH.stagger))
        return [a0 + (b0 - a0) * e, a1 + (b1 - a1) * e]
      })
    )
    shape.current = { keys, from: current, to: target }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
    // keys is derived from series; target covers both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, settled, reduced, paint, progress])

  const stageAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return null
    const x = clientX - rect.left
    let best = 0
    for (let k = 1; k < n; k++) if (Math.abs(stageX(k) - x) < Math.abs(stageX(best) - x)) best = k
    return best
  }

  const shownX = stageX(shownIndex)
  const rightSide = shownX + 14
  const tipLeft = rightSide + tip.width <= size.width ? rightSide : shownX - 14 - tip.width
  const tipX = useFollow(clamp(tipLeft, 0, Math.max(0, size.width - tip.width)), fresh)
  const tipY = useFollow(TOP + 4, fresh)

  const rows: TooltipRow[] = series.map((s, j) => ({
    key: s.key,
    label: s.label,
    color: colors[j],
    value: matrix[shownIndex]?.[j] ?? 0,
  }))
  if (series.length > 1) rows.push({ key: "total", label: "Total", value: totals[shownIndex] ?? 0 })

  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => select(null)}
      onPointerMove={(e) => select(stageAt(e.clientX))}
      onPointerDown={(e) => select(stageAt(e.clientX))}
      onPointerLeave={() => {
        select(null)
        setBand(null)
      }}
      className={cn(
        "relative h-72 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            {colors.map((c, j) => (
              <linearGradient key={j} id={`${id}-band-${j}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: c, stopOpacity: 0 }} />
                <stop offset={`${STAGE_START * 100}%`} style={{ stopColor: c, stopOpacity: 0.85 }} />
                <stop offset="100%" style={{ stopColor: c, stopOpacity: 1 }} />
              </linearGradient>
            ))}
            <clipPath id={`${id}-flow`}>
              <motion.rect
                x={0}
                y={0}
                height={size.height}
                initial={{ width: 0 }}
                animate={{ width: inView ? size.width : 0 }}
                transition={settled || reduced ? { duration: 0 } : { duration: FLOW_IN, ease }}
              />
            </clipPath>
          </defs>

          <g clipPath={`url(#${id}-flow)`}>
            {series.map((s, j) => (
              <path
                key={s.key}
                ref={(el) => {
                  if (el) paths.current.set(s.key, el)
                  else paths.current.delete(s.key)
                }}
                fill={`url(#${id}-band-${j})`}
                stroke="var(--card)"
                strokeWidth={1}
                onPointerEnter={() => setBand(s.key)}
                className="transition-opacity duration-200 motion-reduce:transition-none"
                style={{ opacity: band !== null && band !== s.key ? 0.35 : 1 }}
              />
            ))}
          </g>

          {labels.map((text, k) => {
            const x = stageX(k)
            const delay = settled || reduced ? 0 : 0.15 + (x / size.width) * FLOW_IN * 0.55
            return (
              <motion.g
                key={k}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ duration: 0.3, delay }}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={TOP}
                  y2={plotBottom}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-[stroke] duration-150",
                    activeIndex === k ? "stroke-foreground" : "stroke-foreground/50"
                  )}
                />
                <text
                  x={x}
                  y={size.height - 6}
                  textAnchor="middle"
                  className={cn(
                    "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                    activeIndex === k && "fill-foreground"
                  )}
                >
                  {text}
                </text>
              </motion.g>
            )
          })}
        </svg>
      )}

      {size.width > 0 &&
        totals.map((total, k) => {
          const delay = settled || reduced ? 0 : 0.25 + (stageX(k) / size.width) * FLOW_IN * 0.55
          return (
            <motion.div
              key={k}
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background tabular-nums shadow-sm"
              style={{ left: stageX(k), top: mid, x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: inView ? 1 : 0, scale: inView ? (activeIndex === k ? 1.08 : 1) : 0.6 }}
              transition={{ type: "spring", stiffness: 420, damping: 24, delay }}
            >
              <Count value={inView ? total : 0} format={formatValue} />
            </motion.div>
          )
        })}

      <ChartTooltip
        ref={tipRef}
        title={labels[shownIndex] ?? ""}
        rows={rows}
        active={activeIndex !== null}
        fresh={fresh}
        format={formatValue}
        style={{ x: tipX, y: tipY }}
      />

      <ChartDescription
        label={label}
        columns={[...series.map((s) => s.label), ...(series.length > 1 ? ["Total"] : [])]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [
            ...matrix[k].map((v) => formatValue(v)),
            ...(series.length > 1 ? [formatValue(totals[k])] : []),
          ],
        }))}
        live={
          activeIndex !== null
            ? `${labels[activeIndex]}: ${series
                .map((s, j) => `${s.label} ${formatValue(matrix[activeIndex][j])}`)
                .join(", ")}`
            : ""
        }
      />
    </div>
  )
}
