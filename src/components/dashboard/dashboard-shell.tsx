"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Apple, ArrowLeftRight, Circle, ClipboardCheck, CreditCard, Dumbbell, ExternalLink, Film, LayoutDashboard, LogOut, Menu, Newspaper, PersonStanding, SlidersHorizontal, Users, X } from "lucide-react";
import { logout } from "@/app/actions";
import styles from "./dashboard-shell.module.css";

const sections = [
  { label: "အဓိက", items: [
    { href: "/dashboard", label: "ခြုံငုံကြည့်မယ်", hint: "Website ရွေးမယ်", icon: LayoutDashboard },
    { href: "/exercises", label: "Exercises", hint: "Program အားလုံးသုံးမယ်", icon: Film },
  ] },
  { label: "HOME WORKOUT", items: [
    { href: "/home-workout/payments", label: "ငွေပေးချေမှု", hint: "Approve / Reject", icon: CreditCard },
    { href: "/home-workout/customers", label: "သင်တန်းသားများ", hint: "Access စီမံမယ်", icon: Users },
    { href: "/home-workout/templates", label: "Program Template", hint: "12 weeks content", icon: Dumbbell },
  ] },
  { label: "1:1 COACHING", items: [
    { href: "/coaching/overview", label: "Coaching Overview", hint: "ဒီနေ့ track မယ်", icon: PersonStanding },
    { href: "/coaching/payments", label: "1:1 Payments", hint: "Approve / Reject", icon: CreditCard },
    { href: "/coaching/clients", label: "1:1 Clients", hint: "Progress ကြည့်မယ်", icon: Users },
    { href: "/coaching/workouts", label: "Workout Plans", hint: "ရက်အလိုက် ပြင်မယ်", icon: Dumbbell },
    { href: "/coaching/meals", label: "Meal Plans", hint: "အစားအစာ ပြင်မယ်", icon: Apple },
    { href: "/coaching/feedback-forms", label: "Feedback Forms", hint: "မေးခွန်း ပြင်မယ်", icon: ClipboardCheck },
    { href: "/coaching/templates", label: "Custom Templates", hint: "Client plan ဆောက်မယ်", icon: SlidersHorizontal },
  ] },
  { label: "MAIN WEBSITE", items: [{ href: "/website/posts", label: "Blog Posts", hint: "ရေးမယ်၊ Publish မယ်", icon: Newspaper }] },
];

export function DashboardShell({ children, sessionStarted }: { children: React.ReactNode; sessionStarted: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const workspace = pathname.startsWith("/home-workout") ? "HOME WORKOUT" : pathname.startsWith("/coaching") ? "1:1 COACHING" : pathname.startsWith("/website") ? "MAIN WEBSITE" : null;
  const visibleSections = workspace ? [sections[0], sections.find((section) => section.label === workspace)!] : [sections[0]];
  const active = visibleSections.flatMap((section) => section.items).find((item) => pathname.startsWith(item.href)) ?? sections[0].items[0];
  const liveSite = workspace === "HOME WORKOUT"
    ? { label: "Workout site", href: "https://project-peak-beta.vercel.app" }
    : workspace === "1:1 COACHING"
      ? { label: "1:1 site", href: "https://project-peak-coaching.vercel.app" }
      : workspace === "MAIN WEBSITE"
        ? { label: "Main site", href: "https://project-peak-landing.vercel.app" }
        : null;
  return <div className={styles.shell}>
    <button className={styles.backdrop} data-open={open} onClick={() => setOpen(false)} aria-label="Menu ပိတ်မယ်" />
    <aside className={styles.sidebar} data-open={open}>
      <div className={styles.brandRow}><Link href="/dashboard" className={styles.brand} onClick={() => setOpen(false)}><Image src="/brand/logo-light.svg" width={170} height={43} alt="Project Peak" /></Link><button className={styles.close} onClick={() => setOpen(false)} aria-label="Menu ပိတ်မယ်"><X size={20} /></button></div>
      <div className={styles.controlLabel}><span>CONTROL ROOM</span><b><i />LIVE</b></div>
      <nav className={styles.nav}>{visibleSections.map((section) => <div key={section.label} className={styles.navSection}><p>{section.label}</p>{section.items.map(({ href, label, hint, icon: Icon }) => { const selected = pathname === href || (href !== "/dashboard" && pathname.startsWith(href)); return <Link href={href} key={href} data-active={selected} onClick={() => setOpen(false)}><span className={styles.navIcon}><Icon size={18} /></span><span><strong>{href === "/dashboard" && workspace ? "Website ပြောင်းမယ်" : label}</strong><small>{href === "/dashboard" && workspace ? "တခြား Dashboard ကိုသွားမယ်" : hint}</small></span></Link>; })}</div>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.adminProfile}><span className={styles.avatar}>PP</span><span><strong>Trainer Admin</strong><small>တစ်လုံးတည်း active</small></span><Circle size={8} fill="currentColor" /></div><form action={logout}><button><LogOut size={16} />Logout</button></form></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><div className={styles.topbarLeft}><button className={styles.menu} onClick={() => setOpen(true)} aria-label="Menu ဖွင့်မယ်"><Menu size={21} /></button><div><p>{workspace ?? active.hint}</p><h1>{workspace ? active.label : active.href === "/dashboard" ? "Website ရွေးမယ်" : active.label}</h1></div></div><div className={styles.topbarRight}><span className={styles.device}><Circle size={7} fill="currentColor" />Secure device</span>{workspace ? <Link href="/dashboard">Website ပြောင်းမယ် <ArrowLeftRight size={14} /></Link> : null}{liveSite ? <a href={liveSite.href} target="_blank" rel="noreferrer">{liveSite.label} <ExternalLink size={14} /></a> : null}</div></header>
      <main className={styles.content}>{children}</main>
      <footer className={styles.footer}><span>PROJECT PEAK · CENTRAL ADMIN</span><span>Session started {new Date(sessionStarted).toLocaleDateString("en-GB")}</span></footer>
    </div>
  </div>;
}
