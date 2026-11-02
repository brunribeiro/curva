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
  formatPercent,
  springEase,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import { ChartDescription, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type FunnelChartProps<T extends Datum> = {
  /** The stages, from the widest to the narrowest. */
  data: readonly T[]
  /** Key of the label for each stage. */
  index: keyof T & string
  /** Key of the numeric value for each stage. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  formatValue?: (value: number) => string
  className?: string
  /** Called when the visitor points at, taps or arrows to a stage. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const LABELS = 66
const BOTTOM = 8
/** Share of each stage that stays flat before it narrows into the next. */
const FLAT = 0.56
const MIN_HEIGHT = 0.04
const POUR = { duration: 1.2, ease: [0.22, 1, 0.36, 1] } as const
const MORPH = { duration: 0.85, stagger: 0.2 }

type Point = [number, number]

const AREA = d3Area<Point>()
  .x((d) => d[0])
  .y0((d) => d[1])
  .y1((d) => -d[1])
  .curve(curveBumpX)

export function FunnelChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  className,
  onActiveChange,
}: FunnelChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pathRefs = React.useRef<SVGPathElement[]>([])
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), POUR.duration * 1000 + 200)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = React.useMemo(
    () => data.map((d) => Math.max(0, Number(d[value]) || 0)),
    [data, value]
  )
  const n = data.length
  const peak = Math.max(1e-9, ...values)
  const target = React.useMemo(
    () => values.map((v) => Math.max(MIN_HEIGHT, v / peak)),
    [values, peak]
  )

  const band = n > 0 ? size.width / n : 0
  const plotTop = LABELS
  const plotBottom = Math.max(plotTop, size.height - BOTTOM)
  const mid = (plotTop + plotBottom) / 2
  const half = (plotBottom - plotTop) / 2

  const { activeIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  // The outline is painted from heights that morph, outside React renders.
  const progress = useMotionValue(1)
  const shape = React.useRef({ from: target, to: target })
  const geometry = React.useRef({ band, half })

  const paint = React.useCallback(() => {
    const { band: b, half: h } = geometry.current
    const { from, to } = shape.current
    if (b <= 0 || to.length === 0) return
    const p = progress.get()
    const heights = to.map((t, k) => {
      const a = from[k] ?? t
      const local = (p - (k / Math.max(1, to.length)) * MORPH.stagger) / (1 - MORPH.stagger)
      return (a + (t - a) * springEase(local)) * h
    })
    const points: Point[] = []
    heights.forEach((height, k) => {
      points.push([k * b, height], [k * b + FLAT * b, height])
    })
    points.push([to.length * b, heights[heights.length - 1]])
    const d = AREA(points) ?? ""
    pathRefs.current.forEach((el) => el?.setAttribute("d", d))
  }, [progress])

  useMotionValueEvent(progress, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = { band, half }
    paint()
  })

  React.useLayoutEffect(() => {
    const s = shape.current
    if (!settled || reduced || s.to.length !== target.length) {
      shape.current = { from: target, to: target }
      progress.jump(1)
      paint()
      return
    }
    const p = progress.get()
    const current = s.to.map((t, k) => {
      const a = s.from[k] ?? t
      const local = (p - (k / Math.max(1, s.to.length)) * MORPH.stagger) / (1 - MORPH.stagger)
      return a + (t - a) * springEase(local)
    })
    shape.current = { from: current, to: target }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [target, settled, reduced, paint, progress])

  // The highlight is a window that glides to the active stage.
  const lightX = useFollow(activeIndex === null ? 0 : activeIndex * band, fresh)
  const lightW = useFollow(activeIndex === null ? size.width : band, fresh)

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return null
    return clamp(Math.floor(((clientX - rect.left) / size.width) * n), 0, n - 1)
  }

  const describe = (k: number) =>
    `${labels[k]}: ${formatValue(values[k])}` +
    (k > 0 && values[k - 1] > 0
      ? `, ${formatPercent((values[k] / values[k - 1]) * 100)} of ${labels[k - 1]}`
      : "")

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
        "relative h-72 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: color }} />
              <stop offset="100%" style={{ stopColor: `color-mix(in oklab, ${color} 55%, var(--card))` }} />
            </linearGradient>
            <clipPath id={`${id}-pour`}>
              {/* Clips live in the centered group's coordinates, so they span both halves. */}
              <motion.rect
                x={0}
                y={-size.height}
                height={size.height * 2}
                initial={{ width: 0 }}
                animate={{ width: inView ? size.width : 0 }}
                transition={settled || reduced ? { duration: 0 } : POUR}
              />
            </clipPath>
            <clipPath id={`${id}-light`}>
              <motion.rect y={-size.height} height={size.height * 2} style={{ x: lightX }} width={lightW} />
            </clipPath>
          </defs>

          <g clipPath={`url(#${id}-pour)`} transform={`translate(0 ${mid})`}>
            <path
              ref={(el) => {
                if (el) pathRefs.current[0] = el
              }}
              style={{ fill: `color-mix(in oklab, ${color} 18%, transparent)` }}
            />
            <g clipPath={`url(#${id}-light)`}>
              <path
                ref={(el) => {
                  if (el) pathRefs.current[1] = el
                }}
                fill={`url(#${id}-fill)`}
              />
            </g>
          </g>

          {labels.map((_, k) =>
            k > 0 ? (
              <line
                key={k}
                x1={k * band}
                x2={k * band}
                y1={plotTop - 10}
                y2={plotBottom}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ) : null
          )}
        </svg>
      )}

      {size.width > 0 &&
        labels.map((text, k) => {
          const delay = settled || reduced ? 0 : 0.2 + (k / Math.max(1, n)) * POUR.duration * 0.6
          const on = activeIndex === null || activeIndex === k
          const dropped = k > 0 ? values[k - 1] - values[k] : 0
          return (
            <motion.div
              key={text}
              className="pointer-events-none absolute top-0 pr-2 pl-3"
              style={{ left: k * band, width: band }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: inView ? (on ? 1 : 0.45) : 0, y: inView ? 0 : 6 }}
              transition={{ duration: 0.35, delay: inView && !settled ? delay : 0 }}
            >
              <p className="truncate text-xs text-muted-foreground">{text}</p>
              <Count
                value={inView ? values[k] : 0}
                format={formatValue}
                className="block text-lg leading-6 font-semibold tracking-tight tabular-nums"
              />
              <p
                className={cn(
                  "truncate text-[11px] leading-4 tabular-nums",
                  activeIndex === k && k > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                )}
              >
                {k === 0
                  ? "Start"
                  : activeIndex === k
                    ? `${formatValue(dropped)} dropped`
                    : `${formatPercent((values[k] / peak) * 100)} of start`}
              </p>
            </motion.div>
          )
        })}

      {size.width > 0 &&
        labels.slice(1).map((text, i) => {
          const k = i + 1
          const rate = values[k - 1] > 0 ? (values[k] / values[k - 1]) * 100 : 0
          const delay = settled || reduced ? 0 : 0.5 + (k / Math.max(1, n)) * POUR.duration * 0.6
          return (
            <motion.div
              key={text}
              aria-hidden
              className="pointer-events-none absolute rounded-full border bg-background/90 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap tabular-nums shadow-sm backdrop-blur"
              style={{ left: (k - 1) * band + FLAT * band + ((1 - FLAT) * band) / 2, top: mid, x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : 0.6 }}
              transition={{ type: "spring", stiffness: 420, damping: 24, delay }}
            >
              → {formatPercent(rate)}
            </motion.div>
          )
        })}

      <ChartDescription
        label={label}
        columns={["Value", "Of previous stage"]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [
            formatValue(values[k]),
            k > 0 && values[k - 1] > 0 ? formatPercent((values[k] / values[k - 1]) * 100) : "",
          ],
        }))}
        live={activeIndex !== null ? describe(activeIndex) : ""}
      />
    </div>
  )
}
