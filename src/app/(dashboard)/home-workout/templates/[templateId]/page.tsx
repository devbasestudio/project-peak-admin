import { notFound } from "next/navigation";
import { TemplateBuilder } from "@/components/admin/template-builder";
import { ExerciseVideoManager } from "@/components/admin/exercise-video-manager";
import { getAdminTemplate, getAdminTemplateExercises } from "@/lib/data";

export default async function TemplateEditorPage({params}:{params:Promise<{templateId:string}>}){const{templateId}=await params;const [template,exerciseLibrary]=await Promise.all([getAdminTemplate(templateId),getAdminTemplateExercises(templateId)]);if(!template)notFound();return <><ExerciseVideoManager templateId={templateId} library={exerciseLibrary}/><TemplateBuilder initialTemplate={template} locale="mm"/></>}
