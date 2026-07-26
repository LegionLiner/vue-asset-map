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
  { text: 'Представления', link: '/ru/guide/views' },
  { text: 'Узлы', link: '/ru/guide/nodes' },
  { text: 'Связи', link: '/ru/guide/edges' },
  { text: 'Свёртка групп', link: '/ru/guide/collapse' },
  { text: 'Поиск и фильтры', link: '/ru/guide/search' },
  { text: 'Панель подробностей', link: '/ru/guide/details-panel' },
  { text: 'Раскладки', link: '/ru/guide/layouts' },
  { text: 'Темизация', link: '/ru/guide/theming' },
  { text: 'Обходы графа', link: '/ru/guide/traversal' },
]

// Must match the repository name: GitHub Pages serves the site from a subpath.
// `head` link hrefs are not rewritten with `base` by VitePress the way
// theme-config asset fields (e.g. `logo`) are, so favicon and OG links below
// prefix it by hand.
const base = '/vue-asset-map/'

// Matches `homepage` in package.json. `sitemap.hostname` is resolved against
// with each page's base-relative URL, so it has to include the base path
// itself — otherwise every sitemap entry would drop the `/vue-asset-map/` prefix.
const hostname = 'https://legionliner.github.io/vue-asset-map/'
const ogImage = `${hostname}hero-light.webp`

export default defineConfig({
  base,
  title: 'vue-asset-map',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: false,

  sitemap: { hostname },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo-light.svg` }],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
        href: `${base}logo-light.svg`,
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
        href: `${base}logo-dark.svg`,
      },
    ],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'vue-asset-map' }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: ogImage }],
  ],

  // Per-page tags that need the resolved title/description/URL: adds a
  // canonical link (the same content is reachable at "/" and "/index",
  // canonical says which one counts) plus OG/Twitter title, description and
  // url so shared links render a real preview instead of a bare URL.
  transformHead({ pageData, siteData, title, description }) {
    if (pageData.isNotFound) return [['meta', { name: 'robots', content: 'noindex' }]]

    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    const canonicalUrl = `${hostname}${path}`

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:locale', content: siteData.lang.replace('-', '_') }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    ]
  },

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
        siteTitle: 'VueAssetMap',
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
        siteTitle: 'VueAssetMap',
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
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/LegionLiner/vue-asset-map' }],
    search: { provider: 'local' },
    footer: {
      message: 'MIT licensed',
      copyright: 'Copyright © 2026 Dmitriy Korolev',
    },
  },
})
