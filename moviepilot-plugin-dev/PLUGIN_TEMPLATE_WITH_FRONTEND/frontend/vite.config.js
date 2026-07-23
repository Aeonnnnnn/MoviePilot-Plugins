import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'demofrontend',
      filename: 'remoteEntry.js',
      exposes: {
        './Config': './src/components/Config.vue',
        './Page': './src/components/Page.vue',
        './AppPage': './src/components/AppPage.vue',
      },
      shared: ['vue', 'vuetify', 'axios'],
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['vue', 'vuetify', 'axios'],
    },
  },
  server: { port: 5173 },
})
