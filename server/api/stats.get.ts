
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
      date_trunc('week', work_date::timestamp)::date AS week_start,
      start_time,
      greatest(
        0,
        (extract(epoch FROM (end_time - start_time)) / 60)::int
          - coalesce(break_minutes, 0)
      ) AS minutes,
      baseline_weekly_minutes_at_time
    FROM work_entries
    WHERE user_id = $1
      AND end_time IS NOT NULL
  ),
  per_week AS (
    SELECT
      week_start,
      sum(minutes)::int AS week_minutes,
      -- baseline snapshot from the earliest entry of that week
      (array_agg(baseline_weekly_minutes_at_time ORDER BY work_date ASC, start_time ASC))[1]::int AS week_baseline
    FROM entry_minutes
    GROUP BY week_start
  )
  SELECT
    coalesce((SELECT sum(week_minutes) FROM per_week), 0)::int AS total_worked_minutes,
    coalesce((SELECT sum(week_minutes - week_baseline) FROM per_week), 0)::int AS overtime_total_minutes,
    coalesce((SELECT sum(week_minutes - week_baseline) FROM per_week), 0)::int AS overtime_weekly_minutes,
    coalesce((SELECT count(*) FROM per_week), 0)::int AS weeks_count,
    coalesce((SELECT count(DISTINCT work_date) FROM entry_minutes), 0)::int AS days_count
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
            overtime_weekly_minutes: Number(row.overtime_weekly_minutes),

            total_worked_minutes: Number(row.total_worked_minutes),
            weeks_count: Number(row.weeks_count),
            days_count: Number(row.days_count),
        },
    };
});