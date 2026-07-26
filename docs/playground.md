---
title: Playground
description: The full development playground of vue-asset-map, running in the browser.
pageClass: playground-page
aside: false
---

# Playground

Every example elsewhere in these docs is deliberately small — one feature at a time, so the code stays readable. This
page is the opposite: the repository's own development playground, the app that `pnpm dev` serves, running here
unchanged. It is the same `playground/App.vue` file, imported rather than copied, so it cannot drift from what the
maintainers actually work against.

Its interface is in Russian, because that is what it is: an internal playground rather than a polished demo.

## What to try

- **Views.** The switcher in the toolbar moves between the physical topology and the VPN overlay. The same entities and
  links, two projections — and sublabels are hidden in one of them.
- **Search.** `10.38.24.*` and `10.38.24.0/24` match addresses, anything else is a substring. Matches stay bright, the
  kept context dims.
- **Filters.** The funnel opens consumer-defined groups — subnet, asset type, severity — with counts taken from the
  current view.
- **Details.** Click a node to open a window; up to three stay open at once, and each drags, collapses and closes on its
  own. The contents come from the `#details` slot, so they are the application's, not the package's.
- **Paths.** Shift-click two nodes. `autoPath` finds the route and highlights it with nothing to press; the toolbar
  above the map shows the hops. A modified click never opens a window, so the path stays visible.
- **Infection.** Toggle it on to mark `vps-tailscale` as a source and watch `blastRadius` spread; the ± buttons change
  the depth.
- **Collapse.** Containers fold into a group node past the threshold — click it to expand. The button on a node with
  children folds its subtree away instead.
- **Adding data.** "Добавить" opens a form that appends a real entity and link, so you can watch the layout absorb it.
- **The history strip** at the top right is a `MapWindow` in the `#windows` slot — a window built by the application
  out of the package's own chrome.
- **Theme.** The toolbar's own light/dark toggle drives the map's `theme` prop, independently of this site's.

<!-- VitePress's own `ClientOnly` renders nothing at all until mounted — it has
     no fallback slot — so the placeholder is the frame's own, shown by `:empty`
     for as long as the box has no app in it. -->
<div class="playground-frame" data-loading="Loading the playground…">
  <ClientOnly>
    <PlaygroundApp />
  </ClientOnly>
</div>

## The source

<<< @/../playground/App.vue

The styles behind the `pg-*` classes are in
[`playground/playground.css`](https://github.com/LegionLiner/vue-asset-map/blob/main/playground/playground.css), and
the fixture it renders is
[`fixtures/infra.ts`](https://github.com/LegionLiner/vue-asset-map/blob/main/fixtures/infra.ts) — shared with the test
suite, so the data on screen is the data the tests assert against.

To run it locally:

```bash
pnpm install
pnpm dev
```
