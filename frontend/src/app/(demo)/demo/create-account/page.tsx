import { DemoCreateAccountScreen } from "@/components/demo/demo-create-account-screen";

export default function DemoCreateAccountPage({
  searchParams,
}: {
  searchParams?: { restaurantSlug?: string };
}) {
  const restaurantSlug = searchParams?.restaurantSlug || "targetrestaurant";
  return <DemoCreateAccountScreen restaurantSlug={restaurantSlug} />;
}
