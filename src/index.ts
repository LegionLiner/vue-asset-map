/**
 * Публичный API пакета `network-map`.
 *
 * Ядро доступно и отдельным подпутём `network-map/core` — там нет ни Vue, ни
 * VueFlow, поэтому его можно использовать на сервере.
 */

export * from './core/index'

// Раскладки: `manual` и `radial` встроены, `dagre` — отдельным подпутём
// `network-map/layout-dagre`, чтобы опциональная зависимость не попадала в
// основной бандл.
export {
  applyPinned,
  builtinLayoutEngines,
  isLayoutAborted,
  LayoutAbortedError,
  manualLayout,
  radialLayout,
  resolveLayoutEngine,
  throwIfAborted,
} from './layout/index'
export type {
  LayoutEngine,
  LayoutGraph,
  LayoutNode,
  ManualLayoutOptions,
  RadialLayoutOptions,
} from './layout/index'

export type {
  LocaleKey,
  LocaleMessages,
  PartialLocaleMessages,
  ResolvedTheme,
  ThemeConfig,
  ThemeMode,
  Translate,
} from './types/index'
