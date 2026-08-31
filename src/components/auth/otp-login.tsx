"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, LockKeyhole } from "lucide-react";
import styles from "./otp-login.module.css";

type Step = "request" | "verify" | "success";

function TelegramLogo() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
    <path fill="currentColor" d="M23.91 3.79 20.3 20.84c-.27 1.21-.97 1.5-1.97.93l-5.5-4.06-2.65 2.55c-.29.29-.54.53-1.1.53l.39-5.57L19.6 6.07c.44-.39-.1-.61-.68-.22L6.4 13.74.99 12.05c-1.18-.37-1.2-1.18.25-1.75L22.4 2.15c.98-.36 1.84.24 1.51 1.64Z" />
  </svg>;
}

export function OtpLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(300);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (step !== "verify" || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, seconds]);

  async function requestOtp() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/request-otp", { method: "POST", headers: { "Content-Type": "application/json" } });
      const result = await response.json() as { challengeId?: string; error?: string };
      if (!response.ok || !result.challengeId) throw new Error(result.error ?? "OTP ပို့မရပါ။");
      setChallengeId(result.challengeId); setSeconds(300); setStep("verify");
    } catch (error) { setMessage(error instanceof Error ? error.message : "OTP ပို့မရပါ။"); }
    finally { setBusy(false); }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setMessage("OTP ၆ လုံး ပြည့်အောင်ထည့်ပါ။"); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, code }) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "OTP မမှန်ပါ။");
      setStep("success"); router.push("/dashboard"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Login ဝင်မရပါ။"); }
    finally { setBusy(false); }
  }

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");

  return <main className={styles.page}>
    <section className={styles.story}>
      <Image src="/brand/logo-light.svg" width={190} height={48} alt="Project Peak" priority />
      <div><p className={styles.kicker}>ONE CONTROL ROOM · TWO WEBSITES</p><h1>Trainer အတွက်<br /><span>ရှင်းလင်းတဲ့ Control.</span></h1><p>Home Workout customer တွေ၊ payment တွေ၊ program template နဲ့ Main Website blog တွေကို တစ်နေရာထဲက စီမံပါ။</p></div>
      <div className={styles.securityLine}><LockKeyhole size={17} /><span>Telegram OTP · One active device · 7-day secure session</span></div>
    </section>
    <section className={styles.loginPanel}>
      <div className={styles.mobileBrand}><Image src="/brand/logo-dark.svg" width={160} height={40} alt="Project Peak" /></div>
      <div className={styles.loginCard}>
        <div className={styles.stepMark}><KeyRound size={20} /></div>
        <p className={styles.cardKicker}>SECURE ADMIN ACCESS</p>
        <h2>{step === "request" ? "Control Room ဝင်မယ်" : step === "verify" ? "OTP ထည့်ပါ" : "ဝင်ရောက်နေပါတယ်"}</h2>
        <p className={styles.help}>{step === "request" ? "ခလုတ်နှိပ်တာနဲ့ သတ်မှတ်ထားတဲ့ Admin Telegram ဆီ OTP ပို့ပေးပါမယ်။" : "Telegram မှာရောက်လာတဲ့ ဂဏန်း ၆ လုံးကို အောက်မှာထည့်ပါ။"}</p>
        {step === "request" ? <><button className={styles.telegramButton} type="button" onClick={() => void requestOtp()} disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <span className={styles.telegramIcon}><TelegramLogo /></span>}<span>{busy ? "OTP ပို့နေပါတယ်…" : "Telegram မှ OTP ယူမယ်"}</span></button><a className={styles.botLink} href="https://t.me/projectpeak_admin_bot" target="_blank" rel="noreferrer">ပထမဆုံးဝင်တာဆိုရင် Telegram Bot ကို Start လုပ်ပါ ↗</a></> : null}
        {step === "verify" ? <form onSubmit={verifyOtp}><label htmlFor="otp">OTP CODE</label><input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="• • • • • •" autoFocus /><div className={styles.timer}><span>Code သက်တမ်း</span><b>{minutes}:{remainder}</b></div><button className={styles.verifyButton} disabled={busy || seconds <= 0}>{busy ? <LoaderCircle className={styles.spin} /> : null}{busy ? "စစ်ဆေးနေပါတယ်…" : "Dashboard ဝင်မယ်"}</button><button className={styles.resend} type="button" disabled={busy} onClick={() => { setCode(""); void requestOtp(); }}>OTP အသစ်ပြန်ယူမယ်</button></form> : null}
        {message ? <p className={styles.error}>{message}</p> : null}
        <div className={styles.deviceNote}><span>1</span><p><strong>Device တစ်လုံးသာ</strong>Login အသစ်ဝင်ရင် အရင်ဝင်ထားတဲ့ device က အလိုအလျောက် logout ဖြစ်သွားပါမယ်။</p></div>
      </div>
    </section>
  </main>;
}
