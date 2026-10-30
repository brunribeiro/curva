"use client"

import * as React from "react"

import { revenue, type Range, type RevenuePoint } from "@/lib/demo-data"
import { AreaChart } from "@/registry/curva/ui/area-chart"
import { Card, Segmented, Ticker, formatCurrency, rangeOptions } from "./controls"

export function RevenueCard() {
  const [range, setRange] = React.useState<Range>("week")
  const [hovered, setHovered] = React.useState<RevenuePoint | null>(null)
  const { data, delta, period } = revenue[range]
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.revenue, 0), [data])

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {hovered ? `Revenue on ${hovered.label}` : "Total revenue"}
          </p>
          <Ticker
            value={hovered ? hovered.revenue : total}
            format={formatCurrency}
            className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
          />
          <p className="mt-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">+{delta}%</span>{" "}
            vs {period}
          </p>
        </div>
        <Segmented label="Range" options={rangeOptions} value={range} onChange={setRange} />
      </div>

      <AreaChart
        data={data}
        index="label"
        value="revenue"
        label="Revenue"
        formatValue={formatCurrency}
        onActiveChange={setHovered}
        className="mt-6 h-64 sm:h-72"
      />
    </Card>
  )
}
