# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.5

### Added

- `linkTypes` prop: the kinds of connection the data uses, each with a colour, a dash and a name. One declaration drives
  the edge stroke, the legend and the type select when a link is edited, so the three can never disagree.
- `showLegend` prop: a legend of connection kinds bottom-left. Only kinds drawn differently appear in it, and each
  swatch draws the real line rather than an approximation of it.
- A window for connections, opened by clicking an edge: what it joins, its kind, its layers and its `meta`. Driven by
  `v-model:openLinks`, replaceable through the `#link-details` slot. Edges also gained a transparent hit area, so a 1px
  line is actually clickable.
- `showContextMenu` prop: a menu on right-click over nodes and edges — "open in a new window" for a node, "open details"
  for an edge, and "delete" for either while `editable`.
- `editable` prop plus `entityFields` / `linkFields` schemas: an edit button in details windows that turns the body into
  a form and back, connection handles for drawing new links, and the delete items in the context menus. The map never
  writes to `entities` or `links` — it reports through the new `entity-update`, `entity-delete`, `link-create`,
  `link-update` and `link-delete` events.
- `ConfirmDialog`, `ContextMenu`, `MapLegend`, `LinkDetailsPanel` and `EditableFields` are exported. Deleting is
  confirmed by the package's own dialog rather than `window.confirm` or a dialog dependency.
- Field helpers on the core subpath: `readField`, `writeField`, `applyFields`, `fieldLabel`, `fieldToInput`,
  `fieldFromInput`. `writeField` copies every level it touches and creates missing branches; `applyFields` returns the
  same object when nothing changed, so an untouched form is told from a real edit.
- `#details-edit` and `#link-edit` slots: replace the edit form with your own controls. Each receives the record, the
  declared fields, the draft, a writer for it and the save/cancel actions — nothing tied to the package's inputs.
- Hovering a node reveals four grab points, one per side of its circle, for drawing a link. Four rather than one because
  the direction of the drag says where the link should run. They are declared after the centre handles, so existing
  edges still anchor centre to centre, and group nodes get none.
- `--vam-window-border`, `--vam-window-shadow`, `--vam-window-caption-padding`, `--vam-menu-*`, `--vam-confirm-scrim`,
  `--vam-connector-size` and `--vam-legend-swatch-size` tokens, in both themes.

### Changed

- **A plain click on a node now replaces the open details window instead of opening another.** Clicking around the map
  reads one node at a time rather than burying it under windows. `detailsMode: 'stack'` restores the previous
  behaviour; "open in a new window" from the context menu stacks either way.
- Hovering a membership dot now dims the other dots along with the nodes. Leaving the whole row at full strength made
  it read as unaffected while the map behind it faded.
- A node's label plate is sized by its contents up to `--vam-node-label-max-width`, rather than always filling a fixed
  slab. Layout still reserves the ceiling for every node, so a shorter plate never lets a neighbour drift into its
  space. `--vam-node-label-width` is now `--vam-node-label-max-width`.
- A collapsed window shrinks to the width of its caption instead of holding a 480px box open, and windows are outlined
  as well as shadowed — over a busy canvas the shadow alone did not separate them from what was behind.
- Window title-bar buttons are 20px with a hover plate and a pressed state; at 16px with only a colour change it was
  hard to tell whether a click had landed.

### Fixed

- **Links could not be drawn at all.** Every node was built with `connectable: false`, which VueFlow reads after the
  graph-wide `nodesConnectable`, so the `editable` prop was silently defeated. Nodes now follow `editable`, groups stay
  unconnectable, and the connection mode is loose so a drag can end on any handle.
- The edit form was squeezed into the label column of the details section's two-column grid, leaving every control at
  roughly 40% of the window. Fields now span the full width, one per row with the label above.
- The edit form now replaces the window body even when `#details` is filled. It used to render only inside the fallback
  branch, so a consumer with a custom body got an Edit button that produced no inputs at all.

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
