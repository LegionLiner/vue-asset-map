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
  --vam-node-label-width: 96px;
}
```

### Key tokens

| Group     | Tokens                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces  | `--vam-bg`, `--vam-surface`, `--vam-surface-raised`, `--vam-surface-sunken`                                                                                                |
| Text      | `--vam-fg`, `--vam-fg-muted`, `--vam-fg-subtle`                                                                                                                            |
| Accent    | `--vam-accent`, `--vam-accent-fg`, `--vam-accent-soft`, `--vam-selection`, `--vam-focus-ring`                                                                              |
| Edges     | `--vam-edge`, `--vam-edge-active`, `--vam-edge-width`                                                                                                                      |
| Node      | `--vam-node-size`, `--vam-node-size-root`, `--vam-node-label-width`, `--vam-node-label-height`, `--vam-node-label-gap`, `--vam-node-toggle-size`, `--vam-node-status-size` |
| Node text | `--vam-node-label-color`, `--vam-node-sublabel-color`, `--vam-node-overlay-color`                                                                                          |
| Markers   | `--vam-marker-1`, `--vam-marker-2`, `--vam-marker-3`, `--vam-marker-infected`, `--vam-marker-size`, `--vam-marker-gap`, `--vam-marker-offset`                              |
| Infection | `--vam-infected-bg`, `--vam-infected-border`, `--vam-infected-fg`                                                                                                          |
| Windows   | `--vam-window-width`, `--vam-window-radius`, `--vam-window-header-height`, `--vam-windows-top`, `--vam-details-top`                                                        |
| Filters   | `--vam-filter-width`, `--vam-filter-height`                                                                                                                                |
| Canvas    | `--vam-canvas-dot`, `--vam-canvas-dot-size`, `--vam-canvas-grid`                                                                                                           |
| Motion    | `--vam-transition`, `--vam-dimmed-opacity`                                                                                                                                 |

The label plate has a fixed width on purpose: sublabels appear and disappear as views change, and a breathing size
would jolt the whole layout.

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

`kindIcons` maps a `kind` to a component. Use `currentColor` for every stroke and fill — an icon with a baked-in color
ignores both the theme switch and your token overrides. See [Nodes](./nodes).

## Reduced motion

Transitions become instant (`0s`) under `prefers-reduced-motion: reduce`. Nothing to configure.

## Class names

Every class is prefixed `vam-`, and there are no global selectors. The ones you are most likely to target:
`.vam-root`, `.vam-canvas`, `.vam-toolbar`, `.vam-node`, `.vam-node__circle`, `.vam-node__info`, `.vam-edge`,
`.vam-window`, `.vam-details`, `.vam-filter`.

State classes follow the same pattern: `.vam-node--selected`, `.vam-node--matched`, `.vam-node--dimmed`,
`.vam-node--highlighted`, `.vam-node--simplified`, `.vam-node--infected`.

<script setup>
import darkSource from '../.vitepress/demos/DarkThemeMap.vue?raw'
</script>
