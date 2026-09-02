import { getCoachingMealManagerData } from "@/lib/data";
import { MealManager } from "@/components/coaching/meal-manager";

export const dynamic = "force-dynamic";

export default async function CoachingMealsPage(){
  const data=await getCoachingMealManagerData();
  return <MealManager items={data.items} programTypes={data.programTypes}/>;
}
