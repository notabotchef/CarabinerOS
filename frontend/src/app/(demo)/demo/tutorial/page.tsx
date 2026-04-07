import { DemoTutorialScreen } from "@/components/demo/demo-tutorial-screen";

export default function DemoTutorialPage({
  searchParams,
}: {
  searchParams?: { restaurantSlug?: string };
}) {
  const restaurantSlug = searchParams?.restaurantSlug || "targetrestaurant";
  return <DemoTutorialScreen restaurantSlug={restaurantSlug} />;
}
