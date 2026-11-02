"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  allocate,
  clamp,
  formatNumber,
  formatPercent,
  seriesColor,
  useActivePoint,
  useElementSize,
} from "@/registry/curva/lib/curva"
import { ChartDescription, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type SplitBarProps<T extends Datum> = {
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
  formatValue?: (value: number) => string
  className?: string
  /** Called when the visitor points at, taps or arrows to a part. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const PITCH = 6
const TICK = 3
const LABELS = 38
const LABEL_WIDTH = 96
/** Ticks rise like an equalizer, left to right. */
const RISE = { type: "spring", stiffness: 420, damping: 26 } as const
const RISE_STEP = 0.006
const SLIDE = { type: "spring", stiffness: 300, damping: 32 } as const

/** A fixed, gentle texture so the ticks read as a woven band, not a flat block. */
const texture = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return 0.55 + 0.45 * (x - Math.floor(x))
}

export function SplitBar<T extends Datum>({
  data,
  index,
  value,
  label,
  color,
  formatValue = formatNumber,
  className,
  onActiveChange,
}: SplitBarProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.5 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1400)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Math.max(0, Number(d[value]) || 0))
  const colors = data.map((d, k) => (color ? String(d[color]) : seriesColor(k)))
  const total = values.reduce((a, b) => a + b, 0)
  const share = (k: number) => (total > 0 ? (values[k] / total) * 100 : 0)

  const count = Math.max(10, Math.floor((size.width + PITCH - TICK) / PITCH))
  const allocation = allocate(values, count)
  const groupOf: number[] = []
  const starts: number[] = []
  allocation.forEach((n, k) => {
    starts.push(groupOf.length)
    for (let i = 0; i < n; i++) groupOf.push(k)
  })

  const n = data.length
  const { activeIndex, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const barTop = LABELS
  const barHeight = Math.max(0, size.height - barTop)

  const groupAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || groupOf.length === 0) return null
    const i = clamp(Math.floor((clientX - rect.left) / PITCH), 0, groupOf.length - 1)
    return groupOf[i]
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
      onPointerMove={(e) => n > 0 && select(groupAt(e.clientX))}
      onPointerDown={(e) => n > 0 && select(groupAt(e.clientX))}
      onPointerLeave={() => select(null)}
      className={cn(
        "relative h-24 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          <AnimatePresence initial={false}>
            {groupOf.map((k, i) => {
              const leading = starts[k] === i
              const dim = activeIndex !== null && activeIndex !== k
              return (
                <motion.rect
                  key={`${i}-${labels[k]}`}
                  x={i * PITCH}
                  y={leading ? 2 : barTop}
                  width={TICK}
                  height={leading ? barHeight + barTop - 2 : barHeight}
                  rx={TICK / 2}
                  fill={colors[k]}
                  style={{ originY: 1 }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{
                    scaleY: inView ? 1 : 0,
                    opacity: inView ? (leading ? 1 : texture(i)) * (dim ? 0.22 : 1) : 0,
                  }}
                  exit={{ scaleY: 0, opacity: 0, transition: { duration: 0.18 } }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          scaleY: { ...RISE, delay: i * (settled ? RISE_STEP / 2 : RISE_STEP) },
                          opacity: { duration: 0.2, delay: dim || activeIndex !== null ? 0 : i * RISE_STEP },
                        }
                  }
                />
              )
            })}
          </AnimatePresence>
        </svg>
      )}

      {size.width > 0 &&
        labels.map((text, k) => {
          const room = allocation[k] * PITCH
          const x = Math.min(starts[k] * PITCH, Math.max(0, size.width - LABEL_WIDTH))
          // The active label always shows; a neighbor that would collide with it steps aside.
          const collides =
            activeIndex !== null &&
            activeIndex !== k &&
            Math.abs(x - Math.min(starts[activeIndex] * PITCH, Math.max(0, size.width - LABEL_WIDTH))) <
              LABEL_WIDTH
          const visible = (room >= 52 && !collides) || activeIndex === k
          return (
            <motion.div
              key={text}
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 pl-2 whitespace-nowrap"
              initial={false}
              animate={{
                x,
                opacity: inView && visible ? (activeIndex === null || activeIndex === k ? 1 : 0.4) : 0,
              }}
              transition={reduced ? { duration: 0 } : { x: SLIDE, opacity: { duration: 0.2 } }}
            >
              <p className="max-w-28 truncate text-[11px] leading-4 text-muted-foreground">{text}</p>
              <p className="text-sm leading-5 font-medium tabular-nums">
                {activeIndex === k ? (
                  <Count value={values[k]} format={formatValue} instant />
                ) : (
                  <Count value={share(k)} format={formatPercent} />
                )}
              </p>
            </motion.div>
          )
        })}

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
