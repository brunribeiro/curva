# Curva

Animated chart components for [shadcn/ui](https://ui.shadcn.com). They install as source you own, read your theme's tokens, and move with your data.

## Install

```bash
npx shadcn@latest add <registry-url>/r/area-chart.json
npx shadcn@latest add <registry-url>/r/bar-chart.json
npx shadcn@latest add <registry-url>/r/donut-chart.json
npx shadcn@latest add <registry-url>/r/radial-chart.json
npx shadcn@latest add <registry-url>/r/gauge-chart.json
npx shadcn@latest add <registry-url>/r/polar-bar-chart.json
npx shadcn@latest add <registry-url>/r/heatmap-chart.json
npx shadcn@latest add <registry-url>/r/split-bar.json
```

Each chart adds its own file to `components/ui/` plus the shared `components/ui/chart-parts.tsx` and `lib/curva.ts`. Every chart depends on `motion`. The area, donut, radial, gauge and polar bar charts also need `d3-shape`.

## Area chart

```tsx
import { AreaChart } from "@/components/ui/area-chart"

<AreaChart data={data} index="day" value="revenue" label="Revenue" />
```

| Prop | Type | Default |
| --- | --- | --- |
| `data` | `T[]` | |
| `index` | key of `T`, the label of each point | |
| `value` | key of `T`, the number of each point | |
| `label` | accessible name and series name | |
| `color` | any CSS color | `var(--chart-1)` |
| `formatValue` | `(n) => string`, tooltip and screen readers | `1,234.5` |
| `formatAxis` | `(n) => string`, y-axis | `1.2K` |
| `showXAxis` / `showYAxis` / `showGrid` | `boolean` | `true` |
| `onActiveChange` | `(point, index) => void` | |

Size it with `className` (it defaults to `h-60 w-full`).

- **Entrance:** the curve rises from the baseline in a left-to-right wave the first time it scrolls into view.
- **Morphing:** new `data` reshapes the curve in place, even when the number of points changes and even mid-animation.
- **Gliding:** the active point rides along the curve on a spring, the region to its right goes quiet, and the tooltip and axis labels count to their new values.

## Bar chart

```tsx
import { BarChart } from "@/components/ui/bar-chart"

<BarChart
  data={data}
  index="month"
  series={[
    { key: "online", label: "Online store" },
    { key: "marketplace", label: "Marketplace" },
  ]}
  stacked
  label="Revenue by channel"
/>
```

It takes the same props as the area chart, except `series` (each with `key`, `label` and an optional `color`) replaces `value` and `color`, and `stacked` puts the series in one bar instead of side by side. Without a `color`, series take `--chart-1` to `--chart-5` in order, so pass colors when series can be hidden. Bars expect values of zero or more.

- **Entrance:** bars grow from the baseline with a slight overshoot in a left-to-right wave, and stacks fill from the bottom up.
- **Morphing:** when the number of columns changes, bars slide to their new slots while new ones grow in and old ones sink away. A removed series shrinks out and the rest restack.
- **Highlight:** a soft band glides to the active column, the other columns step back, and the tooltip follows on a spring and flips sides near the edge.

## Donut chart

```tsx
import { DonutChart } from "@/components/ui/donut-chart"

<DonutChart data={data} index="category" value="revenue" label="Revenue by category" />
```

| Prop | Type | Default |
| --- | --- | --- |
| `data`, `index`, `value`, `label` | as in the area chart; labels must be unique | |
| `color` | key of `T` holding each segment's CSS color | theme chart colors |
| `formatValue` | `(n) => string` | `1,234.5` |
| `centerLabel` | what the center says when nothing is active | `Total` |
| `legend` | legend beside the ring, below it in narrow containers | `true` |
| `thickness` | ring thickness as a share of the radius | `0.28` |
| `onActiveChange` | `(point, index) => void` | |

- **Entrance:** segments pour in clockwise from 12 o'clock, one after another, while the total counts up.
- **Morphing:** segments are matched by label. Changed values reshape the ring, new labels grow in from their own place, and removed ones close up while the rest take the room.
- **Highlight:** pointing at a segment or its legend row lifts the segment, quiets the rest, and the center counts to its value and share.

## Radial chart

```tsx
import { RadialChart } from "@/components/ui/radial-chart"

<RadialChart data={goals} index="goal" value="value" max="target" label="Monthly goals" />
```

It takes the donut chart's props without `thickness`, plus `max` (a key of `T` or one number for every ring). `formatValue` also receives the point, so each ring can use its own unit. With nothing active, the center shows the average progress.

- **Entrance:** rings fill clockwise from the outside in, settling with a slight overshoot.
- **Changes:** each ring springs to its new progress. Progress stops at a full ring.

## Gauge chart

```tsx
import { GaugeChart } from "@/components/ui/gauge-chart"

<GaugeChart value={8240} max={12000} target={9600} label="Budget spent" />
```

A half circle of blocks (`segments`, default 24) that ramp from a light tint up to `color`. The blocks light up one by one toward the value and go out one by one when it drops. `target` adds a tick on the arc, `caption` sets the line above the number, and pointing at the gauge swaps the share for what's left. It's exposed as a `meter`.

## Polar bar chart

```tsx
import { PolarBarChart } from "@/components/ui/polar-bar-chart"

<PolarBarChart data={hours} index="hour" value="orders" label="Orders by hour" />
```

Bars around a circle, clockwise from 12 o'clock: hours of a day, days of a week, months of a year. Bars grow out in a clockwise sweep, deeper values read darker, and the center counts to the total or to the active bar. `labelEvery` controls the outer labels (four quarters by default).

## Heatmap chart

```tsx
import { HeatmapChart } from "@/components/ui/heatmap-chart"

<HeatmapChart data={cells} row="day" column="hour" value="orders" label="Orders" shape="hex" />
```

One point per cell, as rounded squares or a honeycomb (`shape`). Cells ripple in diagonally, a lens glides from cell to cell, and the active row and column stay lit while the rest step back. Arrow keys walk the grid in both directions. `rows` and `columns` set the order. The chart takes its height from the grid, so size it by width.

## Split bar

```tsx
import { SplitBar } from "@/components/ui/split-bar"

<SplitBar data={expenses} index="item" value="amount" label="Expenses by category" />
```

A share-of-total bar woven from thin ticks, each part marked by a taller leading tick and a label. The ticks rise like an equalizer and regroup when values change. Pointing at a part shows its value, and labels too narrow to fit appear on demand.

## Motion and reduced motion

Each chart has one orchestrated moment, its entrance. Everything after that answers the visitor. With `prefers-reduced-motion`, every change happens instantly.

## Accessibility

The chart is a focusable group. Arrow keys, Home and End walk the points, Escape clears, the active value is announced through `aria-live`, and a visually hidden table carries the full dataset.

## Develop

```bash
pnpm dev             # showcase at localhost:3000
pnpm registry:build  # writes public/r/*.json
pnpm typecheck && pnpm lint
```

Chart sources live in `registry/curva/`. Imports of `@/registry/curva/lib/*` become `@/lib/*` when installed.

## License

MIT © Bruno Ribeiro
