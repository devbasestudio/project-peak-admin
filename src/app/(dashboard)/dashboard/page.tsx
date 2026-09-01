import Link from "next/link";
import { ArrowUpRight, Dumbbell, Newspaper, PersonStanding } from "lucide-react";
import styles from "./workspace-picker.module.css";

const workspaces = [
  {
    code: "01",
    title: "Home Workout",
    subtitle: "12 Weeks Program",
    description: "Payment စစ်မယ်၊ သင်တန်းသား access စီမံမယ်၊ workout template နဲ့ exercise videos ပြင်မယ်။",
    href: "/home-workout/payments",
    action: "Home Workout ကိုဝင်မယ်",
    icon: Dumbbell,
    tone: "cyan",
  },
  {
    code: "02",
    title: "1:1 Coaching",
    subtitle: "Personal Coaching",
    description: "Client တစ်ယောက်ချင်းစီရဲ့ custom plan၊ payment နဲ့ progress ကို တစ်နေရာတည်းက track လုပ်မယ်။",
    href: "/coaching/overview",
    action: "1:1 Coaching ကိုဝင်မယ်",
    icon: PersonStanding,
    tone: "dark",
  },
  {
    code: "03",
    title: "Main Website",
    subtitle: "Project Peak Journal",
    description: "Main landing page မှာပေါ်မယ့် Blog Post အသစ်ရေးမယ်၊ draft ပြင်မယ်၊ publish လုပ်မယ်။",
    href: "/website/posts",
    action: "Main Website ကိုဝင်မယ်",
    icon: Newspaper,
    tone: "light",
  },
] as const;

export default function DashboardPage() {
  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>PROJECT PEAK · ADMIN</p><h1>ဘယ် Website ကို<br />စီမံချင်ပါသလဲ?</h1></div>
      <p>Website တစ်ခုရွေးပြီးတာနဲ့ အဲဒီ Website နဲ့ သက်ဆိုင်တဲ့ menu တွေပဲ မြင်ရပါမယ်။ နောက်တစ်ခုကိုပြောင်းချင်ရင် “Website ပြောင်းမယ်” ကိုနှိပ်ပါ။</p>
    </header>
    <section className={styles.grid} aria-label="Project Peak websites">
      {workspaces.map(({ code, title, subtitle, description, href, action, icon: Icon, tone }) => <Link href={href} className={styles.card} data-tone={tone} key={href}>
        <div className={styles.cardTop}><span>{code}</span><span className={styles.icon}><Icon size={24} /></span></div>
        <div className={styles.cardBody}><p>{subtitle}</p><h2>{title}</h2><span>{description}</span></div>
        <div className={styles.cardAction}><strong>{action}</strong><ArrowUpRight size={18} /></div>
      </Link>)}
    </section>
    <p className={styles.help}>Trainer အတွက် ရိုးရှင်းအောင် Website တစ်ခုချင်းစီကို သီးသန့်ခွဲပြထားပါတယ်။</p>
  </div>;
}
