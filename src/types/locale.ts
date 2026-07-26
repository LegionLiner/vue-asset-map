/**
 * Flat dictionary of every UI string. Keys are fixed; values are plain strings
 * or templates with `{name}` placeholders.
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
  'filter.types': string
  'filter.statuses': string
  'filter.reset': string
  'filter.empty': string
  'filter.active': string
  'filter.search': string
  'filter.close': string

  'details.title': string
  'details.close': string
  'details.type': string
  'details.status': string
  'details.id': string
  'details.addresses': string
  'details.meta': string
  'details.neighbors': string
  'details.tab.overview': string
  'details.tab.links': string
  'details.empty': string
  'details.collapseWindow': string
  'details.expandWindow': string

  'window.close': string
  'window.collapse': string
  'window.expand': string
  'window.drag': string

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

  'marker.membership': string

  'node.status': string
  'node.badges': string
}

export type LocaleKey = keyof LocaleMessages

/** Override dictionary: missing keys fall back to the built-in locale. */
export type PartialLocaleMessages = Partial<LocaleMessages>

/** Looks up a key and substitutes `{name}` placeholders from `params`. */
export type Translate = (key: LocaleKey, params?: Record<string, string | number>) => string
