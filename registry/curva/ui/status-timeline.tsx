"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { clamp, useActivePoint, useElementSize, useFollow } from "@/registry/curva/lib/curva"
import { ChartDescription, ChartTooltip, Count } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type TimelineState = {
  /** The value of `status` this state stands for. */
  value: string
  label: string
  /** Any CSS color. */
  color: string
  /** Stripes instead of a fill, for states such as "not recorded". */
  hatched?: boolean
}

export type StatusTimelineProps<T extends Datum> = {
  /** One point per period, oldest first. */
  data: readonly T[]
  /** Key of the label for each period. */
  index: keyof T & string
  /** Key of each period's state. */
  status: keyof T & string
  /** Every state, in the order the legend lists them. */
  states: readonly TimelineState[]
  /** Accessible name of the chart. */
  label: string
  /** A line of detail for the tooltip, such as how long a store was paused. */
  detail?: (point: T) => string | null | undefined
  /** List each state with how many periods it covers. */
  legend?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a period. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const RISE = { type: "spring", stiffness: 520, damping: 30 } as const
/** Seconds the entrance takes to cross the strip. */
const SWEEP = 0.55

function fillOf(state: TimelineState | undefined): React.CSSProperties {
  if (!state) return { backgroundColor: "color-mix(in oklab, var(--foreground) 8%, transparent)" }
  if (state.hatched) {
    return {
      backgroundImage: `repeating-linear-gradient(-45deg, ${state.color} 0 1.5px, transparent 1.5px 4.5px)`,
      boxShadow: `inset 0 0 0 1px ${state.color}`,
    }
  }
  return { backgroundColor: state.color }
}

const formatCount = (v: number) => String(Math.round(v))

export function StatusTimeline<T extends Datum>({
  data,
  index,
  status,
  states,
  label,
  detail,
  legend = true,
  className,
  onActiveChange,
}: StatusTimelineProps<T>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const stripRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const strip = useElementSize(stripRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.5 })
  const reduced = useReducedMotion() ?? false
  const [focus, setFocus] = React.useState<number | null>(null)

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1200)
    return () => clearTimeout(timer)
  }, [inView])

  const n = data.length
  const labels = data.map((d) => String(d[index]))
  const stateOf = data.map((d) => states.findIndex((s) => s.value === String(d[status])))
  const counts = states.map((_, j) => stateOf.filter((s) => s === j).length)
  const details = data.map((d) => detail?.(d) ?? null)

  const gap = n > 0 ? clamp((strip.width / n) * 0.22, 1, 4) : 2
  const pitch = n > 0 ? (strip.width + gap) / n : 0
  const cell = Math.max(0, pitch - gap)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const tipX = useFollow(
    clamp(shownIndex * pitch + cell / 2 - tip.width / 2, 0, Math.max(0, strip.width - tip.width)),
    fresh
  )

  const indexAt = (clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect()
    if (!rect || pitch <= 0) return null
    return clamp(Math.floor((clientX - rect.left) / pitch), 0, n - 1)
  }

  const describe = (k: number) =>
    `${labels[k]}: ${states[stateOf[k]]?.label ?? "Unknown"}${details[k] ? `, ${details[k]}` : ""}`

  const shownState = states[stateOf[shownIndex]]

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
        ref={stripRef}
        onPointerMove={(e) => select(indexAt(e.clientX))}
        onPointerDown={(e) => select(indexAt(e.clientX))}
        onPointerLeave={() => select(null)}
        className="relative flex h-9 touch-pan-y select-none"
        style={{ gap }}
      >
        {data.map((_, k) => {
          const quiet = focus !== null && stateOf[k] !== focus
          const delay = settled || reduced ? 0 : (n <= 1 ? 0 : k / (n - 1)) * SWEEP
          return (
            <motion.div
              key={k}
              className="h-full min-w-0 flex-1 origin-bottom transition-[background-color,opacity] duration-300"
              style={{ ...fillOf(states[stateOf[k]]), borderRadius: Math.min(4, cell / 2), opacity: quiet ? 0.22 : 1 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: inView ? (activeIndex === k ? 1.18 : 1) : 0 }}
              transition={reduced ? { duration: 0 } : { ...RISE, delay: activeIndex === null ? delay : 0 }}
            />
          )
        })}

        <ChartTooltip
          ref={tipRef}
          title={labels[shownIndex] ?? ""}
          rows={[]}
          active={activeIndex !== null}
          fresh={fresh}
          format={formatCount}
          style={{ x: tipX, y: -tip.height - 10 }}
          footer={
            <div className="text-sm">
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={fillOf(shownState)} />
                {shownState?.label ?? "Unknown"}
              </p>
              {details[shownIndex] && (
                <p className="text-[11px] text-muted-foreground">{details[shownIndex]}</p>
              )}
            </div>
          }
        />
      </div>

      <div aria-hidden className="mt-2 flex justify-between gap-4 text-xs text-muted-foreground">
        <span>{labels[0]}</span>
        <span>{labels[n - 1]}</span>
      </div>

      {legend && (
        <ul aria-hidden className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {states.map((s, j) => (
            <li
              key={s.value}
              onPointerEnter={() => setFocus(j)}
              onPointerLeave={() => setFocus(null)}
              className={cn(
                "flex cursor-default items-center gap-1.5 transition-opacity duration-200",
                focus !== null && focus !== j && "opacity-50"
              )}
            >
              <span className="size-2.5 rounded-[3px]" style={fillOf(s)} />
              {s.label}
              <Count
                value={inView ? counts[j] : 0}
                format={formatCount}
                className="font-medium text-foreground tabular-nums"
              />
            </li>
          ))}
        </ul>
      )}

      <ChartDescription
        label={label}
        columns={["Status", "Detail"]}
        rows={labels.map((text, k) => ({
          label: text,
          values: [states[stateOf[k]]?.label ?? "Unknown", details[k] ?? ""],
        }))}
        live={activeIndex !== null ? describe(activeIndex) : ""}
      />
    </div>
  )
}
