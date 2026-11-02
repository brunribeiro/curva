"use client"

import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { clamp, formatNumber, niceDomain, useActivePoint, useElementSize, useFollow } from "@/registry/curva/lib/curva"
import { ChartDescription, ChartTooltip, Count, type TooltipRow } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type Percentile<T extends Datum> = {
  /** Key of this percentile's value, such as the median. */
  key: keyof T & string
  /** What it means to a reader, such as "Typical" or "Slowest 10%". */
  label: string
}

export type PercentileZone = {
  /** Where the zone ends. Leave it out for the last zone. */
  upTo?: number
  label: string
  tone: "good" | "warn" | "bad"
}

export type PercentileChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each row. */
  index: keyof T & string
  /** The percentiles to layer, from the smallest (the median) to the largest. */
  percentiles: readonly Percentile<T>[]
  /** Accessible name of the chart. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  formatValue?: (value: number) => string
  /** Formats the axis labels. Defaults to `formatValue`. */
  formatAxis?: (value: number) => string
  /** Bands behind the bars that judge a value, such as good, needs work and poor. */
  zones?: readonly PercentileZone[]
  /** Key of the percentile shown at the end of each row and judged by the zones. Defaults to the first. */
  score?: keyof T & string
  /** The value at the right edge. Defaults to a round number above every value. */
  max?: number
  className?: string
  /** Called when the visitor points at, taps or arrows to a row. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const GROW = { type: "spring", stiffness: 160, damping: 24 } as const
const ROW = 44

const ZONE_FILL = {
  good: "bg-emerald-500/[0.07]",
  warn: "bg-amber-500/[0.09]",
  bad: "bg-rose-500/[0.08]",
}
const ZONE_TEXT = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-rose-700 dark:text-rose-400",
}
const ZONE_SWATCH = {
  good: "bg-emerald-500/60",
  warn: "bg-amber-500/60",
  bad: "bg-rose-500/60",
}
const ZONE_PILL = {
  good: "bg-emerald-500/10",
  warn: "bg-amber-500/12",
  bad: "bg-rose-500/10",
}

/** The median is solid; each wider percentile is a fainter layer behind it. */
const layerColor = (color: string, j: number) =>
  j === 0 ? color : `color-mix(in oklab, ${color} ${Math.round(Math.max(16, 50 / j))}%, transparent)`

