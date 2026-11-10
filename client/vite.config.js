import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // En développement, les appels /api sont envoyés au serveur Node (projet server/)
  const api = env.VITE_DEV_API || 'http://localhost:4000';
  return {
    plugins: [react()],
    // Version en ligne : pas de cartes de code source ni de messages de débogage dans la console
    build: { sourcemap: false },
    esbuild: mode === 'production' ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] } : undefined,
    server: {
      port: 5173,
      proxy: {
        '/api': api,
        '/uploads': api,
        '/sitemap.xml': api,
        '/robots.txt': api,
      },
    },
  };
});
