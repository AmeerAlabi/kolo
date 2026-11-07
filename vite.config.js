import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Serves the same /api/* handlers locally that Vercel runs in production.
function localApi() {
  return {
    name: 'kolo-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const name = req.url.split('?')[0].replace('/api/', '');
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), localApi()] };
});
