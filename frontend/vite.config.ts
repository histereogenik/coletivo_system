import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    host: true,
    port: 5173,
  },
});
