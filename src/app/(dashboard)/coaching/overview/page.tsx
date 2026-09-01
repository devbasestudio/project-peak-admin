import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ClipboardList, CreditCard, Users } from "lucide-react";
import { getCoachingOverview } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function CoachingOverviewPage() {
  const { stats, recent } = await getCoachingOverview();
  const cards = [
    { label: "1:1 Clients", value: stats.clients, caption: `${stats.ready} ယောက် Ready`, icon: Users },
    { label: "စစ်ရမယ့် Payment", value: stats.pending, caption: "Screenshot စစ်ဖို့", icon: CreditCard },
    { label: "Custom Templates", value: stats.templates, caption: "Client-specific", icon: ClipboardList },
    { label: "Weekly Check-ins", value: stats.checkins, caption: "Progress entries", icon: CheckCircle2 },
  ];
  return <><div className={styles.pageHeader}><div><p className={styles.eyebrow}>1:1 COACHING · DAILY CONTROL</p><h1 className={styles.pageTitle}>Client တစ်ယောက်ချင်းကို ရှင်းရှင်းကြည့်မယ်</h1><p className={styles.pageDescription}>Payment ကနေ custom template၊ client tracking နဲ့ feedback အထိ ဒီ section ထဲကနေပဲလုပ်နိုင်ပါတယ်။</p></div><Link className={styles.button} href="/coaching/templates">Template ဆောက်မယ် <ArrowUpRight size={15}/></Link></div><div className={styles.statsGrid}>{cards.map(({label,value,caption,icon:Icon})=><article className={styles.statCard} key={label}><div className={styles.statTop}><span>{label}</span><span className={styles.statIcon}><Icon size={16}/></span></div><div className={styles.statValue}>{value}</div><div className={styles.statCaption}>{caption}</div></article>)}</div><section className={styles.panel}><div className={styles.panelHeader}><h2>နောက်ဆုံး 1:1 ဝယ်ယူမှု</h2><Link href="/coaching/payments">အားလုံးကြည့်မယ် →</Link></div>{recent.length?<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Client</th><th>Email</th><th>Status</th><th>ရက်စွဲ</th></tr></thead><tbody>{recent.map((row)=><tr key={row.id}><td data-label="Client"><strong>{row.name||"Google Client"}</strong></td><td data-label="Email" className="mono">{row.email||"—"}</td><td data-label="Status"><span className={styles.status} data-status={row.payment_status}>{row.payment_status.replaceAll("_"," ")}</span></td><td data-label="ရက်စွဲ">{new Date(row.created_at).toLocaleDateString("en-GB")}</td></tr>)}</tbody></table></div>:<div className={styles.empty}><strong>1:1 client မရှိသေးပါ</strong>Client က website မှာ package ယူတာနဲ့ ဒီမှာပေါ်ပါမယ်။</div>}</section></>;
}
