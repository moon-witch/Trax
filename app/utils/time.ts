import type { Entry } from "@/types/entry";

export function hhmm(t: string | null): string {
  if (!t) return "";
  return String(t).slice(0, 5);
}

export function toMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function workedMinutes(e: Entry): number {
  const s = toMinutes(hhmm(e.start_time));
  const enStr = hhmm(e.end_time);
  if (!enStr) return 0;
  const en = toMinutes(enStr);
  return Math.max(0, en - s - (e.break_minutes || 0));
}

export function formatMinutes(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}