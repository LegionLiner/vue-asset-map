# Screenshots for the README

Three assets are referenced from `README.md` and `README.ru.md` once they exist. They are not in the repository yet:
capturing them needs a browser, which the build cannot do on its own.

| File | What to capture |
| --- | --- |
| `map-light.png` | The map on the light theme, physical topology, one node selected with its details window open. |
| `map-dark.png` | The same frame with `theme="dark"`. |
| `map-projections.gif` | Switching physical ↔ VPN overlay two or three times, so the relayout is visible. |

Run `pnpm run dev` for the playground, or `pnpm run docs:dev` and use the gallery at `/examples/`. Capture at a 2×
device pixel ratio and roughly 1440×900 logical pixels.

After adding them here, put absolute links in both READMEs — relative paths do not resolve on npmjs.com:

```md
<img src="https://raw.githubusercontent.com/LegionLiner/vue-asset-map/main/docs/public/map-light.png" width="49%" />
<img src="https://raw.githubusercontent.com/LegionLiner/vue-asset-map/main/docs/public/map-dark.png" width="49%" />

![Switching projections](https://raw.githubusercontent.com/LegionLiner/vue-asset-map/main/docs/public/map-projections.gif)
```
