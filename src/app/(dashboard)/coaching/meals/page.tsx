import { getCoachingMealManagerData } from "@/lib/data";
import { MealManager } from "@/components/coaching/meal-manager";
import { CoachingToolsNav } from "@/components/coaching/coaching-tools-nav";

export const dynamic = "force-dynamic";

export default async function CoachingMealsPage(){
  const items=await getCoachingMealManagerData();
  return <><CoachingToolsNav group="plans" active="/coaching/meals"/><MealManager items={items}/></>;
}
