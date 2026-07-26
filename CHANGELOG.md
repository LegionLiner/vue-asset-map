# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.4 — 2026-07-26

### Added

- `autoPath` prop: with exactly two nodes selected, the map finds the route between them and highlights it on its own.
  The result leaves through the new `path-change` event, which also fires for the imperative `highlightPath`.
- `pathOptions` prop (`maxDepth`, `layers`) bounding a path search, plus a third argument on `highlightPath` overriding
  it per call.
- `showNodeStatus`, `showNodeToggle` and `showNodeLabel` props: remove the status dot, the subtree fold button and the
  label plate from the default node. `maxSublabels` caps the sublabel lines, `0` hiding them.
- `#node-status` and `#node-label` slots: replace the status indicator and the whole label plate without writing a node
  component. `#node-label` receives the sublabels already narrowed by the view and by `maxSublabels`.
- `detailsTitle`, `showDetailsHeading` and `detailsTabs` props, plus `#details-title` and `#details-tabs` slots:
  everything below a details window's title bar can now be replaced or removed, so nothing of the default design need
  survive but the bar itself. `detailsTabs: false` removes the tab strip; a custom array replaces the built-in tabs.
- `DetailsTabDef`, `PathOptions`, `DetailsTitleSlotProps` and `DetailsTabsSlotProps` are exported.

### Fixed

- `node-*` slots now receive `nodeId` as their public `NodeSlotProps` type promises. They were passed the raw attribute
  name `node-id`, so `nodeId` read as `undefined` in every custom node slot while TypeScript accepted it.

### Changed

- A modified click (Shift, Ctrl or Cmd) on a node now only builds up the selection and no longer opens a details
  window. Picking a second node to trace a path to used to bury the path under the windows it opened on the way. A
  plain click still opens one.
- The docs claimed a node draws "up to two sublabels". There has never been such a limit — a node draws every sublabel
  the entity carries, and the plate grows to fit.

### Removed

- The `Release` GitHub Actions workflow.

## 1.0.3 — 2026-07-26

### Added

- `sitemap.xml`, `robots.txt` and per-page canonical/Open Graph/Twitter Card meta tags on the docs site, so pages are
  indexable and share links render a title, description and preview image.
- IBM Plex Mono as the site-wide typeface, replacing the default theme font.
- The project logo in the docs header and as the browser favicon, and a hero image on the landing page — both
  switching with the site's light/dark theme.

### Fixed

- Example maps on the docs site now follow the site's own dark-mode toggle instead of always rendering in light
  theme.

## 1.0.2 — 2026-07-26

### Changed

- Reworked the Russian and English guide, API reference and examples pages for consistent terminology and a plainer,
  less editorialized tone. In Russian, `AssetView` is now called "представление" everywhere (including the sidebar
  and API tables), and "layout engine" is "алгоритм раскладки" instead of the calque "движок раскладки".
- Added a project logo and favicon to the docs site.

### Removed

- `DECISIONS.md`, an internal development log not part of the published docs.

## 1.0.1 — 2026-07-26

### Added

- `autoFitView` prop: fits the canvas to its content after the first layout and after anything that reshapes it (view
  switch, group collapse/expand, layout engine change).

### Fixed

- Shift-click is now the reliable additive-selection modifier for multi-selecting nodes. Ctrl+click still works where
  the OS allows it, but macOS treats Ctrl+click as a right-click and never delivers it as a `click` event.
- `vue-asset-map/core` and `vue-asset-map/layout-dagre` subpath imports type-check in the playground; `tsconfig.lib.json`
  was missing their path mappings, which only worked locally when `dist/` happened to already be built.

### Changed

- Diversified the example demos so each one exercises a different layout or view instead of all twelve sharing the
  same fixture, radial layout and physical view.

## 1.0.0 — 2026-07-25

First public release.

### Added

- Asset map on Vue Flow with switching between projections of one graph
- Group collapse for sets of same-type nodes, with edge aggregation and expand on click
- Subtree collapse from a button on the node itself
- Search by name, IPv4 wildcard and CIDR
- Facet filters with consumer-defined groups
- Membership markers derived from the graph connections
- Details panel in draggable windows, filled through slots
- Light and dark themes on CSS custom properties
- Pluggable layouts: `manual` and `radial` built in, `dagre` behind an optional subpath
- Framework-free core on the `vue-asset-map/core` subpath
