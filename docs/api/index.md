# API reference

Everything the package exports. Three entry points:

| Import                       | Contents                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `vue-asset-map`              | Components, composables, types and everything from the core. |
| `vue-asset-map/core`         | Graph functions with no Vue and no Vue Flow.                 |
| `vue-asset-map/layout-dagre` | The dagre layout engine, behind an optional dependency.      |
| `vue-asset-map/style.css`    | Tokens, light and dark themes, component rules.              |

## Component

### `<AssetMap>`

The map. Generic over the payload types of `entity.meta` and `link.meta`: `AssetMap<E, L>`.

#### Props

| Prop                        | Type                                | Default                | Description                                            |
| --------------------------- | ------------------------------------ | ---------------------- | -------------------------------------------------------- |
| `entities`                  | `AssetEntity<E>[]`                 | —                      | The map's nodes.                                     |
| `links`                     | `AssetLink<L>[]`                   | —                      | The map's edges.                                     |
| `views`                     | `AssetView[]`                      | —                      | The views.                                            |
| `nodeTypes`                 | `Record<string, Component>`        | —                      | Node components by `kind`, merged over the built-ins. |
| `edgeTypes`                 | `Record<string, Component>`        | —                      | Edge components by `kind`.                            |
| `layout`                    | `AssetMapLayoutSpec`               | `{ engine: 'manual' }` | Layout engine by name or instance, plus its options.  |
| `collapse`                  | `CollapseRule \| false`            | `{ threshold: 10 }`    | Group collapse rule; `false` disables collapsing.     |
| `filterOptions`             | `FilterOptions`                    | —                      | Search fields, neighbour depth, filter groups.        |
| `theme`                     | `ThemeMode`                        | `'light'`               | Theme mode: `'light'`, `'dark'` or `'auto'`.          |
| `themeConfig`               | `ThemeConfig`                      | —                      | `statusColors` and `kindIcons`.                       |
| `locale`                    | `string \| PartialLocaleMessages`  | `'ru'`                 | Locale code or an override dictionary.                |
| `showToolbar`               | `boolean`                          | `true`                 | Visibility of the built-in controls.                  |
| `showDetailsPanel`          | `boolean`                          | `true`                 | Opening of details windows on click.                  |
| `showMinimap`               | `boolean`                          | `false`                | Visibility of the overview map.                       |
| `maxDetailsWindows`         | `number`                           | `2`                    | Cap on open windows; `0` disables windows.            |
| `neighborHighlightDepth`    | `number`                           | `1`                    | Steps of a selection that stay lit; `0` disables.     |
| `infected`                  | `EntityId[]`                       | —                      | Infection sources for `blastRadius`.                  |
| `infectionOptions`          | `InfectionOptions`                 | —                      | `direction`, `maxDepth`, `layers` of the spread.      |
| `markers`                   | `NodeMarkerDef[]`                  | —                      | Membership dots under the labels.                     |
| `markerHoverDelay`          | `number`                           | `500`                  | Delay in ms before a hovered dot highlights.          |
| `onlyRenderVisibleElements` | `boolean`                          | `true`                 | Mounting of only what is in the viewport.             |
| `lodThreshold`              | `number`                           | `0.5`                  | Zoom below which nodes render simplified.             |
| `searchDebounce`            | `number`                           | `200`                  | Delay in ms before a typed query applies.             |
| `loading`                   | `boolean`                          | `false`                | Loading indicator.                                    |
| `autoFitView`               | `boolean`                          | `false`                | Auto-fit of the canvas to its content after layout.   |

`entities` and `links` are read-only for the map: it never adds, reorders or normalises fields in the input arrays.
Without `views`, everything is drawn.

#### Two-way bindings

| Model              | Type                    | Description                                       |
| ------------------ | ----------------------- | ------------------------------------------------- |
| `view`             | `string \| undefined`   | Active view id.                                   |
| `selection`        | `EntityId[]`            | Selected ids, in selection order.                 |
| `expanded`         | `Set<string>`           | Group ids expanded by hand.                       |
| `filters`          | `FilterState`           | Query, filter groups, group selection.            |
| `viewport`         | `Viewport`              | Pan in px plus zoom.                              |
| `openDetails`      | `EntityId[]`            | Entities with an open window; the last is on top. |
| `collapsedNodes`   | `Set<EntityId>`         | Nodes whose subtree is folded.                    |
| `openFilterGroups` | `string[] \| undefined` | Expanded filter lists.                            |

