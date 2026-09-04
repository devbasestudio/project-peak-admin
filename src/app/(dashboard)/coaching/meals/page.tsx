import { getCoachingMealManagerData } from "@/lib/data";
import { MealManager } from "@/components/coaching/meal-manager";
import { CoachingToolsNav } from "@/components/coaching/coaching-tools-nav";

export const dynamic = "force-dynamic";

export default async function CoachingMealsPage(){
  const data=await getCoachingMealManagerData();
  return <><CoachingToolsNav group="plans" active="/coaching/meals"/><MealManager clients={data.clients} items={data.items}/></>;
}
