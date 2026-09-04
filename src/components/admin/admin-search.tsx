import Link from "next/link";
import { Search, X } from "lucide-react";
import styles from "./admin.module.css";

export function AdminSearch({
  defaultValue,
  placeholder,
  clearHref,
  resultText,
}: {
  defaultValue: string;
  placeholder: string;
  clearHref: string;
  resultText: string;
}) {
  return (
    <form className={styles.searchBar} method="get" role="search">
      <label className={styles.searchField}>
        <Search aria-hidden="true" size={17} />
        <input
          aria-label={placeholder}
          autoComplete="off"
          defaultValue={defaultValue}
          name="q"
          placeholder={placeholder}
          type="search"
        />
      </label>
      <button className={styles.searchButton} type="submit">ရှာမယ်</button>
      {defaultValue ? <Link className={styles.searchClear} href={clearHref}><X size={15} />အားလုံးပြမယ်</Link> : null}
      <span aria-live="polite" className={styles.searchResult}>{resultText}</span>
    </form>
  );
}
