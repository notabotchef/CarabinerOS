import type { NextConfig } from "next";

const A0_URL = process.env.A0_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      { source: "/csrf_token", destination: `${A0_URL}/api/csrf_token` },
      { source: "/message_async", destination: `${A0_URL}/api/message_async` },
      { source: "/message", destination: `${A0_URL}/api/message` },
      { source: "/chats", destination: `${A0_URL}/api/chats` },
      { source: "/chat_load", destination: `${A0_URL}/api/chat_load` },
      { source: "/chat_create", destination: `${A0_URL}/api/chat_create` },
      { source: "/chat_remove", destination: `${A0_URL}/api/chat_remove` },
      { source: "/api/:path*", destination: `${A0_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
