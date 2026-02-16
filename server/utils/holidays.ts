import Holidays from "date-holidays";

function ymd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseYmd(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y!, m! - 1, d);
}

/**
 * Public holidays for Hamburg, Germany (DE-HH) in [from..to] inclusive.
 * Returns normalized local YYYY-MM-DD strings.
 */
export function hamburgPublicHolidaysInRange(from: string, to: string): Set<string> {
    const hd = new Holidays("DE", "HH"); // Germany, Hamburg

    const start = parseYmd(from);
    const end = parseYmd(to);

    const years = new Set<number>();
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);

    const out = new Set<string>();

    for (const y of years) {
        const list = hd.getHolidays(y) || [];
        for (const h of list) {
            if (h.type !== "public") continue;

            // h.date is ISO-like, normalize to YYYY-MM-DD
            const dateStr = String(h.date).slice(0, 10);
            if (dateStr >= from && dateStr <= to) out.add(dateStr);
        }
    }

    return out;
}
