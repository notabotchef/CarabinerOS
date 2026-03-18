import { ChatDock } from "@/components/workspace/chat-dock";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-auto min-w-0">{children}</div>
      <ChatDock />
    </div>
  );
}
