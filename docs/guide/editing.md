# Connections and editing

The map is read-only by default. This page covers the parts that let someone change what is on it: connection kinds and
their legend, the window a connection opens, the right-click menus, editing entities and links, and drawing a new link
between two nodes.

One rule runs through all of it: **the map never writes to `entities` or `links`.** It reports what was asked for and
the application decides. Every payload below is a new object; applying it is your move. That is what keeps the map
usable over a store, an API, an undo stack, or nothing at all.

## Connection kinds

`linkTypes` declares the kinds your data uses. One declaration drives three separate things, which is the point —
a colour in the legend always belongs to an edge someone can actually draw, and an editable type is never one the
legend has never heard of.

```vue
<script setup lang="ts">
import type { LinkTypeDef } from 'vue-asset-map'

const linkTypes: LinkTypeDef[] = [
  { id: 'fiber', label: 'Fibre', color: '#2f7d4f', width: 2 },
  { id: 'wifi', label: 'Wi-Fi', color: '#c07b1e', dash: '2 3' },
  { id: 'vpn', label: 'VPN tunnel', color: '#5a5ee7', dash: '6 4' },
]
</script>

<template>
  <AssetMap :entities="entities" :links="links" :link-types="linkTypes" show-legend />
</template>
```

`id` is matched against `link.type`. Give each kind a `dash` as well as a `color`: colour alone does not survive a
monochrome print or a red-green deficiency, and the legend is meant to be readable by everyone who can see the map.

The per-kind stroke is applied inline, and deliberately **withheld** while an edge is highlighted, dimmed or infected.
An inline `stroke` beats every class, so keeping it would leave those states silently unpainted — in those moments what
the edge _is_ matters less than what is happening to it.

### The legend

`showLegend` puts it bottom-left, the last corner not already claimed by the toolbar or the minimap. Only kinds that
are drawn differently appear: one with neither colour nor dash is indistinguishable from the default, and a row
explaining nothing is worse than no row. Each swatch draws the real line — same colour, same dash, same width — because
a legend that only approximates the map has to be trusted to be read.

## The connection window

Clicking an edge opens a window with what the line joins, its kind, its layers and its `meta`. Where an entity window
leans on `#details` for anything meaningful, a link has enough of a fixed shape that the package can show it unaided.

The open set is state like any other:

```vue
<AssetMap v-model:open-links="openLinks" :entities="entities" :links="links" />
```

An **aggregated** edge opens nothing. It stands for several links at once and has no single record to describe; the
click still reports through `edge-click`.

`#link-details` replaces the body, the same way `#details` does for entities.

## One window at a time

A plain click now **replaces** what is open rather than adding to it, so clicking around the map reads one node at a
time instead of burying it under windows. `detailsMode: 'stack'` restores the old behaviour.

Either way, "open in a new window" from the context menu stacks — that is what it is for.

```vue
<AssetMap :entities="entities" :links="links" details-mode="stack" />
```

## Right-click menus

`showContextMenu` puts a menu on nodes and on edges. A node's offers to open the entity in a second window; an edge's
offers to open its details. With `editable` on, both also offer to delete.

```vue
<AssetMap :entities="entities" :links="links" show-context-menu editable />
```

It is off by default because `node-context-menu` has always been the way to put your own menu there, and a built-in one
appearing over it would be a surprise for anyone already doing that. The event still fires either way.

A group node gets no menu: there is no entity behind it for either item to act on.

## Deleting

Delete always goes through a confirmation first, and that confirmation is the package's own — not `window.confirm`,
which is unstyleable and looks like a phishing prompt, and not a dialog library, which would be a runtime dependency for
one box. It is built from the same tokens as the rest of the map, so it follows the theme. Focus opens on **cancel**:
the destructive action must never be what a stray Enter lands on.

Nothing is removed until you remove it:

```vue
<AssetMap
  :entities="entities"
  :links="links"
  show-context-menu
  editable
  @entity-delete="onEntityDelete"
  @link-delete="onLinkDelete"
/>
```

```ts
function onEntityDelete({ id }: { id: string }): void {
  entities.value = entities.value.filter((entity) => entity.id !== id)
  // A node's links go with it, or the graph builder reports them dangling.
  links.value = links.value.filter((link) => link.source !== id && link.target !== id)
}
```

