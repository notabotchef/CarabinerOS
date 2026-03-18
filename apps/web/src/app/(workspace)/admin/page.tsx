import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminPage() {
  return (
    <>
      <WorkspaceHeader title="Admin" subtitle="Settings & configuration" />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Configuration and administration features are coming in a future
              update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page will include execution mode settings, connector
              configuration, user management, and organization preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
