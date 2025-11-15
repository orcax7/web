import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.{test,spec}.{js,jsx}',
        'vite.config.js',
        'vitest.config.js'
      ]
    }
  }
})