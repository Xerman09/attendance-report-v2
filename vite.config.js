import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const allowedHosts = env.VITE_ALLOWED_HOSTS ? env.VITE_ALLOWED_HOSTS.split(',') : [];

    return {
        plugins: [vue()],
        server: {
            host: '0.0.0.0',
            port: 7777,
            allowedHosts: allowedHosts,
            proxy: {
                '/api': {
                    target: env.VITE_API_PROXY_TARGET || 'http://goatedcodoer:8091/',
                    changeOrigin: true,
                    rewrite: p => p.replace(/^\/api/, '')
                }
            }
        },
        preview: {
            host: '0.0.0.0',
            port: 5173,
            allowedHosts: allowedHosts
        }
    }
})
