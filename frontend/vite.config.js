import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: {
      key: fs.readFileSync('../ssl/key.pem'),
      cert: fs.readFileSync('../ssl/cert.pem'),
    },
  },
})


