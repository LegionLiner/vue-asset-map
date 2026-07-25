/**
 * Дымовая проверка собранного пакета в чистом Node.
 *
 * Зачем отдельно от тестов: Vitest и любой бандлер подкладывают свою
 * интероперабельность для CommonJS-зависимостей, поэтому ошибки вида
 * «`import * as dagre` не видит `dagre.layout` в Node ESM» видны только на
 * настоящем `dist`, загруженном настоящим Node. Именно так и был найден баг с
 * импортом dagre.
 *
 * Проверяется:
 *  - все три подпути из `exports` загружаются без бандлера (SSR-путь);
 *  - `dist/style.css` существует и содержит и токены, и правила компонентов;
 *  - движки раскладки действительно работают, а не просто импортируются;
 *  - в JS-энтрипоинтах нет импорта CSS (иначе Node упал бы на загрузке).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = new URL('../dist/', import.meta.url)
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
    return
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('main entry (vue-asset-map)')
const main = await import(new URL('index.js', dist).href)
check('экспортирует <AssetMap>', typeof main.AssetMap === 'object')
check('экспортирует buildGraph', typeof main.buildGraph === 'function')
check('экспортирует встроенные движки', Object.keys(main.builtinLayoutEngines ?? {}).length === 2)
check('экспортирует локали ru и en', typeof main.ru === 'object' && typeof main.en === 'object')

const graph = main.buildGraph(
  [
    { id: 'a', kind: 'router', label: 'A' },
    { id: 'b', kind: 'host', label: 'B', parentId: 'a' },
  ],
  [{ id: 'e', source: 'a', target: 'b', layers: ['physical'] }],
)
check('индексы графа считаются', graph.entities.size === 2 && graph.adjacency.get('a')?.length === 1)

console.log('core subpath (vue-asset-map/core)')
const core = await import(new URL('core/index.js', dist).href)
check('projectGraph работает', core.projectGraph(graph, { id: 'physical', label: 'P' }).linkIds.size === 1)
check('blastRadius работает', core.blastRadius(graph, 'a').size === 2)
check('findPaths работает', core.findPaths(graph, 'a', 'b').length === 1)
check('ядро не тянет Vue', !readFileSync(fileURLToPath(new URL('core/index.js', dist))).includes('"vue"'))

console.log('layout engines')
const layoutGraph = {
  nodes: [
    { id: 'a', width: 100, height: 50 },
    { id: 'b', width: 100, height: 50 },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b' }],
}

for (const engine of [main.manualLayout, main.radialLayout]) {
  const positions = await engine.run(layoutGraph)
  check(`движок ${engine.name} раскладывает узлы`, positions.size === 2)
}

console.log('layout-dagre subpath (vue-asset-map/layout-dagre)')
const dagreModule = await import(new URL('layout/dagre.js', dist).href)
check('экспортирует dagreLayout', typeof dagreModule.dagreLayout?.run === 'function')
// Главное здесь — именно вызов: импорт CommonJS-зависимости проходит и при
// сломанной интероперабельности, а падает только обращение к её функции.
const dagrePositions = await dagreModule.dagreLayout.run(layoutGraph, { rankdir: 'LR' })
check('dagre действительно считает раскладку', dagrePositions.size === 2)
check(
  'dagre раскладывает по горизонтали при rankdir LR',
  (dagrePositions.get('b')?.x ?? 0) > (dagrePositions.get('a')?.x ?? 0),
)

console.log('стили')
const css = readFileSync(fileURLToPath(new URL('style.css', dist)), 'utf8')
check('style.css содержит токены', css.includes('--vam-status-online'))
check('style.css содержит тёмную тему', css.includes('.vam-theme-dark'))
check('style.css содержит правила компонентов', css.includes('.vam-node'))

console.log('энтрипоинты не импортируют CSS из JS')
for (const entry of ['index.js', 'core/index.js', 'layout/dagre.js']) {
  const code = readFileSync(fileURLToPath(new URL(entry, dist)), 'utf8')
  check(`${entry} без импорта .css`, !/from\s*['"][^'"]+\.css['"]/.test(code))
}

if (failures.length > 0) {
  console.error(`\nverify-dist: ${failures.length} проверок не прошли`)
  process.exit(1)
}

console.log('\nverify-dist: собранный пакет исправен')
