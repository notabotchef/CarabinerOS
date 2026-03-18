import { ChatView } from "@/components/chat/chat-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col h-[100dvh]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-semibold">CarabinerOS</span>
      </header>
      <ChatView />
    </div>
  );
}
