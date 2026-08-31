import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function HomePage() {
  redirect((await getCurrentSession()) ? "/dashboard" : "/login");
}
