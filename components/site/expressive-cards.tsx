"use client"

import * as React from "react"

import { channelFlow, daily, growth, tickets } from "@/lib/demo-data"
import { CapsuleBarChart } from "@/registry/curva/ui/capsule-bar-chart"
import { DotMatrixChart } from "@/registry/curva/ui/dot-matrix-chart"
import { FlowChart } from "@/registry/curva/ui/flow-chart"
import { RangeHistogram } from "@/registry/curva/ui/range-histogram"
import { Card, Segmented, formatCurrency, formatInteger } from "./controls"

const ticketFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const formatTicket = (v: number) => ticketFormat.format(v)

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

export function FlowCard() {
  const [year, setYear] = React.useState<"2025" | "2026">("2025")

  return (
    <Card>
      <Header title="Revenue by channel" text="Dine-in, delivery and pickup, flowing quarter to quarter">
        <Segmented
          label="Year"
          options={[
            { value: "2025", label: "2025" },
            { value: "2026", label: "2026" },
          ]}
          value={year}
          onChange={setYear}
        />
      </Header>
      <FlowChart
        data={channelFlow[year]}
        index="quarter"
        series={[
          { key: "dineIn", label: "Dine-in", color: "var(--chart-1)" },
          { key: "delivery", label: "Delivery", color: "var(--chart-2)" },
          { key: "pickup", label: "Pickup", color: "var(--chart-3)" },
        ]}
        label="Channel revenue by quarter"
        formatValue={formatCurrency}
        className="mt-6"
      />
    </Card>
  )
}

export function TicketCard() {
  const [meal, setMeal] = React.useState<"lunch" | "dinner">("dinner")

  return (
    <Card>
      <Header title="Average ticket" text="The busiest day stands out; point at any other">
        <Segmented
          label="Meal"
          options={[
            { value: "lunch", label: "Lunch" },
            { value: "dinner", label: "Dinner" },
          ]}
          value={meal}
          onChange={setMeal}
        />
      </Header>
      <CapsuleBarChart
        data={tickets[meal]}
        index="day"
        value="ticket"
        label="Average ticket"
        formatValue={formatTicket}
        className="mt-6"
      />
    </Card>
  )
}

export function GrowthCard() {
  const [metric, setMetric] = React.useState<"members" | "app">("members")

  return (
    <Card>
      <Header title="Loyalty growth" text="Two years, one dot at a time">
        <Segmented
          label="Metric"
          options={[
            { value: "members", label: "Members" },
            { value: "app", label: "App users" },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </Header>
      <DotMatrixChart
        data={growth}
        index="month"
        value={metric}
        label={metric === "members" ? "Members" : "App users"}
        color={metric === "members" ? "var(--chart-3)" : "var(--chart-2)"}
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}

export function DailyCard() {
  return (
    <Card>
      <Header
        title="Daily revenue"
        text="Sweep across the bars, drag the window or its handles, or use the arrow keys"
      />
      <RangeHistogram
        data={daily}
        index="day"
        value="revenue"
        label="Daily revenue"
        defaultRange={[daily.length - 28, daily.length - 1]}
        formatValue={formatCurrency}
        className="mt-6"
      />
    </Card>
  )
}
