import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages: repo is "mobideal", so site is at github.io/mobideal/
// Set base so assets load. Local dev uses base '/' by default.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
