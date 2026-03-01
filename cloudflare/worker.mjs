// PicToFrontend — Cloudflare Worker
// Handles: API (D1 backend) + Vercel proxy (frontend)
import { handleAPI } from './api/router.mjs';

const VERCEL_ORIGIN = "https://pictofrontend.vercel.app";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'healthy', version: '3.0.0', backend: 'cloudflare-worker+d1' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // API routes → handled by Worker + D1, except for OAuth routes which go to Python backend
    if (url.pathname.startsWith('/api/')) {
      if (
        url.pathname.startsWith('/api/auth/github') ||
        url.pathname.startsWith('/api/auth/google')
      ) {
        // Fallthrough to proxy below for OAuth routes
      } else {
        return handleAPI(request, env);
      }
    }

    // Everything else (Frontend + Python OAuth backend proxy) → proxy to Vercel
    return proxyToVercel(request);
  },
};

async function proxyToVercel(request) {
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, VERCEL_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set('Host', 'pictofrontend.vercel.app');
  headers.set('X-Forwarded-Host', url.hostname);
  headers.set('X-Forwarded-Proto', 'https');

  const isStreaming = request.body !== null && !['GET', 'HEAD'].includes(request.method);
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
    ...(isStreaming ? { body: request.body, duplex: 'half' } : {}),
  };

  const response = await fetch(targetUrl.toString(), init);
  const nextHeaders = new Headers(response.headers);
  nextHeaders.set('x-served-by', 'cloudflare-worker');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}
