export function localYYYYMMDD(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function formatDisplayDate(dateStr: string) {
    // accepts YYYY-MM-DD
    const [y, m, d] = dateStr.split("-");
    return `${Number(d)}.${Number(m)}.${y}`;
}

export function nowHHMMSS() {
    return new Date().toLocaleTimeString("en-GB", {
        timeZone: "Europe/Berlin",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}