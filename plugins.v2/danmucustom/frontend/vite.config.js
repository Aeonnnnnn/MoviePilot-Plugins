import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'DanmuCustomPlugin',
      filename: 'remoteEntry.js',
      exposes: {
        './Page': './src/components/Page.vue',
        './Config': './src/components/Config.vue',
        './Dashboard': './src/components/Dashboard.vue',
        './AppPage': './src/components/AppPage.vue',
        './AppPageFilter': './src/components/AppPageFilter.vue',
        './AppPageScrape': './src/components/AppPageScrape.vue',
      },
      shared: {
        vue: {
          requiredVersion: false,
          singleton: true,
        },
        vuetify: {
          singleton: true,
        },
        'vuetify/styles': {
          singleton: true,
        },
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: true,
    outDir: '../dist',
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'charset-removal',
          AtRule: {
            charset: (atRule) => {
              atRule.remove()
            },
          },
        },
        {
          postcssPlugin: 'vuetify-filter',
          Once(root) {
            root.walkRules((rule) => {
              if (rule.selector && (
                rule.selector.startsWith('.v-') ||
                rule.selector.includes('.v-') ||
                rule.selector.startsWith('.mdi-') ||
                rule.selector.includes('.mdi-')
              )) {
                rule.remove()
              }
            })
          },
        },
      ],
    },
  },
  server: {
    port: 5001,
    cors: true,
    origin: 'http://localhost:5001',
  },
})
