/**
 * Vercel Serverless Function: Clerk Frontend API Proxy
 * Routes: /__clerk/* -> https://frontend-api.clerk.dev/*
 *
 * Implements official Clerk Proxy specifications:
 * - Clerk-Proxy-Url header
 * - Clerk-Secret-Key header (server-side only, never exposed to client)
 * - X-Forwarded-For (client IP)
 * - Multi-cookie forwarding via Set-Cookie array
 * - Safe compression handling (identity encoding + strips stale content-encoding)
 */

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'greencart-three-chi.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const proxyUrl = process.env.CLERK_PROXY_URL || `${proto}://${host}/__clerk`;

  // Secret key validation
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET_KEY) {
    console.error('[Clerk Proxy] Missing CLERK_SECRET_KEY environment variable on server.');
    return res.status(500).json({
      error: 'Clerk proxy configuration error: CLERK_SECRET_KEY is not configured on this deployment.'
    });
  }

  try {
    // 1. Resolve destination subpath
    let subpath = '';
    if (req.query && req.query.__clerk_path) {
      subpath = Array.isArray(req.query.__clerk_path)
        ? req.query.__clerk_path.join('/')
        : req.query.__clerk_path;
    } else if (req.headers['x-matched-path']) {
      subpath = req.headers['x-matched-path'].replace(/^\/__clerk\/?/, '');
    } else if (req.url) {
      const parsed = new URL(req.url, 'http://localhost');
      subpath = parsed.searchParams.get('__clerk_path') || parsed.pathname.replace(/^\/api\/clerk-proxy\/?/, '');
    }

    // Strip any query string from subpath if present to prevent parameter duplication
    const queryIndex = subpath.indexOf('?');
    if (queryIndex !== -1) {
      subpath = subpath.slice(0, queryIndex);
    }

    if (!subpath.startsWith('/')) {
      subpath = '/' + subpath;
    }

    // 2. Construct destination target URL
    const targetUrl = new URL(`https://frontend-api.clerk.dev${subpath}`);

    // Append all original query parameters (excluding the internal routing helper)
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (key === '__clerk_path') continue;
        if (Array.isArray(value)) {
          value.forEach(v => targetUrl.searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          targetUrl.searchParams.append(key, value);
        }
      }
    }

    // 3. Extract and sanitize client IP (trusted Vercel header)
    const rawForwardedFor = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const clientIp = typeof rawForwardedFor === 'string'
      ? rawForwardedFor.split(',')[0].trim()
      : '';

    // 4. Construct forwarding headers
    const forwardHeaders = {};
    const hopByHopHeaders = new Set([
      'host',
      'connection',
      'content-length',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade'
    ]);

    for (const [key, value] of Object.entries(req.headers)) {
      if (hopByHopHeaders.has(key.toLowerCase())) continue;
      forwardHeaders[key] = value;
    }

    // Request uncompressed upstream content to prevent decoding mismatches
    forwardHeaders['accept-encoding'] = 'identity';

    // Inject mandatory Clerk proxy headers
    forwardHeaders['Clerk-Proxy-Url'] = proxyUrl;
    forwardHeaders['Clerk-Secret-Key'] = CLERK_SECRET_KEY;
    if (clientIp) {
      forwardHeaders['X-Forwarded-For'] = clientIp;
    }
    forwardHeaders['X-Forwarded-Host'] = host;
    forwardHeaders['X-Forwarded-Proto'] = proto;

    // 5. Format body if request method transmits payload
    let body = undefined;
    const method = (req.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
      }
    }

    // 6. Forward request to Clerk Frontend API
    const clerkResponse = await fetch(targetUrl.toString(), {
      method,
      headers: forwardHeaders,
      body,
      redirect: 'manual'
    });

    // 7. Set response status code
    res.status(clerkResponse.status);

    // 8. Forward response headers safely
    // Exclude hop-by-hop and encoding headers so the browser doesn't attempt to decompress unencoded bytes
    const excludedResponseHeaders = new Set([
      'connection',
      'content-encoding',
      'content-length',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
      'set-cookie'
    ]);

    clerkResponse.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (excludedResponseHeaders.has(lowerKey)) return;
      res.setHeader(key, val);
    });

    // 9. Forward all Set-Cookie headers correctly (supports multiple cookies)
    const setCookies = typeof clerkResponse.headers.getSetCookie === 'function'
      ? clerkResponse.headers.getSetCookie()
      : clerkResponse.headers.get('set-cookie');

    if (setCookies) {
      res.setHeader('Set-Cookie', setCookies);
    }

    // 10. Stream / send response body as raw Buffer (binary-safe)
    const arrayBuffer = await clerkResponse.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('[Clerk Proxy] Fetch error:', error.message);
    return res.status(502).json({
      error: 'Bad Gateway: Failed to reach Clerk Frontend API',
      message: error.message
    });
  }
}
