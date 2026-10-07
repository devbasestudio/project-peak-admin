import { getCoachingMealManagerData } from "@/lib/data";
import { MealManager } from "@/components/coaching/meal-manager";
import { CoachingToolsNav } from "@/components/coaching/coaching-tools-nav";

export const dynamic = "force-dynamic";

export default async function CoachingMealsPage({searchParams}:{searchParams:Promise<{client?:string}>}){
  const data=await getCoachingMealManagerData((await searchParams).client);
  return <><CoachingToolsNav group="plans" active="/coaching/meals"/><MealManager key={data.selectedClientId} initialClientId={data.selectedClientId} clients={data.clients} items={data.items}/></>;
}
