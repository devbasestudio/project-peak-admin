import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/admin-db";
import { isAllowedOrigin, requestFingerprint, requestIp, sha256, verifyOtpHash } from "@/lib/security";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "OTP ၆ လုံး ပြည့်အောင်ထည့်ပါ။" }, { status: 400 });

  const db = createAdminClient();
  const { data: challenge, error } = await db.from("admin_otp_challenges")
    .select("id,code_hash,request_fingerprint_hash,attempts,expires_at,consumed_at")
    .eq("id", parsed.data.challengeId).maybeSingle();
  const expired = !challenge || new Date(challenge.expires_at).getTime() <= Date.now();
  if (error || expired || challenge?.consumed_at || (challenge?.attempts ?? 5) >= 5) {
    return NextResponse.json({ error: "OTP သက်တမ်းကုန်သွားပါပြီ။ အသစ်ပြန်တောင်းပါ။" }, { status: 400 });
  }
  if (challenge.request_fingerprint_hash !== requestFingerprint(request.headers)) {
    return NextResponse.json({ error: "OTP တောင်းထားတဲ့ device ကနေပဲ ဝင်နိုင်ပါတယ်။" }, { status: 403 });
  }
  if (!verifyOtpHash(challenge.id, parsed.data.code, challenge.code_hash)) {
    await db.from("admin_otp_challenges").update({ attempts: challenge.attempts + 1 }).eq("id", challenge.id).eq("attempts", challenge.attempts);
    const remaining = Math.max(0, 4 - challenge.attempts);
    return NextResponse.json({ error: `OTP မမှန်ပါ။ ထပ်စမ်းနိုင်တာ ${remaining} ကြိမ် ကျန်ပါတယ်။` }, { status: 401 });
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60_000);
  const { error: sessionError } = await db.rpc("central_admin_activate_session", {
    p_challenge_id: challenge.id,
    p_session_token_hash: sha256(token),
    p_user_agent_hash: sha256(request.headers.get("user-agent") ?? "unknown"),
    p_ip_hash: sha256(requestIp(request.headers)),
    p_expires_at: expiresAt.toISOString(),
  });
  if (sessionError) return NextResponse.json({ error: "Login session စတင်မရသေးပါ။" }, { status: 500 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
