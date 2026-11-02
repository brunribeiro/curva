"use client"

import * as React from "react"
import { curveMonotoneX, line as d3Line } from "d3-shape"
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
  PAD,
  clamp,
  formatNumber,
  labelStep,
  niceDomain,
  useActivePoint,
  useElementSize,
  useFollow,
  waveFrame,
  type Frame,
} from "@/registry/curva/lib/curva"
import {
  ChartDescription,
  ChartGrid,
  ChartTooltip,
  XAxis,
  YAxis,
  type TooltipRow,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type ComboSeries<T extends Datum> = {
  /** Key of the numeric value. Line values may be null where nothing was measured. */
  key: keyof T & string
  label: string
  /** Any CSS color. */
  color?: string
  /** Formats this series on its axis, in the tooltip and for screen readers. */
  format?: (value: number) => string
}

export type ComboBand = {
  /** Label of the first point the band covers. */
  from: string
  /** Label of the last point the band covers. */
  to: string
  /** What happened, such as "Paused". */
  label: string
}

export type ComboChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each point (x). */
  index: keyof T & string
  /** The bars, read on the left axis. */
  bar: ComboSeries<T>
  /** The line, read on the right axis. */
  line: ComboSeries<T>
  /** Accessible name of the chart. */
  label: string
  /** Key of a flag; bars whose flag is truthy take `flagColor` and still show when empty. */
  flag?: keyof T & string
  /** What a flagged bar means, for the tooltip and legend. */
  flagLabel?: string
  flagColor?: string
  /** Label of the point where a "Now" line stands; later bars are still to come and fade. */
  now?: string
  /** Stretches shaded behind the bars, such as pauses or outages. */
  bands?: readonly ComboBand[]
  /** Show a legend under the chart. */
  legend?: boolean
  showGrid?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a point. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const GROW = { type: "spring", stiffness: 240, damping: 24, mass: 0.9 } as const
const ENTRANCE_WAVE = 0.5
const MORPH_WAVE = 0.16
const MORPH = { duration: 0.8, stagger: 0.3 }
/** The line draws in once the bars are up. */
const DRAW = { duration: 0.9, delay: 0.5, ease: [0.4, 0, 0.2, 1] } as const

const RADIUS = 3
const MAX_BAR = 28
/** Room above the plot for band labels and the "Now" tag. */
const TAG_ROOM = 20
/** About how wide the "Now" tag is. */
const NOW_TAG = 32
/** Label steps that land on round times: with 15-minute slots, every hour, two, three or six. */
const NICE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 48]

