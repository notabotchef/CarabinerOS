"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCards } from "./metric-cards";
import { CoversChart } from "./covers-chart";
import { InboxList } from "./inbox-list";
import { SuggestedPrompts } from "./suggested-prompts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DashboardTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics" disabled>
          Analytics
        </TabsTrigger>
        <TabsTrigger value="reports" disabled>
          Reports
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <MetricCards />

        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Daily Covers</CardTitle>
              <CardDescription>
                Guest count by location this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoversChart />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>
                Operational exceptions needing attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InboxList />
            </CardContent>
          </Card>
        </div>

        <SuggestedPrompts />
      </TabsContent>
    </Tabs>
  );
}
