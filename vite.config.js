import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'https://api.developer.atomberg-iot.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
                configure: (proxy, _options) => {
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        proxyReq.removeHeader('Origin');
                        proxyReq.removeHeader('Referer');
                    });
                }
            }
        }
    }
});
