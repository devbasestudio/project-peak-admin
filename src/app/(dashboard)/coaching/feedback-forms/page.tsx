import { getCoachingFeedbackManagerData } from "@/lib/data";
import { FeedbackFormManager } from "@/components/coaching/feedback-form-manager";

export const dynamic = "force-dynamic";

export default async function CoachingFeedbackFormsPage(){
  const templates=await getCoachingFeedbackManagerData();
  return <FeedbackFormManager templates={templates}/>;
}