function comboFrame(width: number, height: number, room: number): Frame {
  const left = PAD.axis
  const right = width - PAD.axis
  const top = PAD.top + room
  const bottom = height - PAD.labels
  return { left, right, top, bottom, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/** Fills the gaps between measured values, so the line reads as one trend. */
function bridge(values: readonly (number | null)[]) {
  const known = values.flatMap((v, k) => (v === null ? [] : [k]))
  const filled = values.map((v, k) => {
    if (v !== null) return v
    const next = known.find((j) => j > k)
    const prev = [...known].reverse().find((j) => j < k)
    if (prev === undefined && next === undefined) return 0
    if (prev === undefined) return values[next as number] ?? 0
    if (next === undefined) return values[prev] ?? 0
    const a = values[prev] ?? 0
    const b = values[next] ?? 0
    return a + ((b - a) * (k - prev)) / (next - prev)
  })
  return { filled, first: known[0] ?? -1, last: known[known.length - 1] ?? -1 }
}

export function ComboChart<T extends Datum>({
  data,
  index,
  bar,
  line,
  label,
  flag,
  flagLabel = "Flagged",
  flagColor = "var(--destructive)",
  now,
  bands,
  legend = true,
  showGrid = true,
  className,
  onActiveChange,
}: ComboChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const lineRef = React.useRef<SVGPathElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1600)
    return () => clearTimeout(timer)
  }, [inView])

  const barColor = bar.color ?? "var(--chart-1)"
  const lineColor = line.color ?? "var(--chart-2)"
  const formatBar = bar.format ?? formatNumber
  const formatLine = line.format ?? formatNumber

  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const bars = React.useMemo(() => data.map((d) => Math.max(0, Number(d[bar.key]) || 0)), [data, bar.key])
  const flags = data.map((d) => (flag ? Boolean(d[flag]) : false))
  const measured = React.useMemo(
    () =>
      data.map((d) => {
        const v = d[line.key]
        return v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v)
      }),
    [data, line.key]
  )

  const barDomain = React.useMemo(() => niceDomain(bars), [bars])
  const lineDomain = React.useMemo(
    () => niceDomain(measured.filter((v): v is number => v !== null)),
    [measured]
  )
  const lineTarget = React.useMemo(() => {
    const { filled, first, last } = bridge(measured)
    const span = lineDomain.hi - lineDomain.lo
    return { values: filled.map((v) => (v - lineDomain.lo) / span), first, last }
  }, [measured, lineDomain])

  const n = data.length
  const nowIndex = now === undefined ? -1 : labels.indexOf(now)
  const spans = (bands ?? [])
    .map((b) => ({ ...b, start: labels.indexOf(b.from), end: labels.indexOf(b.to) }))
    .filter((s) => s.start >= 0 && s.end >= s.start)
  const room = spans.length > 0 || nowIndex >= 0 ? TAG_ROOM : 0

  const frame = comboFrame(size.width, size.height, room)
  const band = n > 0 ? frame.w / n : 0
  const barWidth = Math.min(band * 0.68, MAX_BAR)
  const radius = Math.min(RADIUS, barWidth / 3)
  const centerOf = (k: number) => frame.left + band * (k + 0.5)
  const barY = (v: number) => frame.top + (1 - (v - barDomain.lo) / (barDomain.hi - barDomain.lo)) * frame.h
  const lineY = (u: number) => frame.top + (1 - u) * frame.h
  const base = barY(0)

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  // The line is painted from values that morph, outside React renders.
  const progress = useMotionValue(1)
  const shape = React.useRef({ from: lineTarget.values, to: lineTarget.values, first: -1, last: -1 })
  const geometry = React.useRef({ frame, band })
  const dots = React.useRef(new Map<number, SVGCircleElement>())
  const generator = React.useMemo(() => d3Line<[number, number]>().curve(curveMonotoneX), [])

  const paint = React.useCallback(() => {
    const { frame: f, band: b } = geometry.current
    const s = shape.current
    if (f.w <= 0 || s.first < 0) {
      lineRef.current?.setAttribute("d", "")
      return
    }
    const values = s.to.length > 1 ? waveFrame(s.from, s.to, progress.get(), MORPH.stagger) : s.to
    const x = (k: number) => f.left + b * (k + 0.5)
    const y = (u: number) => f.top + (1 - u) * f.h
    const points: [number, number][] = []
    for (let k = s.first; k <= s.last; k++) points.push([x(k), y(values[k] ?? 0)])
    lineRef.current?.setAttribute("d", generator(points) ?? "")
    dots.current.forEach((el, k) => {
      el.setAttribute("cx", String(x(k)))
      el.setAttribute("cy", String(y(values[k] ?? 0)))
    })
  }, [generator, progress])

  useMotionValueEvent(progress, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = { frame, band }
    paint()
  })

  // After the entrance, new values reshape the line in a wave; a new length swaps in.
  React.useLayoutEffect(() => {
    const s = shape.current
    const next = { to: lineTarget.values, first: lineTarget.first, last: lineTarget.last }
    if (!settled || reduced || s.to.length !== next.to.length || next.to.length < 2) {
      shape.current = { ...next, from: next.to }
      progress.jump(1)
      paint()
      return
    }
    shape.current = { ...next, from: waveFrame(s.from, s.to, progress.get(), MORPH.stagger) }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [lineTarget, settled, reduced, paint, progress])

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || frame.w <= 0 || n === 0) return 0
    return Math.min(n - 1, Math.floor(clamp((clientX - rect.left - frame.left) / frame.w, 0, 1) * n))
  }

  // Band labels stop short of the next tag to their right, so tags never overlap.
  const tagStarts = [
    ...spans.map((s) => centerOf(s.start) - band / 2),
    ...(nowIndex >= 0 ? [centerOf(nowIndex) - NOW_TAG / 2] : []),
  ]
  const tagRoom = (left: number, wanted: number) =>
    Math.max(0, Math.min(wanted, ...tagStarts.filter((x) => x > left + 1).map((x) => x - left - 4)))

  const isActive = activeIndex !== null
  const shownLine = measured[shownIndex] ?? null
  const shownTop = Math.min(
    barY(bars[shownIndex] ?? 0),
    shownLine === null ? Infinity : lineY(lineTarget.values[shownIndex] ?? 0)
  )

  // The highlight, the tooltip and the active line dot travel with the column.
  const inset = Math.min(4, band * 0.08)
  const bandX = useFollow(centerOf(shownIndex) - band / 2 + inset, fresh)
  const rightSide = centerOf(shownIndex) + band / 2 + 8
  const tipLeft = rightSide + tip.width <= size.width ? rightSide : centerOf(shownIndex) - band / 2 - 8 - tip.width
  const tipX = useFollow(clamp(tipLeft, 0, Math.max(0, size.width - tip.width)), fresh)
  const tipY = useFollow(clamp(shownTop - 8, 0, Math.max(0, frame.bottom - tip.height)), fresh)
  const dotX = useFollow(centerOf(shownIndex), fresh)
  const dotY = useFollow(lineY(lineTarget.values[shownIndex] ?? 0), fresh)

  const rows: TooltipRow[] = [
    {
      key: "bar",
      label: bar.label,
      color: flags[shownIndex] ? flagColor : barColor,
      value: bars[shownIndex] ?? 0,
      format: formatBar,
    },
  ]
  if (shownLine !== null) {
    rows.push({ key: "line", label: line.label, color: lineColor, value: shownLine, format: formatLine })
  }
  const shownSpans = spans.filter((s) => shownIndex >= s.start && shownIndex <= s.end)
  const notes = [
    flags[shownIndex] ? flagLabel : null,
    shownLine === null ? `${line.label}: not measured` : null,
    ...shownSpans.map((s) => `${s.label}, ${s.from} to ${s.to}`),
  ].filter((note): note is string => note !== null)

  const describe = (k: number) =>
    [
      `${labels[k]}: ${bar.label} ${formatBar(bars[k])}`,
      flags[k] ? flagLabel : null,
      measured[k] === null ? `${line.label} not measured` : `${line.label} ${formatLine(measured[k] ?? 0)}`,
      ...spans.filter((s) => k >= s.start && k <= s.end).map((s) => s.label),
    ]
      .filter(Boolean)
      .join(", ")

  const barTicks = barDomain.ticks.map((t) => (inView ? t : 0))
  const lineTicks = lineDomain.ticks.map((t) => (inView ? t : 0))
  const anyFlag = flags.some(Boolean)

  return (
    <div className={cn("flex h-72 w-full flex-col", className)}>
      <div
        ref={rootRef}
        role="group"
        aria-roledescription="chart"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => n > 0 && select(indexAt(e.clientX))}
        onPointerDown={(e) => n > 0 && select(indexAt(e.clientX))}
        onPointerLeave={() => select(null)}
        onKeyDown={onKeyDown}
        onBlur={() => select(null)}
        className="relative min-h-0 w-full flex-1 touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {size.width > 0 && (
          <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
            <defs>
              <clipPath id={`${id}-plot`}>
                <rect x={0} y={0} width={size.width} height={Math.max(0, base)} />
              </clipPath>
              <clipPath id={`${id}-draw`}>
                <motion.rect
                  x={0}
                  y={0}
                  height={size.height}
                  initial={{ width: 0 }}
                  animate={{ width: inView ? size.width : 0 }}
                  transition={settled || reduced ? { duration: 0 } : DRAW}
                />
              </clipPath>
              <pattern id={`${id}-hatch`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={6} className="stroke-foreground/10" strokeWidth={2.5} />
              </pattern>
            </defs>

            {spans.map((s, i) => (
              <motion.rect
                key={`${s.label}-${s.start}`}
                x={centerOf(s.start) - band / 2}
                y={frame.top}
                width={band * (s.end - s.start + 1)}
                height={frame.h}
                fill={`url(#${id}-hatch)`}
                className="stroke-foreground/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ duration: 0.4, delay: settled || reduced ? 0 : 0.7 + i * 0.08 }}
              />
            ))}

            <motion.rect
              y={frame.top - 4}
              height={frame.h + 4}
              rx={6}
              width={Math.max(0, band - inset * 2)}
              style={{ x: bandX }}
              className="fill-foreground/[0.05]"
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: 0.18 }}
            />

            {showGrid && <ChartGrid frame={frame} lines={barTicks.length} />}
            <YAxis ticks={barTicks} frame={frame} format={formatBar} />
            <YAxis ticks={lineTicks} frame={frame} format={formatLine} side="right" />

            <g clipPath={`url(#${id}-plot)`}>
              {bars.map((v, k) => {
                const flagged = flags[k]
                // A flagged point with nothing in it still shows a sliver.
                const top = Math.min(barY(v), base - (flagged ? 4 : 0))
                const later = nowIndex >= 0 && k > nowIndex
                const quiet = activeIndex !== null && activeIndex !== k
                const u = n <= 1 ? 0 : k / (n - 1)
                const delay = u * (settled ? MORPH_WAVE : ENTRANCE_WAVE)
                return (
                  <motion.rect
                    key={k}
                    rx={radius}
                    className="transition-[fill] duration-300"
                    style={{ fill: flagged ? flagColor : barColor }}
                    initial={{ x: centerOf(k) - barWidth / 2, width: barWidth, y: base, height: 0 }}
                    animate={
                      inView
                        ? {
                            x: centerOf(k) - barWidth / 2,
                            width: barWidth,
                            y: top,
                            height: base - top + radius,
                            opacity: later ? 0.32 : quiet ? 0.45 : 1,
                          }
                        : { x: centerOf(k) - barWidth / 2, width: barWidth, y: base, height: 0 }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            x: GROW,
                            width: GROW,
                            y: { ...GROW, delay },
                            height: { ...GROW, delay },
                            opacity: { duration: 0.2 },
                          }
                    }
                  />
                )
              })}
            </g>

            {nowIndex >= 0 && (
              <motion.line
                x1={centerOf(nowIndex)}
                x2={centerOf(nowIndex)}
                y1={frame.top - 4}
                y2={frame.bottom}
                className="stroke-foreground/50"
                strokeDasharray="3 3"
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ duration: 0.3, delay: settled || reduced ? 0 : 0.9 }}
              />
            )}

            <g clipPath={`url(#${id}-draw)`}>
              <path
                ref={lineRef}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {measured.map((v, k) =>
                v === null ? null : (
                  <circle
                    key={k}
                    ref={(el) => {
                      if (el) dots.current.set(k, el)
                      else dots.current.delete(k)
                    }}
                    r={2.25}
                    fill={lineColor}
                    className="stroke-card"
                    strokeWidth={1}
                  />
                )
              )}
            </g>

            <XAxis
              labels={labels}
              xOf={centerOf}
              y={size.height - 8}
              step={NICE_STEPS.find((s) => s >= labelStep(n, frame.w)) ?? labelStep(n, frame.w)}
              activeIndex={activeIndex}
            />

            <motion.g
              initial={false}
              animate={{ opacity: isActive && shownLine !== null ? 1 : 0 }}
              transition={{ duration: 0.16 }}
            >
              <motion.circle cx={dotX} cy={dotY} r={4.5} className="fill-background" stroke={lineColor} strokeWidth={2.5} />
            </motion.g>
          </svg>
        )}

        {size.width > 0 &&
          spans.map((s, i) => (
            <motion.p
              key={`${s.label}-${s.start}`}
              aria-hidden
              className="pointer-events-none absolute truncate border-l-2 border-foreground/20 pl-1 text-[10px] leading-4 text-muted-foreground"
              style={{
                left: centerOf(s.start) - band / 2,
                top: PAD.top,
                maxWidth: tagRoom(centerOf(s.start) - band / 2, Math.max(band * (s.end - s.start + 1), 64)),
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 4 }}
              transition={{ duration: 0.35, delay: settled || reduced ? 0 : 0.8 + i * 0.08 }}
            >
              {s.label}
            </motion.p>
          ))}

        {size.width > 0 && nowIndex >= 0 && (
          <motion.p
            aria-hidden
            className="pointer-events-none absolute rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-semibold text-background"
            style={{ left: centerOf(nowIndex), top: PAD.top, x: "-50%" }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : 0.6 }}
            transition={{ type: "spring", stiffness: 480, damping: 24, delay: settled || reduced ? 0 : 1 }}
          >
            Now
          </motion.p>
        )}

        <ChartTooltip
          ref={tipRef}
          title={labels[shownIndex] ?? ""}
          rows={rows}
          active={isActive}
          fresh={fresh}
          format={formatBar}
          style={{ x: tipX, y: tipY }}
          footer={
            notes.length > 0 ? (
              <div className="mt-1.5 space-y-0.5 border-t pt-1.5 text-[11px] text-muted-foreground">
                {notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null
          }
        />

        <ChartDescription
          label={label}
          columns={[bar.label, line.label]}
          rows={labels.map((text, k) => ({
            label: text,
            values: [formatBar(bars[k]), measured[k] === null ? "" : formatLine(measured[k] ?? 0)],
          }))}
          live={activeIndex !== null ? describe(activeIndex) : ""}
        />
      </div>

      {legend && (
        <ul aria-hidden className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: barColor }} />
            {bar.label}
          </li>
          {anyFlag && (
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: flagColor }} />
              {flagLabel}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <span className="relative flex w-4 items-center">
              <span className="h-0.5 w-full rounded-full" style={{ background: lineColor }} />
              <span className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full" style={{ background: lineColor }} />
            </span>
            {line.label}
          </li>
        </ul>
      )}
    </div>
  )
}
