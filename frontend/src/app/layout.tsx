import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { ThemeScript } from "@/components/theme-script";
import { AppRouteShell } from "@/components/app-route-shell";
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
      className={`${dmSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        {/* Polyfill crypto.randomUUID for Safari on HTTP (non-secure context) */}
        <script dangerouslySetInnerHTML={{ __html: `if(typeof crypto!=='undefined'&&!crypto.randomUUID){crypto.randomUUID=function(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^(Math.random()*16>>c/4)).toString(16)});};}` }} />
      </head>
      <body className="min-h-full flex">
        <AppRouteShell>{children}</AppRouteShell>
      </body>
    </html>
  );
}
