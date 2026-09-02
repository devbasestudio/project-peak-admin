import { getCoachingWorkoutManagerData } from "@/lib/data";
import { WorkoutManager } from "@/components/coaching/workout-manager";

export const dynamic = "force-dynamic";

export default async function CoachingWorkoutsPage(){
  const data=await getCoachingWorkoutManagerData();
  const now=new Date();
  const today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return <WorkoutManager clients={data.clients} workouts={data.workouts} today={today}/>;
}
