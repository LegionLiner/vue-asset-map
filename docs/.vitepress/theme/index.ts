import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'
import './fonts.css'
import './demo.css'
import './custom.css'
// Component styles of the playground app, for the /playground page. Its
// page-level rules live in `playground/reset.css` and are deliberately not
// imported: VitePress mounts on `#app` too.
import '../../../playground/playground.css'

import LiveDemo from './LiveDemo.vue'
// The real playground app, not a copy of it: /playground runs the same file
// `pnpm dev` serves, so the page cannot drift from it.
import PlaygroundApp from '../../../playground/App.vue'
import BasicMap from '../demos/BasicMap.vue'
import ProjectionsMap from '../demos/ProjectionsMap.vue'
import CollapsedGroupMap from '../demos/CollapsedGroupMap.vue'
import CustomNodeMap from '../demos/CustomNodeMap.vue'
import CustomDetailsMap from '../demos/CustomDetailsMap.vue'
import DarkThemeMap from '../demos/DarkThemeMap.vue'
import PathTraceMap from '../demos/PathTraceMap.vue'
import LargeGraphMap from '../demos/LargeGraphMap.vue'
import MarkersMap from '../demos/MarkersMap.vue'
import SearchMap from '../demos/SearchMap.vue'
import LayoutMap from '../demos/LayoutMap.vue'
import EdgeKindMap from '../demos/EdgeKindMap.vue'

// Registered globally so every markdown page can use them without a script block.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiveDemo', LiveDemo)
    app.component('PlaygroundApp', PlaygroundApp)
    app.component('BasicMap', BasicMap)
    app.component('ProjectionsMap', ProjectionsMap)
    app.component('CollapsedGroupMap', CollapsedGroupMap)
    app.component('CustomNodeMap', CustomNodeMap)
    app.component('CustomDetailsMap', CustomDetailsMap)
    app.component('DarkThemeMap', DarkThemeMap)
    app.component('PathTraceMap', PathTraceMap)
    app.component('LargeGraphMap', LargeGraphMap)
    app.component('MarkersMap', MarkersMap)
    app.component('SearchMap', SearchMap)
    app.component('LayoutMap', LayoutMap)
    app.component('EdgeKindMap', EdgeKindMap)
  },
} satisfies Theme
