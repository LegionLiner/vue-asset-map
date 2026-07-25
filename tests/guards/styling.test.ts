import { describe, expect, it } from 'vitest'
import { fileNamed, readSources, stripComments } from './sources'

/**
 * Критерии приёмки по стилям и строкам.
 *
 * Оба требования («ни одного литерального цвета в .vue», «ни одной строки
 * интерфейса вне src/locale») нельзя выразить правилом ESLint, но они
 * прекрасно проверяются чтением исходников.
 */

const vueSources = readSources('src/components', ['.vue'])
const themeSources = readSources('src/theme', ['.css'])

const COLOR_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'hex', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'rgb()/rgba()', pattern: /\brgba?\s*\(/ },
  { name: 'hsl()/hsla()', pattern: /\bhsla?\s*\(/ },
  { name: 'color-mix()/oklch()', pattern: /\b(?:color-mix|oklch|lab|lch)\s*\(/ },
]

/** Ключевые слова, которые не задают палитру, поэтому разрешены. */
const ALLOWED_COLOR_KEYWORDS = ['transparent', 'currentColor', 'inherit', 'none', 'unset', 'initial']

describe('в .vue-файлах нет литеральных цветов', () => {
  it('файлы найдены', () => {
    expect(vueSources.length).toBeGreaterThan(3)
  })

  it.each(COLOR_PATTERNS.map((entry) => [entry.name, entry.pattern] as const))(
    'ни один компонент не содержит цвет в формате %s',
    (name, pattern) => {
      for (const { path, content } of vueSources) {
        const match = stripComments(content).match(pattern)
        expect(match, `${path}: найден цвет (${name}) → ${match?.[0]}`).toBeNull()
      }
    },
  )

  it('цвета берутся из токенов через var(--vnm-*)', () => {
    // Обратная проверка: без неё предыдущий тест был бы зелёным просто потому,
    // что в компонентах вообще нет работы с цветом.
    const all = vueSources.map((file) => file.content).join('\n')
    expect(all).toContain('var(--vnm-')
  })

  it('разрешённые ключевые слова используются, а не запрещены заодно', () => {
    const all = vueSources.map((file) => file.content).join('\n')
    expect(ALLOWED_COLOR_KEYWORDS.some((keyword) => all.includes(keyword))).toBe(true)
  })

  it('все объявляемые классы имеют префикс vnm-', () => {
    const classPattern = /^\s*\.([a-zA-Z][\w-]*)/gm

    for (const { path, content } of vueSources) {
      const styleBlocks = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
        (match) => match[1] ?? '',
      )

      for (const block of styleBlocks) {
        for (const match of stripComments(block).matchAll(classPattern)) {
          const className = match[1] ?? ''
          // `vue-flow__*` — классы самого VueFlow: мы их переопределяем внутри
          // своего `.vnm-canvas`, а не объявляем как свои.
          if (className.startsWith('vnm-') || className.startsWith('vue-flow__')) continue
          expect.fail(`${path}: класс без префикса vnm- → .${className}`)
        }
      }
    }
  })

  it('нет глобальных селекторов по тегам', () => {
    const globalTagPattern = /^\s*(?:html|body|\*|:root)\b[^{]*\{/gm

    for (const { path, content } of vueSources) {
      const styleBlocks = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
        (match) => match[1] ?? '',
      )
      for (const block of styleBlocks) {
        const match = stripComments(block).match(globalTagPattern)
        expect(match, `${path}: глобальный селектор → ${match?.[0]}`).toBeNull()
      }
    }
  })
})

describe('токены темы объявлены только на .vnm-root', () => {
  it('CSS пакета прочитан', () => {
    expect(themeSources.length).toBe(4)
  })

  it('нет селекторов :root и html/body', () => {
    for (const { path, content } of themeSources) {
      const code = stripComments(content)
      expect(code.includes(':root'), `${path} объявляет токены на :root`).toBe(false)
      expect(/^\s*(?:html|body)\b/m.test(code), `${path} стилизует html/body`).toBe(false)
    }
  })

  it('тёмная тема включается классом, а не media-запросом', () => {
    // Комментарии выкидываем: в них `prefers-color-scheme` как раз и объясняет,
    // почему media-запрос здесь не используется.
    const dark = stripComments(fileNamed(themeSources, 'dark.css').content)
    expect(dark).toContain('.vnm-root.vnm-theme-dark')
    expect(dark).not.toContain('prefers-color-scheme')
  })

  it('светлая тема объявлена явным классом', () => {
    expect(fileNamed(themeSources, 'light.css').content).toContain('.vnm-root.vnm-theme-light')
  })

  it('каждый токен светлой темы имеет пару в тёмной', () => {
    const tokenNames = (source: string): Set<string> =>
      new Set([...source.matchAll(/(--vnm-[\w-]+)\s*:/g)].map((match) => match[1] ?? ''))

    const light = tokenNames(fileNamed(themeSources, 'light.css').content)
    const dark = tokenNames(fileNamed(themeSources, 'dark.css').content)

    const missing = [...light].filter((token) => !dark.has(token))
    expect(missing, `в тёмной теме не переопределены: ${missing.join(', ')}`).toEqual([])
  })
})

describe('строки интерфейса живут только в src/locale', () => {
  it('в .vue-файлах нет русского текста вне комментариев', () => {
    // Продукт русскоязычный, поэтому кириллица — надёжный признак
    // захардкоженной надписи. Единственное место с англоязычными строками —
    // словари локалей, и это видно по структуре каталога.
    for (const { path, content } of vueSources) {
      const match = stripComments(content).match(/[А-Яа-яЁё]{2,}/)
      expect(match, `${path}: текст интерфейса вне локали → «${match?.[0]}»`).toBeNull()
    }
  })

  it('компоненты не импортируют конкретную локаль напрямую', () => {
    for (const { path, content } of vueSources) {
      expect(/from\s+['"].*locale\/(?:ru|en)['"]/.test(content), `${path} импортирует локаль жёстко`).toBe(
        false,
      )
    }
  })

  it('в словарях локалей одинаковый набор ключей', () => {
    const localeSources = readSources('src/locale', ['.ts'])
    const keysOf = (source: string): Set<string> =>
      new Set([...source.matchAll(/^\s*'([\w.]+)':/gm)].map((match) => match[1] ?? ''))

    const ru = keysOf(fileNamed(localeSources, 'ru.ts').content)
    const en = keysOf(fileNamed(localeSources, 'en.ts').content)

    expect(ru.size).toBeGreaterThan(20)
    expect([...ru].filter((key) => !en.has(key))).toEqual([])
    expect([...en].filter((key) => !ru.has(key))).toEqual([])
  })
})
