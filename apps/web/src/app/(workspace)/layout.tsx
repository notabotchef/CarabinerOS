import { ChatDock } from "@/components/workspace/chat-dock";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
      <ChatDock />
    </div>
  );
}
