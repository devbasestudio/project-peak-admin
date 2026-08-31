"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { reviewPaymentOrder } from "@/app/admin-actions";
import styles from "./admin.module.css";

type VersionOption = { id: string; label: string };
export function PaymentReview({ orderId, versions }: { orderId: string; versions: VersionOption[] }) {
  const [versionId, setVersionId] = useState(versions[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function review(decision: "approve" | "reject") {
    if (decision === "reject" && !window.confirm("ဒီ payment ကို Reject လုပ်မှာ သေချာပါသလား?")) return;
    setMessage(""); startTransition(async () => { const result = await reviewPaymentOrder(orderId, decision, decision === "approve" && versionId ? versionId : null, "", "mm"); setMessage(result.message); });
  }
  return <div><div className={styles.reviewForm}><select aria-label="Program version" className={styles.select} disabled={pending || !versions.length} onChange={(event) => setVersionId(event.target.value)} value={versionId}>{versions.length ? versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>) : <option value="">Default program</option>}</select><button className={styles.button} disabled={pending} onClick={() => review("approve")} type="button">{pending ? <LoaderCircle className="animate-spin" size={13} /> : <Check size={13} />}Approve</button><button className={styles.buttonDanger} disabled={pending} onClick={() => review("reject")} type="button"><X size={13} />Reject</button></div>{message ? <small className={styles.muted}>{message}</small> : null}</div>;
}
