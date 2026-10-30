"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatNumber,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import { ChartDescription, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type CapsuleBarChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each capsule. */
  index: keyof T & string
  /** Key of the numeric value for each capsule. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Bottom color of the lit capsule. */
  color?: string
  /** Top color of the lit capsule. */
  accent?: string
  /** Which capsule glows while nothing is active. */
  highlight?: "max" | "last" | number
  formatValue?: (value: number) => string
  className?: string
  /** Called when the visitor points at, taps or arrows to a capsule. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const TOP = 30
const LABELS = 24
const MAX_WIDTH = 56
/** Liquid rises with a little slosh. */
const RISE = { type: "spring", stiffness: 130, damping: 13 } as const
const RISE_STEP = 0.07
const MORPH = { type: "spring", stiffness: 180, damping: 20 } as const

export function CapsuleBarChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  accent = "var(--chart-4)",
  highlight = "max",
  formatValue = formatNumber,
  className,
  onActiveChange,
}: CapsuleBarChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1500)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Math.max(0, Number(d[value]) || 0))
  const peak = Math.max(1e-9, ...values)
  const n = data.length

  const { activeIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )
  const resting =
    n === 0
      ? 0
      : highlight === "last"
        ? n - 1
        : highlight === "max"
          ? values.indexOf(Math.max(...values))
          : clamp(highlight, 0, n - 1)
  const lit = activeIndex ?? resting

  const band = n > 0 ? size.width / n : 0
  const width = Math.min(band * 0.62, MAX_WIDTH)
  const trackTop = TOP
  const trackBottom = Math.max(trackTop, size.height - LABELS)
  const trackHeight = trackBottom - trackTop
  const centerOf = (k: number) => band * (k + 0.5)
  const liquidOf = (k: number) =>
    values[k] > 0 ? Math.max(width, (values[k] / peak) * trackHeight) : 0

  const pillX = useFollow(clamp(centerOf(lit) - tip.width / 2, 0, Math.max(0, size.width - tip.width)), fresh)
  const pillY = useFollow(Math.max(0, trackBottom - liquidOf(lit) - tip.height - 8), fresh)

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return null
    return clamp(Math.floor(((clientX - rect.left) / size.width) * n), 0, n - 1)
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
        "relative h-72 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${id}-lit`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: accent }} />
              <stop offset="100%" style={{ stopColor: color }} />
            </linearGradient>
            <filter id={`${id}-glow`} x="-60%" y="-30%" width="220%" height="160%">
              <feGaussianBlur stdDeviation={Math.max(4, width / 5)} />
            </filter>
          </defs>

          <AnimatePresence initial={false}>
            {values.map((_, k) => {
              const x = centerOf(k) - width / 2
              const h = liquidOf(k)
              const on = lit === k
              const rise = inView ? { y: trackBottom - h, height: h } : { y: trackBottom, height: 0 }
              const transition = reduced
                ? { duration: 0 }
                : { ...(settled ? MORPH : RISE), delay: settled ? 0 : k * RISE_STEP }
              return (
                <motion.g
                  key={k}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* The glass tube. */}
                  <rect
                    x={x}
                    y={trackTop}
                    width={width}
                    height={trackHeight}
                    rx={width / 2}
                    style={{
                      fill: "color-mix(in oklab, var(--foreground) 4%, transparent)",
                      stroke: "color-mix(in oklab, var(--foreground) 7%, transparent)",
                    }}
                  />
                  {/* Its glow, then the liquid: grey at rest, the gradient when lit. */}
                  <motion.rect
                    x={x}
                    width={width}
                    rx={width / 2}
                    fill={`url(#${id}-lit)`}
                    filter={`url(#${id}-glow)`}
                    initial={{ y: trackBottom, height: 0, opacity: 0 }}
                    animate={{ ...rise, opacity: on && inView ? 0.45 : 0 }}
                    transition={{ ...transition, opacity: { duration: 0.3 } }}
                  />
                  <motion.rect
                    x={x}
                    width={width}
                    rx={width / 2}
                    style={{ fill: "color-mix(in oklab, var(--foreground) 15%, transparent)" }}
                    initial={{ y: trackBottom, height: 0 }}
                    animate={rise}
                    transition={transition}
                  />
                  <motion.rect
                    x={x}
                    width={width}
                    rx={width / 2}
                    fill={`url(#${id}-lit)`}
                    initial={{ y: trackBottom, height: 0, opacity: 0 }}
                    animate={{ ...rise, opacity: on ? 1 : 0 }}
                    transition={{ ...transition, opacity: { duration: 0.3 } }}
                  />
                  {/* A sliver of light down the glass. */}
                  <rect
                    x={x + width * 0.2}
                    y={trackTop + width * 0.35}
                    width={Math.max(1.5, width * 0.12)}
                    height={Math.max(0, trackHeight - width * 0.7)}
                    rx={width * 0.06}
                    className="fill-white/40 dark:fill-white/[0.07]"
                  />
                  <text
                    x={centerOf(k)}
                    y={size.height - 6}
                    textAnchor="middle"
                    className={cn(
                      "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                      on && "fill-foreground"
                    )}
                  >
                    {labels[k]}
                  </text>
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
      )}

      <motion.div
        ref={tipRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium whitespace-nowrap text-background tabular-nums shadow-md"
        style={{ x: pillX, y: pillY }}
        initial={false}
        animate={{ opacity: inView && n > 0 ? 1 : 0 }}
        transition={{ duration: 0.3, delay: settled ? 0 : 0.6 }}
      >
        <Count value={inView ? (values[lit] ?? 0) : 0} format={formatValue} instant={fresh && activeIndex !== null} />
      </motion.div>

      <ChartDescription
        label={label}
        columns={["Value"]}
        rows={labels.map((text, k) => ({ label: text, values: [formatValue(values[k])] }))}
        live={activeIndex !== null ? `${labels[activeIndex]}: ${formatValue(values[activeIndex])}` : ""}
      />
    </div>
  )
}
