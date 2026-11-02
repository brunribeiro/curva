"use client"

import * as React from "react"
import { area as d3Area, curveMonotoneX, line as d3Line } from "d3-shape"
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  PAD,
  SAMPLES,
  changeOf,
  clamp,
  flat,
  formatChange,
  formatCompact,
  formatNumber,
  frameOf,
  labelStep,
  niceDomain,
  normalize,
  sampleAt,
  sampleMonotone,
  useActivePoint,
  useElementSize,
  waveFrame,
  type Frame,
  type Rising,
} from "@/registry/curva/lib/curva"
import {
  ChangeBadge,
  ChartDescription,
  ChartGrid,
  ChartTooltip,
  XAxis,
  YAxis,
  type TooltipRow,
} from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type AreaMarker = {
  /** The label of the point the marker stands on. */
  at: string
  /** What happened, listed under the chart. */
  label: string
}

export type AreaChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each point (x). */
  index: keyof T & string
  /** Key of the numeric value for each point (y). */
  value: keyof T & string
  /** Accessible name of the chart, also the series name in the tooltip. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  /** Formats values in the tooltip and for screen readers. */
  formatValue?: (value: number) => string
  /** Formats the y-axis labels. */
  formatAxis?: (value: number) => string
  /** Key of the previous period's value at the same position, drawn as a dashed line. */
  previous?: keyof T & string
  /** Name of the previous period in the tooltip and legend. */
  previousLabel?: string
  /** Whether a rise is good news; colors the change in the tooltip. */
  rising?: Rising
  /** Numbered marks for things that happened, such as a launch or a price change. */
  markers?: readonly AreaMarker[]
  showXAxis?: boolean
  showYAxis?: boolean
  showGrid?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a point. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

/** How the active dot rides the curve between points. */
const GLIDE = { stiffness: 380, damping: 36, mass: 0.7 }

const ENTRANCE = { duration: 1.25, stagger: 0.5 }
const MORPH = { duration: 0.9, stagger: 0.24 }

/** Room above the plot for marker badges. */
const MARKER_ROOM = 22
const PREVIOUS = "color-mix(in oklab, var(--muted-foreground) 75%, transparent)"

function plotFrame(width: number, height: number, xAxis: boolean, yAxis: boolean, room: number): Frame {
  const f = frameOf(width, height, xAxis, yAxis)
  return { ...f, top: f.top + room, h: Math.max(0, f.h - room) }
}

