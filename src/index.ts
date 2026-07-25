/**
 * Публичный API пакета `network-map`.
 *
 * Ядро доступно и отдельным подпутём `network-map/core` — там нет ни Vue, ни
 * VueFlow, поэтому его можно использовать на сервере.
 */

export * from './core/index'

export type {
  LocaleKey,
  LocaleMessages,
  PartialLocaleMessages,
  ResolvedTheme,
  ThemeConfig,
  ThemeMode,
  Translate,
} from './types/index'
