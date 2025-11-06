import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/tarea2/'   // debe coincidir EXACTO con el nombre del repo
})