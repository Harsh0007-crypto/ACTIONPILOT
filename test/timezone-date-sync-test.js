/**
 * ActionPilot Timezone & Dynamic Date Synchronization Test Suite
 * Validates:
 * 1. Runtime dynamic derivation of "today" and "tomorrow" in Asia/Kolkata (IST, UTC+05:30).
 * 2. Proper handling of UTC vs IST boundaries (e.g., 01:00 UTC = 06:30 IST on same/next calendar day).
 * 3. Month & Year rollover handling (e.g. Oct 31 -> Nov 1, Dec 31 -> Jan 1).
 * 4. Month Calendar Grid and Week Grid dynamic generation.
 * 5. Synchronization of /api/health, /api/state, and /api/agent/plan dates with zero hardcoded values.
 */

const assert = require("assert");
const {
  DEFAULT_TIMEZONE,
  getZonedDateParts,
  getRelativeDayInfo,
  resolveDateInfo,
  getWeekDays,
  getMonthCalendarGrid
} = require("../lib/dateTimeUtils");
const { extractConstraints, buildConstrainedSchedule, validateAndSynchronizePlan } = require("../lib/scheduleOptimizer");
const { generateFallbackPlan } = require("../lib/fallbackPlanner");

async function runTimezoneTests() {
  console.log("==================================================");
  console.log("  ACTIONPILOT TIMEZONE & DATE SYNCHRONIZATION TESTS");
  console.log("==================================================");

  // -------------------------------------------------------------------------
  // TEST 1: Asia/Kolkata (IST) Midnight Boundary Handling
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing UTC vs IST boundary (e.g., 01:00 UTC = 06:30 IST)...");
  // 2026-10-09 01:00:00 UTC is 2026-10-09 06:30:00 IST
  const earlyUtc = new Date(Date.UTC(2026, 9, 9, 1, 0, 0));
  const istParts = getZonedDateParts(earlyUtc, "Asia/Kolkata");
  assert.strictEqual(istParts.year, 2026);
  assert.strictEqual(istParts.month, 10);
  assert.strictEqual(istParts.day, 9);
  assert.strictEqual(istParts.hour, 6);
  assert.strictEqual(istParts.minute, 30);
  assert.strictEqual(istParts.isoDate, "2026-10-09");
  console.log(`✓ Zoned parts at 01:00 UTC correctly resolve to 06:30 IST on ${istParts.isoDate}`);

  // Test when UTC is late on Oct 8 (20:00 UTC) -> in IST (+5:30) it is Oct 9 01:30 AM!
  const lateOct8Utc = new Date(Date.UTC(2026, 9, 8, 20, 0, 0));
  const rolloverParts = getZonedDateParts(lateOct8Utc, "Asia/Kolkata");
  assert.strictEqual(rolloverParts.day, 9, "20:00 UTC on Oct 8 must be Oct 9 in IST (+05:30)");
  assert.strictEqual(rolloverParts.isoDate, "2026-10-09");
  console.log(`✓ Critical UTC-to-IST rollover verified: Oct 8 20:00 UTC is Oct 9 in IST (day ${rolloverParts.day})`);

  // -------------------------------------------------------------------------
  // TEST 2: Tomorrow is dynamically the next calendar day
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifying today and tomorrow relative day info...");
  const baseDate = new Date();
  const today = getRelativeDayInfo(0, baseDate, "Asia/Kolkata");
  const tomorrow = getRelativeDayInfo(1, baseDate, "Asia/Kolkata");

  console.log(`  Dynamic Today: ${today.dayLabel} (${today.isoDate}) [dateNum: ${today.dateNum}]`);
  console.log(`  Dynamic Tomorrow: ${tomorrow.dayLabel} (${tomorrow.isoDate}) [dateNum: ${tomorrow.dateNum}]`);

  assert.ok(today.dayLabel.startsWith("Today"), "today.dayLabel must start with 'Today'");
  assert.ok(tomorrow.dayLabel.startsWith("Tomorrow"), "tomorrow.dayLabel must start with 'Tomorrow'");
  assert.strictEqual(today.offsetDays, 0);
  assert.strictEqual(tomorrow.offsetDays, 1);

  // Check next calendar day calculation
  const todayDateObj = new Date(today.year, today.month - 1, today.day);
  const expectedTomorrowObj = new Date(today.year, today.month - 1, today.day + 1);
  assert.strictEqual(tomorrow.year, expectedTomorrowObj.getFullYear());
  assert.strictEqual(tomorrow.month, expectedTomorrowObj.getMonth() + 1);
  assert.strictEqual(tomorrow.day, expectedTomorrowObj.getDate());
  console.log(`✓ Tomorrow is verified as the exact sequential calendar day (${tomorrow.isoDate})`);

  // -------------------------------------------------------------------------
  // TEST 3: Month End Rollover (e.g., Oct 31 -> Nov 1)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Testing month boundary rollover (Oct 31 -> Nov 1)...");
  const oct31 = new Date(Date.UTC(2026, 9, 31, 12, 0, 0)); // Oct 31, 2026
  const oct31Info = getRelativeDayInfo(0, oct31, "Asia/Kolkata");
  const nov1Info = getRelativeDayInfo(1, oct31, "Asia/Kolkata");

  assert.strictEqual(oct31Info.month, 10);
  assert.strictEqual(oct31Info.day, 31);
  assert.strictEqual(nov1Info.month, 11, "Tomorrow after Oct 31 must be month 11 (November)");
  assert.strictEqual(nov1Info.day, 1, "Tomorrow after Oct 31 must be day 1");
  assert.strictEqual(nov1Info.isoDate, "2026-11-01");
  console.log(`✓ Month end rollover verified: Oct 31 -> ${nov1Info.dayLabel} (${nov1Info.isoDate})`);

  // -------------------------------------------------------------------------
  // TEST 4: Year End Rollover (e.g., Dec 31 -> Jan 1)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Testing year boundary rollover (Dec 31, 2026 -> Jan 1, 2027)...");
  const dec31 = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));
  const dec31Info = getRelativeDayInfo(0, dec31, "Asia/Kolkata");
  const jan1Info = getRelativeDayInfo(1, dec31, "Asia/Kolkata");

  assert.strictEqual(dec31Info.year, 2026);
  assert.strictEqual(dec31Info.month, 12);
  assert.strictEqual(dec31Info.day, 31);
  assert.strictEqual(jan1Info.year, 2027);
  assert.strictEqual(jan1Info.month, 1);
  assert.strictEqual(jan1Info.day, 1);
  assert.strictEqual(jan1Info.isoDate, "2027-01-01");
  console.log(`✓ Year end rollover verified: Dec 31, 2026 -> ${jan1Info.dayLabel} (${jan1Info.isoDate})`);

  // -------------------------------------------------------------------------
  // TEST 5: resolveDateInfo Dynamic Strings
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing resolveDateInfo string parsing...");
  const resToday = resolveDateInfo("Today", baseDate, "Asia/Kolkata");
  const resTomorrow = resolveDateInfo("Tomorrow", baseDate, "Asia/Kolkata");
  const resDay2 = resolveDateInfo("Day 2", baseDate, "Asia/Kolkata");

  assert.strictEqual(resToday.isoDate, today.isoDate);
  assert.strictEqual(resToday.dateNum, today.dateNum);
  assert.strictEqual(resTomorrow.isoDate, tomorrow.isoDate);
  assert.strictEqual(resTomorrow.dateNum, tomorrow.dateNum);
  assert.strictEqual(resDay2.isoDate, tomorrow.isoDate);
  console.log("✓ 'Today', 'Tomorrow', and 'Day 2' resolve accurately to dynamic dates.");

  // -------------------------------------------------------------------------
  // TEST 6: Week Grid & Month Grid Generation
  // -------------------------------------------------------------------------
  console.log("\n[TEST 6] Testing getWeekDays and getMonthCalendarGrid...");
  const weekDays = getWeekDays(baseDate, "Asia/Kolkata");
  assert.strictEqual(weekDays.length, 7, "Week must have 7 days");
  const todayWeekEntries = weekDays.filter(w => w.isToday);
  assert.strictEqual(todayWeekEntries.length, 1, "Exactly one day in week must be marked isToday");
  assert.strictEqual(todayWeekEntries[0].day, today.day);

  const monthGrid = getMonthCalendarGrid(baseDate, "Asia/Kolkata");
  assert.ok(monthGrid.monthTitle.length > 0);
  assert.ok(monthGrid.days.length >= 28 && monthGrid.days.length <= 31);
  const todayMonthEntry = monthGrid.days.find(d => d.isToday);
  assert.ok(todayMonthEntry, "Month grid must highlight today's day");
  assert.strictEqual(todayMonthEntry.dayNum, today.day);
  console.log(`✓ Month grid (${monthGrid.monthTitle}) and week days dynamically generated with today: day ${today.day}`);

  // -------------------------------------------------------------------------
  // TEST 7: Full Server API Integration
  // -------------------------------------------------------------------------
  console.log("\n[TEST 7] Testing server endpoints with Asia/Kolkata timezone...");
  process.env.PORT = "3461";
  const server = require("../server.js");
  const BASE_URL = "http://127.0.0.1:3461";

  await new Promise(r => setTimeout(r, 600));

  try {
    // 7A: GET /api/health
    const healthRes = await (await fetch(`${BASE_URL}/api/health?timeZone=Asia/Kolkata`)).json();
    assert.strictEqual(healthRes.status, "ok");
    assert.strictEqual(healthRes.timeZone, "Asia/Kolkata");
    assert.strictEqual(healthRes.currentDate, today.isoDate);
    assert.strictEqual(healthRes.currentDayLabel, today.dayLabel);
    console.log(`✓ GET /api/health returned dynamic currentDate: ${healthRes.currentDate} (${healthRes.currentDayLabel})`);

    // 7B: GET /api/state
    const stateRes = await (await fetch(`${BASE_URL}/api/state?timeZone=Asia/Kolkata`)).json();
    assert.strictEqual(stateRes.success, true);
    assert.strictEqual(stateRes.data.timeZone, "Asia/Kolkata");
    assert.strictEqual(stateRes.data.currentDate.isoDate, today.isoDate);
    console.log(`✓ GET /api/state returned dynamic currentDate matching runtime IST.`);

    // 7C: POST /api/agent/plan
    const planGoal = "I have a presentation tomorrow. I can prepare today from 7 PM to 9 PM and tomorrow from 1 PM to 3 PM.";
    const planRes = await (await fetch(`${BASE_URL}/api/agent/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-timezone": "Asia/Kolkata" },
      body: JSON.stringify({ goal: planGoal, timeZone: "Asia/Kolkata" })
    })).json();

    assert.strictEqual(planRes.success, true);
    const plan = planRes.plan;
    assert.ok(Array.isArray(plan.schedule) && plan.schedule.length > 0);

    const todaySession = plan.schedule.find(s => s.dateNum === today.dateNum || (s.date && s.date.includes(today.monthShort + " " + today.dateNum)));
    const tomorrowSession = plan.schedule.find(s => s.dateNum === tomorrow.dateNum || (s.date && s.date.includes(tomorrow.monthShort + " " + tomorrow.dateNum)));

    assert.ok(todaySession, `Plan must have a session on today's date (${today.dayLabel})`);
    assert.ok(tomorrowSession, `Plan must have a session on tomorrow's date (${tomorrow.dayLabel})`);
    assert.strictEqual(todaySession.dateNum, today.dateNum);
    assert.strictEqual(tomorrowSession.dateNum, tomorrow.dateNum);

    console.log(`✓ Plan schedule synchronized with dynamic dates:`);
    console.log(`   - Today session: "${todaySession.task}" on ${todaySession.date} (dateNum: ${todaySession.dateNum})`);
    console.log(`   - Tomorrow session: "${tomorrowSession.task}" on ${tomorrowSession.date} (dateNum: ${tomorrowSession.dateNum})`);

    server.close(() => {
      console.log("\n==================================================");
      console.log("  ALL TIMEZONE & DATE SYNCHRONIZATION CHECKS PASSED! ✓");
      console.log("==================================================");
      process.exit(0);
    });

  } catch (err) {
    if (server) server.close();
    throw err;
  }
}

runTimezoneTests().catch(err => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
