import "server-only";
import { createAdminClient } from "@/lib/admin-db";

export type BlogPost = { id:string;author_id:string;slug:string;language:"mm"|"en";title:string;excerpt:string;content:string;cover_image_url:string|null;cover_image_path:string|null;seo_title:string|null;seo_description:string|null;status:"draft"|"published";featured:boolean;published_at:string|null;created_at:string;updated_at:string };
const columns = "id,author_id,slug,language,title,excerpt,content,cover_image_url,cover_image_path,seo_title,seo_description,status,featured,published_at,created_at,updated_at";
export async function getPosts(){const {data,error}=await createAdminClient().from("blog_posts").select(columns).order("updated_at",{ascending:false});if(error)throw error;return(data??[])as BlogPost[]}
export async function getPost(id:string){const {data,error}=await createAdminClient().from("blog_posts").select(columns).eq("id",id).maybeSingle();if(error)throw error;return data as BlogPost|null}
