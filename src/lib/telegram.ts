import "server-only";
import { serverEnv } from "@/lib/env";

type TelegramResponse = { ok: boolean; description?: string };

export async function sendOtpToAdmins(code: string) {
  const env = serverEnv();
  const text = [
    "🔐 Project Peak Admin Login",
    "",
    `OTP: ${code}`,
    "",
    "ဒီ code က ၅ မိနစ်အတွင်းသာ အသုံးပြုနိုင်ပါတယ်။",
    "သင် request မလုပ်ထားပါက မည်သူ့ကိုမှ မပေးပါနှင့်။",
  ].join("\n");

  const results = await Promise.allSettled(env.telegramAdminChatIds.map(async (chatId) => {
    const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, protect_content: true }),
      cache: "no-store",
    });
    const result = await response.json() as TelegramResponse;
    if (!response.ok || !result.ok) throw new Error(result.description ?? "Telegram delivery failed");
    return chatId;
  }));

  return results.filter((result) => result.status === "fulfilled").length;
}
