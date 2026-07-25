import type { LocaleKey, LocaleMessages, PartialLocaleMessages, Translate } from '../types/locale'
import { en } from './en'
import { ru } from './ru'

export { en } from './en'
export { ru } from './ru'

/** Встроенные локали. Дефолт — русский: продукт русскоязычный. */
export const builtinLocales: Readonly<Record<string, LocaleMessages>> = Object.freeze({ ru, en })

export const defaultLocale = ru

/**
 * Сводит prop `locale` к полному словарю.
 *
 * Принимает код (`'en'`), полный словарь или частичный: недостающие ключи
 * добираются из дефолтной локали, поэтому потребитель может переопределить две
 * строки, а не копировать словарь целиком.
 */
export function resolveLocale(locale?: string | PartialLocaleMessages): LocaleMessages {
  if (locale === undefined) return defaultLocale

  if (typeof locale === 'string') {
    // Неизвестный код — не ошибка: интерфейс просто останется на дефолте.
    return builtinLocales[locale] ?? defaultLocale
  }

  return { ...defaultLocale, ...locale }
}

/**
 * Переводчик с подстановкой `{name}`.
 *
 * Неизвестный ключ возвращается как есть: пустая надпись прячет проблему, а
 * видимый ключ сразу показывает, чего не хватает в словаре.
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
