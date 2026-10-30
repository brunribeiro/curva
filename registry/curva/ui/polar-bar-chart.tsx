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
import { formatNumber, useActivePoint, useElementSize } from "@/registry/curva/lib/curva"
import { ChartCenter, ChartDescription } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type PolarBarChartProps<T extends Datum> = {
  /** Points around the circle, clockwise from 12 o'clock (hours, weekdays, months). */
  data: readonly T[]
  /** Key of the label for each bar. */
  index: keyof T & string
  /** Key of the numeric value for each bar. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  formatValue?: (value: number) => string
  /** What the center says when nothing is active; it shows the total. */
  centerLabel?: string
  /** Label every nth bar around the outside. Defaults to the four quarters. */
  labelEvery?: number
  className?: string
  /** Called when the visitor points at, taps or arrows to a bar. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** Bars grow outward in a clockwise sweep. */
const GROW = { type: "spring", stiffness: 170, damping: 19 } as const
const SWEEP_STEP = 0.028
const MORPH = { type: "spring", stiffness: 200, damping: 24 } as const
const LABEL_ROOM = 20

type ArcDatum = Required<DefaultArcObject> & { cornerRadius: number }

const ARC = d3Arc<ArcDatum>()
  .innerRadius((d) => d.innerRadius)
  .outerRadius((d) => d.outerRadius)
  .startAngle((d) => d.startAngle)
  .endAngle((d) => d.endAngle)
  .padAngle((d) => d.padAngle)
  .cornerRadius((d) => d.cornerRadius)

export function PolarBarChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  centerLabel = "Total",
  labelEvery,
  className,
  onActiveChange,
}: PolarBarChartProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
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
  const peak = Math.max(1e-9, ...values)
  const total = values.reduce((a, b) => a + b, 0)

  const n = data.length
  const box = Math.min(size.width, size.height)
  const outer = Math.max(0, box / 2 - LABEL_ROOM)
  const inner = outer * 0.44
  const step = n > 0 ? (Math.PI * 2) / n : 0
  const every = labelEvery ?? Math.max(1, Math.round(n / 4))

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
      onPointerLeave={() => select(null)}
      className={cn(
        "@container relative mx-auto aspect-square w-full max-w-80 touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {box > 0 && (
        <svg
          width={size.width}
          height={size.height}
          viewBox={`${-size.width / 2} ${-size.height / 2} ${size.width} ${size.height}`}
          className="absolute inset-0 overflow-visible"
          aria-hidden
        >
          {values.map((v, k) => (
            <PolarBar
              key={k}
              start={k * step}
              end={(k + 1) * step}
              inner={inner}
              outer={outer}
              length={inner + (outer - inner) * (v / peak)}
              color={color}
              weight={0.35 + 0.65 * (v / peak)}
              active={activeIndex === k}
              dimmed={activeIndex !== null && activeIndex !== k}
              delay={settled ? 0 : k * SWEEP_STEP}
              grow={!settled}
              run={inView}
              reduced={reduced}
              onEnter={() => select(k)}
            />
          ))}
          {labels.map((text, k) => {
            if (k % every !== 0) return null
            const angle = (k + 0.5) * step
            const r = outer + 11
            return (
              <text
                key={k}
                x={Math.sin(angle) * r}
                y={-Math.cos(angle) * r}
                dy="0.32em"
                textAnchor="middle"
                className={cn(
                  "fill-muted-foreground text-[10px] transition-[fill] duration-150",
                  activeIndex === k && "fill-foreground"
                )}
              >
                {text}
              </text>
            )
          })}
        </svg>
      )}

      <ChartCenter
        title={activeIndex === null ? centerLabel : labels[activeIndex]}
        value={activeIndex === null ? (inView ? total : 0) : values[activeIndex]}
        format={formatValue}
        instant={reduced}
      />

      <ChartDescription
        label={label}
        columns={["Value"]}
        rows={labels.map((text, k) => ({ label: text, values: [formatValue(values[k])] }))}
        live={activeIndex !== null ? `${labels[activeIndex]}: ${formatValue(values[activeIndex])}` : ""}
      />
    </div>
  )
}

function PolarBar({
  start,
  end,
  inner,
  outer,
  length,
  color,
  weight,
  active,
  dimmed,
  delay,
  grow,
  run,
  reduced,
  onEnter,
}: {
  start: number
  end: number
  inner: number
  outer: number
  length: number
  color: string
  weight: number
  active: boolean
  dimmed: boolean
  delay: number
  grow: boolean
  run: boolean
  reduced: boolean
  onEnter: () => void
}) {
  const reach = useMotionValue(inner)

  React.useEffect(() => {
    if (!run) return
    const options = reduced ? { duration: 0 } : { ...(grow ? GROW : MORPH), delay }
    const controls = animate(reach, length, options)
    return () => controls.stop()
  }, [run, length, delay, grow, reduced, reach])

  const geometry = {
    innerRadius: inner,
    startAngle: start,
    endAngle: end,
    padAngle: (end - start) * 0.32,
    cornerRadius: Math.min(3, (inner * (end - start) * 0.68) / 2),
  }
  const track = ARC({ ...geometry, outerRadius: outer }) ?? ""

  // Painted from the reach and the current size, so a resize redraws it too.
  const d = useMotionValue("")
  const paint = () => {
    const r = reach.get()
    d.set(r <= inner + 0.5 ? "" : (ARC({ ...geometry, outerRadius: r }) ?? ""))
  }
  useMotionValueEvent(reach, "change", paint)
  React.useLayoutEffect(() => {
    paint()
  })

  return (
    <g onPointerEnter={onEnter} onPointerDown={onEnter}>
      <path d={track} fill={color} opacity={0.07} />
      <motion.path
        d={d}
        fill={color}
        initial={false}
        animate={{ opacity: active ? 1 : dimmed ? 0.22 : weight }}
        transition={{ duration: 0.2 }}
      />
    </g>
  )
}
