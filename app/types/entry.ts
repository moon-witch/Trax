export type Entry = {
  id: string
  work_date: string // YYYY-MM-DD
  start_time: string // HH:MM:SS
  end_time: string | null
  break_minutes: number
  note: string | null
  baseline_daily_minutes_at_time?: number
  baseline_weekly_minutes_at_time?: number
  workdays_per_week_at_time?: number
}

export type EntryForm = {
  id?: string
  work_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  break_minutes: number
  note: string | null
}

export type Stats = {
  baseline_weekly_minutes?: number
  baseline_daily_minutes?: number
  overtime_total_minutes?: number
  overtime_daily_minutes?: number
  overtime_weekly_minutes?: number
  total_worked_minutes: number
  weeks_count: number
  days_count: number
}