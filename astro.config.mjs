import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: https://christianjair27.github.io/motion-landing/
export default defineConfig({
  site: 'https://christianjair27.github.io',
  base: '/motion-landing',
  vite: { plugins: [tailwindcss()] },
})
