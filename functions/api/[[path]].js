export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Strip /api prefix and forward to Atomberg API
  const targetBase = 'https://api.developer.atomberg-iot.com';
  const apiPath = url.pathname.replace(/^\/api/, '');
  const targetUrl = new URL(apiPath + url.search, targetBase);

  // Clone headers, remove browser-set headers that can cause CORS issues
  const newHeaders = new Headers(request.headers);
  newHeaders.delete('Origin');
  newHeaders.delete('Referer');
  newHeaders.delete('Host');

  let body = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = request.body;
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body,
      redirect: 'follow',
    });

    // Pass through the response with CORS headers for safety
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'Error', message: 'Proxy Error: ' + error.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestOptions() {
  // Handle CORS preflight
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
