export function parseTimeToMinutes(t: string): number {
    // expects "HH:MM" (from <input type="time">)
    const m = /^(\d{2}):(\d{2})$/.exec(t);
    if (!m) throw createError({ statusCode: 400, statusMessage: "Invalid time format" });
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        throw createError({ statusCode: 400, statusMessage: "Invalid time value" });
    }
    return hh * 60 + mm;
}

export function computeWorkedMinutes(startHHMM: string, endHHMM: string, breakMinutes: number) {
    const start = parseTimeToMinutes(startHHMM);
    const end = parseTimeToMinutes(endHHMM);

    // Simple rule: same-day only
    if (end <= start) {
        throw createError({ statusCode: 400, statusMessage: "end_time must be after start_time" });
    }

    const raw = end - start;
    const worked = raw - breakMinutes;

    if (breakMinutes < 0) {
        throw createError({ statusCode: 400, statusMessage: "break_minutes must be >= 0" });
    }
    if (worked < 0) {
        throw createError({ statusCode: 400, statusMessage: "break_minutes is too large" });
    }

    return { workedMinutes: worked, rawMinutes: raw };
}

export function overtimeMinutes(workedMinutes: number, dailyTargetMinutes = 480) {
    return Math.max(0, workedMinutes - dailyTargetMinutes);
}
