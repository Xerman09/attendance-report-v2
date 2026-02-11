import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        host: '0.0.0.0', // 👈 allow LAN access using IP
        port: 7777,
        proxy: {
            '/api': {
                target: 'http://goatedcodoer:8091/',
                changeOrigin: true,
                rewrite: p => p.replace(/^\/api/, '')
            }
        }
    }
})
