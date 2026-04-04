import type { NextConfig } from "next";

const A0_URL = process.env.A0_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.39"],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // A0 chat endpoints (frontend calls bare paths, A0 serves at /api/)
      { source: "/csrf_token", destination: `${A0_URL}/api/csrf_token` },
      { source: "/message_async", destination: `${A0_URL}/api/message_async` },
      { source: "/message", destination: `${A0_URL}/api/message` },
      { source: "/chats", destination: `${A0_URL}/api/chats` },
      { source: "/chat_load", destination: `${A0_URL}/api/chat_load` },
      { source: "/chat_create", destination: `${A0_URL}/api/chat_create` },
      { source: "/chat_remove", destination: `${A0_URL}/api/chat_remove` },
      // Inventory sub-routes must come before the generic /api/inventory/:id
      // rewrite — otherwise Next.js would treat "counts", "par-levels", etc.
      // as an :id value and proxy them to the wrong handler.
      { source: "/api/inventory/counts/:id", destination: `${A0_URL}/api/inventory/counts?id=:id` },
      // Detail-route rewrites: /api/<resource>/:id → /api/<resource>?id=:id
      // These must come before the catch-all so Next.js matches them first.
      { source: "/api/orders/:id", destination: `${A0_URL}/api/orders?id=:id` },
      { source: "/api/inventory/:id", destination: `${A0_URL}/api/inventory?id=:id` },
      { source: "/api/prep/:id", destination: `${A0_URL}/api/prep?id=:id` },
      { source: "/api/food-cost/:id", destination: `${A0_URL}/api/food-cost?id=:id` },
      { source: "/api/menu/:id", destination: `${A0_URL}/api/menu?id=:id` },
      { source: "/api/recipes/:id", destination: `${A0_URL}/api/recipes?id=:id` },
      { source: "/api/invoices/:id", destination: `${A0_URL}/api/invoices?id=:id` },
      { source: "/api/campaigns/:id", destination: `${A0_URL}/api/campaigns?id=:id` },
      // CarabinerOS + A0 API catch-all
      { source: "/api/:path*", destination: `${A0_URL}/api/:path*` },
      // Socket.IO (Engine.IO polling + WebSocket upgrade) — must come after
      // REST rewrites so /api/* is matched first.
      { source: "/socket.io/:path*", destination: `${A0_URL}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
