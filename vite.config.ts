import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, './shared')
        }
    },
    optimizeDeps: {
        disabled: true
    },
    server: {
        proxy: {
            '/party': {
                target: 'http://127.0.0.1:1999',
                changeOrigin: true,
                ws: true
            }
        }
    }
})
