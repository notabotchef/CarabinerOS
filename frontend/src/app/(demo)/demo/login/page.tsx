import { DemoLoginScreen } from "@/components/demo/demo-login-screen";

export default function DemoLoginPage({
  searchParams,
}: {
  searchParams?: { restaurantSlug?: string };
}) {
  const restaurantSlug = searchParams?.restaurantSlug || "targetrestaurant";
  return <DemoLoginScreen restaurantSlug={restaurantSlug} />;
}
