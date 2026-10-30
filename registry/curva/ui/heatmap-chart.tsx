"use client"

import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import {
  clamp,
  formatNumber,
  labelStep,
  useActivePoint,
  useElementSize,
  useFollow,
} from "@/registry/curva/lib/curva"
import { ChartDescription, ChartTooltip } from "@/registry/curva/ui/chart-parts"

type Datum = Record<string, unknown>

export type HeatmapChartProps<T extends Datum> = {
  /** One point per cell. */
  data: readonly T[]
  /** Key of each point's row label. */
  row: keyof T & string
  /** Key of each point's column label. */
  column: keyof T & string
  /** Key of each point's numeric value. */
  value: keyof T & string
  /** Accessible name of the chart. */
  label: string
  /** Row order. Defaults to the order rows first appear in `data`. */
  rows?: readonly string[]
  /** Column order. Defaults to the order columns first appear in `data`. */
  columns?: readonly string[]
  /** Rounded squares or a honeycomb. */
  shape?: "square" | "hex"
  /** Any CSS color. Cells ramp from the muted color up to it. */
  color?: string
  formatValue?: (value: number) => string
  /** Show the less-to-more scale under the grid. */
  legend?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a cell. */
  onActiveChange?: (point: T | null) => void
}

const GUTTER = 40
const FOOT = 22
const GAP = 3
const MAX_PITCH = 52
const SQRT3 = Math.sqrt(3)

/** The grid ripples in diagonally from the top left. */
const RIPPLE_STEP = 0.022
const MORPH_STEP = 0.008
const POP = { type: "spring", stiffness: 380, damping: 22 } as const

type Cell = { r: number; c: number; v: number; point: Datum | null }

/** A pointy-top hexagon with softened corners, centered on 0,0. */
function hexPath(size: number) {
  const corners = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [Math.cos(a) * size, Math.sin(a) * size]
  })
  const soft = 0.2
  let d = ""
  corners.forEach(([x, y], i) => {
    const [px, py] = corners[(i + 5) % 6]
    const [nx, ny] = corners[(i + 1) % 6]
    const ax = x + (px - x) * soft
    const ay = y + (py - y) * soft
    const bx = x + (nx - x) * soft
    const by = y + (ny - y) * soft
    d += `${i === 0 ? "M" : "L"}${ax},${ay}Q${x},${y} ${bx},${by}`
  })
  return `${d}Z`
}

function squarePath(size: number) {
  const h = size / 2
  const r = Math.min(6, size * 0.22)
  return `M${-h + r},${-h}H${h - r}Q${h},${-h} ${h},${-h + r}V${h - r}Q${h},${h} ${h - r},${h}H${-h + r}Q${-h},${h} ${-h},${h - r}V${-h + r}Q${-h},${-h} ${-h + r},${-h}Z`
}

