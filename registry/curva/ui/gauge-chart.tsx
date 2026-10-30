"use client"

import * as React from "react"
import { arc as d3Arc, type DefaultArcObject } from "d3-shape"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { clamp, formatNumber, formatPercent, useElementSize } from "@/registry/curva/lib/curva"
import { Count } from "@/registry/curva/ui/chart-parts"

export type GaugeChartProps = {
  value: number
  max: number
  /** Accessible name of the gauge. */
  label: string
  /** The line above the number. Defaults to `label`. */
  caption?: string
  /** Number of blocks along the arc. */
  segments?: number
  /** Any CSS color. The arc ramps up to it from a lighter tint. */
  color?: string
  /** Marks a target on the arc. */
  target?: number
  formatValue?: (value: number) => string
  className?: string
}

/** Seconds between one block lighting up and the next. */
const BLOCK_STEP = 0.034
const POP = { type: "spring", stiffness: 520, damping: 24 } as const
const PAD = 12

type ArcDatum = Required<DefaultArcObject> & { cornerRadius: number }

const ARC = d3Arc<ArcDatum>()
  .innerRadius((d) => d.innerRadius)
  .outerRadius((d) => d.outerRadius)
  .startAngle((d) => d.startAngle)
  .endAngle((d) => d.endAngle)
  .padAngle((d) => d.padAngle)
  .cornerRadius((d) => d.cornerRadius)

export function GaugeChart({
  value,
  max,
  label,
  caption = label,
  segments = 24,
  color = "var(--chart-1)",
  target,
  formatValue = formatNumber,
  className,
}: GaugeChartProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.5 })
  const reduced = useReducedMotion() ?? false
  const [hovered, setHovered] = React.useState(false)

  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0
  const lit = inView ? Math.round(ratio * segments) : 0

  // Blocks light up (or go out) one by one, starting from where the last change ended.
  const [wave, setWave] = React.useState({ lit: 0, from: 0 })
  if (wave.lit !== lit) setWave({ lit, from: wave.lit })

  const radius = Math.max(0, Math.min(size.width / 2, size.height) - PAD)
  const inner = radius * 0.64
  const step = Math.PI / segments
  const cx = size.width / 2
  const cy = PAD + radius

  const markerAngle = target !== undefined && max > 0 ? -Math.PI / 2 + clamp(target / max, 0, 1) * Math.PI : null

  return (
    <div
      ref={rootRef}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${formatValue(value)} of ${formatValue(max)}`}
      tabIndex={0}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        "relative mx-auto aspect-[2/1.08] w-full max-w-sm rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          <g transform={`translate(${cx} ${cy})`}>
            {Array.from({ length: segments }, (_, i) => {
              const start = -Math.PI / 2 + i * step
              const d =
                ARC({
                  startAngle: start,
                  endAngle: start + step,
                  innerRadius: inner,
                  outerRadius: radius,
                  padAngle: step * 0.24,
                  cornerRadius: Math.min(4, (radius - inner) / 4),
                }) ?? ""
              const on = i < wave.lit
              const delay = reduced
                ? 0
                : Math.max(0, on ? (i - wave.from) * BLOCK_STEP : (wave.from - 1 - i) * BLOCK_STEP)
              const tint = Math.round(38 + 62 * (i / Math.max(1, segments - 1)))
              return (
                <g key={i}>
                  <path d={d} className="fill-muted" />
                  <motion.path
                    d={d}
                    style={{ fill: `color-mix(in oklab, ${color} ${tint}%, transparent)` }}
                    initial={false}
                    animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.6 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { opacity: { duration: 0.16, delay }, scale: { ...POP, delay } }
                    }
                  />
                </g>
              )
            })}
            {markerAngle !== null && (
              <line
                x1={Math.sin(markerAngle) * (radius + 3)}
                y1={-Math.cos(markerAngle) * (radius + 3)}
                x2={Math.sin(markerAngle) * (radius + 10)}
                y2={-Math.cos(markerAngle) * (radius + 10)}
                className="stroke-foreground"
                strokeWidth={2}
                strokeLinecap="round"
              />
            )}
          </g>
        </svg>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
        <p className="text-xs text-muted-foreground">{caption}</p>
        <Count
          value={inView ? value : 0}
          format={formatValue}
          instant={reduced}
          className="mt-0.5 block text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
        />
        <div className="relative mt-0.5 h-4 text-xs text-muted-foreground tabular-nums">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={hovered ? "left" : "share"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {hovered
                ? value >= max
                  ? "Target reached"
                  : `${formatValue(max - value)} left`
                : `${formatPercent(ratio * 100)} of ${formatValue(max)}`}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
