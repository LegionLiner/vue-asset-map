import { createApp } from 'vue'

import '@vue-flow/core/dist/style.css'
import 'vue-asset-map/style.css'
// `reset.css` is the standalone app's own page setup; the docs site embeds
// `App.vue` and loads only `playground.css`. See the comment in `reset.css`.
import './reset.css'
import './playground.css'

import App from './App.vue'

createApp(App).mount('#app')
