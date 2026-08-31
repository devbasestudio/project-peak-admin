import "server-only";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function serverEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    telegramAdminChatIds: required("TELEGRAM_ADMIN_CHAT_IDS").split(",").map((value) => value.trim()).filter(Boolean),
    otpHmacSecret: required("OTP_HMAC_SECRET"),
    siteUrl: required("NEXT_PUBLIC_SITE_URL"),
  };
}
