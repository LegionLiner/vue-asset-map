import { describe, expect, it } from 'vitest'

/**
 * Критерии приёмки, проверяемые машиной, а не глазами.
 *
 * ESLint уже запрещает эти импорты правилом `no-restricted-imports`, но правило
 * можно отключить комментарием, а тест — нет. Плюс тест видит транзитивную
 * картину: не только `import`, но и любое упоминание.
 */

const coreSources = import.meta.glob<string>('../../src/core/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const layoutSources = import.meta.glob<string>('../../src/layout/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * Импорт из модуля или любого его подпути. Ловит все формы: `import`,
 * `import type`, динамический `import()` и `require()`.
 */
function importsFrom(source: string, moduleName: string): boolean {
  return matchesSpecifier(source, `${escapeRegExp(moduleName)}(/[^'"]*)?`)
}

/** Импорт ровно этого спецификатора, без подпутей. */
function importsExactly(source: string, moduleName: string): boolean {
  return matchesSpecifier(source, escapeRegExp(moduleName))
}

function matchesSpecifier(source: string, specifierPattern: string): boolean {
  return [
    new RegExp(`from\\s+['"]${specifierPattern}['"]`),
    new RegExp(`import\\s*\\(\\s*['"]${specifierPattern}['"]`),
    new RegExp(`require\\s*\\(\\s*['"]${specifierPattern}['"]`),
  ].some((pattern) => pattern.test(source))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('src/core и src/layout свободны от фреймворка', () => {
  it('файлы вообще нашлись — иначе тест бессмысленно зелёный', () => {
    expect(Object.keys(coreSources).length).toBeGreaterThan(5)
    expect(Object.keys(layoutSources).length).toBeGreaterThan(0)
  })

  it.each(['vue', '@vue-flow/core', '@vue/reactivity', '@vue/runtime-core'])(
    'ни один файл ядра не импортирует %s',
    (moduleName) => {
      for (const [path, source] of Object.entries({ ...coreSources, ...layoutSources })) {
        expect(importsFrom(source, moduleName), `${path} импортирует ${moduleName}`).toBe(false)
      }
    },
  )

  it('ядро не импортирует баррель types/index, который тянет типы Vue', () => {
    for (const [path, source] of Object.entries(coreSources)) {
      // Конкретные модули типов (`../types/entity`) разрешены — запрещён именно
      // баррель: он реэкспортирует `types/theme` со ссылкой на Vue.
      expect(importsExactly(source, '../types/index'), `${path} импортирует баррель типов`).toBe(false)
      expect(importsExactly(source, '../types'), `${path} импортирует баррель типов`).toBe(false)
    }
  })

  it('ядро не тянет слой Vue из самого пакета', () => {
    for (const [path, source] of Object.entries({ ...coreSources, ...layoutSources })) {
      for (const forbidden of ['composables', 'components', 'registry']) {
        expect(source.includes(`/${forbidden}/`), `${path} ссылается на ${forbidden}`).toBe(false)
      }
    }
  })
})

describe('SSR-безопасность', () => {
  it('ядро и раскладки не обращаются к window, document и localStorage', () => {
    for (const [path, source] of Object.entries({ ...coreSources, ...layoutSources })) {
      // Комментарии выкидываем: в них эти слова упоминать можно.
      const code = stripComments(source)
      for (const global of ['window', 'document', 'localStorage', 'sessionStorage', 'navigator']) {
        expect(new RegExp(`\\b${global}\\b`).test(code), `${path} обращается к ${global}`).toBe(false)
      }
    }
  })
})

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}