Each works without a `v-model`; the component then owns that state.

#### Events

| Event                                              | Payload                                                   |
| -------------------------------------------------- | --------------------------------------------------------- |
| `node-click`, `node-dblclick`, `node-context-menu` | `NodeEventPayload`                                        |
| `edge-click`                                       | `{ id: string; event: MouseEvent }`                       |
| `pane-click`                                       | `MouseEvent`                                              |
| `expand`, `collapse`                               | `{ groupId: string; group: CollapsedGroup \| undefined }` |
| `node-expand`, `node-collapse`                     | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`   |
| `selection-change`                                 | `EntityId[]`                                              |
| `layout-start`                                     | `string` — engine name                                    |
| `layout-done`                                      | `{ engine: string; positions: number }`                   |
| `error`                                            | `unknown`                                                 |

#### Slots

| Slot                            | Props                       |
| ------------------------------- | --------------------------- |
| `toolbar-left`, `toolbar-right` | —                           |
| `empty`, `loading`              | —                           |
| `windows`                       | —                           |
| `details`                       | `DetailsSlotProps<E>`       |
| `details-header`                | `DetailsHeaderSlotProps<E>` |
| `edge-label`                    | `EdgeLabelSlotProps<L>`     |
| `node-{kind}`, `node-badge`     | `NodeSlotProps<E>`          |

#### Exposed methods — `AssetMapExposed<E, L>`

| Method           | Signature                                                 |
| ---------------- | --------------------------------------------------------- |
| `fitView`        | `() => Promise<void>`                                     |
| `focus`          | `(id: EntityId, options?: FocusOptions) => Promise<void>` |
| `relayout`       | `() => Promise<void>`                                     |
| `highlightPath`  | `(from: EntityId, to: EntityId) => EntityId[]`            |
| `clearHighlight` | `() => void`                                              |
| `getGraph`       | `() => AssetGraph<E, L>`                                  |

### Other components

| Component                                   | Purpose                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `MapWindow`                                 | Floating window chrome: bar, dragging, collapsing, closing. |
| `DetailsPanel`                              | Default details window.                                     |
| `DetailsSection`                            | One section of a details panel: heading plus content.       |
| `BaseNode`, `GroupNode`                     | Default node and group node.                                |
| `AssetEdge`                                 | Default edge.                                               |
| `MiniMap`                                   | Overview map.                                               |
| `SearchInput`, `ViewSwitcher`, `FilterMenu` | Toolbar controls; usable outside the map.                   |

## Types

### Data

`AssetEntity<M>`, `AssetLink<M>`, `AssetView`, `ProjectionResult`, `EntityId`, `XY`, `Badge`, `AssetGraph<E, L>`,
`GraphIssue`, `GraphIssueCode`.

### Collapsing

`CollapseRule`, `CollapsedGroup`, `CollapsedLink<L>`, `CollapseResult<L>`, `AggregatedLink<L>`, `CollapseOptions`.

### Filtering

`FilterState`, `FilterOptions`, `FilterResult`, `FacetCounts`, `FilterGroupDef`, `FilterGroupOption`.

### Markers

`NodeMarkerDef`, `ResolvedNodeMarker`, `MarkerAnchor`, `ConnectionMarkerOptions`.

### Layout

`LayoutEngine<O>`, `LayoutGraph`, `LayoutNode`, `NodeSize`, `ManualLayoutOptions`, `RadialLayoutOptions`,
`DagreLayoutOptions`, `LayoutAbortedError`.

### Component contract

`AssetMapProps<E, L>`, `AssetMapModels`, `AssetMapSlots<E, L>`, `AssetMapExposed<E, L>`, `AssetMapLayoutSpec`,
`Viewport`, `FocusOptions`, `InfectionOptions`, `NodeEventPayload`, `NodeSlotProps<E>`, `DetailsSlotProps<E>`,
`DetailsHeaderSlotProps<E>`, `EdgeLabelSlotProps<L>`, `EmptySlotProps`, `MiniMapNode`, `MapContext`,
`AssetNodeData<E>`, `EntityNodeData<E>`, `GroupNodeData`, `AssetEdgeData`.

### Theme and locale

`ThemeMode`, `ResolvedTheme`, `ThemeConfig`, `LocaleMessages`, `PartialLocaleMessages`, `LocaleKey`, `Translate`.

### IP

`CidrRange`.

## Composables

| Composable                                                                      | Returns                                                        |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `useAssetGraph(entities, links)`                                                | `{ graph, issues }` — indexes plus repair reports.             |
| `useViewProjection(graph, views, viewId)`                                       | `{ view, projection, showSublabels }`                          |
| `useFilters(graph, projection, filters, options, debounceMs)`                   | `{ result, facets, active, visibleIds, matchedIds }`           |
| `useCollapse(graph, visibleIds, projection, rule, expanded, collapsedParents?)` | Group state plus toggles.                                      |
| `useLayout(params)`                                                             | `{ positions, running, engineName, relayout, positionOf, … }`  |
| `useFlowElements(params)`                                                       | `{ nodes, edges }` for `<VueFlow>`.                            |
| `useSelection(selection)`                                                       | Selection state and mutators.                                  |
| `useNodeMarkers(graph, markers, hoverDelay)`                                    | `{ markersFor, hoveredMarker, memberIds, … }`                  |
| `useMapContext()`                                                               | The context nodes and edges read. Throws outside `<AssetMap>`. |
| `useTranslate()`                                                                | A translator that falls back to the built-in locale.           |
| `resolveTheme(mode)`                                                            | `ComputedRef<ResolvedTheme>`.                                  |

## Core

Available from both `vue-asset-map` and `vue-asset-map/core`.

### Graph

| Function                                | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `buildGraph(entities, links, options?)` | Builds the indexes; reports repairs through `onIssue`. |
| `emptyGraph()`                          | A graph with nothing in it.                            |
| `parentIdOf(graph, id)`                 | Effective parent, `null` for a root.                   |
| `ancestorsOf(graph, id)`                | Chain up to the root. Cycle-safe.                      |
| `descendantsOf(graph, id)`              | Depth-first, excluding the node. Cycle-safe.           |
| `incidentLinks(graph, id, layers?)`     | Links touching a node.                                 |
| `matchesLayers(link, layers)`           | Empty `layers` matches everything.                     |
| `otherEnd(link, id)`                    | The far end; a self-loop returns `id`.                 |

### Projection

`projectGraph(graph, view?)`, `resolveView(views, viewId)`, `defaultLinkFilter(view)`.

### Filtering

`applyFilters(graph, state, options?)`, `facetCounts(graph, restrictTo?, groups?)`, `emptyFilterState()`,
`isFilterActive(state)`, `matchesQuery(fields, query)`, `defaultSearchFields(entity)`, `groupValuesOf(group, entity)`,
`selectedGroupCount(state)`.

### Collapsing

`collapseGraph(graph, options?)`, `groupIdFor(parentId, bucket)`, `isAggregatedLink(link)`.

### Traversal

`neighbors(graph, id, depth, layers?)`, `findPaths(graph, from, to, options?)`, `blastRadius(graph, id, options?)`.

### Markers

`connectionMarkers(anchors, options?)`, `topAnchors(graph, count, layers?)`.

### IP

`parseIPv4(value)`, `extractIPv4(text)`, `parseCidr(query)`, `cidrContains(range, address)`,
`isIPv4Wildcard(query)`, `wildcardToRegExp(query)`, `matchesWildcard(text, query)`, `matchesCidr(text, range)`.

### Layout

`manualLayout`, `radialLayout`, `builtinLayoutEngines`, `resolveLayoutEngine(engine, extra?)`,
`applyPinned(positions, nodes)`, `throwIfAborted(signal, engineName)`, `isLayoutAborted(error)`,
`LayoutAbortedError`. The dagre engine is `dagreLayout` from `vue-asset-map/layout-dagre`.

### Registry

`buildNodeTypes(custom?)`, `buildEdgeTypes(custom?)`, `nodeTypeFor(kind, types)`, `edgeTypeFor(kind, types)`,
`NODE_TYPE_BASE`, `NODE_TYPE_GROUP`, `EDGE_TYPE_BASE`.

### Locale

`builtinLocales`, `defaultLocale`, `resolveLocale(locale?)`, `createTranslator(messages)`, `en`, `ru`.
