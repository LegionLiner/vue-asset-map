# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Group collapse for sets of same-kind nodes, with edge aggregation and expand on click
- Subtree collapse from a button on the node itself
- Search by name, IPv4 wildcard and CIDR
- Facet filters with consumer-defined groups
- Membership markers derived from the graph connections
- Details panel in draggable windows, filled through slots
- Light and dark themes on CSS custom properties
- Pluggable layouts: `manual` and `radial` built in, `dagre` behind an optional subpath
- Framework-free core on the `vue-asset-map/core` subpath
