/**
 * Плоский словарь строк интерфейса. Ключи фиксированы, значения — строки или
 * шаблоны с `{name}`-подстановками.
 */
export interface LocaleMessages {
  'search.placeholder': string
  'search.label': string
  'search.clear': string
  'search.results': string
  'search.empty': string

  'view.label': string
  'view.switch': string

  'filter.label': string
  'filter.kinds': string
  'filter.statuses': string
  'filter.reset': string
  'filter.empty': string
  'filter.active': string

  'details.title': string
  'details.close': string
  'details.kind': string
  'details.status': string
  'details.id': string
  'details.addresses': string
  'details.meta': string
  'details.neighbors': string
  'details.tab.overview': string
  'details.tab.links': string
  'details.empty': string

  'group.label': string
  'group.expand': string
  'group.collapse': string
  'group.members': string
  'group.internalLinks': string

  'link.aggregated': string
  'link.direction': string

  'canvas.label': string
  'canvas.empty': string
  'canvas.loading': string
  'canvas.error': string

  'controls.zoomIn': string
  'controls.zoomOut': string
  'controls.fitView': string
  'controls.relayout': string
  'controls.theme.light': string
  'controls.theme.dark': string

  'minimap.label': string

  'node.status': string
  'node.badges': string
}

export type LocaleKey = keyof LocaleMessages

/** Частичный словарь: недостающие ключи берутся из встроенной локали. */
export type PartialLocaleMessages = Partial<LocaleMessages>

export type Translate = (key: LocaleKey, params?: Record<string, string | number>) => string
