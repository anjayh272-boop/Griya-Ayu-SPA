export async function POST(request) {
  try {
    const body = await request.json();
    const res = await fetch('http://104.234.26.109:2219/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { status: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