export function PercentileChart<T extends Datum>({
  data,
  index,
  percentiles,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  formatAxis,
  zones,
  score,
  max,
  className,
  onActiveChange,
}: PercentileChartProps<T>) {
  const id = React.useId()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const track = useElementSize(trackRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1800)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = data.map((d) => String(d[index]))
  const matrix = data.map((d) => percentiles.map((p) => Math.max(0, Number(d[p.key]) || 0)))
  const scoreKey = score ?? percentiles[0]?.key
  const scores = data.map((d) => (scoreKey ? Math.max(0, Number(d[scoreKey]) || 0) : 0))
  const thresholds = (zones ?? []).flatMap((z) => (z.upTo === undefined ? [] : [z.upTo]))
  const domain = niceDomain([...matrix.flat(), ...thresholds])
  const top = max ?? domain.hi
  const ticks = max === undefined ? domain.ticks : [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const at = (v: number) => clamp((v / (top || 1)) * 100, 0, 100)
  const n = data.length

  const zoneSpans = (zones ?? []).map((z, i, all) => {
    const start = i === 0 ? 0 : (all[i - 1].upTo ?? top)
    return { ...z, start: at(start), end: at(z.upTo ?? top) }
  })
  const zoneOf = (v: number) => zones?.find((z) => z.upTo === undefined || v <= z.upTo)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(
    n,
    (k) => onActiveChange?.(k === null ? null : data[k], k),
    { vertical: true }
  )

  // The tooltip waits just past the widest layer, or above the row when the edge is near.
  const widest = (at(matrix[shownIndex]?.[percentiles.length - 1] ?? 0) / 100) * track.width
  const beside = widest + 12 + tip.width <= track.width
  const above = shownIndex * ROW - tip.height + 6
  const tipX = useFollow(
    clamp(beside ? widest + 12 : widest - tip.width / 2, 0, Math.max(0, track.width - tip.width)),
    fresh
  )
  const tipY = useFollow(
    beside ? shownIndex * ROW + ROW / 2 - tip.height / 2 : above >= 0 ? above : (shownIndex + 1) * ROW - 6,
    fresh
  )

  const rows: TooltipRow[] = percentiles.map((p, j) => ({
    key: p.key,
    label: p.label,
    color: layerColor(color, j),
    value: matrix[shownIndex]?.[j] ?? 0,
  }))

  const describe = (k: number) => {
    const zone = zoneOf(scores[k])
    return (
      `${labels[k]}: ` +
      percentiles.map((p, j) => `${p.label} ${formatValue(matrix[k][j])}`).join(", ") +
      (zone ? `, ${zone.label}` : "")
    )
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
      className={cn(
        "w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <div
        onPointerLeave={() => select(null)}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 select-none"
      >
        {/* Zones and gridlines run behind every row; the tooltip lives here too. */}
        <div
          ref={trackRef}
          className="relative self-stretch"
          style={{ gridColumn: 2, gridRow: `1 / span ${n}` }}
        >
          {zoneSpans.map((z, i) => (
            <motion.div
              key={z.label}
              aria-hidden
              className={cn(
                "absolute inset-y-0",
                ZONE_FILL[z.tone],
                ZONE_TEXT[z.tone],
                i > 0 && "border-l border-dashed border-current/60"
              )}
              style={{ left: `${z.start}%`, width: `${z.end - z.start}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: inView ? 1 : 0 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : i * 0.1 }}
            />
          ))}
          {!zones?.length &&
            ticks.map((t) => (
              <span
                key={t}
                aria-hidden
                className="absolute inset-y-0 border-l border-dashed border-border"
                style={{ left: `${at(t)}%` }}
              />
            ))}

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

        <AnimatePresence>
          {activeIndex !== null && (
            <motion.div
              aria-hidden
              layoutId={`${id}-row`}
              className="-mx-2 h-full rounded-md bg-foreground/[0.04]"
              style={{ gridColumn: "1 / -1", gridRow: activeIndex + 1 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </AnimatePresence>

        {labels.map((text, k) => {
          const row = k + 1
          const quiet = activeIndex !== null && activeIndex !== k
          const zone = zoneOf(scores[k])
          return (
            <React.Fragment key={text}>
              <span
                aria-hidden
                onPointerEnter={() => select(k)}
                onPointerDown={() => select(k)}
                className={cn("relative max-w-32 truncate text-sm transition-opacity duration-200", quiet && "opacity-50")}
                style={{ gridColumn: 1, gridRow: row, lineHeight: `${ROW}px` }}
              >
                {text}
              </span>

              <div
                aria-hidden
                onPointerEnter={() => select(k)}
                onPointerDown={() => select(k)}
                className={cn("relative transition-opacity duration-200", quiet && "opacity-40")}
                style={{ gridColumn: 2, gridRow: row, height: ROW }}
              >
                {percentiles
                  .map((p, j) => ({ p, j }))
                  .reverse()
                  .map(({ p, j }) => (
                    <motion.span
                      key={p.key}
                      className="absolute top-1/2 left-0 h-2.5 -translate-y-1/2 rounded-full"
                      style={{ background: layerColor(color, j) }}
                      initial={{ width: "0%" }}
                      animate={{ width: inView ? `${at(matrix[k][j])}%` : "0%" }}
                      transition={
                        reduced ? { duration: 0 } : { ...GROW, delay: settled ? 0 : 0.2 + k * 0.07 + j * 0.2 }
                      }
                    />
                  ))}
              </div>

              <div
                aria-hidden
                className={cn("relative flex items-center justify-end gap-2 transition-opacity duration-200", quiet && "opacity-50")}
                style={{ gridColumn: 3, gridRow: row }}
              >
                <Count
                  value={inView ? scores[k] : 0}
                  format={formatValue}
                  instant={reduced}
                  className={cn(
                    "text-sm font-medium tabular-nums transition-colors duration-300",
                    zone && ["rounded-full px-2 py-0.5 text-xs", ZONE_PILL[zone.tone], ZONE_TEXT[zone.tone]]
                  )}
                />
              </div>
            </React.Fragment>
          )
        })}

        <div aria-hidden className="relative mt-1.5 h-4" style={{ gridColumn: 2, gridRow: n + 1 }}>
          {(zones?.length ? [0, ...thresholds, top] : ticks).map((t, i, all) => (
            <span
              key={`${t}-${i}`}
              className={cn(
                "absolute text-[11px] text-muted-foreground tabular-nums",
                i === 0 ? "" : i === all.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              )}
              style={{ left: `${at(t)}%` }}
            >
              {(formatAxis ?? formatValue)(t)}
            </span>
          ))}
        </div>
      </div>

      <div aria-hidden className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {percentiles.map((p, j) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className="h-2 w-3.5 rounded-full" style={{ background: layerColor(color, j) }} />
            {p.label}
          </span>
        ))}
        {zones?.map((z) => (
          <span key={z.label} className={cn("flex items-center gap-1.5", ZONE_TEXT[z.tone])}>
            <span className={cn("size-2.5 rounded-[3px]", ZONE_SWATCH[z.tone])} />
            {z.label}
          </span>
        ))}
      </div>

      <ChartDescription
        label={label}
        columns={[...percentiles.map((p) => p.label), ...(zones?.length ? ["Rating"] : [])]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [
            ...matrix[k].map((v) => formatValue(v)),
            ...(zones?.length ? [zoneOf(scores[k])?.label ?? ""] : []),
          ],
        }))}
        live={activeIndex !== null ? describe(activeIndex) : ""}
      />
    </div>
  )
}
