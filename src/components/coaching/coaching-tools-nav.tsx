import Link from "next/link";
import styles from "./coaching-tools-nav.module.css";

const groups = {
  clients: [
    { href: "/coaching/clients", label: "Client List" },
    { href: "/coaching/payments", label: "Payment Approval" },
  ],
  plans: [
    { href: "/coaching/workouts", label: "Workout" },
    { href: "/coaching/meals", label: "Meals" },
    { href: "/coaching/templates", label: "Client Template" },
  ],
} as const;

export function CoachingToolsNav({ group, active }: { group: keyof typeof groups; active: string }) {
  return <nav className={styles.nav} aria-label={group === "clients" ? "Client tools" : "Plan tools"}>
    <span>{group === "clients" ? "CLIENT TOOLS" : "PLAN TOOLS"}</span>
    <div>{groups[group].map((item) => <Link key={item.href} href={item.href} data-active={item.href === active}>{item.label}</Link>)}</div>
  </nav>;
}
