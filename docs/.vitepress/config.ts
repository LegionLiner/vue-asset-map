import { defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'node:url'

const guide = (base: string) => [
  { text: 'Getting started', link: `${base}/guide/getting-started` },
  { text: 'Data model', link: `${base}/guide/data-model` },
  { text: 'Views', link: `${base}/guide/views` },
  { text: 'Nodes', link: `${base}/guide/nodes` },
  { text: 'Edges', link: `${base}/guide/edges` },
  { text: 'Collapse', link: `${base}/guide/collapse` },
  { text: 'Search and filters', link: `${base}/guide/search` },
  { text: 'Details panel', link: `${base}/guide/details-panel` },
  { text: 'Layouts', link: `${base}/guide/layouts` },
  { text: 'Theming', link: `${base}/guide/theming` },
  { text: 'Traversal', link: `${base}/guide/traversal` },
]

const guideRu = [
  { text: 'Начало работы', link: '/ru/guide/getting-started' },
  { text: 'Модель данных', link: '/ru/guide/data-model' },
  { text: 'Проекции', link: '/ru/guide/views' },
  { text: 'Узлы', link: '/ru/guide/nodes' },
  { text: 'Связи', link: '/ru/guide/edges' },
  { text: 'Свёртка групп', link: '/ru/guide/collapse' },
  { text: 'Поиск и фильтры', link: '/ru/guide/search' },
  { text: 'Панель подробностей', link: '/ru/guide/details-panel' },
  { text: 'Раскладки', link: '/ru/guide/layouts' },
  { text: 'Темизация', link: '/ru/guide/theming' },
  { text: 'Обходы графа', link: '/ru/guide/traversal' },
]

export default defineConfig({
  // Must match the repository name: GitHub Pages serves the site from a subpath.
  base: '/vue-asset-map/',
  title: 'vue-asset-map',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: false,

  vite: {
    resolve: {
      // Examples are compiled against the sources, so the docs break as soon as
      // the API does — a published tarball would hide that until release.
      alias: [
        {
          // Node's own package self-reference would otherwise resolve this to
          // dist/style.css, which does not exist until `build` has run — the
          // docs workflow only runs `docs:build`, so this must point at the
          // source CSS directly, same as playground/vite.config.ts does.
          find: /^vue-asset-map\/style\.css$/,
          replacement: fileURLToPath(new URL('../../src/theme/index.css', import.meta.url)),
        },
        {
          find: /^vue-asset-map\/core$/,
          replacement: fileURLToPath(new URL('../../src/core/index.ts', import.meta.url)),
        },
        {
          find: /^vue-asset-map\/layout-dagre$/,
          replacement: fileURLToPath(new URL('../../src/layout/dagre.ts', import.meta.url)),
        },
        {
          find: /^vue-asset-map$/,
          replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
        },
      ],
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      description: 'Interactive infrastructure asset map for Vue 3, built on Vue Flow',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'API', link: '/api/' },
          { text: 'Examples', link: '/examples/' },
        ],
        sidebar: {
          '/guide/': [{ text: 'Guide', items: guide('') }],
          '/api/': [
            {
              text: 'API reference',
              items: [
                { text: 'Overview', link: '/api/' },
                { text: 'Component', link: '/api/#component' },
                { text: 'Types', link: '/api/#types' },
                { text: 'Composables', link: '/api/#composables' },
                { text: 'Core functions', link: '/api/#core' },
              ],
            },
          ],
          '/examples/': [{ text: 'Examples', items: [{ text: 'Gallery', link: '/examples/' }] }],
        },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      link: '/ru/',
      description: 'Интерактивная карта инфраструктурных активов для Vue 3 на базе Vue Flow',
      themeConfig: {
        nav: [
          { text: 'Руководство', link: '/ru/guide/getting-started' },
          { text: 'API', link: '/ru/api/' },
          { text: 'Примеры', link: '/ru/examples/' },
        ],
        sidebar: {
          '/ru/guide/': [{ text: 'Руководство', items: guideRu }],
          '/ru/api/': [{ text: 'Справочник API', items: [{ text: 'Обзор', link: '/ru/api/' }] }],
          '/ru/examples/': [{ text: 'Примеры', items: [{ text: 'Галерея', link: '/ru/examples/' }] }],
        },
        docFooter: { prev: 'Назад', next: 'Далее' },
        outline: { label: 'На этой странице' },
        darkModeSwitchLabel: 'Тема',
        returnToTopLabel: 'Наверх',
      },
    },
  },

  themeConfig: {
    logo: '/logo.png',
    socialLinks: [{ icon: 'github', link: 'https://github.com/LegionLiner/vue-asset-map' }],
    search: { provider: 'local' },
    footer: {
      message: 'MIT licensed',
      copyright: 'Copyright © 2026 Dmitriy Korolev',
    },
  },
})
