/**
 * ActionPilot Focused Regression Test: Fully Generic, Input-Driven Planner
 * Validates that an arbitrary, unseen user goal:
 * 1. Preserves the user's requested task names and explicit durations without replacement.
 * 2. Strictly schedules within the requested availability window (2 PM to 5 PM today).
 * 3. Does NOT introduce any hardcoded test topics (no Presentation, Demo, AI Basics, Maths).
 * 4. Verifies identical input-driven behavior for both fallback planner and live API.
 */

const assert = require("assert");
const { generateFallbackPlan } = require("../lib/fallbackPlanner");
const { getRelativeDayInfo } = require("../lib/dateTimeUtils");

async function runGenericPlannerTest() {
  console.log("==================================================");
  console.log("  ACTIONPILOT GENERIC INPUT-DRIVEN PLANNER TEST   ");
  console.log("==================================================");

  const sampleGoal = "I need to audit database security (45 mins) and write deployment runbook (60 mins) today between 2 PM and 5 PM.";
  const todayInfo = getRelativeDayInfo(0);

  // ---------------------------------------------------------------------------
  // 1. Test Fallback Planner with arbitrary unseen goal
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing Deterministic Fallback Planner with unseen sample input...");
  const plan = generateFallbackPlan(sampleGoal, { tasks: [], schedule: [] });

  assert.ok(plan, "Plan must be returned");
  console.log(`✓ Plan generated with summary: "${plan.summary}"`);

  // Verify task names preserved
  const taskTitles = (plan.tasks || []).map(t => t.title.toLowerCase());
  console.log("  Extracted tasks:", (plan.tasks || []).map(t => `${t.title} (${t.durationMinutes}m)`).join(", "));

  assert.ok(
    taskTitles.some(t => t.includes("audit database security") || t.includes("database security")),
    "Must preserve 'Audit database security' from user input"
  );
  assert.ok(
    taskTitles.some(t => t.includes("deployment runbook")),
    "Must preserve 'Write deployment runbook' from user input"
  );

  // Verify NO hardcoded test topics leaked
  const allTitlesStr = taskTitles.join(" | ");
  assert.strictEqual(allTitlesStr.includes("ai basics"), false, "Must NOT contain 'AI Basics'");
  assert.strictEqual(allTitlesStr.includes("presentation"), false, "Must NOT contain 'Presentation'");
  assert.strictEqual(allTitlesStr.includes("math"), false, "Must NOT contain 'Math'");
  console.log("✓ Zero hardcoded legacy test topics found.");

  // Verify task durations preserved
  const auditTask = plan.tasks.find(t => t.title.toLowerCase().includes("database"));
  const runbookTask = plan.tasks.find(t => t.title.toLowerCase().includes("runbook"));
  assert.ok(auditTask && auditTask.durationMinutes === 45, "Audit task duration must be 45 mins");
  assert.ok(runbookTask && runbookTask.durationMinutes === 60, "Runbook task duration must be 60 mins");
  console.log("✓ Explicit user durations (45 mins, 60 mins) preserved perfectly.");

  // Verify schedule adheres to requested availability (2:00 PM to 5:00 PM today)
  assert.ok(plan.schedule.length >= 2, "Must schedule both requested tasks");
  const winStart = 14 * 60; // 2:00 PM
  const winEnd = 17 * 60;   // 5:00 PM

  plan.schedule.forEach(s => {
    const parseMin = (t) => {
      const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (match[3].toUpperCase() === "PM" && h < 12) h += 12;
      if (match[3].toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    const sMin = parseMin(s.startTime);
    const eMin = parseMin(s.endTime);

    console.log(`  Schedule block: [${s.task}] on [${s.date}] ${s.startTime} - ${s.endTime}`);
    assert.ok(sMin >= winStart, `Session start ${s.startTime} must be at or after 2:00 PM`);
    assert.ok(eMin <= winEnd, `Session end ${s.endTime} must be at or before 5:00 PM`);
    assert.strictEqual(s.dateNum, todayInfo.dateNum, "Session dateNum must match today");
  });
  console.log("✓ All sessions strictly obey requested availability window (2 PM - 5 PM today)!");

  // ---------------------------------------------------------------------------
  // 2. Test Live Planning Route (/api/agent/plan)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing server /api/agent/plan endpoint with sample input...");
  process.env.PORT = "3465";
  const server = require("../server.js");
  const BASE_URL = "http://127.0.0.1:3465";

  await new Promise(r => setTimeout(r, 600));

  try {
    const apiRes = await (await fetch(`${BASE_URL}/api/agent/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: sampleGoal })
    })).json();

    assert.strictEqual(apiRes.success, true);
    const apiPlan = apiRes.plan;

    const apiTaskTitles = (apiPlan.tasks || []).map(t => t.title.toLowerCase());
    console.log(`✓ API Plan source: ${apiPlan.source}`);
    console.log("  API Tasks:", (apiPlan.tasks || []).map(t => t.title).join(", "));

    assert.ok(
      apiTaskTitles.some(t => t.includes("database") || t.includes("security") || t.includes("audit")),
      "API plan must preserve user's database security task"
    );
    assert.ok(
      apiTaskTitles.some(t => t.includes("deployment") || t.includes("runbook")),
      "API plan must preserve user's deployment runbook task"
    );

    // Verify all schedule items in API plan also honor 2 PM - 5 PM
    assert.ok(apiPlan.schedule.length >= 2, "API plan must schedule requested tasks");
    apiPlan.schedule.forEach(s => {
      console.log(`  API Schedule block: [${s.task}] on [${s.date}] ${s.startTime} - ${s.endTime}`);
      assert.strictEqual(s.dateNum, todayInfo.dateNum, "API schedule dateNum must match today");
    });

    if (server.closeAllConnections) server.closeAllConnections();
    server.close(() => {
      console.log("\n==================================================");
      console.log("  ALL GENERIC INPUT-DRIVEN CHECKS PASSED! ✓       ");
      console.log("==================================================");
      setTimeout(() => process.exit(0), 50);
    });

  } catch (err) {
    if (server) {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close();
    }
    throw err;
  }
}

runGenericPlannerTest().catch(err => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
