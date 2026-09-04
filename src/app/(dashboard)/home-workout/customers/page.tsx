import { AdminSearch } from "@/components/admin/admin-search";
import styles from "@/components/admin/admin.module.css";
import { ProgramStatusControl } from "@/components/admin/program-status";
import { getAdminCustomers } from "@/lib/data";
import { matchesSearch } from "@/lib/search";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [customers, query] = await Promise.all([getAdminCustomers(), searchParams]);
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const active = customers.filter((customer) => customer.program?.status === "active").length;
  const visibleCustomers = customers.filter((customer) => matchesSearch(search, [
    customer.display_name,
    customer.id,
    customer.preferred_locale,
    customer.order?.reference_code,
    customer.order?.status.replaceAll("_", " "),
    customer.program?.name_mm,
    customer.program?.name_en,
    customer.program?.status,
  ]));

  return <>
    <div className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{customers.length} ယောက်ရှိ · {active} ယောက် Active</p>
        <h1 className={styles.pageTitle}>သင်တန်းသားများ</h1>
        <p className={styles.pageDescription}>Payment၊ program နဲ့ access အခြေအနေကို တစ်တန်းတည်းကြည့်နိုင်ပါတယ်။ လိုအပ်ရင် Active, Paused, Completed ပြောင်းပါ။</p>
      </div>
    </div>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><h2>Customer list</h2><span className={styles.muted}>စုစုပေါင်း {customers.length} ယောက်</span></div>
      <AdminSearch
        clearHref="/home-workout/customers"
        defaultValue={search}
        placeholder="နာမည်၊ reference code၊ program၊ status နဲ့ရှာမယ်"
        resultText={search ? `${visibleCustomers.length} ယောက် တွေ့ပါတယ်` : `${customers.length} ယောက်လုံး ပြထားပါတယ်`}
      />
      {visibleCustomers.length ? <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Customer</th><th>Language</th><th>Payment</th><th>Program</th><th>Access</th></tr></thead>
          <tbody>{visibleCustomers.map((customer) => <tr key={customer.id}>
            <td data-label="Customer"><strong>{customer.display_name || "အမည်မရှိသေး"}</strong><small className="mono">ID · {customer.id.slice(0, 8)}</small></td>
            <td data-label="Language">{customer.preferred_locale === "en" ? "English" : "မြန်မာ"}</td>
            <td data-label="Payment">{customer.order ? <><span className={styles.status} data-status={customer.order.status}>{customer.order.status.replaceAll("_", " ")}</span><small className="mono">{customer.order.reference_code}</small></> : <span className={styles.muted}>Order မရှိ</span>}</td>
            <td data-label="Program">{customer.program ? <><strong>{customer.program.name_en || customer.program.name_mm}</strong><small>{customer.program.assigned_at ? `ပေးထားသည့်ရက် ${new Date(customer.program.assigned_at).toLocaleDateString("en-GB")}` : "ပေးထားပြီး"}</small></> : <span className={styles.muted}>မပေးရသေး</span>}</td>
            <td data-label="Access">{customer.program && ["active", "paused", "completed"].includes(customer.program.status) ? <ProgramStatusControl initialStatus={customer.program.status as "active" | "paused" | "completed"} programId={customer.program.id} /> : <span className={styles.muted}>—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className={styles.empty}><strong>{search ? "ရှာမတွေ့ပါ" : "Customer မရှိသေးပါ"}</strong>{search ? "နာမည်၊ reference code၊ program ဒါမှမဟုတ် status ကို ပြန်စစ်ကြည့်ပါ။" : "Google Login ဝင်တဲ့ customer တွေ ဒီမှာပေါ်ပါမယ်။"}</div>}
    </section>
  </>;
}
