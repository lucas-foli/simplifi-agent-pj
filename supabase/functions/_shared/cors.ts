const DEFAULT_ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'apikey',
  'content-type',
  'accept',
  'origin',
  'x-supabase-api-version',
  'prefer',
].join(', ');

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'].join(', ');

const ALLOWED_ORIGINS: Set<string> = (() => {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  origins.push(
    'https://app.simplifiqa.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
  );
  return new Set(origins);
})();

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowedOrigin = isOriginAllowed(origin) ? origin! : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function corsOptionsResponse(req: Request): Response {
  return new Response('ok', { headers: buildCorsHeaders(req) });
}
