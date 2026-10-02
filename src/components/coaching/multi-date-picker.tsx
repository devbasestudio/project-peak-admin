"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./content-managers.module.css";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: string) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(value: Date, amount: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parseDate(value));
}

export function MultiDatePicker({
  selectedDates,
  onChange,
  disabledDates = [],
  initialDate,
}: {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
  disabledDates?: string[];
  initialDate: string;
}) {
  const [month, setMonth] = useState(() => monthStart(initialDate));
  const selected = useMemo(() => new Set(selectedDates), [selectedDates]);
  const disabled = useMemo(() => new Set(disabledDates), [disabledDates]);
  const selectionLimitReached = selectedDates.length >= 31;

  const days = useMemo(() => {
    const mondayOffset = (month.getUTCDay() + 6) % 7;
    const first = new Date(month);
    first.setUTCDate(1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setUTCDate(first.getUTCDate() + index);
      return date;
    });
  }, [month]);

  function toggle(value: string) {
    if (disabled.has(value)) return;
    const next = selected.has(value) ? selectedDates.filter((date) => date !== value) : [...selectedDates, value];
    onChange([...new Set(next)].sort());
  }

  return (
    <div className={styles.multiDatePicker}>
      <div className={styles.calendarHead}>
        <button type="button" aria-label="အရင်လ" onClick={() => setMonth((current) => addMonths(current, -1))}><ChevronLeft size={18}/></button>
        <strong>{new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(month)}</strong>
        <button type="button" aria-label="နောက်လ" onClick={() => setMonth((current) => addMonths(current, 1))}><ChevronRight size={18}/></button>
      </div>
      <div className={styles.calendarGrid}>
        {weekDays.map((day) => <span className={styles.weekDay} key={day}>{day}</span>)}
        {days.map((day) => {
          const value = isoDate(day);
          const outside = day.getUTCMonth() !== month.getUTCMonth();
          const isDisabled = disabled.has(value) || (selectionLimitReached && !selected.has(value));
          return <button
            type="button"
            key={value}
            aria-pressed={selected.has(value)}
            disabled={isDisabled}
            data-outside={outside}
            data-selected={selected.has(value)}
            title={disabled.has(value) ? "Source ရက်ဖြစ်လို့ ထပ်ရွေးစရာမလိုပါ" : selectionLimitReached && !selected.has(value) ? "တစ်ကြိမ်မှာ ၃၁ ရက်အထိရွေးနိုင်ပါတယ်" : value}
            onClick={() => toggle(value)}
          >{day.getUTCDate()}</button>;
        })}
      </div>
      <div className={styles.selectedDates}>
        <span><strong>{selectedDates.length}</strong> ရက်ရွေးထားပါတယ်</span>
        {selectedDates.map((date) => <button type="button" key={date} onClick={() => toggle(date)}>{displayDate(date)} <X size={13}/></button>)}
        {selectedDates.length ? <button type="button" className={styles.clearDates} onClick={() => onChange([])}>အားလုံးဖြုတ်မယ်</button> : null}
      </div>
    </div>
  );
}
