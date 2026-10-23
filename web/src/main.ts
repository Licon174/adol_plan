import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { probeSession } from './api'
import { initTheme } from './composables/useTheme'

import './styles/tokens.css'
import './styles/base.css'

async function bootstrap(): Promise<void> {
  initTheme()
  await probeSession()

  const app = createApp(App)

  app.config.errorHandler = (err, _instance, info) => {
    console.error(`[adol-web] 未捕获错误（${info}）：`, err)
  }

  app.use(router).mount('#app')
}

void bootstrap()
