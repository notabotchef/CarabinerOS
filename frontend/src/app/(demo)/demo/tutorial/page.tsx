import { DemoTutorialScreen } from "@/components/demo/demo-tutorial-screen";

// Next.js 16: searchParams is a Promise and must be awaited in the server component.
export default async function DemoTutorialPage({
  searchParams,
}: {
  searchParams?: Promise<{ restaurantSlug?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const restaurantSlug = resolved.restaurantSlug || "targetrestaurant";
  return <DemoTutorialScreen restaurantSlug={restaurantSlug} />;
}
