import { getCoachingExerciseLibraryData } from "@/lib/data";
import { ExerciseLibraryManager } from "@/components/coaching/exercise-library-manager";

export const dynamic="force-dynamic";

export default async function CoachingExercisesPage(){
  const items=await getCoachingExerciseLibraryData();
  return <ExerciseLibraryManager items={items}/>;
}
