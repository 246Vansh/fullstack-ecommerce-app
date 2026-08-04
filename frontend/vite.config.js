import { defineConfig } from 'vite'
import { fileURLToPath, fileURLToPathBuffer, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss() // <-- Ensure this is listed
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    }
  }
})