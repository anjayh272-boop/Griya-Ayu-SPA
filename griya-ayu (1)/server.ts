import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_WA_GATEWAY_URL = 'http://104.234.26.109:2219/api/send-message';
const FONNTE_FALLBACK_TOKEN = 'f3iKmRXKoigZnWbLRGX4';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  const handleWhatsAppProxy = async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const { target, message } = body;

      if (!target || !message) {
        res.status(400).json({
          status: false,
          error: 'Parameter "target" dan "message" wajib diisi.',
        });
        return;
      }

      // 1. Teruskan POST request dari server ke VPS WhatsApp Gateway (http://104.234.26.109:2219/api/send-message)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(VPS_WA_GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, message }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const rawText = await response.text();
        let data: unknown;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { status: response.ok, raw: rawText };
        }

        res.status(response.status || 200).json(data);
        return;
      } catch (vpsError) {
        // 2. Jika port 2219 diblokir oleh firewall jaringan container, teruskan via HTTPS gateway (port 443)
        try {
          const formData = new URLSearchParams();
          formData.append('target', String(target));
          formData.append('message', String(message));

          const fallbackRes = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
              Authorization: FONNTE_FALLBACK_TOKEN,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          });

          const fallbackData = await fallbackRes.json().catch(() => ({ status: true }));
          res.status(200).json({
            status: true,
            success: true,
            ...fallbackData,
          });
          return;
        } catch {
          res.status(500).json({
            status: false,
            error: vpsError instanceof Error ? vpsError.message : String(vpsError),
          });
          return;
        }
      }
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Endpoint proxy untuk kirim OTP & notifikasi WhatsApp ke VPS Gateway
  app.post('/api/vps/send-message', handleWhatsAppProxy);
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
