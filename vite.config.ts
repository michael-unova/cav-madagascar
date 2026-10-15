import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Hashed build output goes to /static (cached forever, see public/_headers).
    // /assets stays for the hand-managed images in public/assets.
    assetsDir: 'static',
  },
})
