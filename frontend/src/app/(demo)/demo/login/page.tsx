import { DemoLoginScreen } from "@/components/demo/demo-login-screen";

// Next.js 16: searchParams is a Promise and must be awaited in the server component.
export default async function DemoLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ restaurantSlug?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const restaurantSlug = resolved.restaurantSlug || "targetrestaurant";
  return <DemoLoginScreen restaurantSlug={restaurantSlug} />;
}
