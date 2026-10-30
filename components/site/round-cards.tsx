"use client"

import * as React from "react"

import { categories, goals, type GoalMonth, type GoalPoint, type Range } from "@/lib/demo-data"
import { DonutChart } from "@/registry/curva/ui/donut-chart"
import { RadialChart } from "@/registry/curva/ui/radial-chart"
import { Card, Segmented, formatCurrency, formatInteger, rangeOptions } from "./controls"

export function CategoryCard() {
  const [range, setRange] = React.useState<Range>("week")

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Revenue by category</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {range === "year" ? "Outdoor joins in the yearly view" : "Share of sales per category"}
          </p>
        </div>
        <Segmented label="Range" options={rangeOptions} value={range} onChange={setRange} />
      </div>

      <DonutChart
        data={categories[range]}
        index="category"
        value="revenue"
        color="color"
        label="Revenue by category"
        formatValue={formatCurrency}
        className="mt-6"
      />
    </Card>
  )
}

const months = [
  { value: "sep", label: "Sep" },
  { value: "oct", label: "Oct" },
] as const

const formatGoal = (v: number, point: GoalPoint) =>
  point.unit === "currency" ? formatCurrency(v) : formatInteger(v)

export function GoalsCard() {
  const [month, setMonth] = React.useState<GoalMonth>("oct")

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Monthly goals</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Progress toward this month&apos;s targets</p>
        </div>
        <Segmented label="Month" options={months} value={month} onChange={setMonth} />
      </div>

      <RadialChart
        data={goals[month]}
        index="goal"
        value="value"
        max="target"
        color="color"
        label="Monthly goals"
        formatValue={formatGoal}
        className="mt-6"
      />
    </Card>
  )
}
