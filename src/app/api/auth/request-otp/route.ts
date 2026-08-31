import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin-db";
import { createOtpChallenge, isAllowedOrigin, requestFingerprint } from "@/lib/security";
import { sendOtpToAdmins } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const db = createAdminClient();
  const fingerprint = requestFingerprint(request.headers);
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000).toISOString();
  const [{ count: recentDevice }, { count: recentGlobal }] = await Promise.all([
    db.from("admin_otp_challenges").select("id", { count: "exact", head: true }).eq("request_fingerprint_hash", fingerprint).gte("created_at", fifteenMinutesAgo),
    db.from("admin_otp_challenges").select("id", { count: "exact", head: true }).gte("created_at", oneMinuteAgo),
  ]);
  if ((recentDevice ?? 0) >= 5 || (recentGlobal ?? 0) >= 3) {
    return NextResponse.json({ error: "OTP request များနေပါတယ်။ ခဏစောင့်ပြီး ပြန်လုပ်ပါ။" }, { status: 429 });
  }

  const challenge = createOtpChallenge();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error: insertError } = await db.from("admin_otp_challenges").insert({
    id: challenge.id,
    code_hash: challenge.codeHash,
    request_fingerprint_hash: fingerprint,
    expires_at: expiresAt,
  });
  if (insertError) return NextResponse.json({ error: "OTP စတင်လို့မရသေးပါ။" }, { status: 500 });

  const delivered = await sendOtpToAdmins(challenge.code);
  if (!delivered) {
    await db.from("admin_otp_challenges").delete().eq("id", challenge.id);
    return NextResponse.json({ error: "Telegram ကို OTP ပို့မရပါ။ Admin က bot ကို Start လုပ်ထားကြောင်း စစ်ပါ။" }, { status: 502 });
  }
  await db.from("admin_otp_challenges").update({ telegram_delivery_count: delivered }).eq("id", challenge.id);
  return NextResponse.json({ challengeId: challenge.id, expiresIn: 300, delivered });
}
