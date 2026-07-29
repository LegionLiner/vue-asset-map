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

| Prop                        | Type                              | Default                | Description                                           |
| --------------------------- | --------------------------------- | ---------------------- | ----------------------------------------------------- |
| `entities`                  | `AssetEntity<E>[]`                | —                      | The map's nodes.                                      |
| `links`                     | `AssetLink<L>[]`                  | —                      | The map's edges.                                      |
| `views`                     | `AssetView[]`                     | —                      | The views.                                            |
| `nodeTypes`                 | `Record<string, Component>`       | —                      | Node components by `type`, merged over the built-ins. |
| `edgeTypes`                 | `Record<string, Component>`       | —                      | Edge components by `type`.                            |
| `layout`                    | `AssetMapLayoutSpec`              | `{ engine: 'manual' }` | Layout engine by name or instance, plus its options.  |
| `collapse`                  | `CollapseRule \| false`           | `{ threshold: 10 }`    | Group collapse rule; `false` disables collapsing.     |
| `filterOptions`             | `FilterOptions`                   | —                      | Search fields, neighbour depth, filter groups.        |
| `theme`                     | `ThemeMode`                       | `'light'`              | Theme mode: `'light'`, `'dark'` or `'auto'`.          |
| `themeConfig`               | `ThemeConfig`                     | —                      | `statusColors` and `kindIcons`.                       |
| `locale`                    | `string \| PartialLocaleMessages` | `'ru'`                 | Locale code or an override dictionary.                |
| `showToolbar`               | `boolean`                         | `true`                 | Visibility of the built-in controls.                  |
| `showDetailsPanel`          | `boolean`                         | `true`                 | Opening of details windows on click.                  |
| `showMinimap`               | `boolean`                         | `false`                | Visibility of the overview map.                       |
| `linkTypes`                 | `LinkTypeDef[]`                   | —                      | Connection kinds: colour, dash, name.                 |
| `showLegend`                | `boolean`                         | `false`                | Connection legend, bottom-left.                       |
| `showContextMenu`           | `boolean`                         | `false`                | Menu on right-click, over nodes and edges.            |
| `editable`                  | `boolean`                         | `false`                | Edit button, delete items, link drawing.              |
| `entityFields`              | `FieldDef[]`                      | —                      | Fields offered when an entity is edited.              |
| `linkFields`                | `FieldDef[]`                      | type, label, speed     | Fields offered when a link is edited.                 |
| `detailsMode`               | `'replace' \| 'stack'`            | `'replace'`            | What a plain click does to the open windows.          |
| `showNodeStatus`            | `boolean`                         | `true`                 | Status dot on the node circle.                        |
| `showNodeToggle`            | `boolean`                         | `true`                 | Subtree fold button on a node.                        |
| `showNodeLabel`             | `boolean`                         | `true`                 | Label plate under the circle.                         |
| `maxSublabels`              | `number`                          | unlimited              | Cap on sublabel lines; `0` hides them.                |
| `detailsTitle`              | `string \| (entity) => string`    | `entity.label`         | Caption of a details window's title bar.              |
| `showDetailsHeading`        | `boolean`                         | `true`                 | Heading block inside a details window.                |
| `detailsTabs`               | `DetailsTabDef[] \| false`        | the built-in tabs      | Tabs of a details window; `false` removes the strip.  |
| `maxDetailsWindows`         | `number`                          | `2`                    | Cap on open windows; `0` disables windows.            |
| `neighborHighlightDepth`    | `number`                          | `1`                    | Steps of a selection that stay lit; `0` disables.     |
| `infected`                  | `EntityId[]`                      | —                      | Infection sources for `blastRadius`.                  |
| `infectionOptions`          | `InfectionOptions`                | —                      | `direction`, `maxDepth`, `layers` of the spread.      |
| `autoPath`                  | `boolean`                         | `false`                | Trace the path between two selected nodes on its own. |
| `pathOptions`               | `PathOptions`                     | —                      | `maxDepth`, `layers` of a path search.                |
| `markers`                   | `NodeMarkerDef[]`                 | —                      | Membership dots under the labels.                     |
| `markerHoverDelay`          | `number`                          | `500`                  | Delay in ms before a hovered dot highlights.          |
| `onlyRenderVisibleElements` | `boolean`                         | `true`                 | Mounting of only what is in the viewport.             |
| `lodThreshold`              | `number`                          | `0.5`                  | Zoom below which nodes render simplified.             |
| `searchDebounce`            | `number`                          | `200`                  | Delay in ms before a typed query applies.             |
| `loading`                   | `boolean`                         | `false`                | Loading indicator.                                    |
| `autoFitView`               | `boolean`                         | `false`                | Fit the canvas on first layout and on a view switch.  |

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
| `openLinks`        | `string[]`              | Links with an open window; the last is on top.    |
| `positions`        | `Record<EntityId, XY>`  | Where nodes were moved by hand. Persist this.     |
| `collapsedNodes`   | `Set<EntityId>`         | Nodes whose subtree is folded.                    |
| `openFilterGroups` | `string[] \| undefined` | Expanded filter lists.                            |

