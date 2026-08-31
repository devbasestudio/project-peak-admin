import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { OtpLogin } from "@/components/auth/otp-login";

export const metadata: Metadata = { title: "Secure login" };

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <OtpLogin />;
}