export function HeatmapChart<P extends Datum>({
  data,
  row,
  column,
  value,
  label,
  rows,
  columns,
  shape = "square",
  color = "var(--chart-1)",
  formatValue = formatNumber,
  legend = true,
  className,
  onActiveChange,
}: HeatmapChartProps<P>) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const tip = useElementSize(tipRef)
  const inView = useInView(rootRef, { once: true, amount: 0.3 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1600)
    return () => clearTimeout(timer)
  }, [inView])

  const rowKeys = React.useMemo(
    () => rows ?? [...new Set(data.map((d) => String(d[row])))],
    [rows, data, row]
  )
  const colKeys = React.useMemo(
    () => columns ?? [...new Set(data.map((d) => String(d[column])))],
    [columns, data, column]
  )
  const cells = React.useMemo(() => {
    const lookup = new Map(data.map((d) => [`${d[row]}\u0000${d[column]}`, d]))
    return rowKeys.flatMap((rk, r) =>
      colKeys.map((ck, c): Cell => {
        const point = lookup.get(`${rk}\u0000${ck}`) ?? null
        return { r, c, v: point ? Number(point[value]) || 0 : 0, point }
      })
    )
  }, [data, row, column, value, rowKeys, colKeys])

  const lo = Math.min(...cells.map((c) => c.v))
  const hi = Math.max(...cells.map((c) => c.v))
  const level = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 1)

  const R = rowKeys.length
  const C = colKeys.length
  const hex = shape === "hex"
  const pitch = C > 0 ? Math.min((size.width - GUTTER) / (C + (hex ? 0.5 : 0)), MAX_PITCH) : 0
  const cellSize = Math.max(0, pitch - GAP)
  const hexSize = cellSize / SQRT3
  const rowPitch = hex ? hexSize * 1.5 + GAP * 0.87 : pitch
  const gridHeight = R === 0 ? 0 : hex ? (R - 1) * rowPitch + hexSize * 2 : R * pitch
  const height = gridHeight + FOOT
  // Wide containers center the grid instead of stretching the cells.
  const left = Math.max(0, (size.width - (GUTTER + pitch * (C + (hex ? 0.5 : 0)))) / 2) + GUTTER

  const centerOf = (r: number, c: number) => ({
    x: left + c * pitch + pitch / 2 + (hex && r % 2 === 1 ? pitch / 2 : 0),
    y: hex ? hexSize + r * rowPitch : r * pitch + pitch / 2,
  })
  const path = hex ? hexPath(hexSize) : squarePath(cellSize)
  const lensPath = hex ? hexPath(hexSize + 3) : squarePath(cellSize + 6)

  const { activeIndex, shownIndex, fresh, select } = useActivePoint(R * C, (k) =>
    onActiveChange?.(k === null ? null : (cells[k]?.point as P | null) ?? null)
  )
  const activeCell = activeIndex === null ? null : cells[activeIndex]
  const shownCell = cells[shownIndex] ?? { r: 0, c: 0, v: 0, point: null }
  const shownAt = centerOf(shownCell.r, shownCell.c)

  // Arrow keys walk the grid in two dimensions.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (R * C === 0) return
    const k = activeIndex
    const r = k === null ? 0 : Math.floor(k / C)
    const c = k === null ? -1 : k % C
    let next: number | null = k
    switch (e.key) {
      case "ArrowRight":
        next = r * C + Math.min(c + 1, C - 1)
        break
      case "ArrowLeft":
        next = k === null ? C - 1 : r * C + Math.max(c - 1, 0)
        break
      case "ArrowDown":
        next = k === null ? 0 : Math.min(r + 1, R - 1) * C + c
        break
      case "ArrowUp":
        next = k === null ? 0 : Math.max(r - 1, 0) * C + c
        break
      case "Home":
        next = r * C
        break
      case "End":
        next = r * C + C - 1
        break
      case "Escape":
        next = null
        break
      default:
        return
    }
    e.preventDefault()
    select(next)
  }

  const lensX = useFollow(shownAt.x, fresh)
  const lensY = useFollow(shownAt.y, fresh)
  const rightSide = shownAt.x + cellSize / 2 + 10
  const tipLeft = rightSide + tip.width <= size.width ? rightSide : shownAt.x - cellSize / 2 - 10 - tip.width
  const tipX = useFollow(clamp(tipLeft, 0, Math.max(0, size.width - tip.width)), fresh)
  const tipY = useFollow(clamp(shownAt.y - tip.height / 2, 0, Math.max(0, gridHeight - tip.height)), fresh)

  const colStep = labelStep(C, size.width - GUTTER, 30)

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={rootRef}
        role="group"
        aria-roledescription="chart"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => select(null)}
        onPointerLeave={() => select(null)}
        style={{ height: size.width > 0 ? height : undefined }}
        className="relative min-h-40 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {size.width > 0 && (
          <svg width={size.width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
            {rowKeys.map((text, r) => (
              <text
                key={text}
                x={left - 10}
                y={centerOf(r, 0).y}
                dy="0.32em"
                textAnchor="end"
                className={cn(
                  "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                  activeCell?.r === r && "fill-foreground"
                )}
              >
                {text}
              </text>
            ))}
            {colKeys.map((text, c) =>
              c % colStep === 0 ? (
                <text
                  key={text}
                  x={centerOf(0, c).x}
                  y={gridHeight + 15}
                  textAnchor="middle"
                  className={cn(
                    "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                    activeCell?.c === c && "fill-foreground"
                  )}
                >
                  {text}
                </text>
              ) : null
            )}

            {cells.map((cell, k) => {
              const { x, y } = centerOf(cell.r, cell.c)
              const wave = (cell.r + cell.c) * (settled ? MORPH_STEP : RIPPLE_STEP)
              const inCross = activeCell !== null && (activeCell.r === cell.r || activeCell.c === cell.c)
              return (
                <motion.g
                  key={`${cell.r}-${cell.c}`}
                  transform={`translate(${x} ${y})`}
                  initial={false}
                  animate={{ opacity: activeCell === null || inCross ? 1 : 0.45 }}
                  transition={{ duration: 0.2 }}
                  onPointerEnter={() => select(k)}
                  onPointerDown={() => select(k)}
                >
                  <path d={path} className="fill-muted" />
                  <motion.path
                    d={path}
                    fill={color}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={
                      inView
                        ? { opacity: 0.08 + 0.92 * level(cell.v), scale: activeIndex === k ? 1.06 : 1 }
                        : { opacity: 0, scale: 0.4 }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            opacity: { duration: 0.35, delay: activeIndex === k ? 0 : wave },
                            scale: { ...POP, delay: activeIndex !== null ? 0 : wave },
                          }
                    }
                  />
                </motion.g>
              )
            })}

            {/* The lens glides from cell to cell. */}
            <motion.path
              d={lensPath}
              fill="none"
              className="stroke-foreground"
              strokeWidth={1.5}
              style={{ x: lensX, y: lensY }}
              initial={false}
              animate={{ opacity: activeCell === null ? 0 : 1 }}
              transition={{ duration: 0.15 }}
            />
          </svg>
        )}

        <ChartTooltip
          ref={tipRef}
          title={`${rowKeys[shownCell.r] ?? ""} · ${colKeys[shownCell.c] ?? ""}`}
          rows={[{ key: "value", label, color, value: shownCell.v }]}
          active={activeCell !== null}
          fresh={fresh}
          format={formatValue}
          style={{ x: tipX, y: tipY }}
        />

        <ChartDescription
          label={label}
          columns={colKeys}
          rows={rowKeys.map((rk, r) => ({
            label: rk,
            values: colKeys.map((_, c) => formatValue(cells[r * C + c]?.v ?? 0)),
          }))}
          live={
            activeCell
              ? `${rowKeys[activeCell.r]}, ${colKeys[activeCell.c]}: ${formatValue(activeCell.v)}`
              : ""
          }
        />
      </div>

      {legend && (
        <div aria-hidden className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="mr-0.5">Less</span>
          {[0.08, 0.3, 0.54, 0.77, 1].map((o) => (
            <svg key={o} viewBox="-6 -6 12 12" className="size-3">
              <path d={hex ? hexPath(6) : squarePath(11)} className="fill-muted" />
              <path d={hex ? hexPath(6) : squarePath(11)} fill={color} opacity={o} />
            </svg>
          ))}
          <span className="ml-0.5">More</span>
        </div>
      )}
    </div>
  )
}
