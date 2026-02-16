import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";
import { hamburgPublicHolidaysInRange } from "../utils/holidays";

function parseYmd(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y!, m! - 1, d);
}
function ymd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** week_start is a DATE at Monday 00:00 (per date_trunc('week')) */
function weekRangeFromMonday(weekStartYmd: string) {
    const start = parseYmd(weekStartYmd);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
}

/**
 * Weekly targets distributed across configured workdays (Mon..).
 * Example: 40h/week, 5 workdays => [8h,8h,8h,8h,8h,0,0] (minutes).
 */
function distributedWeeklyTargets(weeklyMinutes: number, workdays: number) {
    const wd = Math.min(7, Math.max(1, Math.floor(workdays)));
    const week = Math.max(0, Math.floor(weeklyMinutes));

    const base = Math.floor(week / wd);
    const remainder = week - base * wd;

    return Array.from({ length: 7 }, (_, i) => {
        if (i >= wd) return 0;
        if (i === wd - 1) return base + remainder;
        return base;
    });
}

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    // Current user settings (informational only)
    const u = await pool.query(
        `select baseline_weekly_minutes, baseline_daily_minutes, workdays_per_week
     from app_users where id = $1`,
        [userId]
    );

    if (!u.rowCount) {
        throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    const baselineWeeklyMinutes = Number(u.rows[0].baseline_weekly_minutes) || 0;
    const baselineDailyMinutes = Number(u.rows[0].baseline_daily_minutes) || 0;

    // Aggregate worked minutes per week + snapshot weekly baseline/workdays from earliest entry that week
    const r = await pool.query(
        `
    WITH entry_minutes AS (
      SELECT
        work_date,
        date_trunc('week', work_date::timestamp)::date AS week_start,
        start_time,
        greatest(
          0,
          (extract(epoch FROM (end_time - start_time)) / 60)::int
            - coalesce(break_minutes, 0)
        ) AS minutes,
        baseline_weekly_minutes_at_time,
        workdays_per_week_at_time
      FROM work_entries
      WHERE user_id = $1
        AND end_time IS NOT NULL
    ),
    per_week AS (
      SELECT
        week_start,
        sum(minutes)::int AS week_minutes,
        (array_agg(baseline_weekly_minutes_at_time ORDER BY work_date ASC, start_time ASC))[1]::int AS week_baseline,
        (array_agg(workdays_per_week_at_time ORDER BY work_date ASC, start_time ASC))[1]::int AS week_workdays
      FROM entry_minutes
      GROUP BY week_start
    )
    SELECT
      coalesce((SELECT sum(week_minutes) FROM per_week), 0)::int AS total_worked_minutes,
      coalesce((SELECT count(*) FROM per_week), 0)::int AS weeks_count,
      coalesce((SELECT count(DISTINCT work_date) FROM entry_minutes), 0)::int AS days_count,
      coalesce(json_agg(per_week ORDER BY week_start ASC), '[]'::json) AS weeks
    FROM per_week;
    `,
        [userId]
    );

    const row = r.rows[0];

    type WeekRow = { week_start: string; week_minutes: number; week_baseline: number; week_workdays: number };
    const weeks: WeekRow[] = Array.isArray(row.weeks) ? row.weeks : [];

    let overtimeTotal = 0;

    for (const w of weeks) {
        const weekStart = String(w.week_start).slice(0, 10);
        const { from, to } = weekRangeFromMonday(weekStart);
        const holidaySet = hamburgPublicHolidaysInRange(from, to);

        const baseline = Number(w.week_baseline) || 0;
        const wd = Number(w.week_workdays) || 5;
        const wdClamped = Math.min(7, Math.max(1, Math.floor(wd)));

        const targetsByDow = distributedWeeklyTargets(baseline, wdClamped);

        // Paid holiday credit: holiday on an expected workday (Mon..workdays) credits that day's target minutes
        const start = parseYmd(weekStart);
        let credit = 0;

        for (let i = 0; i < 7; i++) {
            if (i >= wdClamped) break; // only expected workdays
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dayKey = ymd(d);

            if (holidaySet.has(dayKey)) {
                credit += targetsByDow[i] ?? 0;
            }
        }

        const worked = Number(w.week_minutes) || 0;

        // Expected week stays baseline; holiday counts as work time via credit
        overtimeTotal += (worked + credit) - baseline;
    }

    return {
        ok: true,
        stats: {
            baseline_weekly_minutes: baselineWeeklyMinutes,
            baseline_daily_minutes: baselineDailyMinutes,

            overtime_total_minutes: overtimeTotal,
            overtime_weekly_minutes: overtimeTotal,

            total_worked_minutes: Number(row.total_worked_minutes),
            weeks_count: Number(row.weeks_count),
            days_count: Number(row.days_count),
        },
    };
});
