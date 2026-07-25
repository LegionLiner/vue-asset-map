import { computed, inject, type ComputedRef } from 'vue'
import { MAP_CONTEXT_KEY } from './useMapContext'
import { createTranslator, defaultLocale } from '../locale/index'
import type { Translate } from '../types/locale'

/**
 * Переводчик для контролов.
 *
 * Контролы обычно живут в тулбаре `<NetworkMap>` и берут локаль из контекста
 * карты, но их можно поставить и отдельно — например, в свою шапку страницы. В
 * этом случае контекста нет, и вместо исключения используется встроенная локаль:
 * контрол не должен падать только потому, что его вынесли из карты.
 */
export function useTranslate(): ComputedRef<Translate> {
  const context = inject(MAP_CONTEXT_KEY, undefined)
  const fallback = createTranslator(defaultLocale)

  return computed(() => context?.t ?? fallback)
}
