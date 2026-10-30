"use client"

import * as React from "react"
import { arc as d3Arc, type DefaultArcObject } from "d3-shape"
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
  seriesColor,
  useActivePoint,
  useElementSize,
} from "@/registry/curva/lib/curva"
import {
  ChartCenter,
  ChartDescription,
  ChartLegend,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type RadialChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each ring. */
  index: keyof T & string
  /** Key of the numeric value for each ring. */
  value: keyof T & string
  /** The value that closes a ring: a key of each point, or one number for all. */
  max: (keyof T & string) | number
  /** Accessible name of the chart. */
  label: string
  /** Key of a CSS color for each ring. Defaults to the theme's chart colors in order. */
  color?: keyof T & string
  /** Formats a ring's value; receives the point so each ring can have its own unit. */
  formatValue?: (value: number, point: T) => string
  /** What the center says when nothing is active; it shows the average progress. */
  centerLabel?: string
  /** Show the legend beside the rings (below them in narrow containers). */
  legend?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a ring. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** Rings fill from the outside in, settling with a slight overshoot. */
const FILL = { type: "spring", stiffness: 60, damping: 13 } as const
const FILL_STAGGER = 0.14
const MORPH = { type: "spring", stiffness: 110, damping: 18 } as const
const RING_GAP = 4
const MAX_THICKNESS = 22
const TAU = Math.PI * 2

type ArcDatum = Required<DefaultArcObject> & { cornerRadius: number }

const ARC = d3Arc<ArcDatum>()
  .innerRadius((d) => d.innerRadius)
  .outerRadius((d) => d.outerRadius)
  .startAngle((d) => d.startAngle)
  .endAngle((d) => d.endAngle)
  .padAngle((d) => d.padAngle)
  .cornerRadius((d) => d.cornerRadius)

export function RadialChart<T extends Datum>({
  data,
  index,
  value,
  max,
  label,
  color,
  formatValue = (v) => formatNumber(v),
  centerLabel = "Average",
  legend = true,
  className,
  onActiveChange,
}: RadialChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const ringRef = React.useRef<HTMLDivElement>(null)
  const ring = useElementSize(ringRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Number(d[value]) || 0)
  const maxima = data.map((d) => (typeof max === "number" ? max : Number(d[max]) || 0))
  const progress = values.map((v, k) => (maxima[k] > 0 ? v / maxima[k] : 0))
  const colors = data.map((d, k) => (color ? String(d[color]) : seriesColor(k)))
  const average = progress.length ? (progress.reduce((a, b) => a + b, 0) / progress.length) * 100 : 0
  const formatOf = (k: number) => (v: number) => formatValue(v, data[k])

  const n = data.length
  const size = Math.min(ring.width, ring.height)
  const outer = Math.max(0, size / 2 - 2)
  const room = outer * 0.6
  const thickness = n > 0 ? clamp(room / n - RING_GAP, 6, MAX_THICKNESS) : 0

  const { activeIndex, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const describe = (k: number) =>
    `${labels[k]}: ${formatValue(values[k], data[k])} of ${formatValue(maxima[k], data[k])}, ${formatPercent(progress[k] * 100)}`

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
          ref={ringRef}
          onPointerLeave={() => select(null)}
          className="@container relative aspect-square w-full max-w-56 shrink-0 touch-pan-y select-none @sm:max-w-40 @lg:max-w-56"
        >
          {size > 0 && (
            <svg
              width={size}
              height={size}
              viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
              className="absolute inset-0 overflow-visible"
              aria-hidden
            >
              {data.map((_, k) => (
                <Ring
                  key={labels[k]}
                  radius={outer - k * (thickness + RING_GAP)}
                  thickness={thickness}
                  progress={progress[k]}
                  color={colors[k]}
                  dimmed={activeIndex !== null && activeIndex !== k}
                  delay={settled ? 0 : k * FILL_STAGGER}
                  fill={!settled}
                  run={inView}
                  reduced={reduced}
                  onEnter={() => select(k)}
                />
              ))}
            </svg>
          )}
          <ChartCenter
            title={activeIndex === null ? centerLabel : labels[activeIndex]}
            value={activeIndex === null ? (inView ? average : 0) : progress[activeIndex] * 100}
            format={formatPercent}
            detail={
              activeIndex === null
                ? undefined
                : { value: values[activeIndex], format: formatOf(activeIndex) }
            }
            instant={reduced}
          />
        </div>

        {legend && (
          <ChartLegend
            rows={labels.map((text, k) => ({
              key: text,
              label: text,
              color: colors[k],
              value: values[k],
              format: formatOf(k),
              percent: progress[k] * 100,
            }))}
            activeIndex={activeIndex}
            onSelect={select}
          />
        )}
      </div>

      <ChartDescription
        label={label}
        columns={["Value", "Goal", "Progress"]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [
            formatValue(values[k], data[k]),
            formatValue(maxima[k], data[k]),
            formatPercent(progress[k] * 100),
          ],
        }))}
        live={activeIndex !== null ? describe(activeIndex) : ""}
      />
    </div>
  )
}

function Ring({
  radius,
  thickness,
  progress,
  color,
  dimmed,
  delay,
  fill,
  run,
  reduced,
  onEnter,
}: {
  radius: number
  thickness: number
  progress: number
  color: string
  dimmed: boolean
  delay: number
  fill: boolean
  run: boolean
  reduced: boolean
  onEnter: () => void
}) {
  const p = useMotionValue(0)

  React.useEffect(() => {
    if (!run) return
    const options = reduced ? { duration: 0 } : { ...(fill ? FILL : MORPH), delay }
    const controls = animate(p, progress, options)
    return () => controls.stop()
  }, [run, progress, delay, fill, reduced, p])

  const geometry = {
    innerRadius: Math.max(0, radius - thickness),
    outerRadius: Math.max(0, radius),
    startAngle: 0,
    padAngle: 0,
    cornerRadius: thickness / 2,
  }
  const track = ARC({ ...geometry, endAngle: TAU }) ?? ""

  // Painted from the progress and the current size, so a resize redraws it too.
  const d = useMotionValue("")
  const paint = () => {
    const v = p.get()
    d.set(v <= 0.0005 ? "" : (ARC({ ...geometry, endAngle: TAU * clamp(v, 0, 1) }) ?? ""))
  }
  useMotionValueEvent(p, "change", paint)
  React.useLayoutEffect(() => {
    paint()
  })

  return (
    <motion.g
      initial={false}
      animate={{ opacity: dimmed ? 0.35 : 1 }}
      transition={{ duration: 0.2 }}
      onPointerEnter={onEnter}
      onPointerDown={onEnter}
    >
      <path d={track} fill={color} opacity={0.14} />
      <motion.path d={d} fill={color} />
    </motion.g>
  )
}
