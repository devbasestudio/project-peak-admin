import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/admin/template-builder";
import { getAdminTemplate } from "@/lib/data";

export default async function TemplateEditorPage({params}:{params:Promise<{templateId:string}>}){const{templateId}=await params;const template=await getAdminTemplate(templateId);if(!template)notFound();return <TemplateBuilder initialTemplate={template} locale="mm"/>}
