/**
 * API Route Proxy: /api/send-message
 * Meneruskan POST request dari web (HTTPS) ke VPS WhatsApp Gateway (HTTP):
 * http://104.234.26.109:2219/api/send-message
 * Mencegah pemblokiran Mixed Content oleh browser.
 */
const VPS_WA_GATEWAY_URL = 'http://104.234.26.109:2219/api/send-message';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Gunakan POST.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { target, message } = body;

    if (!target || !message) {
      return res.status(400).json({
        success: false,
        error: 'Parameter "target" dan "message" wajib diisi.',
      });
    }

    const response = await fetch(VPS_WA_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { status: response.ok, raw: rawText };
    }

    return res.status(response.status || 200).json(data);
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: 'Gagal menghubungi server WhatsApp Gateway VPS.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
