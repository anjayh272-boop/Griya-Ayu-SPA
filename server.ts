import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_WA_GATEWAY_URL = 'http://104.234.26.109:2219/api/send-message';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  const handleWhatsAppProxy = async (req: Request, res: Response) => {
    try {
      const { target, message } = req.body || {};

      if (!target || !message) {
        res.status(400).json({
          success: false,
          error: 'Parameter "target" dan "message" wajib diisi.',
        });
        return;
      }

      const response = await fetch(VPS_WA_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target, message }),
      });

      const rawText = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { status: response.ok, raw: rawText };
      }

      res.status(response.status || 200).json(data);
    } catch (error) {
      res.status(502).json({
        success: false,
        error: 'Gagal menghubungi server WhatsApp Gateway VPS.',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Endpoint proxy untuk kirim OTP & notifikasi WhatsApp ke VPS Gateway
  app.post('/api/send-otp', handleWhatsAppProxy);
  app.post('/api/send-message', handleWhatsAppProxy);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Griya Ayu Server running on http://localhost:${PORT}`);
  });
}

startServer();
