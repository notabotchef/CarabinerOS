import { DemoCreateAccountScreen } from "@/components/demo/demo-create-account-screen";

// Next.js 16: searchParams is a Promise and must be awaited in the server component.
export default async function DemoCreateAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ restaurantSlug?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const restaurantSlug = resolved.restaurantSlug || "targetrestaurant";
  return <DemoCreateAccountScreen restaurantSlug={restaurantSlug} />;
}
