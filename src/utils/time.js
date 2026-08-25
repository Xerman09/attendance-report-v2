import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

// ---------- Formatting helpers ----------
export const fmtDate = (d) => d ? dayjs(d).format('M/D/YYYY') : '';
export const fmtTime = (d) => d ? dayjs(d).format('h:mma') : '';

export const minutesToHHMM = (mins) => {
  const h = Math.floor((mins || 0) / 60);
  const m = Math.max(0, (mins || 0) % 60);
  return `${h}h ${m}m`;
};
export const minutesPrettyWithTotal = (mins) => `${minutesToHHMM(mins || 0)} (total mins ${mins || 0})`;

// ---------- Internal helpers ----------
function safeTime(t){
  // Accepts 'HH:mm' or 'HH:mm:ss' and normalizes to 'HH:mm:ss'
  if(!t) return '08:00:00';
  const parts = String(t).split(':');
  if(parts.length === 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:00`;
  if(parts.length >= 3) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}:${parts[2].padStart(2,'0')}`;
  return '08:00:00';
}
function safeEnd(t){
  const norm = safeTime(t);
  return norm;
}

// When no time_out is present, decide what to display in the table
export function displayTimeOutWhenMissing({ log_date, expectedStart }){
  // Keep UI minimal: show '—' when missing
  return '—';
}

/**
 * Compute daily status and time metrics.
 * Business rules:
 * - If no time_in: Absent.
 * - If time_in exists but no time_out: show total 240 min placeholder and evaluate status using grace.
 * - 5-minute grace after work start for lateness.
 * - Overtime counts any time after expectedEnd, deducting scheduled lunch if it overlaps.
 */
export function computeStatus({ time_in, time_out, expectedStart, expectedEnd, lunchStart, lunchEnd, gracePeriod = 5 }){
  expectedStart = safeTime(expectedStart);
  expectedEnd   = safeEnd(expectedEnd);

  // No time-in at all
  if(!time_in){
    return { totalMinutes: 0, lateMinutes: 0, overtimeMinutes: 0, status: 'Absent' };
  }

  // Missing timeout case
  if(time_in && !time_out){
    const lateRaw = computeLateMinutes(time_in, expectedStart);
    const late = Math.max(0, lateRaw - gracePeriod);
    const status = late > 0 ? 'Late' : 'On Time';
    return { totalMinutes: 240, lateMinutes: late, overtimeMinutes: 0, status };
  }

  // Normal attendance
  let inTime  = dayjs(time_in);
  let outTime = dayjs(time_out);

  if (outTime.isBefore(inTime)) {
    outTime = outTime.add(1, 'day');
  }

  const total = Math.max(0, outTime.diff(inTime,'minute'));
  const lateRaw  = computeLateMinutes(time_in, expectedStart);
  
  let endSched = dayjs(inTime.format('YYYY-MM-DD') + 'T' + expectedEnd);
  if (expectedEnd < expectedStart) {
    endSched = endSched.add(1, 'day');
  }

  const overtimeRaw = Math.max(0, outTime.diff(endSched,'minute'));
  
  let lunchDeduct = 0;
  if (lunchStart && lunchEnd && overtimeRaw > 0) {
    let lStart = dayjs(inTime.format('YYYY-MM-DD') + 'T' + safeTime(lunchStart));
    let lEnd = dayjs(inTime.format('YYYY-MM-DD') + 'T' + safeTime(lunchEnd));
    
    // Handle overnight lunch shifts if any
    if (safeTime(lunchEnd) < safeTime(lunchStart)) {
      lEnd = lEnd.add(1, 'day');
    }
    if (safeTime(lunchStart) < safeTime(expectedStart)) {
      lStart = lStart.add(1, 'day');
      lEnd = lEnd.add(1, 'day');
    }

    if (lEnd.isAfter(endSched)) {
       const overlapStart = lStart.isAfter(endSched) ? lStart : endSched;
       const overlapEnd = outTime.isBefore(lEnd) ? outTime : lEnd;
       if (overlapEnd.isAfter(overlapStart)) {
         lunchDeduct = overlapEnd.diff(overlapStart, 'minute');
       }
    }
  }

  const overtime = Math.max(0, overtimeRaw - lunchDeduct);

  // Grace period
  const late = Math.max(0, lateRaw - gracePeriod);

  let status = 'On Time';
  if(late > 0) status = 'Late';
  if(overtime > 0) status = 'Overtime';

  return { totalMinutes: total, lateMinutes: late, overtimeMinutes: overtime, status };
}

/**
 * Compute lateness: minutes difference if time_in is after expectedStart.
 * If before or equal, returns 0.
 */
function computeLateMinutes(time_in, expectedStart){
  try {
    const inT = dayjs(time_in);
    const sched = dayjs(inT.format('YYYY-MM-DD') + 'T' + expectedStart);
    const diff = inT.diff(sched,'minute');
    return diff > 0 ? diff : 0;
  } catch(e){
    return 0;
  }
}

/**
 * Compute daily late minutes combined:
 * 1) Late on time-in (beyond grace) relative to expectedStart.
 * 2) Late return from lunch: actual lunch_end later than scheduled lunchEnd.
 * All diffs are clamped to >= 0.
 * @param {Object} p
 * @param {string|null} p.time_in - ISO datetime of actual time in
 * @param {string|null} p.lunch_end - ISO datetime of actual lunch end (nullable)
 * @param {string} p.expectedStart - 'HH:mm:ss' scheduled work start
 * @param {string|null} p.lunchEnd - 'HH:mm:ss' scheduled lunch end (nullable)
 * @param {number} [p.grace=5] - grace minutes for time-in late
 * @returns {number} total late minutes
 */
export function computeDailyLate({ time_in, lunch_end, expectedStart, lunchEnd, grace = 5 }){
  try {
    const baseLate = Math.max(0, computeLateMinutes(time_in, expectedStart) - grace);
    let lunchLate = 0;
    if (lunch_end && lunchEnd) {
      const lunchActual = dayjs(lunch_end);
      const lunchSched  = dayjs(lunchActual.format('YYYY-MM-DD') + 'T' + lunchEnd);
      const diff = lunchActual.diff(lunchSched, 'minute');
      lunchLate = diff > 0 ? diff : 0;
    }
    return baseLate + lunchLate;
  } catch(e){
    return 0;
  }
}

