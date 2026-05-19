// Cloudflare Worker — FinanceCollab R2 File Storage
// Handles: PUT /upload/:key, GET /files/:key, DELETE /files/:key

export interface Env {
  R2_BUCKET: R2Bucket;
  ALLOWED_ORIGIN: string;
  SUPABASE_JWT_SECRET: string;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Workspace-Id",
    "Access-Control-Max-Age": "86400",
  };
}

async function verifySupabaseJWT(token: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? env.ALLOWED_ORIGIN ?? "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const token = authHeader.slice(7);
    const user = await verifySupabaseJWT(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const workspaceId = request.headers.get("X-Workspace-Id") ?? "";
    const pathname = url.pathname;

    // PUT /upload/:key — Upload file
    if (request.method === "PUT" && pathname.startsWith("/upload/")) {
      const key = pathname.slice(8);
      const r2Key = workspaceId ? `${workspaceId}/${key}` : key;

      if (!request.body) {
        return new Response("No body", { status: 400, headers: corsHeaders(origin) });
      }

      await env.R2_BUCKET.put(r2Key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") ?? "application/octet-stream",
        },
        customMetadata: {
          uploadedBy: user.sub,
          workspaceId,
        },
      });

      return new Response(JSON.stringify({ key: r2Key, success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // GET /files/:key — Serve file
    if (request.method === "GET" && pathname.startsWith("/files/")) {
      const key = decodeURIComponent(pathname.slice(7));
      const object = await env.R2_BUCKET.get(key);

      if (!object) {
        return new Response("Not Found", { status: 404, headers: corsHeaders(origin) });
      }

      const headers = new Headers(corsHeaders(origin));
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "private, max-age=3600");
      headers.set("ETag", object.httpEtag);

      return new Response(object.body, { headers });
    }

    // DELETE /files/:key — Delete file
    if (request.method === "DELETE" && pathname.startsWith("/files/")) {
      const key = decodeURIComponent(pathname.slice(7));
      await env.R2_BUCKET.delete(key);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders(origin) });
  },
} satisfies ExportedHandler<Env>;
