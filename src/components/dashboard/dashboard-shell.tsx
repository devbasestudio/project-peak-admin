"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Circle, CreditCard, Dumbbell, ExternalLink, LayoutDashboard, LogOut, Menu, Newspaper, PersonStanding, SlidersHorizontal, Users, X } from "lucide-react";
import { logout } from "@/app/actions";
import styles from "./dashboard-shell.module.css";

const sections = [
  { label: "အဓိက", items: [{ href: "/dashboard", label: "ခြုံငုံကြည့်မယ်", hint: "ဒီနေ့လုပ်စရာ", icon: LayoutDashboard }] },
  { label: "HOME WORKOUT", items: [
    { href: "/home-workout/payments", label: "ငွေပေးချေမှု", hint: "Approve / Reject", icon: CreditCard },
    { href: "/home-workout/customers", label: "သင်တန်းသားများ", hint: "Access စီမံမယ်", icon: Users },
    { href: "/home-workout/templates", label: "Program Template", hint: "12 weeks content", icon: Dumbbell },
  ] },
  { label: "1:1 COACHING", items: [
    { href: "/coaching/overview", label: "Coaching Overview", hint: "ဒီနေ့ track မယ်", icon: PersonStanding },
    { href: "/coaching/payments", label: "1:1 Payments", hint: "Approve / Reject", icon: CreditCard },
    { href: "/coaching/clients", label: "1:1 Clients", hint: "Progress ကြည့်မယ်", icon: Users },
    { href: "/coaching/templates", label: "Custom Templates", hint: "Client plan ဆောက်မယ်", icon: SlidersHorizontal },
  ] },
  { label: "MAIN WEBSITE", items: [{ href: "/website/posts", label: "Blog Posts", hint: "ရေးမယ်၊ Publish မယ်", icon: Newspaper }] },
];

export function DashboardShell({ children, sessionStarted }: { children: React.ReactNode; sessionStarted: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = sections.flatMap((section) => section.items).find((item) => pathname.startsWith(item.href)) ?? sections[0].items[0];
  return <div className={styles.shell}>
    <button className={styles.backdrop} data-open={open} onClick={() => setOpen(false)} aria-label="Menu ပိတ်မယ်" />
    <aside className={styles.sidebar} data-open={open}>
      <div className={styles.brandRow}><Link href="/dashboard" className={styles.brand} onClick={() => setOpen(false)}><Image src="/brand/logo-light.svg" width={170} height={43} alt="Project Peak" /></Link><button className={styles.close} onClick={() => setOpen(false)} aria-label="Menu ပိတ်မယ်"><X size={20} /></button></div>
      <div className={styles.controlLabel}><span>CONTROL ROOM</span><b><i />LIVE</b></div>
      <nav className={styles.nav}>{sections.map((section) => <div key={section.label} className={styles.navSection}><p>{section.label}</p>{section.items.map(({ href, label, hint, icon: Icon }) => { const selected = pathname.startsWith(href); return <Link href={href} key={href} data-active={selected} onClick={() => setOpen(false)}><span className={styles.navIcon}><Icon size={18} /></span><span><strong>{label}</strong><small>{hint}</small></span></Link>; })}</div>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.adminProfile}><span className={styles.avatar}>PP</span><span><strong>Trainer Admin</strong><small>တစ်လုံးတည်း active</small></span><Circle size={8} fill="currentColor" /></div><form action={logout}><button><LogOut size={16} />Logout</button></form></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><div className={styles.topbarLeft}><button className={styles.menu} onClick={() => setOpen(true)} aria-label="Menu ဖွင့်မယ်"><Menu size={21} /></button><div><p>{active.hint}</p><h1>{active.label}</h1></div></div><div className={styles.topbarRight}><span className={styles.device}><Circle size={7} fill="currentColor" />Secure device</span><a href="https://project-peak-landing.vercel.app" target="_blank" rel="noreferrer">Main site <ExternalLink size={14} /></a><a href="https://project-peak-beta.vercel.app" target="_blank" rel="noreferrer">Workout <ExternalLink size={14} /></a><a href="https://project-peak-coaching.vercel.app" target="_blank" rel="noreferrer">1:1 <ExternalLink size={14} /></a></div></header>
      <main className={styles.content}>{children}</main>
      <footer className={styles.footer}><span>PROJECT PEAK · CENTRAL ADMIN</span><span>Session started {new Date(sessionStarted).toLocaleDateString("en-GB")}</span></footer>
    </div>
  </div>;
}
