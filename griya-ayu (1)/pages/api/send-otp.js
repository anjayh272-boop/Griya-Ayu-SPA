export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const response = await fetch('http://104.234.26.109:2219/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
