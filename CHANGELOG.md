# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
