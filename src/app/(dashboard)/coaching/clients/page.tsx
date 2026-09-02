import Link from "next/link";
import { ArrowUpRight, Eye } from "lucide-react";
import { getCoachingClients } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

export default async function CoachingClientsPage() {
  const clients = await getCoachingClients();
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{clients.length} ယောက် · LIVE PROGRESS</p>
          <h1 className={styles.pageTitle}>1:1 Clients</h1>
          <p className={styles.pageDescription}>Client ကိုနှိပ်ပြီး weight trend၊ workouts၊ habits၊ weekly check-in နဲ့ custom template အားလုံးကို အသေးစိတ်ကြည့်နိုင်ပါတယ်။</p>
        </div>
        <Link className={styles.button} href="/coaching/templates">Template ဆောက်မယ် <ArrowUpRight size={15}/></Link>
      </div>
      <section className={styles.panel}>
        {clients.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Client</th><th>Program</th><th>Template</th><th>Daily Logs</th><th>Check-ins</th><th>Latest</th><th>Detail</th></tr></thead>
              <tbody>{clients.map((client) => (
                <tr key={client.id}>
                  <td data-label="Client"><strong>{client.username}</strong><small className="mono">{client.email || "—"}</small></td>
                  <td data-label="Program">{client.program ? <><strong>{client.program.duration_weeks} weeks</strong><small>Started {new Date(client.program.start_date).toLocaleDateString("en-GB")}</small></> : <span className={styles.muted}>မသတ်မှတ်ရသေး</span>}</td>
                  <td data-label="Template">{client.template ? <><span className={styles.status} data-status="approved">READY</span><small>{client.template.name}</small></> : <span className={styles.status} data-status="pending">BUILD</span>}</td>
                  <td data-label="Daily Logs"><strong>{client.logs.length}</strong><small>entries</small></td>
                  <td data-label="Check-ins"><strong>{client.checkins.length}</strong><small>entries</small></td>
                  <td data-label="Latest">{client.logs[0] ? <><strong>{client.logs[0].body_weight ? `${client.logs[0].body_weight} kg` : "Logged"}</strong><small>{new Date(client.logs[0].date).toLocaleDateString("en-GB")}</small></> : <span className={styles.muted}>မဖြည့်ရသေး</span>}</td>
                  <td data-label="Detail"><Link className={styles.tableAction} href={`/coaching/clients/${client.id}`}><Eye size={14}/>အသေးစိတ်</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className={styles.empty}><strong>Approved client မရှိသေးပါ</strong>Payment approve လုပ်ပြီးတဲ့ client တွေ ဒီမှာပေါ်ပါမယ်။</div>}
      </section>
    </>
  );
}
