import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/message", destination: "http://localhost:5000/message" },
      { source: "/message_async", destination: "http://localhost:5000/message_async" },
      { source: "/chats", destination: "http://localhost:5000/chats" },
      { source: "/chat_load", destination: "http://localhost:5000/chat_load" },
      { source: "/chat_create", destination: "http://localhost:5000/chat_create" },
    ];
  },
};

export default nextConfig;
