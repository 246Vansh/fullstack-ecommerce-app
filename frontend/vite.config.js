import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

import { apiUrlErrors } from './src/config/apiUrl.js'

export default defineConfig(({ command, mode, isPreview }) => {
  // VITE_API_URL is compiled into the bundle, so check it before serving or
  // building (an environment variable overrides the .env files). Only the dev
  // server may use a local http URL; every build gets the production rules,
  // whatever --mode says. Preview only serves an existing dist/ and is not checked.
  if (!isPreview) {
    const { VITE_API_URL } = loadEnv(mode, process.cwd(), 'VITE_')
    const errors = apiUrlErrors(VITE_API_URL, { development: command === 'serve' })

    if (errors.length) {
      throw new Error(`Invalid frontend configuration (vite ${command}, mode "${mode}"):\n${errors.map((error) => `  - ${error}`).join('\n')}`)
    }
  }

  return {
    plugins: [
      vue(),
      tailwindcss()
    ],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['chafe-angelic-coastal.ngrok-free.dev'],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      }
    }
  }
})