Each works without a `v-model`; the component then owns that state.

#### Events

| Event                                              | Payload                                                      |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `node-click`, `node-dblclick`, `node-context-menu` | `NodeEventPayload`                                           |
| `edge-click`                                       | `{ id: string; event: MouseEvent }`                          |
| `pane-click`                                       | `MouseEvent`                                                 |
| `expand`, `collapse`                               | `{ groupId: string; group: CollapsedGroup \| undefined }`    |
| `node-expand`, `node-collapse`                     | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`      |
| `selection-change`                                 | `EntityId[]`                                                 |
| `path-change`                                      | `EntityId[]` — the traced path, empty when dropped           |
| `entity-update`                                    | `{ id: EntityId; entity: AssetEntity<E> }` — a new object    |
| `link-update`                                      | `{ id: string; link: AssetLink<L> }` — a new object          |
| `entity-delete`                                    | `{ id: EntityId; entity: AssetEntity<E> \| undefined }`      |
| `link-delete`                                      | `{ id: string; link: AssetLink<L> \| undefined }`            |
| `link-create`                                      | `{ link: AssetLink<L>; source: EntityId; target: EntityId }` |
| `node-move`                                        | `{ id: EntityId; entity?: AssetEntity<E>; position: XY }`    |
| `layout-start`                                     | `string` — engine name                                       |
| `layout-done`                                      | `{ engine: string; positions: number }`                      |
| `error`                                            | `unknown`                                                    |

#### Slots

| Slot                            | Props                           |
| ------------------------------- | ------------------------------- |
| `toolbar-left`, `toolbar-right` | —                               |
| `empty`, `loading`              | —                               |
| `windows`                       | —                               |
| `details`                       | `DetailsSlotProps<E>`           |
| `details-header`                | `DetailsHeaderSlotProps<E>`     |
| `details-title`                 | `DetailsTitleSlotProps<E>`      |
| `details-tabs`                  | `DetailsTabsSlotProps<E>`       |
| `edge-label`                    | `EdgeLabelSlotProps<L>`         |
| `link-details`                  | `LinkDetailsSlotProps<L>`       |
| `details-edit`                  | `EditSlotProps<AssetEntity<E>>` |
| `link-edit`                     | `EditSlotProps<AssetLink<L>>`   |
| `node-{type}`, `node-badge`     | `NodeSlotProps<E>`              |
| `node-label`, `node-status`     | `NodeSlotProps<E>`              |

`NodeSlotProps` carries `entity`, `nodeId` and `simplified` for every `node-*` slot, plus one field for the slot that
needs it: `badge` for `node-badge`, `sublabels` for `node-label`, `status` and `statusColor` for `node-status`.

#### Exposed methods — `AssetMapExposed<E, L>`

| Method           | Signature                                                 |
| ---------------- | --------------------------------------------------------- |
| `fitView`        | `() => Promise<void>`                                     |
| `focus`          | `(id: EntityId, options?: FocusOptions) => Promise<void>` |
| `relayout`       | `() => Promise<void>`                                     |
| `highlightPath`  | `(from, to, options?: PathOptions) => EntityId[]`         |
| `clearHighlight` | `() => void`                                              |
| `getGraph`       | `() => AssetGraph<E, L>`                                  |
| `getPositions`   | `() => Record<EntityId, XY>` — every visible node         |
| `resetPositions` | `() => void` — forget the hand-placed ones                |

### Other components

| Component                                   | Purpose                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `MapWindow`                                 | Floating window chrome: bar, dragging, collapsing, closing. |
| `DetailsPanel`                              | Default details window.                                     |
| `LinkDetailsPanel`                          | Default connection window.                                  |
| `DetailsSection`                            | One section of a details panel: heading plus content.       |
| `EditableFields`                            | Field rows that switch between reading and editing.         |
| `ContextMenu`                               | Menu at a point on the canvas.                              |
| `ConfirmDialog`                             | The package's own confirmation, not `window.confirm`.       |
| `MapLegend`                                 | Connection legend.                                          |
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
`Viewport`, `FocusOptions`, `InfectionOptions`, `PathOptions`, `NodeEventPayload`, `NodeSlotProps<E>`,
`DetailsSlotProps<E>`, `DetailsHeaderSlotProps<E>`, `DetailsTitleSlotProps<E>`, `DetailsTabsSlotProps<E>`,
`DetailsTabDef`, `LinkDetailsSlotProps<L>`, `EdgeLabelSlotProps<L>`, `EmptySlotProps`, `MiniMapNode`, `MapContext`,
`AssetNodeData<E>`, `EntityNodeData<E>`, `GroupNodeData`, `AssetEdgeData`, `ContextMenuItem`.

### Connections and editing

`LinkTypeDef`, `FieldDef`, `FieldOption`, `EditSlotProps<T>`.

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

These are the pieces `<AssetMap>` is itself assembled from, exported so a map can be built by hand instead. They form a
pipeline, each stage consuming the one before it:

```
entities, links → useAssetGraph → useViewProjection → useFilters → useCollapse → useLayout → useFlowElements → <VueFlow>
```

Reaching for them is worth it when the map's own structure is in the way — a different canvas, a graph rendered
server-side, a filter panel living somewhere else in the application. For everything short of that, `<AssetMap>` props
and slots do the same work.

Two conventions run through all of them. Inputs are `Ref`s, not plain values, so a stage keeps recomputing as its
source changes; outputs are `ComputedRef`s and never mutated in place. And state that a consumer might own — the
selection, expanded groups, filters — is passed **in** as a `Ref` and written back to, rather than created inside. That
is what makes each of them work equally well with a `v-model` and with a store.

### `useAssetGraph(entities, links)`

Builds the indexes every other stage reads: `entities` and `links` as `Map`s, `parentOf`, `childrenOf`, `adjacency`.
Everything downstream is a lookup rather than a scan.

Recomputation is tied to the **array references**, not to their contents. Handing back a new array re-indexes; editing a
field inside an existing entity does not, because no index depends on fields. Mutating an entity in place and expecting
the map to notice is the one thing that will not work here.

`issues` is what the builder repaired or dropped in the current input — a link pointing at a missing entity, a parent
cycle, a duplicate id. The build never throws over bad data: a map that renders 900 of 1000 nodes is more useful than a
blank screen, and the report says exactly what was lost. Worth logging in development.

Each entity's `meta` is passed through `markRaw`. Vue Flow makes `node.data` reactive, and without it Vue would proxy
every nested object of consumer payload for no gain — the details panel only reads it. Only `meta` is marked, never the
entity itself.

### `useViewProjection(graph, views, viewId)`

Applies the active view, returning the resolved `view`, the `projection` (the `entityIds` and `linkIds` that survive
it) and `showSublabels`.

`viewId` arrives from outside and may name a view that no longer exists — persisted from an older configuration, say.
`resolveView` then falls back to the first view rather than to nothing, so a stale id degrades to a different map
instead of an empty one.

The projection is what "restricted to the current view" means everywhere else: filtering, facet counts and path
searches all take their scope from it.

### `useFilters(graph, projection, filters, options, debounceMs)`

Search and facet filtering on top of the projection. Returns `matchedIds` (direct hits, drawn highlighted), `visibleIds`
(hits plus kept context), `facets` for the counters, and `active` — whether any criterion is set at all.

Debouncing lives here rather than in the input component, and applies to the **text query only**. The core stays a
synchronous pure function; "do not recompute the graph on every keystroke" is a property of the UI. A facet click is a
single deliberate act, and delaying it would just feel sluggish. Clearing the field applies immediately — there is no
reason to wait to get the map back.

`facets` are counted over the projection, not over the filter result. Counting the result would zero every other
counter the moment one value is picked, leaving nowhere to navigate back to.

### `useCollapse(graph, visibleIds, projection, rule, expanded, collapsedParents?)`

Folds sets of same-type siblings into group nodes and, through the optional `collapsedParents`, folds subtrees away
from the button on a node. Returns the collapsed graph, the groups, and the toggles: `expand`, `collapse`, `toggle`,
`toggleSubtree`. The toggles return the **new** state, so a caller can emit the right event without re-reading.

It runs before layout, deliberately: positions are computed on the collapsed graph, or a single group node would land
in space laid out for the fourteen nodes it replaced.

`expanded` is never mutated in place. Vue does track `Set` mutations, but the set may have come out of a consumer's own
store, so a fresh `Set` always goes back out.

Note the argument order: it takes `visibleIds` from the filter, but `<AssetMap>` passes it the **projection's** ids
instead. Collapsing follows the view, not the search — otherwise the set of groups would change on every letter typed
and the map would rebuild under the user's hands.

### `useLayout(params)`

Runs the layout engine and applies its result. Takes an object: `graph`, `collapsed`, `spec`, `view`, a `sizeOf`
callback and optional `onStart` / `onDone` / `onError` hooks. Returns `positions`, `running`, `engineName`, `relayout`,
`positionOf` and the manual-position setters.

Position priority is dragged-by-hand → `entity.position` from the backend → engine output. The first two are handed to
the engine as `pinned` rather than applied over its result, so the engine leaves them alone instead of moving them and
being corrected a frame later. `positionOf` applies the same order, so a node does not jump between "before" and
"after" the result lands.

Every run aborts the previous one through an `AbortSignal`: switch views three times quickly and only the last layout
is applied. The abort is re-checked after `await` as well as inside the engine, because a third-party engine may ignore
the signal entirely. The result lands as a single `Map` assignment — one reactive trigger per layout, not one per node.

An unknown engine name falls back to `manual` and reports through `onError` instead of throwing. Names come from view
data, i.e. from outside, and a typo must not blank the map.

Layout ignores the filter entirely. Search hides and highlights, but never rebuilds.

### `useFlowElements(params)`

Turns the collapsed graph into the `nodes` and `edges` arrays Vue Flow consumes.

`node.data` carries the bare minimum — an entity or a group. Everything volatile (selection, highlighting, LOD) is read
from the map context by the node components instead, so changing the selection does not rebuild the node array. That is
the single decision that keeps large maps responsive.

Filtering hides through `node.hidden`, Vue Flow's own mechanism, rather than by dropping nodes from the array — dropped
nodes would leave edges reaching toward things that no longer exist. A group node stays visible while any one member
matches, or a group would vanish exactly when you search for something inside it.

Nodes are built `selectable: false, focusable: false`. Vue Flow keeps selection state of its own, and two sources of
truth for one selection always drift apart.

### `useSelection(selection)`

Selection state over a `Ref<EntityId[]>` you own. Returns `selectedIds` (a `Set`), `primaryId`, `isSelected` and the
mutators `select`, `deselect`, `toggle`, `clear`, `replace`.

The state leaves as an **array** but is mirrored into a `Set` for lookups: an `includes` per node per render is
quadratic on a large map. Order is preserved, and it carries meaning — "first selected" is what the details panel
shows, and "two selected" is the pair a path is traced between.

`toggle(id, additive)` is what a click calls. A plain click on an already-selected node leaves it as the only
selection rather than deselecting it; clearing is what clicking the background is for.

### `useNodeMarkers(graph, markers, hoverDelay)`

Membership dots and the hover highlighting they drive. Returns `markersFor`, `hoveredMarker`, `memberIds` and the
pointer handlers.

The entity → markers index is built once per data change, and it iterates **markers** rather than entities: a marker
with `members` computes its set in one pass over the graph, whereas running a `match` predicate per entity would cost
entities × markers. A consequence worth relying on — dot order on a node is marker declaration order, so the same
marker sits in the same slot on every node.

Colors are assigned by declaration order from a three-token palette and wrap around, so a marker keeps its color no
matter which nodes carry it.

Hovering waits out `hoverDelay` (500 ms by default) before highlighting, so a pointer merely crossing the dots on its
way elsewhere does not flash the whole map. Leaving cancels both the pending delay and highlighting already started.
Keyboard focus highlights immediately — focus is already a deliberate act.

### `useMapContext()`

Reads the context `<AssetMap>` publishes: the translator, the graph, per-node state predicates (`isSelected`,
`isDimmed`, `isInfected`, …) and the interaction callbacks. This is what a custom node or edge component uses, and the
reason such a component needs no props beyond `id` and `data`.

Interactions go through the context (`onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu`) rather than through Vue
Flow's events, so behaviour is identical whether or not Vue Flow's own selection is enabled, and identical for mouse
and keyboard.

It **throws** outside `<AssetMap>`, with a legible message. Returning `undefined` would surface as
`undefined is not a function` somewhere deep inside a custom node's render, which is a far worse way to learn the
component was mounted in the wrong place.

### `useTranslate()`

A translator for the standalone controls. Unlike `useMapContext`, it does **not** throw without a context: it falls back
to the built-in locale. `SearchInput`, `ViewSwitcher` and `FilterMenu` are exported for use outside the map — in a page
header, say — and a control must not break merely for being moved out of it.

### `resolveTheme(mode)`

Reduces `ThemeMode` to `'light' | 'dark'`.

`'auto'` reads the system setting **once** and then stops watching it. The product has an explicit theme switch, and
that switch has to win; were `auto` subscribed to `prefers-color-scheme`, changing the OS theme would silently override
a choice the user made by hand.

The read is lazy and memoised: a map with `theme: 'light'` never calls `matchMedia` at all, and the `window` access
sits behind a guard inside the function rather than at module top level, so the package still imports under SSR.

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

### Fields

Pure helpers behind the edit forms. `readField(source, path)` and `writeField(source, path, value)` read and set a
dotted path (`'meta.speed'`); `writeField` copies every level it touches and creates missing branches, so an entity
without `meta` can still have `meta.speed` set. `applyFields(source, values)` applies a whole draft at once and returns
the **same object** when nothing actually changed, which is how an untouched form is told from a real edit.
`fieldLabel`, `fieldToInput` and `fieldFromInput` convert between stored values and what an `<input>` holds.

### IP

`parseIPv4(value)`, `extractIPv4(text)`, `parseCidr(query)`, `cidrContains(range, address)`,
`isIPv4Wildcard(query)`, `wildcardToRegExp(query)`, `matchesWildcard(text, query)`, `matchesCidr(text, range)`.

### Layout

`manualLayout`, `radialLayout`, `builtinLayoutEngines`, `resolveLayoutEngine(engine, extra?)`,
`applyPinned(positions, nodes)`, `throwIfAborted(signal, engineName)`, `isLayoutAborted(error)`,
`LayoutAbortedError`. The dagre engine is `dagreLayout` from `vue-asset-map/layout-dagre`.

### Registry

`buildNodeTypes(custom?)`, `buildEdgeTypes(custom?)`, `nodeTypeFor(type, types)`, `edgeTypeFor(type, types)`,
`NODE_TYPE_BASE`, `NODE_TYPE_GROUP`, `EDGE_TYPE_BASE`.

### Locale

`builtinLocales`, `defaultLocale`, `resolveLocale(locale?)`, `createTranslator(messages)`, `en`, `ru`.
