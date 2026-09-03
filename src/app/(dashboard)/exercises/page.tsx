import { SharedExerciseManager } from "@/components/admin/shared-exercise-manager";
import { getSharedExerciseLibraryData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const data = await getSharedExerciseLibraryData();
  return <SharedExerciseManager categories={data.categories} exercises={data.exercises} />;
}
