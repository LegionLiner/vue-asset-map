import { computed, inject, type ComputedRef } from 'vue'
import { MAP_CONTEXT_KEY } from './useMapContext'
import { createTranslator, defaultLocale } from '../locale/index'
import type { Translate } from '../types/locale'

/**
 * Translator for the standalone controls.
 *
 * Controls normally sit in the `<AssetMap>` toolbar and take the locale from
 * the map context, but they can also be placed on their own — in a page header,
 * for instance. With no context around they fall back to the built-in locale
 * instead of throwing: a control must not break just for being moved out.
 */
export function useTranslate(): ComputedRef<Translate> {
  const context = inject(MAP_CONTEXT_KEY, undefined)
  const fallback = createTranslator(defaultLocale)

  return computed(() => context?.t ?? fallback)
}
