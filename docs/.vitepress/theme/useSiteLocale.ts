import { computed, type ComputedRef } from 'vue'
import { useData } from 'vitepress'

/**
 * Keeps a demo map's wording in step with the page it is on.
 *
 * The package's own default is `ru`, so without this every map on the English
 * side of the site renders its filters, its search and its legend in Russian —
 * the strings are all there, they were simply never asked for.
 *
 * The same component renders on both language trees, so the locale cannot be
 * hardcoded either way; it has to follow `lang`, exactly as `useSiteTheme`
 * follows the dark-mode toggle.
 */
export function useSiteLocale(): ComputedRef<'en' | 'ru'> {
  const { lang } = useData()
  return computed(() => (lang.value.startsWith('ru') ? 'ru' : 'en'))
}
