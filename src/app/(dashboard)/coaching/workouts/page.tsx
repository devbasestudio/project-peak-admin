import { getCoachingWorkoutManagerData } from "@/lib/data";
import { WorkoutManager } from "@/components/coaching/workout-manager";
import { CoachingToolsNav } from "@/components/coaching/coaching-tools-nav";

export const dynamic = "force-dynamic";

export default async function CoachingWorkoutsPage({searchParams}:{searchParams:Promise<{client?:string}>}){
  const data=await getCoachingWorkoutManagerData((await searchParams).client);
  const now=new Date();
  const today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return <><CoachingToolsNav group="plans" active="/coaching/workouts"/><WorkoutManager key={data.selectedClientId} initialClientId={data.selectedClientId} clients={data.clients} workouts={data.workouts} library={data.library} today={today}/></>;
}
