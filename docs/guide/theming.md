# Theming

Every value is a CSS custom property declared on `.vam-root`, the component's own root element — never on `:root`. The
package may not affect the page beyond its own bounds, and two maps with different themes have to be able to coexist.

<LiveDemo :source="darkSource">
  <DarkThemeMap />
</LiveDemo>

## Light and dark

```vue
<AssetMap theme="dark" :entities="entities" :links="links" />
```

`'auto'` reads `prefers-color-scheme` **once** at initialisation and then stops watching it. The product has an
explicit switch, and that switch has to beat the system: were `auto` subscribed, changing the OS theme would override
the user's own choice. A map with `theme: 'light'` never calls `matchMedia` at all.

The dark theme is applied through the `.vam-theme-dark` class, so it is a plain cascade override you can extend or
replace.

## Overriding tokens

```css
.vam-root {
  --vam-node-size: 44px;
  --vam-node-size-root: 72px;
  --vam-accent: #5a5ee7;
  --vam-selection: #4d6d9a;
  --vam-font: 'Inter', system-ui, sans-serif;
}
```

Scope it to one map by adding a class of your own:

```vue
<AssetMap class="compact-map" :entities="entities" :links="links" />
```

```css
.compact-map.vam-root {
  --vam-node-size: 28px;
  --vam-node-label-max-width: 96px;
}
```

### Key tokens

| Group     | Tokens                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Surfaces  | `--vam-bg`, `--vam-surface`, `--vam-surface-raised`, `--vam-surface-sunken`                                                                                                                                  |
| Text      | `--vam-fg`, `--vam-fg-muted`, `--vam-fg-subtle`                                                                                                                                                              |
| Accent    | `--vam-accent`, `--vam-accent-fg`, `--vam-accent-soft`, `--vam-selection`, `--vam-focus-ring`                                                                                                                |
| Edges     | `--vam-edge`, `--vam-edge-active`, `--vam-edge-width`                                                                                                                                                        |
| Node      | `--vam-node-size`, `--vam-node-size-root`, `--vam-node-label-max-width`, `--vam-node-label-min-width`, `--vam-node-label-height`, `--vam-node-label-gap`, `--vam-node-toggle-size`, `--vam-node-status-size` |
| Node text | `--vam-node-label-color`, `--vam-node-sublabel-color`, `--vam-node-overlay-color`                                                                                                                            |
| Markers   | `--vam-marker-1`, `--vam-marker-2`, `--vam-marker-3`, `--vam-marker-infected`, `--vam-marker-size`, `--vam-marker-gap`, `--vam-marker-offset`                                                                |
| Infection | `--vam-infected-bg`, `--vam-infected-border`, `--vam-infected-fg`                                                                                                                                            |
| Windows   | `--vam-window-width`, `--vam-window-radius`, `--vam-window-header-height`, `--vam-window-border`, `--vam-window-shadow`, `--vam-window-caption-padding`, `--vam-windows-top`, `--vam-details-top`            |
| Menus     | `--vam-menu-min-width`, `--vam-menu-danger`, `--vam-menu-danger-soft`, `--vam-confirm-scrim`                                                                                                                 |
| Legend    | `--vam-legend-swatch-size`                                                                                                                                                                                   |
| Filters   | `--vam-filter-width`, `--vam-filter-height`                                                                                                                                                                  |
| Canvas    | `--vam-canvas-dot`, `--vam-canvas-dot-size`, `--vam-canvas-grid`                                                                                                                                             |
| Motion    | `--vam-transition`, `--vam-dimmed-opacity`                                                                                                                                                                   |

The label plate is sized by its contents up to `--vam-node-label-max-width`, so a short name gets a short plate and a
long one is clipped rather than allowed to push its neighbours around. Layout reserves the ceiling for every node
whatever its text, so plates cannot collide when a view swaps the labels underneath them.

## Status colors

`status` values are yours, so the mapping is too:

```ts
const statusColors = {
  online: 'var(--vam-status-online)',
  offline: '#cb5555',
  degraded: '#e0a800',
}
```

```vue
<AssetMap :entities="entities" :links="links" :theme-config="{ statusColors }" />
```

## Icons

`kindIcons` maps a `type` to a component. Use `currentColor` for every stroke and fill — an icon with a baked-in color
ignores both the theme switch and your token overrides. See [Nodes](./nodes).

## Reduced motion

Transitions become instant (`0s`) under `prefers-reduced-motion: reduce`.

## Class names

Every class is prefixed `vam-`, and there are no global selectors. The ones you are most likely to target:
`.vam-root`, `.vam-canvas`, `.vam-toolbar`, `.vam-node`, `.vam-node__circle`, `.vam-node__info`, `.vam-edge`,
`.vam-window`, `.vam-details`, `.vam-filter`.

State classes follow the same pattern: `.vam-node--selected`, `.vam-node--matched`, `.vam-node--dimmed`,
`.vam-node--highlighted`, `.vam-node--simplified`, `.vam-node--infected`.

## Wording

**The built-in locale is Russian.** Every string ships in English too, but the map does not pick it up on its own — a
map with no `locale` renders its filters, its search and its legend in Russian.

```vue
<AssetMap :entities="entities" :links="links" locale="en" />
```

A **partial** dictionary merges over the default, which is still `ru`. So this leaves everything but one string in
Russian:

```vue
<!-- Not what it looks like: the other ~90 strings stay Russian. -->
<AssetMap :locale="{ 'search.label': 'Find' }" :entities="entities" :links="links" />
```

For an English base with overrides on top, spread the exported dictionary:

```vue
<script setup lang="ts">
import { en } from 'vue-asset-map'

const locale = { ...en, 'search.label': 'Find' }
</script>
```

Both `en` and `ru` are exported, and `LocaleMessages` types the full key set, so a missing key is a compile error
rather than a stray Russian word in production.

<script setup>
import darkSource from '../.vitepress/demos/DarkThemeMap.vue?raw'
</script>
