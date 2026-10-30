# Curva

Animated chart components for [shadcn/ui](https://ui.shadcn.com). They install as source you own, read your theme's tokens, and move with your data.

## Install

```bash
npx shadcn@latest add <registry-url>/r/area-chart.json
npx shadcn@latest add <registry-url>/r/bar-chart.json
```

Each chart adds its own file to `components/ui/` plus the shared `components/ui/chart-parts.tsx` and `lib/curva.ts`. The charts depend on `motion`, and the area chart also needs `d3-shape`.

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