export function AreaChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  formatAxis = formatCompact,
  previous,
  previousLabel = "Previous period",
  rising = "good",
  markers,
  showXAxis = true,
  showYAxis = true,
  showGrid = true,
  className,
  onActiveChange,
}: AreaChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 2000)
    return () => clearTimeout(timer)
  }, [inView])

  const values = React.useMemo(() => data.map((d) => Number(d[value]) || 0), [data, value])
  const previousValues = React.useMemo(
    () => (previous ? data.map((d) => Number(d[previous]) || 0) : null),
    [data, previous]
  )
  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const domain = React.useMemo(
    () => niceDomain(previousValues ? [...values, ...previousValues] : values),
    [values, previousValues]
  )
  const target = React.useMemo(
    () => sampleMonotone(normalize(values, domain), SAMPLES),
    [values, domain]
  )
  const previousTarget = React.useMemo(
    () => (previousValues ? sampleMonotone(normalize(previousValues, domain), SAMPLES) : null),
    [previousValues, domain]
  )
  const baseline = -domain.lo / (domain.hi - domain.lo)

  // Markers on the same point share one badge, numbered in the order they happened.
  const marks = React.useMemo(() => {
    const placed = (markers ?? [])
      .map((m, order) => ({ ...m, k: labels.indexOf(m.at), order }))
      .filter((m) => m.k >= 0)
      .sort((a, b) => a.k - b.k || a.order - b.order)
      .map((m, i) => ({ ...m, number: i + 1 }))
    const groups: { k: number; numbers: number[] }[] = []
    placed.forEach((m) => {
      const last = groups[groups.length - 1]
      if (last?.k === m.k) last.numbers.push(m.number)
      else groups.push({ k: m.k, numbers: [m.number] })
    })
    return { placed, groups }
  }, [markers, labels])
  const room = marks.placed.length > 0 ? MARKER_ROOM : 0

  const n = values.length
  const frame = plotFrame(size.width, size.height, showXAxis, showYAxis, room)
  const xOf = (k: number) => frame.left + (n <= 1 ? 0 : k / (n - 1)) * frame.w

  const { activeIndex, shownIndex, fresh, select, onKeyDown } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  // Everything that moves is a motion value painted outside React renders.
  const progress = useMotionValue(0)
  const glide = useSpring(0, GLIDE)
  const reveal = useSpring(1, GLIDE)
  const lineD = useMotionValue("")
  const areaD = useMotionValue("")
  const previousD = useMotionValue("")
  const dotX = useMotionValue(0)
  const dotY = useMotionValue(0)
  const previousDotY = useMotionValue(0)
  const revealX = useMotionValue(0)
  const tipX = useMotionValue(0)
  const tipY = useMotionValue(0)

  const shape = React.useRef({
    from: flat(0),
    to: flat(0),
    out: flat(0),
    previousFrom: flat(0),
    previousTo: null as number[] | null,
    previousOut: flat(0),
    baseline: 0,
    stagger: ENTRANCE.stagger,
    entered: false,
  })
  const geometry = React.useRef({ frame, width: 0 })
  const generators = React.useMemo(
    () => ({
      line: d3Line<number>().curve(curveMonotoneX),
      area: d3Area<number>().curve(curveMonotoneX),
    }),
    []
  )

  const paint = React.useCallback(() => {
    const { frame: f, width } = geometry.current
    if (f.w <= 0) return
    const s = shape.current
    const p = progress.get()
    const current = waveFrame(s.from, s.to, p, s.stagger, s.out)
    const px = (_: number, j: number) => f.left + (j / (SAMPLES - 1)) * f.w
    const py = (v: number) => f.top + (1 - Math.max(v, 0)) * f.h
    const base = py(clamp(s.baseline, 0, 1))

    lineD.set(generators.line.x(px).y(py)(current) ?? "")
    areaD.set(generators.area.x(px).y0(base).y1(py)(current) ?? "")

    const u = glide.get()
    const x = f.left + u * f.w
    const y = py(sampleAt(current, u))
    dotX.set(x)
    dotY.set(y)

    if (s.previousTo) {
      const before = waveFrame(s.previousFrom, s.previousTo, p, s.stagger, s.previousOut)
      previousD.set(generators.line.x(px).y(py)(before) ?? "")
      previousDotY.set(py(sampleAt(before, u)))
    }

    const r = reveal.get()
    revealX.set(r >= 0.999 ? width : f.left + r * f.w)

    const tip = tipRef.current
    if (tip) {
      const w = tip.offsetWidth
      const h = tip.offsetHeight
      tipX.set(clamp(x - w / 2, 0, Math.max(0, width - w)))
      tipY.set(y - h - 14 < 0 ? y + 14 : y - h - 14)
    }
  }, [areaD, dotX, dotY, generators, glide, lineD, previousD, previousDotY, progress, reveal, revealX, tipX, tipY])

  useMotionValueEvent(progress, "change", paint)
  useMotionValueEvent(glide, "change", paint)
  useMotionValueEvent(reveal, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = {
      frame: plotFrame(size.width, size.height, showXAxis, showYAxis, room),
      width: size.width,
    }
    paint()
  }, [size.width, size.height, showXAxis, showYAxis, room, paint])

  // New data: morph from whatever is on screen right now, even mid-animation.
  React.useLayoutEffect(() => {
    const s = shape.current
    s.baseline = baseline
    if (!s.entered) {
      s.from = flat(baseline)
      s.to = target
      s.previousFrom = flat(baseline)
      s.previousTo = previousTarget
      paint()
      return
    }
    const p = progress.get()
    s.from = waveFrame(s.from, s.to, p, s.stagger)
    s.previousFrom = s.previousTo ? waveFrame(s.previousFrom, s.previousTo, p, s.stagger) : flat(baseline)
    s.to = target
    s.previousTo = previousTarget
    s.stagger = MORPH.stagger
    if (reduced) {
      progress.jump(1)
      paint()
      return
    }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [target, previousTarget, baseline, reduced, paint, progress])

  // The one orchestrated moment: the curve rises from the baseline in a wave.
  React.useEffect(() => {
    const s = shape.current
    if (!inView || size.width === 0 || s.entered) return
    s.entered = true
    s.stagger = ENTRANCE.stagger
    if (reduced) {
      progress.jump(1)
      paint()
      return
    }
    progress.jump(0)
    animate(progress, 1, { duration: ENTRANCE.duration, ease: "linear", delay: 0.1 })
  }, [inView, size.width, reduced, paint, progress])

  // The dot glides along the curve; what lies right of it goes quiet.
  React.useEffect(() => {
    if (activeIndex === null) {
      if (reduced) reveal.jump(1)
      else reveal.set(1)
      return
    }
    const u = n <= 1 ? 0 : activeIndex / (n - 1)
    if (fresh || reduced) glide.jump(u)
    else glide.set(u)
    if (reduced) reveal.jump(u)
    else reveal.set(u)
  }, [activeIndex, fresh, n, reduced, glide, reveal])

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || frame.w <= 0) return 0
    return Math.round(clamp((clientX - rect.left - frame.left) / frame.w, 0, 1) * (n - 1))
  }

  // Markers drop in once the curve has passed them.
  const markDelay = (k: number) => (settled ? 0 : 0.55 + (n <= 1 ? 0 : k / (n - 1)) * 0.8)

  const isActive = activeIndex !== null
  const ticks = domain.ticks.map((t) => (inView ? t : 0))

  const rows: TooltipRow[] = [{ key: value, label, color, value: values[shownIndex] ?? 0 }]
  if (previousValues) {
    rows.push({ key: "previous", label: previousLabel, color: PREVIOUS, value: previousValues[shownIndex] ?? 0 })
  }
  const changeAt = (k: number) => (previousValues ? changeOf(values[k] ?? 0, previousValues[k] ?? 0) : null)
  const shownChange = changeAt(shownIndex)
  const shownMarks = marks.placed.filter((m) => m.k === shownIndex)

  const describe = (k: number) => {
    const change = changeAt(k)
    return [
      `${labels[k]}: ${formatValue(values[k])}`,
      previousValues ? `${previousLabel} ${formatValue(previousValues[k])}` : null,
      change !== null ? `change ${formatChange(change)}` : null,
      ...marks.placed.filter((m) => m.k === k).map((m) => m.label),
    ]
      .filter(Boolean)
      .join(", ")
  }

  const hasLegend = previousValues !== null || marks.placed.length > 0

  return (
    <div className={cn("flex h-60 w-full flex-col", className)}>
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
          <svg
            width={size.width}
            height={size.height}
            className="absolute inset-0 overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
              <clipPath id={`${id}-reveal`}>
                <motion.rect x={0} y={-PAD.top} height={size.height + PAD.top} width={revealX} />
              </clipPath>
            </defs>

            {showGrid && <ChartGrid frame={frame} lines={ticks.length} />}
            {showYAxis && <YAxis ticks={ticks} frame={frame} format={formatAxis} />}

            {marks.groups.map(({ k }) => (
              <motion.line
                key={`mark-${k}`}
                x1={xOf(k)}
                x2={xOf(k)}
                y1={frame.top}
                initial={{ y2: frame.top }}
                animate={{ y2: inView ? frame.bottom : frame.top, opacity: activeIndex === k ? 0.7 : 0.3 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        y2: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: markDelay(k) },
                        opacity: { duration: 0.15 },
                      }
                }
                className="stroke-foreground"
                strokeDasharray="3 3"
              />
            ))}

            {previousTarget && (
              <motion.path
                d={previousD}
                fill="none"
                stroke={PREVIOUS}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            )}

            {/* Resting layer: what lies right of the active point stays quiet. */}
            <g opacity={0.32}>
              <motion.path d={areaD} fill={`url(#${id}-fill)`} />
              <motion.path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
            </g>
            <g clipPath={`url(#${id}-reveal)`}>
              <motion.path d={areaD} fill={`url(#${id}-fill)`} />
              <motion.path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
            </g>

            {showXAxis && (
              <XAxis
                labels={labels}
                xOf={xOf}
                y={size.height - 8}
                step={labelStep(n, frame.w)}
                activeIndex={activeIndex}
                alignStart={!showYAxis}
              />
            )}

            <motion.g
              initial={false}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <motion.line
                x1={dotX}
                x2={dotX}
                y1={frame.top}
                y2={frame.bottom}
                className="stroke-muted-foreground/40"
                strokeDasharray="3 4"
              />
              {previousTarget && (
                <motion.circle
                  cx={dotX}
                  cy={previousDotY}
                  r={3}
                  className="fill-background"
                  stroke={PREVIOUS}
                  strokeWidth={1.5}
                />
              )}
              <motion.g style={{ x: dotX, y: dotY }}>
                <motion.circle
                  r={11}
                  fill={color}
                  initial={false}
                  animate={{ scale: isActive ? 1 : 0.3, opacity: isActive ? 0.18 : 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                />
                <circle r={4.5} className="fill-background" stroke={color} strokeWidth={2.5} />
              </motion.g>
            </motion.g>
          </svg>
        )}

        {size.width > 0 &&
          marks.groups.map(({ k, numbers }) => (
            <motion.div
              key={`badge-${k}`}
              aria-hidden
              className="pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums"
              style={{ left: xOf(k), top: frame.top - MARKER_ROOM + 1, x: "-50%" }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: inView ? (activeIndex === k ? 1.2 : 1) : 0,
                opacity: inView ? 1 : 0,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 520, damping: 22, delay: settled ? 0 : markDelay(k) + 0.3 }
              }
            >
              {numbers.join(",")}
            </motion.div>
          ))}

        <ChartTooltip
          ref={tipRef}
          title={labels[shownIndex] ?? ""}
          rows={rows}
          active={isActive}
          fresh={fresh}
          format={formatValue}
          style={{ x: tipX, y: tipY }}
          footer={
            shownChange !== null || shownMarks.length > 0 ? (
              <div className="mt-1.5 space-y-1 border-t pt-1.5">
                {shownChange !== null && (
                  <div className="flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
                    Change
                    <ChangeBadge change={shownChange} rising={rising} />
                  </div>
                )}
                {shownMarks.map((m) => (
                  <div key={m.number} className="flex items-center gap-1.5 text-xs">
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                      {m.number}
                    </span>
                    {m.label}
                  </div>
                ))}
              </div>
            ) : null
          }
        />

        <ChartDescription
          label={label}
          columns={previousValues ? [label, previousLabel] : [label]}
          rows={labels.map((text, k) => ({
            label: text,
            values: previousValues
              ? [formatValue(values[k]), formatValue(previousValues[k])]
              : [formatValue(values[k])],
          }))}
          live={activeIndex !== null ? describe(activeIndex) : ""}
        />
      </div>

      {hasLegend && (
        <ul aria-hidden className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 text-xs text-muted-foreground">
          {previousValues && (
            <>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
                {label}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: PREVIOUS }} />
                {previousLabel}
              </li>
            </>
          )}
          {marks.placed.map((m) => (
            <li
              key={m.number}
              onPointerEnter={() => select(m.k)}
              onPointerLeave={() => select(null)}
              className={cn(
                "flex cursor-default items-center gap-1.5 transition-colors duration-150",
                activeIndex === m.k && "text-foreground"
              )}
            >
              <span className="grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background tabular-nums">
                {m.number}
              </span>
              {m.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
