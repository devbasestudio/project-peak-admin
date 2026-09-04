import { ExternalLink } from "lucide-react";
import { AdminSearch } from "@/components/admin/admin-search";
import { PaymentReview } from "@/components/admin/payment-review";
import styles from "@/components/admin/admin.module.css";
import { getAdminPayments } from "@/lib/data";
import { matchesSearch } from "@/lib/search";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ orders, versions }, query] = await Promise.all([getAdminPayments(), searchParams]);
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const pending = orders.filter((order) => ["awaiting_payment", "submitted"].includes(order.status)).length;
  const visibleOrders = orders.filter((order) => matchesSearch(search, [
    order.customerName,
    order.reference_code,
    order.customer_note,
    order.status.replaceAll("_", " "),
    order.currency,
    order.amount_minor,
  ]));

  return <>
    <div className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{pending} ခု စစ်ဆေးဖို့ကျန်</p>
        <h1 className={styles.pageTitle}>ငွေပေးချေမှု စစ်မယ်</h1>
        <p className={styles.pageDescription}>Customer ပို့ထားတဲ့ KBZPay အချက်အလက်နဲ့ reference code ကိုတိုက်ပြီး မှန်ရင် Approve နှိပ်ပါ။ Approve လုပ်တာနဲ့ 12-week program ကို အလိုအလျောက်ပေးပါမယ်။</p>
      </div>
    </div>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><h2>Payment အားလုံး</h2><span className={styles.muted}>{orders.length} ခု · {pending} ခု open</span></div>
      <AdminSearch
        clearHref="/home-workout/payments"
        defaultValue={search}
        placeholder="နာမည်၊ reference code၊ status နဲ့ရှာမယ်"
        resultText={search ? `${visibleOrders.length} ခု တွေ့ပါတယ်` : `${orders.length} ခုလုံး ပြထားပါတယ်`}
      />
      {visibleOrders.length ? <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Customer</th><th>Order</th><th>Amount</th><th>Receipt</th><th>Status</th><th>လုပ်ဆောင်ရန်</th></tr></thead>
          <tbody>{visibleOrders.map((order) => <tr key={order.id}>
            <td data-label="Customer"><strong>{order.customerName}</strong><small>{order.customer_note || "မှတ်ချက်မရှိ"}</small></td>
            <td data-label="Order"><strong className="mono">{order.reference_code}</strong><small>{new Date(order.submitted_at || order.created_at).toLocaleString("en-GB")}</small></td>
            <td className="mono" data-label="Amount">{Number(order.amount_minor).toLocaleString()} {order.currency}</td>
            <td data-label="Receipt">{order.proofUrl ? <a className={styles.buttonSecondary} href={order.proofUrl} target="_blank" rel="noreferrer">ပုံကြည့်မယ် <ExternalLink size={13} /></a> : <span className={styles.muted}>မတင်ရသေး</span>}</td>
            <td data-label="Status"><span className={styles.status} data-status={order.status}>{order.status.replaceAll("_", " ")}</span></td>
            <td data-label="လုပ်ဆောင်ရန်">{["awaiting_payment", "submitted"].includes(order.status) ? <PaymentReview orderId={order.id} versions={versions} /> : <span className={styles.muted}>{order.status === "approved" ? "Program ပေးပြီး" : order.status === "rejected" ? "Reference အသစ်စောင့်နေသည်" : "ပိတ်ပြီး"}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className={styles.empty}><strong>{search ? "ရှာမတွေ့ပါ" : "Payment မရှိသေးပါ"}</strong>{search ? "နာမည်၊ reference code ဒါမှမဟုတ် status ကို ပြန်စစ်ကြည့်ပါ။" : "Customer ဝယ်ယူမှုတွေ ဒီမှာပေါ်ပါမယ်။"}</div>}
    </section>
  </>;
}
