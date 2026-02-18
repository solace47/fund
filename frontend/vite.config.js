import { defineConfig } from 'vite';

const backendTarget = process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8311';
const backendProxy = {
  target: backendTarget,
  changeOrigin: true
};

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/app/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': backendProxy,
      '/static': backendProxy,
      '/imgs': backendProxy,
      '/fund/sector': backendProxy
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173
  }
}));
