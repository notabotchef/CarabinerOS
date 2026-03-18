import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { fetchAPI, type Location } from "@/lib/api";
import { QueryProvider } from "@/lib/query-provider";
import { SocketProvider } from "@/lib/socket-provider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CarabinerOS",
  description: "Restaurant operations, executed in natural language.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let locations: Location[] | undefined;
  let orgName: string | undefined;
  try {
    const locs = await fetchAPI<Location[]>("/api/locations");
    locations = locs;
    const hq = await fetchAPI<{ organization: { name: string } | null }>("/api/hq");
    orgName = hq.organization?.name;
  } catch {
    // API unavailable — sidebar will use fallback data
  }

  return (
    <html lang="en" className="dark">
      <body
        className={`${jakarta.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <QueryProvider>
          <SocketProvider>
            <TooltipProvider>
              <SidebarProvider>
                <AppSidebar locations={locations} orgName={orgName} />
                <div className="flex flex-1 flex-col overflow-auto">{children}</div>
              </SidebarProvider>
            </TooltipProvider>
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
