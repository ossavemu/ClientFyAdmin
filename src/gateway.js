import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TunnelService } from './services/tunnels.js';

const app = express();
const PORT = 80;

// Configurar proxies para cada bot
const bots = [3008, 3009, 3010, 3011].map((port, index) => ({
  path: `/bot${index + 1}`,
  target: `http://localhost:${port}`,
}));

// Configurar rutas proxy
bots.forEach(({ path, target }) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: {
        [`^${path}`]: '',
      },
    })
  );
});

// Endpoint para túneles
app.get('/tunnels', async (req, res) => {
  try {
    const tunnels = await TunnelService.getTunnels();
    res.json({
      status: 'success',
      data: tunnels,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
});
