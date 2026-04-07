import { DemoInviteScreen } from "@/components/demo/demo-invite-screen";

// Next.js 16: params is a Promise and must be awaited in the server component wrapper.
export default async function DemoInvitePage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  return <DemoInviteScreen restaurantSlug={restaurantSlug} />;
}
