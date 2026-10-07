"use client";
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main style={{ maxWidth: 640, margin: "10vh auto", padding: 24 }} role="alert">
    <h1>ခဏတာ ပြဿနာဖြစ်နေပါတယ်။</h1>
    <p>အချက်အလက်ဖတ်မရသေးပါ။ Connection စစ်ပြီး ပြန်စမ်းပေးပါ။</p>
    {error.digest && <p>Support reference: <code>{error.digest}</code></p>}
    <button type="button" onClick={retry} style={{ minHeight: 48, padding: "12px 24px" }}>ပြန်စမ်းမယ်</button>
  </main>;
}
