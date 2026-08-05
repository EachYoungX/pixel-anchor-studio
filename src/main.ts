import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { clearProcessingWorker } from './core/worker-client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/controls.css'
import './styles/panels.css'
import './styles/viewport.css'
import './styles/responsive.css'

createApp(App).use(createPinia()).mount('#app')
window.addEventListener('pagehide', clearProcessingWorker, { once: true })
