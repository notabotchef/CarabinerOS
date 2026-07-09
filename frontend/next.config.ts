import type { NextConfig } from "next";

const A0_URL = process.env.A0_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  // Tunnel hostnames change every session; allow trycloudflare in dev.
  allowedDevOrigins: [
    "10.0.0.39",
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
    "trycloudflare.com",
  ],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // Bridge chat contract (frontend calls bare paths)
      { source: "/csrf_token", destination: `${A0_URL}/csrf_token` },
      { source: "/message_async", destination: `${A0_URL}/message_async` },
      { source: "/message", destination: `${A0_URL}/message_async` },
      { source: "/chats", destination: `${A0_URL}/chats` },
      { source: "/chat_load", destination: `${A0_URL}/chat_load` },
      { source: "/chat_create", destination: `${A0_URL}/chat_create` },
      { source: "/chat_remove", destination: `${A0_URL}/chat_remove` },
      // Inventory sub-routes before generic /api/inventory/:id
      { source: "/api/inventory/counts/:id", destination: `${A0_URL}/api/inventory/counts?id=:id` },
      // Detail-route rewrites
      { source: "/api/orders/:id", destination: `${A0_URL}/api/orders?id=:id` },
      { source: "/api/inventory/:id", destination: `${A0_URL}/api/inventory?id=:id` },
      { source: "/api/prep/:id", destination: `${A0_URL}/api/prep?id=:id` },
      { source: "/api/food-cost/:id", destination: `${A0_URL}/api/food-cost?id=:id` },
      { source: "/api/menu/:id", destination: `${A0_URL}/api/menu?id=:id` },
      { source: "/api/recipes/:id", destination: `${A0_URL}/api/recipes?id=:id` },
      { source: "/api/invoices/:id", destination: `${A0_URL}/api/invoices?id=:id` },
      { source: "/api/campaigns/:id", destination: `${A0_URL}/api/campaigns?id=:id` },
      // Catch-all API + Socket.IO
      { source: "/api/:path*", destination: `${A0_URL}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${A0_URL}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
