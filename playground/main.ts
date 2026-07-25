import { createApp } from 'vue'

// Структурные стили VueFlow ставит потребитель: пакет держит его в peer, и
// пути к CSS зависимости из опубликованного CSS не разрешить.
import '@vue-flow/core/dist/style.css'
// Токены и темы библиотеки.
import 'network-map/style.css'
import './playground.css'

import App from './App.vue'

createApp(App).mount('#app')