The map closes the deleted thing's window and drops it from the selection before emitting — leaving a window open over a
record the application has just been told to drop would show something that is about to stop existing.

## Editing

`editable` plus a field schema puts an **Edit** button under the window body. The first press turns the body into a
form; the second saves and turns it back.

The schema is data because editing is the one thing the package cannot do on your vocabulary: it knows an entity has a
`label` and a `meta`, but not that `meta.speed` is measured in megabits, nor which of your twenty fields are worth
putting in front of someone.

```vue
<script setup lang="ts">
import type { FieldDef } from 'vue-asset-map'

const entityFields: FieldDef[] = [
  { key: 'label', label: 'Name' },
  {
    key: 'status',
    label: 'State',
    type: 'select',
    options: [
      { value: 'online', label: 'Online' },
      { value: 'offline', label: 'Offline' },
    ],
  },
  { key: 'meta.owner', label: 'Owner' },
]
</script>

<template>
  <AssetMap
    :entities="entities"
    :links="links"
    :entity-fields="entityFields"
    editable
    @entity-update="({ id, entity }) => replaceEntity(id, entity)"
  />
</template>
```

`key` is a dotted path. It is read for display and written on save, and missing branches are created — `meta.speed`
works on an entity that has no `meta` yet. Every level of the path is copied rather than mutated.

Field types are `'text'` (the default), `'number'`, `'select'` and `'textarea'`. A `readonly` field is shown but not
editable.

Some details worth relying on:

- **Editing takes the body over entirely**, including when you filled `#details`. A read view has nothing to type into,
  so a consumer with a custom body still gets a working form for the fields they declared, rather than an Edit button
  that promises something it cannot do.
- **An untouched form emits nothing.** Opening the editor and closing it again is not an edit and never reaches
  `entity-update`.
- **An empty field means no value**, not an empty string — for an optional field those are different kinds of wrong.
- **A number field that cannot be parsed keeps the text.** Silently turning it into `NaN` would destroy what was typed.
- **Cancelling drops the draft**, and so does the record changing underneath an open window.
- **The form is one field per row**, label above and control at the full width of the window. Reading is scanning, so
  the read view keeps two columns; editing is typing, and a control squeezed into half a panel is what makes a form
  feel like an afterthought.

### Your own controls

`#details-edit` replaces the form entirely, for a design that owes nothing to the package's inputs. It receives the
record, the declared fields, the draft, a writer for it, and the two actions the built-in buttons perform:

```vue
<template #details-edit="{ value, fields, values, setValue, save, cancel }">
  <MyForm
    :entity="value"
    :fields="fields"
    :draft="values"
    @change="setValue"
    @submit="save"
    @cancel="cancel"
  />
</template>
```

`#link-edit` does the same for connection windows. Nothing handed to either slot is a component — a form tied to the
package's controls would be exactly the thing these slots exist to escape.

Links work the same way through `linkFields` and `link-update`. Declare nothing and, while `editable`, the map offers a
sensible default: the type as a select over your `linkTypes`, plus a label and a speed. That covers the shape nearly
every link has without restating it.

## Drawing a new link

With `editable`, hovering a node reveals four grab points, one on each side of its circle. Dragging from one to
another node creates a candidate link, and its window opens **straight into edit mode**, so the kind and speed are
filled in while the intent is still fresh.

Four rather than one because the direction you drag in is a statement about where the link should run; a single handle
would force every link out of the same edge of the circle. They stay hidden until the node is hovered or focused —
four dots on every node at rest would be four pieces of chrome per node on a map built to hold hundreds.

The grab points are declared _after_ the node's centre handles, which stay the anchors for drawn edges: an edge naming
no handle resolves to the first of its type, so adding them does not move any existing line. Group nodes get none,
since a link to a group would have no entity at one of its ends.

```vue
<AssetMap :entities="entities" :links="links" :link-types="linkTypes" editable @link-create="onLinkCreate" />
```

```ts
function onLinkCreate({ link }: { link: AssetLink }): void {
  links.value = [...links.value, link]
}
```

The candidate carries the current view's layer, so a link drawn in a view is visible in it — one that vanished the
instant it was created would be the obvious trap here.

Nothing exists until the form is saved. `link-create` fires on that first save, not on the drag; closing the window
first abandons the candidate entirely. A drag that ends where it started is not a link and is ignored.
