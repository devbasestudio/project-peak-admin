"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { updateProgramStatus } from "@/app/admin-actions";
import styles from "./admin.module.css";

type ProgramStatus = "active" | "paused" | "completed";
export function ProgramStatusControl({ programId, initialStatus }: { programId: string; initialStatus: ProgramStatus }) {
  const [status, setStatus] = useState(initialStatus); const [pending, startTransition] = useTransition();
  return <div className={styles.reviewForm}><select aria-label="Program access" className={styles.select} disabled={pending} value={status} onChange={(event) => { const next = event.target.value as ProgramStatus; setStatus(next); startTransition(async () => { await updateProgramStatus(programId, next, "mm"); }); }}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select>{pending ? <LoaderCircle className="animate-spin" size={14} /> : null}</div>;
}
