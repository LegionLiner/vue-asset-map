import { describe, expect, it } from 'vitest'
import { readSources, stripComments } from './sources'

/**
 * Критерии приёмки, проверяемые машиной, а не глазами.
 *
 * ESLint уже запрещает часть этих импортов правилом `no-restricted-imports`, но
 * правило можно отключить комментарием, а тест — нет.
 */

const coreSources = readSources('src/core', ['.ts'])
const layoutSources = readSources('src/layout', ['.ts'])
const pureSources = [...coreSources, ...layoutSources]
const allSources = readSources('src', ['.ts', '.vue'])

/** Импорт из модуля или любого его подпути: `import`, `import type`, `import()`, `require()`. */
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
    expect(coreSources.length).toBeGreaterThan(5)
    expect(layoutSources.length).toBeGreaterThan(3)
  })

  it.each(['vue', '@vue-flow/core', '@vue/reactivity', '@vue/runtime-core'])(
    'ни один файл ядра не импортирует %s',
    (moduleName) => {
      for (const { path, content } of pureSources) {
        expect(importsFrom(content, moduleName), `${path} импортирует ${moduleName}`).toBe(false)
      }
    },
  )

  it('ядро не импортирует баррель types/index, который тянет типы Vue', () => {
    for (const { path, content } of coreSources) {
      // Конкретные модули типов (`../types/entity`) разрешены — запрещён именно
      // баррель: он реэкспортирует `types/theme` со ссылкой на Vue.
      expect(importsExactly(content, '../types/index'), `${path} импортирует баррель`).toBe(false)
      expect(importsExactly(content, '../types'), `${path} импортирует баррель`).toBe(false)
    }
  })

  it('ядро не тянет слой Vue из самого пакета', () => {
    for (const { path, content } of pureSources) {
      for (const forbidden of ['composables', 'components', 'registry']) {
        expect(content.includes(`/${forbidden}/`), `${path} ссылается на ${forbidden}`).toBe(false)
      }
    }
  })
})

describe('SSR-безопасность', () => {
  it('ядро и раскладки не обращаются к браузерным API', () => {
    for (const { path, content } of pureSources) {
      const code = stripComments(content)
      for (const global of ['window', 'document', 'localStorage', 'sessionStorage', 'navigator']) {
        expect(new RegExp(`\\b${global}\\b`).test(code), `${path} обращается к ${global}`).toBe(false)
      }
    }
  })

  it('во всём src нет node-специфичных глобалей', () => {
    // Раньше это гарантировал `types: []` в tsconfig; теперь node-типы нужны
    // guard-тестам, поэтому запрет проверяется текстом (D-301).
    for (const { path, content } of allSources) {
      const code = stripComments(content)
      for (const global of ['process', '__dirname', '__filename', 'Buffer', 'require(']) {
        const pattern = global.endsWith('(')
          ? new RegExp(`\\b${escapeRegExp(global)}`)
          : new RegExp(`\\b${global}\\b`)
        expect(pattern.test(code), `${path} использует node-глобаль ${global}`).toBe(false)
      }
    }
  })

  it('обращения к window и document в слое Vue — только внутри функций', () => {
    // Модуль обязан импортироваться в SSR: обращение к браузерному API на
    // верхнем уровне падает ещё до рендера.
    for (const { path, content } of allSources) {
      // Блок <template> — разметка, а не исполняемый верхний уровень модуля:
      // класс `vnm-window` в нём не имеет отношения к объекту `window`.
      const code = stripComments(stripTemplateBlock(content))
      for (const line of topLevelStatements(code)) {
        expect(
          /\b(?:window|document|localStorage|sessionStorage)\b/.test(line),
          `${path}: обращение к браузерному API на верхнем уровне модуля → ${line.trim()}`,
        ).toBe(false)
      }
    }
  })

  it('пакет не использует localStorage и sessionStorage вообще', () => {
    // Состояние уходит наружу через v-model, а не в хранилище браузера.
    for (const { path, content } of allSources) {
      const code = stripComments(content)
      expect(code.includes('localStorage'), `${path} использует localStorage`).toBe(false)
      expect(code.includes('sessionStorage'), `${path} использует sessionStorage`).toBe(false)
    }
  })
})

/** Убирает `<template>` и `<style>` из SFC, оставляя только скрипт. */
function stripTemplateBlock(source: string): string {
  return source
    .replace(/<template[^>]*>[\s\S]*?<\/template>\s*$/m, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
}

/**
 * Строки нулевого уровня вложенности.
 *
 * Грубая, но достаточная эвристика: считаем баланс фигурных скобок и берём
 * строки, встреченные при нулевой глубине. Внутри функций и блоков обращения к
 * браузерным API разрешены, на верхнем уровне — нет.
 */
function topLevelStatements(code: string): string[] {
  const lines: string[] = []
  let depth = 0

  for (const line of code.split('\n')) {
    if (depth === 0) lines.push(line)
    for (const char of line) {
      if (char === '{' || char === '(') depth += 1
      else if (char === '}' || char === ')') depth = Math.max(0, depth - 1)
    }
  }

  return lines
}
