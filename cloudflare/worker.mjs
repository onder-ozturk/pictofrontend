const APP_DOMAIN = "pictofrontend.com";
const DEFAULT_FRONTEND_ORIGIN = "https://pictofrontend.vercel.app";
const DEFAULT_API_ORIGIN = "https://pictofrontend.vercel.app";

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const frontendOrigin = env.ORIGIN_FRONTEND ?? DEFAULT_FRONTEND_ORIGIN;
    const apiOrigin = env.ORIGIN_API ?? DEFAULT_API_ORIGIN;

    const targetOrigin =
      url.pathname === "/health" || url.pathname.startsWith("/api/")
        ? apiOrigin
        : frontendOrigin;

    const targetUrl = new URL(url.pathname + url.search, targetOrigin);

    const headers = new Headers(request.headers);
    headers.set("Host", targetUrl.host);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown");

    const isStreamingRequest = request.body !== null && !["GET", "HEAD"].includes(request.method.toUpperCase());
    const init = {
      method: request.method,
      headers,
      redirect: "manual",
      ...(isStreamingRequest ? { body: request.body, duplex: "half" } : {}),
    };

    const response = await fetch(targetUrl.toString(), init);

    if (targetUrl.pathname.startsWith("/api/") || targetUrl.pathname === "/health") {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    const nextHeaders = new Headers(response.headers);
    nextHeaders.set("x-served-by", "cloudflare-worker-proxy");
    nextHeaders.set("x-forwarded-domain", APP_DOMAIN);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    });
  },
};
