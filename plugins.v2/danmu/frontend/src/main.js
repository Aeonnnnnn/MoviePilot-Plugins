import { createApp } from 'vue'
import App from './App.vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          primary: '#3B5E8E',
          secondary: '#5C8DB5',
          accent: '#FF6B6B',
          background: '#1A1A2E',
          surface: '#16213E',
        },
      },
    },
  },
})

const app = createApp(App)
app.use(vuetify)
app.mount('#app')
