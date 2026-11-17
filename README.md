# Curva

Animated chart components for [shadcn/ui](https://ui.shadcn.com). They install as source you own, read your theme's tokens, and move with your data.

[Live demo](https://curva.brunoribei.ro), with every chart moving.

## Install

Curva is a [shadcn registry](https://ui.shadcn.com/docs/registry), so it needs a project already set up with shadcn/ui (a `components.json`). It's built and tested with React 19 and Tailwind CSS v4.

Every chart, in one command:

```bash
npx shadcn@latest add https://curva.brunoribei.ro/all
```

Or only the ones you want, by name:

```bash
npx shadcn@latest add https://curva.brunoribei.ro/area-chart
```

The names: `area-chart`, `bar-chart`, `donut-chart`, `radial-chart`, `gauge-chart`, `polar-bar-chart`, `heatmap-chart`, `split-bar`, `flow-chart`, `capsule-bar-chart`, `dot-matrix-chart`, `range-histogram`, `sparkline`, `radar-chart`, `waffle-chart`, `funnel-chart`, `combo-chart`, `status-timeline`, `bar-list`, `dumbbell-chart`, `percentile-chart`.

To use short names, add the registry to your `components.json` once:

```bash
npx shadcn@latest registry add "@curva=https://curva.brunoribei.ro/r/{name}.json"
npx shadcn@latest add @curva/area-chart @curva/bar-chart
```

Each chart adds its own file to `components/ui/` plus the shared `components/ui/chart-parts.tsx` and `lib/curva.ts`. Every chart depends on `motion`. The area, donut, radial, gauge, polar bar, flow, sparkline, funnel and combo charts also need `d3-shape`.

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
| `previous` | key of `T`, the previous period's value at the same position | |
| `previousLabel` | name of the previous period | `Previous period` |
| `rising` | `"good"`, `"bad"` or `"neutral"`, colors the change | `"good"` |
| `markers` | `{ at, label }[]`, numbered marks on the points whose label is `at` | |
| `showXAxis` / `showYAxis` / `showGrid` | `boolean` | `true` |
| `onActiveChange` | `(point, index) => void` | |

Size it with `className` (it defaults to `h-60 w-full`, legend included).

- **Entrance:** the curve rises from the baseline in a left-to-right wave the first time it scrolls into view.
- **Morphing:** new `data` reshapes the curve in place, even when the number of points changes and even mid-animation.
- **Gliding:** the active point rides along the curve on a spring, the region to its right goes quiet, and the tooltip and axis labels count to their new values.
- **Comparing:** with `previous`, a dashed line shows the previous period, and the tooltip adds its value and the change, green or red by `rising`.
- **Markers:** each marker drops a dashed line with a numbered badge once the curve has passed it. Markers on the same point share a badge ("2,3"), the legend lists what each number means, and pointing at a legend row moves the active point there.

```tsx
<AreaChart
  data={days}
  index="day"
  value="revenue"
  previous="lastRevenue"
  previousLabel="Previous 30 days"
  markers={[{ at: "Oct 18", label: "Lunch combo" }]}
  label="Revenue"
/>
```

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

## Flow chart

```tsx
import { FlowChart } from "@/components/ui/flow-chart"

<FlowChart
  data={quarters}
  index="quarter"
  series={[
    { key: "dineIn", label: "Dine-in" },
    { key: "delivery", label: "Delivery" },
  ]}
  label="Revenue by channel"
/>
```

Bands that flow through stages from left to right, stacked around the middle and washing in from a narrow lead on the left edge. Each stage gets a marker and a pill with its total. The flow pours in once. After that, new values reshape the bands in a wave, and a new set of bands or stages swaps in directly. Pointing at a band quiets the others, and the nearest stage shows every value in a tooltip.

## Capsule bar chart

```tsx
import { CapsuleBarChart } from "@/components/ui/capsule-bar-chart"

<CapsuleBarChart data={days} index="day" value="ticket" label="Average ticket" />
```

Glass capsules filled with liquid that rises with a little slosh. One capsule glows in a gradient from `color` up to `accent`: the active one, or the `highlight` (`"max"` by default, `"last"` or an index) while nothing is active. Its value rides on top in a pill.

## Dot matrix chart

```tsx
import { DotMatrixChart } from "@/components/ui/dot-matrix-chart"

<DotMatrixChart data={months} index="month" value="members" label="Members" />
```

An area chart drawn in dots: each column fills bottom up to its value (`rows`, default 12), capped by a brighter dot so the line reads through the matrix. Columns warm up one after another, and changes ripple out from each column's new top.

## Range histogram

```tsx
import { RangeHistogram } from "@/components/ui/range-histogram"

<RangeHistogram data={days} index="day" value="revenue" label="Daily revenue" onRangeChange={(range, points) => {}} />
```

A dense histogram with a brush. Sweep across the bars to pick a range, drag the window to move it, or drag either handle. The handles are sliders, so arrow keys move them (Shift for 5, Page Up and Page Down for a tenth). A summary rides above the window with the range's total and its change from first to last. `defaultRange` sets the starting selection, and `onRangeChange` reports each change with the selected points.

## Sparkline

```tsx
import { Sparkline } from "@/components/ui/sparkline"

<Sparkline data={days} index="day" value="revenue" label="Revenue" onActiveChange={setHovered} />
```

A small trend with no axes, made for KPI cards: a smooth line over a soft fill, or thin bars (`variant="bars"`). The line draws in once, a dot rests on the last point and glides along the line as the visitor scrubs, and a new period morphs in place. Values fill the height whatever their range, because a sparkline shows shape. Pass `onActiveChange` to hand the scrubbed point to a headline number. It's exposed as one image whose label reads the first and last values.

## Radar chart

```tsx
import { RadarChart } from "@/components/ui/radar-chart"

<RadarChart
  data={axes}
  index="axis"
  series={[
    { key: "downtown", label: "Downtown" },
    { key: "riverside", label: "Riverside" },
  ]}
  max={100}
  label="Location scorecard"
/>
```

One point per axis, clockwise from 12 o'clock, with a polygon per series. Each shape unfolds around the axes, and new values morph each vertex in a wave. Pointing near an axis lights its spoke, enlarges its vertices and lists every series in a tooltip. Pointing at a legend row brings its series forward. `max` sets the outer ring; by default it's a round number above the largest value.

## Waffle chart

```tsx
import { WaffleChart } from "@/components/ui/waffle-chart"

<WaffleChart data={sources} index="source" value="orders" label="Orders by source" />
```

A grid of squares (`cells`, default 100, in rows of `columns`, default 10), each owned by a part in proportion to its share. Cells sweep in diagonally, and a change pops the regrouped cells out and back in. Pointing at a cell or a legend row brings its part forward.

## Funnel chart

```tsx
import { FunnelChart } from "@/components/ui/funnel-chart"

<FunnelChart data={stages} index="stage" value="people" label="Ordering funnel" />
```

A stream that narrows from stage to stage, each stage flat before it curves into the next, with a chip for the conversion between neighbors. The stream pours in from the left and new values reshape it in a wave. Pointing at a stage glides a highlight to it and shows how many dropped since the previous stage.

## Combo chart

```tsx
import { ComboChart } from "@/components/ui/combo-chart"

<ComboChart
  data={slots}
  index="slot"
  bar={{ key: "orders", label: "Online orders" }}
  line={{ key: "wait", label: "ASAP wait", format: (m) => `${m}m` }}
  flag="full"
  flagLabel="Slot full"
  now="19:15"
  bands={[{ from: "12:15", to: "12:30", label: "Paused" }]}
  label="Online orders and ASAP wait by pickup slot"
/>
```

Bars on the left axis and a line on the right, for two measures with different units. Bars whose `flag` is truthy take `flagColor` and show a sliver even when empty. Line values can be null where nothing was measured: the line bridges the gap, and the dots mark only real readings. `now` stands a dashed line at a point and fades the bars after it, which are still to come. `bands` shade stretches such as pauses or outages, labelled above the plot, and the tooltip names the band under the pointer. Bars grow in, then the line draws across; a new day reshapes both in a wave.

## Status timeline

```tsx
import { StatusTimeline } from "@/components/ui/status-timeline"

<StatusTimeline
  data={days}
  index="day"
  status="state"
  states={[
    { value: "open", label: "Taking orders", color: "var(--chart-2)" },
    { value: "paused", label: "Paused", color: "var(--chart-4)" },
    { value: "none", label: "Not recorded", color: "var(--muted-foreground)", hatched: true },
  ]}
  detail={(d) => d.note}
  label="Taking orders, last 30 days"
/>
```

One bar per period, colored by its state, like an uptime page. Bars rise in a sweep, a hatched state reads as missing data, and the legend counts the days in each state. Pointing at a legend row brings that state's days forward; pointing at a bar shows its date, state and `detail`.

## Bar list

```tsx
import { BarList } from "@/components/ui/bar-list"

<BarList data={items} index="item" value="sold" label="Items sold" share />
```

A ranked list of labelled bars, the shape of most "top N" panels. Bars grow in from the top, and when values change the rows trade places on a spring while their numbers count. `share` adds each row's share of the total, and `sort={false}` keeps your order.

## Dumbbell chart

```tsx
import { DumbbellChart } from "@/components/ui/dumbbell-chart"

<DumbbellChart
  data={stores}
  index="store"
  from="lastWeek"
  to="thisWeek"
  fromLabel="Last week"
  toLabel="This week"
  label="Average order by store"
/>
```

Before and after on one row each: a hollow dot for `from`, a filled dot for `to`, and a connector colored by whether the move is good news (`rising`). The later dot travels out from the earlier one as the chart enters, and slides when the values change. The axis hugs the data instead of starting at zero. Each row ends with the change; `formatChange` replaces the default percent. Pointing at a row shows both values.

## Percentile chart

```tsx
import { PercentileChart } from "@/components/ui/percentile-chart"

<PercentileChart
  data={pages}
  index="page"
  percentiles={[
    { key: "p50", label: "Typical" },
    { key: "p75", label: "Slow" },
    { key: "p90", label: "Slowest 10%" },
  ]}
  zones={[
    { upTo: 2.5, label: "Good", tone: "good" },
    { upTo: 4, label: "Needs work", tone: "warn" },
    { label: "Poor", tone: "bad" },
  ]}
  score="p75"
  label="Page load"
/>
```

For timings where the average hides the slow end: each row layers its percentiles from the median out, each a fainter shade, growing in one after another. `zones` tint the background and judge each row by its `score` percentile, shown as a colored value at the end of the row. Pointing at a row lists every percentile in a tooltip.

## Motion and reduced motion

Each chart has one orchestrated moment, its entrance. Everything after that answers the visitor. With `prefers-reduced-motion`, every change happens instantly.

## Accessibility

The chart is a focusable group. Arrow keys, Home and End walk the points (lists and rows take up and down too), Escape clears, the active value is announced through `aria-live`, and a visually hidden table carries the full dataset.

## Develop

```bash
pnpm install
pnpm dev             # showcase at localhost:3000
pnpm registry:build  # writes public/r/*.json
pnpm typecheck && pnpm lint
pnpm build           # registry, then the showcase
```

Chart sources live in `registry/curva/`. Imports of `@/registry/curva/lib/*` become `@/lib/*` when installed.

## License

MIT © Bruno Ribeiro
