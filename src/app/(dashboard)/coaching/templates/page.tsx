import { getCoachingTemplateData } from "@/lib/data";
import { CoachingTemplateBuilder } from "@/components/coaching/template-builder";

export default async function CoachingTemplatesPage() {
  const data = await getCoachingTemplateData();
  return <CoachingTemplateBuilder clients={data.clients} templates={data.templates}/>;
}
