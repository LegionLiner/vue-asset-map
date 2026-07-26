import { computed, type ComputedRef } from 'vue'
import { useData } from 'vitepress'

/**
 * Keeps a demo map's theme in lockstep with the site's own dark-mode toggle,
 * so switching the docs theme switches the map instead of leaving it stuck
 * in light mode.
 */
export function useSiteTheme(): ComputedRef<'light' | 'dark'> {
  const { isDark } = useData()
  return computed(() => (isDark.value ? 'dark' : 'light'))
}
