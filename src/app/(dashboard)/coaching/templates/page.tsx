import { getCoachingTemplateData } from "@/lib/data";
import { CoachingTemplateBuilder } from "@/components/coaching/template-builder";
import { CoachingToolsNav } from "@/components/coaching/coaching-tools-nav";

export default async function CoachingTemplatesPage() {
  const data = await getCoachingTemplateData();
  return <><CoachingToolsNav group="plans" active="/coaching/templates"/><CoachingTemplateBuilder clients={data.clients} templates={data.templates}/></>;
}
