"use client"

import * as React from "react"
import { arc as d3Arc, pie as d3Pie, type DefaultArcObject } from "d3-shape"
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  usePresence,
  useReducedMotion,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  formatNumber,
  formatPercent,
  seriesColor,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import {
  ChartCenter,
  ChartDescription,
  ChartLegend,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type DonutChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each segment. Labels must be unique. */
  index: keyof T & string
  /** Key of the numeric value for each segment. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Key of a CSS color for each segment. Defaults to the theme's chart colors in order. */
  color?: keyof T & string
  /** Formats values in the center, the legend and for screen readers. */
  formatValue?: (value: number) => string
  /** What the center says when nothing is active. */
  centerLabel?: string
  /** Show the legend beside the ring (below it in narrow containers). */
  legend?: boolean
  /** Ring thickness as a share of the radius. */
  thickness?: number
  className?: string
  /** Called when the visitor points at, taps or arrows to a segment. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** The ring pours in clockwise, each segment a beat after the last. */
const POUR = { type: "spring", stiffness: 70, damping: 15 } as const
const POUR_STAGGER = 0.09
const MORPH = { type: "spring", stiffness: 140, damping: 22 } as const
const LIFT = 6
const PAD_ANGLE = 0.022

type ArcDatum = Required<DefaultArcObject> & { cornerRadius: number }

const ARC = d3Arc<ArcDatum>()
  .innerRadius((d) => d.innerRadius)
  .outerRadius((d) => d.outerRadius)
  .startAngle((d) => d.startAngle)
  .endAngle((d) => d.endAngle)
  .padAngle((d) => d.padAngle)
  .cornerRadius((d) => d.cornerRadius)

export function DonutChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color,
  formatValue = formatNumber,
  centerLabel = "Total",
  legend = true,
  thickness = 0.28,
  className,
  onActiveChange,
}: DonutChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const ringRef = React.useRef<HTMLDivElement>(null)
  const ring = useElementSize(ringRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  // After the entrance, segments added later grow from their own place.
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1600)
    return () => clearTimeout(timer)
  }, [inView])

  const values = React.useMemo(
    () => data.map((d) => Math.max(0, Number(d[value]) || 0)),
    [data, value]
  )
  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const colors = data.map((d, k) => (color ? String(d[color]) : seriesColor(k)))
  const total = values.reduce((a, b) => a + b, 0)
  const arcs = React.useMemo(() => d3Pie<number>().sort(null).value((v) => v)(values), [values])
  const share = (k: number) => (total > 0 ? (values[k] / total) * 100 : 0)

  const n = data.length
  const size = Math.min(ring.width, ring.height)
  const outer = Math.max(0, size / 2 - LIFT - 2)
  const inner = outer * (1 - thickness)

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
              <AnimatePresence>
                {arcs.map((a, k) => (
                  <Segment
                    key={labels[k]}
                    from={settled ? a.startAngle : 0}
                    start={a.startAngle}
                    end={a.endAngle}
                    inner={inner}
                    outer={outer}
                    color={colors[k]}
                    active={activeIndex === k}
                    dimmed={activeIndex !== null && activeIndex !== k}
                    delay={settled ? 0 : k * POUR_STAGGER}
                    pour={!settled}
                    run={inView}
                    reduced={reduced}
                    onEnter={() => select(k)}
                  />
                ))}
              </AnimatePresence>
            </svg>
          )}
          <ChartCenter
            title={activeIndex === null ? centerLabel : labels[activeIndex]}
            value={activeIndex === null ? (inView ? total : 0) : values[activeIndex]}
            format={formatValue}
            detail={
              activeIndex === null ? undefined : { value: share(activeIndex), format: formatPercent }
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

function Segment({
  from,
  start,
  end,
  inner,
  outer,
  color,
  active,
  dimmed,
  delay,
  pour,
  run,
  reduced,
  onEnter,
}: {
  from: number
  start: number
  end: number
  inner: number
  outer: number
  color: string
  active: boolean
  dimmed: boolean
  delay: number
  pour: boolean
  run: boolean
  reduced: boolean
  onEnter: () => void
}) {
  const [present, safeToRemove] = usePresence()
  const a0 = useMotionValue(from)
  const a1 = useMotionValue(from)
  const lift = useFollow(active ? 1 : 0, false, { stiffness: 380, damping: 24 })

  React.useEffect(() => {
    if (!present) {
      // Leaving: close up around the middle while the others take the room.
      const mid = (a0.get() + a1.get()) / 2
      const options = reduced ? { duration: 0 } : MORPH
      const close = [animate(a0, mid, options), animate(a1, mid, options)]
      Promise.all(close).then(() => safeToRemove?.())
      return () => close.forEach((c) => c.stop())
    }
    if (!run) return
    const options = reduced ? { duration: 0 } : { ...(pour ? POUR : MORPH), delay }
    const moves = [animate(a0, start, options), animate(a1, end, options)]
    return () => moves.forEach((c) => c.stop())
  }, [present, run, start, end, delay, pour, reduced, a0, a1, safeToRemove])

  // Painted from the angles and the current size, so a resize redraws it too.
  const d = useMotionValue("")
  const paint = () =>
    d.set(
      ARC({
        startAngle: a0.get(),
        endAngle: a1.get(),
        innerRadius: inner,
        outerRadius: outer + LIFT * lift.get(),
        padAngle: PAD_ANGLE,
        cornerRadius: Math.min(4, (outer - inner) / 2),
      }) ?? ""
    )
  useMotionValueEvent(a0, "change", paint)
  useMotionValueEvent(a1, "change", paint)
  useMotionValueEvent(lift, "change", paint)
  React.useLayoutEffect(() => {
    paint()
  })

  return (
    <motion.path
      d={d}
      fill={color}
      initial={false}
      animate={{ opacity: dimmed ? 0.35 : 1 }}
      transition={{ duration: 0.2 }}
      onPointerEnter={onEnter}
      onPointerDown={onEnter}
    />
  )
}
