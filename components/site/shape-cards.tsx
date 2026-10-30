"use client"

import * as React from "react"

import { budget, busy, expenses, hours, type GoalMonth } from "@/lib/demo-data"
import { GaugeChart } from "@/registry/curva/ui/gauge-chart"
import { HeatmapChart } from "@/registry/curva/ui/heatmap-chart"
import { PolarBarChart } from "@/registry/curva/ui/polar-bar-chart"
import { SplitBar } from "@/registry/curva/ui/split-bar"
import { Card, Segmented, Ticker, formatCurrency, formatInteger } from "./controls"

const months = [
  { value: "sep", label: "Sep" },
  { value: "oct", label: "Oct" },
] as const

function Header({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  )
}

export function BudgetCard() {
  const [month, setMonth] = React.useState<GoalMonth>("sep")
  const { spent, limit, plan } = budget[month]

  return (
    <Card>
      <Header title="Monthly budget" text="The tick marks the plan; hover for what's left">
        <Segmented label="Month" options={months} value={month} onChange={setMonth} />
      </Header>
      <GaugeChart
        value={spent}
        max={limit}
        target={plan}
        label="Budget spent"
        caption="Spent so far"
        formatValue={formatCurrency}
        className="mt-6"
      />
    </Card>
  )
}

export function HoursCard() {
  const [days, setDays] = React.useState<"weekdays" | "weekend">("weekdays")

  return (
    <Card>
      <Header title="Orders by hour" text="The shape of a day, clockwise from midnight">
        <Segmented
          label="Days"
          options={[
            { value: "weekdays", label: "Weekdays" },
            { value: "weekend", label: "Weekend" },
          ]}
          value={days}
          onChange={setDays}
        />
      </Header>
      <PolarBarChart
        data={hours[days]}
        index="hour"
        value="orders"
        label="Orders by hour"
        centerLabel="Orders a day"
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}

export function BusyCard() {
  const [shape, setShape] = React.useState<"hex" | "square">("hex")

  return (
    <Card>
      <Header title="Busiest times" text="Orders by weekday and hour; arrow keys walk the grid">
        <Segmented
          label="Shape"
          options={[
            { value: "hex", label: "Honeycomb" },
            { value: "square", label: "Grid" },
          ]}
          value={shape}
          onChange={setShape}
        />
      </Header>
      <HeatmapChart
        key={shape}
        data={busy}
        row="day"
        column="slot"
        value="orders"
        label="Orders"
        shape={shape}
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}

export function ExpensesCard() {
  const [month, setMonth] = React.useState<GoalMonth>("sep")
  const data = expenses[month]
  const total = data.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Where the money went</p>
          <Ticker
            value={total}
            format={formatCurrency}
            className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums"
          />
        </div>
        <Segmented label="Month" options={months} value={month} onChange={setMonth} />
      </div>
      <SplitBar
        data={data}
        index="item"
        value="amount"
        color="color"
        label="Expenses by category"
        formatValue={formatCurrency}
        className="mt-6"
      />
    </Card>
  )
}
