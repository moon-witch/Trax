
import { pool } from "../utils/db";
import { requireUserId } from "../utils/auth";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);

    // Pull baseline (weekly) + workdays for this user
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
    const workdaysPerWeek = Number(u.rows[0].workdays_per_week) || 5;

    /**
     * Overtime = total_worked − (number_of_days_worked × daily_baseline)
     *
     * This gives a single signed number:
     *   positive = you've worked more than expected overall
     *   negative = you've worked less than expected overall
     *
     * Using per-entry baseline snapshots so historical changes are respected.
     */
    const r = await pool.query(
        `
    WITH entry_minutes AS (
      SELECT
        work_date,
        greatest(
          0,
          (extract(epoch FROM (end_time - start_time)) / 60)::int
            - coalesce(break_minutes, 0)
        ) AS minutes,
        baseline_daily_minutes_at_time
      FROM work_entries
      WHERE user_id = $1
        AND end_time IS NOT NULL
    ),
    per_day AS (
      SELECT
        work_date,
        sum(minutes)::int AS day_minutes,
        -- use the baseline snapshot from the earliest entry that day
        (array_agg(baseline_daily_minutes_at_time ORDER BY work_date))[1] AS day_baseline
      FROM entry_minutes
      GROUP BY work_date
    )
    SELECT
      coalesce(sum(day_minutes), 0)::int                          AS total_worked_minutes,
      coalesce(sum(day_minutes - day_baseline), 0)::int           AS overtime_total_minutes,
      count(*)::int                                                AS days_count,
      count(DISTINCT date_trunc('week', work_date::timestamp))::int AS weeks_count
    FROM per_day
        `,
        [userId]
    );

    const row = r.rows[0];

    return {
        ok: true,
        stats: {
            baseline_weekly_minutes: baselineWeeklyMinutes,
            baseline_daily_minutes: baselineDailyMinutes,

            overtime_total_minutes: Number(row.overtime_total_minutes),

            total_worked_minutes: Number(row.total_worked_minutes),
            weeks_count: Number(row.weeks_count),
            days_count: Number(row.days_count),
        },
    };
});