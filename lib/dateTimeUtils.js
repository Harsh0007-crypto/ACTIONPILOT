const DEFAULT_TIMEZONE = "Asia/Kolkata";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORTS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function getZonedDateParts(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const d = (typeof date === "string" || typeof date === "number") ? new Date(date) : (date || new Date());
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const partMap = {};
  dtf.formatToParts(d).forEach(p => {
    partMap[p.type] = p.value;
  });

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10); // 1-12
  const day = parseInt(partMap.day, 10);     // 1-31
  const weekday = partMap.weekday;           // 'Fri'
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const monthName = MONTH_NAMES[month - 1];
  const monthShort = MONTH_SHORTS[month - 1];
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    weekday,
    monthName,
    monthShort,
    hour,
    minute,
    second,
    isoDate,
    timeZone: timeZone || DEFAULT_TIMEZONE
  };
}

/**
 * Returns dynamic date info for a day offset from today (0 = Today, 1 = Tomorrow, etc.)
 */
function getRelativeDayInfo(offsetDays = 0, baseDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayParts = getZonedDateParts(baseDate, timeZone);
  // Construct noon UTC Date from zoned year, month, day to add offset days without DST/drift issues
  const targetUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + offsetDays, 12, 0, 0));
  const targetParts = getZonedDateParts(targetUtc, timeZone);

  let dayPrefix = "";
  if (offsetDays === 0) dayPrefix = "Today";
  else if (offsetDays === 1) dayPrefix = "Tomorrow";
  else dayPrefix = `Day ${offsetDays + 1}`;

  return {
    ...targetParts,
    offsetDays,
    dateNum: targetParts.day,
    dayLabel: `${dayPrefix} (${targetParts.monthShort} ${targetParts.day})`,
    dateLabel: `${targetParts.monthShort} ${targetParts.day}, ${targetParts.year}`
  };
}

/**
 * Resolves any date string into dynamic normalized date info
 */
function resolveDateInfo(dateStr, baseDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const today = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrow = getRelativeDayInfo(1, baseDate, timeZone);

  if (dateStr === null || dateStr === undefined) {
    return today;
  }

  // Handle number input (e.g. dateNum passed directly)
  if (typeof dateStr === "number") {
    if (dateStr === today.day) return today;
    if (dateStr === tomorrow.day) return tomorrow;
    return {
      year: today.year,
      month: today.month,
      day: dateStr,
      dateNum: dateStr,
      monthShort: today.monthShort,
      dayLabel: `Day (${today.monthShort} ${dateStr})`,
      isoDate: `${today.year}-${String(today.month).padStart(2, "0")}-${String(dateStr).padStart(2, "0")}`
    };
  }

  if (typeof dateStr !== "string") {
    return today;
  }

  const s = dateStr.trim().toLowerCase();

  // Handle plain numeric string like "9" or "10"
  if (/^\d{1,2}$/.test(s)) {
    const d = parseInt(s, 10);
    if (d === today.day) return today;
    if (d === tomorrow.day) return tomorrow;
    return {
      year: today.year,
      month: today.month,
      day: d,
      dateNum: d,
      monthShort: today.monthShort,
      dayLabel: `Day (${today.monthShort} ${d})`,
      isoDate: `${today.year}-${String(today.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    };
  }

  if (s.includes("today") || s.includes("this evening")) {
    return today;
  }
  if (s.includes("tomorrow")) {
    return tomorrow;
  }

  // Check ISO format YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y === today.year && m === today.month && d === today.day) return today;
    if (y === tomorrow.year && m === tomorrow.month && d === tomorrow.day) return tomorrow;
    const mShort = MONTH_SHORTS[m - 1] || "Oct";
    return {
      year: y,
      month: m,
      day: d,
      dateNum: d,
      monthShort: mShort,
      dayLabel: `Day (${mShort} ${d})`,
      isoDate: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    };
  }

  // Check Month + Day format like "Oct 9", "October 10", "Day 1 (Oct 9)"
  const monthDayMatch = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
  if (monthDayMatch) {
    const d = parseInt(monthDayMatch[2], 10);
    if (d === today.day) return today;
    if (d === tomorrow.day) return tomorrow;
    const mPrefix = monthDayMatch[1].slice(0, 3).toLowerCase();
    const mIdx = MONTH_SHORTS.findIndex(ms => ms.toLowerCase() === mPrefix);
    const m = mIdx >= 0 ? mIdx + 1 : today.month;
    const mShort = MONTH_SHORTS[m - 1];
    return {
      year: today.year,
      month: m,
      day: d,
      dateNum: d,
      monthShort: mShort,
      dayLabel: `Day (${mShort} ${d})`,
      isoDate: `${today.year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    };
  }

  // Day number extraction like "Day 1", "Day 2", "Day 3"
  const dayNumMatch = s.match(/day\s*(\d+)/i);
  if (dayNumMatch) {
    const dayIdx = parseInt(dayNumMatch[1], 10);
    if (dayIdx >= 1) {
      return getRelativeDayInfo(dayIdx - 1, baseDate, timeZone);
    }
  }

  return today;
}

/**
 * Returns the 7 days of the current week (Monday through Sunday) containing baseDate in timeZone
 */
function getWeekDays(baseDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayParts = getZonedDateParts(baseDate, timeZone);
  // Find Monday:
  // weekday is 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  const weekdayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  const currentWeekDayIndex = weekdayMap[todayParts.weekday] !== undefined ? weekdayMap[todayParts.weekday] : 0;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const offsetFromToday = i - currentWeekDayIndex;
    const dayInfo = getRelativeDayInfo(offsetFromToday, baseDate, timeZone);
    const isToday = offsetFromToday === 0;
    days.push({
      ...dayInfo,
      weekIndex: i,
      isToday,
      headerLabel: `${dayInfo.weekday} ${dayInfo.day}${isToday ? " (Today)" : ""}`
    });
  }
  return days;
}

/**
 * Returns month calendar metadata (title, padding cells, days array) for baseDate in timeZone
 */
function getMonthCalendarGrid(baseDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayParts = getZonedDateParts(baseDate, timeZone);
  const year = todayParts.year;
  const month = todayParts.month; // 1-12

  // Total days in current month
  const daysInCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Total days in previous month
  const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  // Day of week of 1st day of current month in timezone
  const firstDayParts = getZonedDateParts(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)), timeZone);
  const weekdayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
  const firstDayWeekIndex = weekdayMap[firstDayParts.weekday] || 0; // Monday=0..Sunday=6

  // Padding cells before 1st of month
  const prevPadding = [];
  for (let p = 0; p < firstDayWeekIndex; p++) {
    prevPadding.push({
      dayNum: daysInPrevMonth - firstDayWeekIndex + 1 + p,
      isOtherMonth: true
    });
  }

  const currentDays = [];
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    currentDays.push({
      dayNum: d,
      isToday: d === todayParts.day,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    });
  }

  return {
    monthTitle: `${todayParts.monthName} ${year}`,
    year,
    month,
    todayDayNum: todayParts.day,
    prevPadding,
    days: currentDays
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  getZonedDateParts,
  getRelativeDayInfo,
  resolveDateInfo,
  getWeekDays,
  getMonthCalendarGrid
};
