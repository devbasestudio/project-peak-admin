import "server-only";
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string) {
  return createHmac("sha256", serverEnv().otpHmacSecret).update(value).digest("hex");
}

export function createOtpChallenge() {
  const id = randomUUID();
  const code = String(randomInt(100000, 1000000));
  return { id, code, codeHash: hmac(`${id}:${code}`) };
}

export function verifyOtpHash(challengeId: string, code: string, expectedHash: string) {
  const actual = Buffer.from(hmac(`${challengeId}:${code}`), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function requestIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function requestFingerprint(headers: Headers) {
  return hmac(`${requestIp(headers)}|${headers.get("user-agent") ?? "unknown"}`);
}

export function isAllowedOrigin(request: Request) {
  if (process.env.NODE_ENV !== "production") return true;
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === serverEnv().siteUrl);
}
