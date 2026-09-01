import { ExternalLink } from "lucide-react";
import { reviewCoachingPayment } from "@/app/coaching-actions";
import { getCoachingPayments } from "@/lib/data";
import styles from "@/components/admin/admin.module.css";

function answers(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function answer(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function measurement(value: unknown, unit: "kg" | "cm") {
  const text = answer(value);
  if (text === "—" || text.toLowerCase().includes(unit)) return text;
  return `${text} ${unit}`;
}

export default async function CoachingPaymentsPage() {
  const rows = await getCoachingPayments();
  const pending = rows.filter((row) => row.payment_status === "pending").length;
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{pending} ခု စစ်ဆေးဖို့ကျန်</p>
          <h1 className={styles.pageTitle}>1:1 Client စစ်မယ်</h1>
          <p className={styles.pageDescription}>Client ပို့ထားတဲ့ info၊ Front/Back/Side body photos နဲ့ KBZPay ငွေလွှဲသူအချက်အလက်ကို စစ်ပါ။ Bank app ထဲက payment record ကိုက်ရင် Approve လုပ်ပြီး custom template ဆောက်နိုင်ပါတယ်။</p>
        </div>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><h2>Client submission အားလုံး</h2><span className={styles.muted}>{rows.length} ခု</span></div>
        {rows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Client</th><th>Payment</th><th>Body info</th><th>Status</th><th>လုပ်ဆောင်ရန်</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const intake = answers(row.intake_answers);
                  return (
                    <tr key={row.id}>
                      <td data-label="Client">
                        <strong>{row.name || "Google Client"}</strong>
                        <small className="mono">{row.email || "—"}</small>
                        <small>{row.phone || "ဖုန်းမရှိ"}</small>
                        <details style={{ marginTop: 10 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Goal နှင့် coaching info</summary>
                          <div style={{ display: "grid", gap: 8, marginTop: 10, maxWidth: 420 }}>
                            <small><b>Goal:</b> {answer(intake.goal)}</small>
                            <small><b>Experience:</b> {answer(intake.experience)}</small>
                            <small><b>Schedule:</b> {answer(intake.schedule)}</small>
                            <small><b>Equipment:</b> {answer(intake.equipment)}</small>
                            <small><b>Limitations:</b> {answer(intake.limitations)}</small>
                          </div>
                        </details>
                      </td>
                      <td data-label="Payment">
                        <strong className="mono">{Number(row.program_price || 550000).toLocaleString()} MMK</strong>
                        <small>{row.payment_method || "KBZPay"} · {answer(intake.payer_name)}</small>
                        <small>{answer(intake.payer_phone)}</small>
                        <small>Ref: {answer(intake.payment_reference)}</small>
                        <small>{intake.payment_confirmed === true ? "Client က ပေးချေပြီးကြောင်း confirm လုပ်ထားသည်" : ["approved", "ready"].includes(row.payment_status) ? "အရင် flow က approve လုပ်ထားတဲ့ record" : "Payment confirm မရှိသေး"}</small>
                      </td>
                      <td data-label="Body info">
                        <strong>{measurement(row.weight, "kg")} · {measurement(row.height, "cm")} · Age {row.age ?? "—"}</strong>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {(["front", "back", "side"] as const).map((slot) => row.photo_urls[slot] ? (
                            <a key={slot} className={styles.buttonSecondary} href={row.photo_urls[slot] || "#"} target="_blank" rel="noreferrer">{slot} <ExternalLink size={12} /></a>
                          ) : <span key={slot} className={styles.muted}>{slot} မရှိ</span>)}
                        </div>
                      </td>
                      <td data-label="Status"><span className={styles.status} data-status={row.payment_status}>{row.payment_status.replaceAll("_", " ")}</span></td>
                      <td data-label="လုပ်ဆောင်ရန်">
                        {row.payment_status === "pending" ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <form action={reviewCoachingPayment}><input type="hidden" name="registrationId" value={row.id} /><input type="hidden" name="decision" value="approve" /><button className={styles.button}>Approve</button></form>
                            <form action={reviewCoachingPayment}><input type="hidden" name="registrationId" value={row.id} /><input type="hidden" name="decision" value="reject" /><button className={styles.buttonSecondary}>ပြန်ပြင်ခိုင်းမယ်</button></form>
                          </div>
                        ) : <span className={styles.muted}>{row.payment_status === "approved" ? "Template ဆောက်ရန်" : row.payment_status === "rejected" ? "Client ပြန်ပို့ရန်စောင့်နေသည်" : "ပြီးပါပြီ"}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className={styles.empty}><strong>Client submission မရှိသေးပါ</strong>Client က info၊ body photos နဲ့ payment confirmation ပို့တာနဲ့ ဒီမှာပေါ်ပါမယ်။</div>}
      </section>
    </>
  );
}
