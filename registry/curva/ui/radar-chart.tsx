"use client"

import * as React from "react"
import {
  animate,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatNumber,
  niceDomain,
  seriesColor,
  springEase,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import {
  ChartDescription,
  ChartLegend,
  ChartTooltip,
  type TooltipRow,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type RadarSeries<T extends Datum> = {
  /** Key of the numeric value for this series. */
  key: keyof T & string
  label: string
  /** Any CSS color. Defaults to the theme's chart colors in order. */
  color?: string
}

export type RadarChartProps<T extends Datum> = {
  /** One point per axis, clockwise from 12 o'clock. */
  data: readonly T[]
  /** Key of the label for each axis. */
  index: keyof T & string
  series: readonly RadarSeries<T>[]
  /** Accessible name of the chart. */
  label: string
  /** The value at the outer ring. Defaults to a round number above the largest value. */
  max?: number
  formatValue?: (value: number) => string
  /** Show the legend beside the chart (below it in narrow containers). */
  legend?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to an axis. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const LEVELS = 4
const LABEL_ROOM = 30
/** The shape unfolds around the axes, each vertex a beat after the last. */
const UNFOLD = { duration: 1.2, stagger: 0.45 }
const MORPH = { duration: 0.9, stagger: 0.25 }

const pointAt = (angle: number, r: number) => [Math.sin(angle) * r, -Math.cos(angle) * r] as const

export function RadarChart<T extends Datum>({
  data,
  index,
  series,
  label,
  max,
  formatValue = formatNumber,
  legend = true,
  className,
  onActiveChange,
}: RadarChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const plotRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const plot = useElementSize(plotRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false
  const [focus, setFocus] = React.useState<number | null>(null)

  const labels = data.map((d) => String(d[index]))
  const colors = series.map((s, j) => s.color ?? seriesColor(j))
  const matrix = React.useMemo(
    () => series.map((s) => data.map((d) => Math.max(0, Number(d[s.key]) || 0))),
    [data, series]
  )
  const top = max ?? niceDomain(matrix.flat()).hi
  const target = React.useMemo(
    () => matrix.map((row) => row.map((v) => clamp(v / (top || 1), 0, 1.05))),
    [matrix, top]
  )

  const n = data.length
  const box = Math.min(plot.width, plot.height)
  const radius = Math.max(0, box / 2 - LABEL_ROOM)
  const angleOf = (i: number) => (n > 0 ? (i / n) * Math.PI * 2 : 0)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  // Shapes are painted into their paths and dots, outside React renders.
  const nodes = React.useRef(new Map<string, SVGElement>())
  const keepNode = (key: string) => (el: SVGElement | null) => {
    if (el) nodes.current.set(key, el)
    else nodes.current.delete(key)
  }
  const progress = useMotionValue(0)
  const shape = React.useRef({
    from: [] as number[][],
    to: [] as number[][],
    stagger: UNFOLD.stagger,
    entered: false,
  })
  const geometry = React.useRef({ radius: 0, n: 0 })

  const frameOf = React.useCallback(
    (p: number) => {
      const { from, to, stagger } = shape.current
      return to.map((row, j) =>
        row.map((b, i) => {
          const a = from[j]?.[i] ?? 0
          const local = (p - (i / Math.max(1, row.length)) * stagger) / (1 - stagger)
          return a + (b - a) * springEase(local)
        })
      )
    },
    []
  )

  const paint = React.useCallback(() => {
    const { radius: r, n: count } = geometry.current
    if (r <= 0 || count === 0) return
    const frame = frameOf(progress.get())
    frame.forEach((row, j) => {
      const points = row.map((v, i) => pointAt((i / count) * Math.PI * 2, Math.max(0, v) * r))
      nodes.current
        .get(`shape-${j}`)
        ?.setAttribute("d", points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + "Z")
      points.forEach(([x, y], i) => {
        const dot = nodes.current.get(`dot-${j}-${i}`)
        dot?.setAttribute("cx", String(x))
        dot?.setAttribute("cy", String(y))
      })
    })
  }, [frameOf, progress])

  useMotionValueEvent(progress, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = { radius, n }
    paint()
  })

  // New values morph from what's on screen; a new set of series or axes swaps in.
  React.useLayoutEffect(() => {
    const s = shape.current
    const sameShape = s.to.length === target.length && s.to[0]?.length === target[0]?.length
    if (!s.entered) {
      shape.current = { ...s, from: target.map((row) => row.map(() => 0)), to: target }
      paint()
      return
    }
    if (!sameShape || reduced) {
      shape.current = { ...s, from: target, to: target }
      progress.jump(1)
      paint()
      return
    }
    shape.current = { ...s, from: frameOf(progress.get()), to: target, stagger: MORPH.stagger }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [target, reduced, paint, progress, frameOf])

  // The one orchestrated moment: each shape unfolds around the axes.
  React.useEffect(() => {
    const s = shape.current
    if (!inView || box === 0 || s.entered) return
    s.entered = true
    s.stagger = UNFOLD.stagger
    if (reduced) {
      progress.jump(1)
      paint()
      return
    }
    progress.jump(0)
    animate(progress, 1, { duration: UNFOLD.duration, ease: "linear", delay: 0.1 })
  }, [inView, box, reduced, paint, progress])

  const axisAt = (clientX: number, clientY: number) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return null
    const x = clientX - rect.left - rect.width / 2
    const y = clientY - rect.top - rect.height / 2
    const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
    return Math.round(angle / ((Math.PI * 2) / n)) % n
  }

  const [tx, ty] = pointAt(angleOf(shownIndex), radius * 0.62)
  const tipX = useFollow(
    clamp(plot.width / 2 + tx - tip.width / 2, 0, Math.max(0, plot.width - tip.width)),
    fresh
  )
  const tipY = useFollow(
    clamp(plot.height / 2 + ty - tip.height / 2, 0, Math.max(0, plot.height - tip.height)),
    fresh
  )

  const rows: TooltipRow[] = series.map((s, j) => ({
    key: s.key,
    label: s.label,
    color: colors[j],
    value: matrix[j]?.[shownIndex] ?? 0,
  }))
  const averages = matrix.map((row) => (row.length ? row.reduce((a, b) => a + b, 0) / row.length : 0))

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
      <div className="flex flex-col items-center gap-6 @md:flex-row @md:gap-8">
        <div
          ref={plotRef}
          onPointerMove={(e) => select(axisAt(e.clientX, e.clientY))}
          onPointerDown={(e) => select(axisAt(e.clientX, e.clientY))}
          onPointerLeave={() => select(null)}
          className="relative aspect-square w-full max-w-80 shrink-0 touch-pan-y select-none"
        >
          {box > 0 && (
            <svg
              width={plot.width}
              height={plot.height}
              viewBox={`${-plot.width / 2} ${-plot.height / 2} ${plot.width} ${plot.height}`}
              className="absolute inset-0 overflow-visible"
              aria-hidden
            >
              {Array.from({ length: LEVELS }, (_, l) => {
                const r = (radius * (l + 1)) / LEVELS
                const ring = labels.map((_, i) => pointAt(angleOf(i), r))
                return (
                  <path
                    key={l}
                    d={ring.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("") + "Z"}
                    fill="none"
                    className="stroke-border"
                    strokeDasharray={l === LEVELS - 1 ? undefined : "2 4"}
                  />
                )
              })}
              {labels.map((text, i) => {
                const [x, y] = pointAt(angleOf(i), radius)
                const [lx, ly] = pointAt(angleOf(i), radius + 14)
                const on = activeIndex === i
                return (
                  <g key={i}>
                    <line
                      x1={0}
                      y1={0}
                      x2={x}
                      y2={y}
                      className={cn(
                        "transition-[stroke] duration-150",
                        on ? "stroke-foreground/60" : "stroke-border"
                      )}
                    />
                    <text
                      x={lx}
                      y={ly}
                      dy="0.32em"
                      textAnchor={Math.abs(lx) < 4 ? "middle" : lx > 0 ? "start" : "end"}
                      className={cn(
                        "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                        on && "fill-foreground"
                      )}
                    >
                      {text}
                    </text>
                  </g>
                )
              })}

              {series.map((s, j) => {
                const quiet = focus !== null && focus !== j
                return (
                  <g
                    key={s.key}
                    className="transition-opacity duration-200 motion-reduce:transition-none"
                    style={{ opacity: quiet ? 0.15 : 1 }}
                  >
                    <path
                      ref={keepNode(`shape-${j}`)}
                      style={{
                        fill: `color-mix(in oklab, ${colors[j]} 18%, transparent)`,
                        stroke: colors[j],
                      }}
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                    {labels.map((_, i) => (
                      <circle
                        key={i}
                        ref={keepNode(`dot-${j}-${i}`)}
                        r={activeIndex === i ? 4.5 : 2.5}
                        fill={colors[j]}
                        className="transition-[r] duration-150"
                      />
                    ))}
                  </g>
                )
              })}
            </svg>
          )}

          <ChartTooltip
            ref={tipRef}
            title={labels[shownIndex] ?? ""}
            rows={rows}
            active={activeIndex !== null}
            fresh={fresh}
            format={formatValue}
            style={{ x: tipX, y: tipY }}
          />
        </div>

        {legend && (
          <ChartLegend
            rows={series.map((s, j) => ({
              key: s.key,
              label: s.label,
              color: colors[j],
              value: activeIndex === null ? averages[j] : (matrix[j]?.[activeIndex] ?? 0),
              format: formatValue,
            }))}
            activeIndex={focus}
            onSelect={setFocus}
          />
        )}
      </div>

      <ChartDescription
        label={label}
        columns={series.map((s) => s.label)}
        rows={labels.map((text, i) => ({
          label: text,
          values: series.map((_, j) => formatValue(matrix[j][i])),
        }))}
        live={
          activeIndex !== null
            ? `${labels[activeIndex]}: ${series
                .map((s, j) => `${s.label} ${formatValue(matrix[j][activeIndex])}`)
                .join(", ")}`
            : ""
        }
      />
    </div>
  )
}
