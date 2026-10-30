"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { clamp, formatNumber, useElementSize, useFollow } from "@/registry/curva/lib/curva"
import { ChartDescription, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type RangeHistogramProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each bar. */
  index: keyof T & string
  /** Key of the numeric value for each bar. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  /** The selected range as first and last index. Defaults to the last quarter. */
  defaultRange?: readonly [number, number]
  formatValue?: (value: number) => string
  className?: string
  /** Called as the range changes, with the selected points. */
  onRangeChange?: (range: [number, number], points: T[]) => void
}

const SUMMARY = 58
const BRUSH = 28
const LABELS = 22
const GAP = 10
/** Bars rise left to right on first view. */
const RISE = { type: "spring", stiffness: 300, damping: 24 } as const
const RISE_STEP = 0.006

type Drag = { mode: "start" | "end" | "move" | "sweep"; anchor: number }

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

export function RangeHistogram<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  defaultRange,
  formatValue = formatNumber,
  className,
  onRangeChange,
}: RangeHistogramProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const pill = useElementSize(pillRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const labels = data.map((d) => String(d[index]))
  const values = data.map((d) => Math.max(0, Number(d[value]) || 0))
  const peak = Math.max(1e-9, ...values)
  const n = data.length

  const [range, setRange] = React.useState<[number, number]>(() => {
    const [a, b] = defaultRange ?? [Math.floor(n * 0.75), n - 1]
    return [clamp(a, 0, Math.max(0, n - 1)), clamp(b, 0, Math.max(0, n - 1))]
  })
  const a = Math.min(range[0], Math.max(0, n - 1))
  const b = Math.min(range[1], Math.max(0, n - 1))
  const [dragging, setDragging] = React.useState(false)
  const drag = React.useRef<Drag | null>(null)

  const update = (next: [number, number]) => {
    const start = clamp(Math.min(next[0], next[1]), 0, n - 1)
    const end = clamp(Math.max(next[0], next[1]), 0, n - 1)
    if (start === a && end === b) return
    setRange([start, end])
    onRangeChange?.([start, end], data.slice(start, end + 1))
  }

  const pitch = n > 0 ? size.width / n : 0
  const barWidth = Math.max(1.5, pitch * 0.62)
  const barsTop = SUMMARY
  const barsBottom = Math.max(barsTop, size.height - BRUSH - LABELS - GAP)
  const brushTop = barsBottom + GAP
  const barsHeight = barsBottom - barsTop

  const sum = values.slice(a, b + 1).reduce((x, y) => x + y, 0)
  const change = values[a] > 0 ? (values[b] - values[a]) / values[a] : 0
  const windowLeft = a * pitch
  const windowWidth = (b - a + 1) * pitch
  const pillX = useFollow(
    clamp(windowLeft + windowWidth / 2 - pill.width / 2, 0, Math.max(0, size.width - pill.width)),
    !inView
  )

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || pitch <= 0) return 0
    return clamp(Math.floor((clientX - rect.left) / pitch), 0, n - 1)
  }

  const begin = (e: React.PointerEvent, mode: Drag["mode"]) => {
    if (n === 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The pointer may already be gone; dragging still works while it stays over the element.
    }
    const k = indexAt(e.clientX)
    drag.current = { mode, anchor: mode === "move" ? k - a : k }
    setDragging(true)
    if (mode === "sweep") update([k, k])
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const k = indexAt(e.clientX)
    if (d.mode === "start") update([Math.min(k, b), b])
    else if (d.mode === "end") update([a, Math.max(k, a)])
    else if (d.mode === "sweep") update([d.anchor, k])
    else {
      const length = b - a
      const start = clamp(k - d.anchor, 0, n - 1 - length)
      update([start, start + length])
    }
  }

  const end = () => {
    drag.current = null
    setDragging(false)
  }

  const onTrackDown = (e: React.PointerEvent) => {
    const k = indexAt(e.clientX)
    // Pressing the track outside the window pulls the nearest handle there.
    const mode = Math.abs(k - a) <= Math.abs(k - b) ? "start" : "end"
    begin(e, mode)
    if (mode === "start") update([Math.min(k, b), b])
    else update([a, Math.max(k, a)])
  }

  const handleKeys = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    const big = Math.max(1, Math.round(n / 10))
    const steps: Record<string, number> = {
      ArrowLeft: e.shiftKey ? -5 : -1,
      ArrowDown: e.shiftKey ? -5 : -1,
      ArrowRight: e.shiftKey ? 5 : 1,
      ArrowUp: e.shiftKey ? 5 : 1,
      PageDown: -big,
      PageUp: big,
    }
    const current = which === "start" ? a : b
    let next: number
    if (e.key === "Home") next = which === "start" ? 0 : a
    else if (e.key === "End") next = which === "start" ? b : n - 1
    else if (e.key in steps) next = current + steps[e.key]
    else return
    e.preventDefault()
    if (which === "start") update([clamp(next, 0, b), b])
    else update([a, clamp(next, a, n - 1)])
  }

  const middle = Math.floor((n - 1) / 2)

  return (
    <div
      ref={rootRef}
      className={cn("relative h-72 w-full touch-pan-y select-none", className)}
    >
      {size.width > 0 && (
        <>
          <div
            role="presentation"
            className="absolute inset-x-0 cursor-crosshair"
            style={{ top: barsTop, height: barsHeight }}
            onPointerDown={(e) => begin(e, "sweep")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          <svg
            width={size.width}
            height={size.height}
            className="pointer-events-none absolute inset-0 overflow-visible"
            aria-hidden
          >
            {values.map((v, k) => {
              const h = (v / peak) * barsHeight
              const x = k * pitch + (pitch - barWidth) / 2
              const selected = k >= a && k <= b
              return (
                <motion.g
                  key={k}
                  style={{ originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: inView ? 1 : 0 }}
                  transition={reduced ? { duration: 0 } : { ...RISE, delay: k * RISE_STEP }}
                >
                  <rect
                    x={x}
                    y={barsBottom - h}
                    width={barWidth}
                    height={h}
                    rx={Math.min(2, barWidth / 2)}
                    style={{ fill: "color-mix(in oklab, var(--foreground) 13%, transparent)" }}
                  />
                  <rect
                    x={x}
                    y={barsBottom - h}
                    width={barWidth}
                    height={h}
                    rx={Math.min(2, barWidth / 2)}
                    fill={color}
                    className="transition-opacity duration-150 motion-reduce:transition-none"
                    style={{ opacity: selected ? 1 : 0 }}
                  />
                </motion.g>
              )
            })}
            {[windowLeft, windowLeft + windowWidth].map((x, i) => (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={barsTop - 6}
                y2={brushTop}
                strokeDasharray="2 3"
                style={{ stroke: `color-mix(in oklab, ${color} 55%, transparent)` }}
              />
            ))}
            {[0, middle, n - 1].map((k, i) =>
              n > 0 ? (
                <text
                  key={i}
                  x={i === 0 ? 0 : i === 2 ? size.width : (k + 0.5) * pitch}
                  y={size.height - 5}
                  textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                  className="fill-muted-foreground text-[11px]"
                >
                  {labels[k]}
                </text>
              ) : null
            )}
          </svg>

          {/* The brush: a track, the selected window and two handles. */}
          <div
            className="absolute inset-x-0 rounded-full bg-muted"
            style={{ top: brushTop, height: BRUSH }}
            onPointerDown={onTrackDown}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <div
              className={cn(
                "absolute inset-y-0 rounded-full",
                dragging ? "cursor-grabbing" : "cursor-grab"
              )}
              style={{
                left: windowLeft,
                width: windowWidth,
                background: `color-mix(in oklab, ${color} 22%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 45%, transparent)`,
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
                begin(e, "move")
              }}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
            {(["start", "end"] as const).map((which) => {
              const at = which === "start" ? windowLeft : windowLeft + windowWidth
              const k = which === "start" ? a : b
              return (
                <div
                  key={which}
                  role="slider"
                  tabIndex={0}
                  aria-label={`${label}, ${which === "start" ? "first" : "last"} selected`}
                  aria-valuemin={0}
                  aria-valuemax={n - 1}
                  aria-valuenow={k}
                  aria-valuetext={labels[k]}
                  onKeyDown={handleKeys(which)}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    begin(e, which)
                  }}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  className="absolute top-1/2 grid h-[calc(100%+8px)] w-4 cursor-ew-resize place-items-center rounded-full bg-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ left: at, transform: "translate(-50%, -50%)" }}
                >
                  <span className="h-3 w-px rounded-full bg-background/70" />
                </div>
              )
            })}
          </div>

          {/* The summary follows the window. */}
          <motion.div
            ref={pillRef}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 rounded-xl border bg-popover px-3 py-1.5 whitespace-nowrap text-popover-foreground shadow-lg shadow-black/5"
            style={{ x: pillX }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: inView ? 1 : 0, y: 0 }}
            transition={{ duration: 0.4, delay: reduced ? 0 : 0.5 }}
          >
            <p className="text-[11px] text-muted-foreground">
              {labels[a]}
              {b > a ? ` – ${labels[b]}` : ""}
            </p>
            <p className="flex items-baseline gap-2 text-sm font-semibold tabular-nums">
              <Count value={inView ? sum : 0} format={formatValue} instant={dragging} />
              {b > a && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {percent.format(change)}
                </span>
              )}
            </p>
          </motion.div>
        </>
      )}

      <ChartDescription
        label={label}
        columns={["Value"]}
        rows={labels.map((text, k) => ({ label: text, values: [formatValue(values[k])] }))}
        live={dragging ? "" : `${labels[a]} to ${labels[b]}: ${formatValue(sum)}`}
      />
    </div>
  )
}
