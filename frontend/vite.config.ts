import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["a82e956189a2.ngrok-free.app"],
    hmr: {
      host: "a82e956189a2.ngrok-free.app",
      protocol: "https",
    },
    origin: "https://a82e956189a2.ngrok-free.app",
  },
})
