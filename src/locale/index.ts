import type { LocaleKey, LocaleMessages, PartialLocaleMessages, Translate } from '../types/locale'
import { en } from './en'
import { ru } from './ru'

export { en } from './en'
export { ru } from './ru'

/** Locales shipped with the package, addressable by code in the `locale` prop. */
export const builtinLocales: Readonly<Record<string, LocaleMessages>> = Object.freeze({ ru, en })

/** Locale used when `locale` is absent, and the source of fallback keys. */
export const defaultLocale = ru

/**
 * Reduces the `locale` prop to a complete dictionary.
 *
 * Accepts a code (`'en'`), a full dictionary or a partial one: missing keys come
 * from the default locale, so a consumer can override two strings instead of
 * copying the whole dictionary.
 */
export function resolveLocale(locale?: string | PartialLocaleMessages): LocaleMessages {
  if (locale === undefined) return defaultLocale

  if (typeof locale === 'string') {
    // An unknown code is not an error: the UI simply stays on the default.
    return builtinLocales[locale] ?? defaultLocale
  }

  return { ...defaultLocale, ...locale }
}

/**
 * Builds a translator that substitutes `{name}` placeholders from `params`.
 *
 * An unknown key is returned verbatim: an empty label would hide the problem,
 * while a visible key shows immediately what the dictionary is missing.
 */
export function createTranslator(messages: LocaleMessages): Translate {
  return (key: LocaleKey, params?: Record<string, string | number>): string => {
    const template = messages[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    )
  }
}
