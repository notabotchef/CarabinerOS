import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { SocketProvider } from "@/components/socket-provider";
import { AppSidebar } from "@/components/app-sidebar";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CarabinerOS",
  description: "AI-powered restaurant operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${dmSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex">
        <SocketProvider>
          <AppSidebar />
          <main className="flex-1 flex flex-col min-h-dvh overflow-hidden">
            {children}
          </main>
        </SocketProvider>
      </body>
    </html>
  );
}
