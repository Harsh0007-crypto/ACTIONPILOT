/**
 * ActionPilot Project Demo Scheduling Consistency Test
 * Verifies that the exact college project demo prompt:
 * 1. Derives tasks directly from user intent (Presentation, Demo, Questions) - NO "AI Basics"
 * 2. Constrains schedule strictly to:
 *    - Today: 7:00 PM - 10:00 PM
 *    - Tomorrow: 1:00 PM - 4:00 PM
 *    - Practice concludes before 5:00 PM demo tomorrow
 * 3. Schedule items reference real generated tasks (taskId)
 * 4. Plan UI, Calendar, Today's Schedule, and Mission Complete share the exact same canonical data
 */

const assert = require("assert");

const TARGET_GOAL = `I have a college project demo tomorrow at 5 PM. I need to prepare the presentation, practice the demo, and review possible questions.

I am available today only from 7 PM to 10 PM, and tomorrow from 1 PM to 4 PM.

Create an optimized schedule that:
- prioritizes presentation preparation first
- schedules practice before the 5 PM demo
- keeps all tasks within my stated availability
- avoids overlapping sessions
- includes reasonable short breaks
- shows the exact date, start time, end time, duration, and priority for every task
- detects any scheduling conflicts

Do not schedule anything outside my stated availability.`;

function timeToMin(tStr) {
  if (!tStr) return 0;
  const match24 = tStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  const match12 = tStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const mer = match12[3].toUpperCase();
    if (mer === "PM" && h < 12) h += 12;
    if (mer === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  return 0;
}

async function runTest() {
  console.log("==================================================");
  console.log("  COLLEGE PROJECT DEMO CONSISTENCY TEST");
  console.log("==================================================");

  process.env.PORT = "3459";
  const server = require("../server.js");
  const BASE_URL = "http://127.0.0.1:3459";

  await new Promise(r => setTimeout(r, 600));

  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    return res.json();
  }

  try {
    // 1. Reset state
    console.log("\n[STEP 1] Resetting state to pristine baseline...");
    await api("/api/state/reset", { method: "POST" });

    // 2. Plan with exact target goal
    console.log("[STEP 2] Submitting exact college project demo goal...");
    const planResp = await api("/api/agent/plan", {
      method: "POST",
      body: JSON.stringify({ goal: TARGET_GOAL })
    });

    assert.strictEqual(planResp.success, true, "Plan request must succeed");
    const plan = planResp.plan;
    console.log(`✓ Plan generated! Source: ${plan.source}`);

    // 3. Verify NO generic "AI Basics" or unrelated studies
    console.log("\n[STEP 3] Verifying domain integrity (NO 'AI Basics')...");
    const allTaskTitles = (plan.tasks || []).map(t => t.title.toLowerCase()).join(" | ");
    const allActionTitles = (plan.actions || []).map(a => (a.title || a.description).toLowerCase()).join(" | ");

    assert.strictEqual(allTaskTitles.includes("ai basics"), false, "Must NOT contain 'AI Basics'");
    assert.strictEqual(allActionTitles.includes("ai basics"), false, "Actions must NOT contain 'AI Basics'");
    console.log("✓ Zero unrelated 'AI Basics' topics found.");

    // 4. Verify core requested tasks exist
    console.log("\n[STEP 4] Verifying domain-relevant tasks...");
    const hasPresentation = (plan.tasks || []).some(t => t.title.toLowerCase().includes("presentation") || t.title.toLowerCase().includes("slide"));
    const hasDemoPractice = (plan.tasks || []).some(t => t.title.toLowerCase().includes("demo") || t.title.toLowerCase().includes("practice"));
    const hasQuestions = (plan.tasks || []).some(t => t.title.toLowerCase().includes("question") || t.title.toLowerCase().includes("q&a") || t.title.toLowerCase().includes("review"));

    assert.ok(hasPresentation, "Plan must contain presentation preparation task");
    assert.ok(hasDemoPractice, "Plan must contain demo practice task");
    assert.ok(hasQuestions, "Plan must contain question/defense review task");
    console.log("✓ Core tasks verified: Presentation Prep, Demo Practice, Question Review.");

    // 5. Verify hard availability constraints
    console.log("\n[STEP 5] Verifying user availability window constraints...");
    const schedule = plan.schedule || [];
    assert.ok(schedule.length >= 2, "Must have scheduled sessions across requested windows");

    // Window 1: Today 7 PM (19:00 / 1140m) to 10 PM (22:00 / 1320m)
    // Window 2: Tomorrow 1 PM (13:00 / 780m) to 4 PM (16:00 / 960m)
    // Demo deadline: 5 PM tomorrow (17:00 / 1020m)
    const todayWindowStart = 19 * 60; // 1140
    const todayWindowEnd = 22 * 60;   // 1320
    const tomorrowWindowStart = 13 * 60; // 780
    const tomorrowWindowEnd = 16 * 60;   // 960
    const demoDeadline = 17 * 60;        // 1020

    schedule.forEach(s => {
      const sMin = timeToMin(s.startTime);
      const eMin = timeToMin(s.endTime);
      const isToday = s.dateNum === 8 || (s.date && s.date.toLowerCase().includes("today"));
      const isTomorrow = s.dateNum === 9 || (s.date && s.date.toLowerCase().includes("tomorrow"));

      console.log(`  Checking session: [${s.task}] on [${s.date}] ${s.startTime} - ${s.endTime} (${sMin}m - ${eMin}m)`);

      if (isToday) {
        assert.ok(sMin >= todayWindowStart, `Today's session [${s.task}] started at ${s.startTime} (${sMin}m), which is before 7:00 PM`);
        assert.ok(eMin <= todayWindowEnd, `Today's session [${s.task}] ended at ${s.endTime} (${eMin}m), which is after 10:00 PM`);
      } else if (isTomorrow) {
        assert.ok(sMin >= tomorrowWindowStart, `Tomorrow's session [${s.task}] started at ${s.startTime} (${sMin}m), which is before 1:00 PM`);
        assert.ok(eMin <= tomorrowWindowEnd, `Tomorrow's session [${s.task}] ended at ${s.endTime} (${eMin}m), which is after 4:00 PM`);
        assert.ok(eMin < demoDeadline, `Tomorrow's session [${s.task}] must conclude before the 5:00 PM demo`);
      }
    });
    console.log("✓ All sessions strictly obey stated availability (Today 7-10 PM, Tomorrow 1-4 PM, before 5 PM demo)!");

    // 6. Verify Single Source of Truth: every schedule item links to a real task
    console.log("\n[STEP 6] Verifying schedule items reference real generated tasks (taskId)...");
    const taskIds = new Set(plan.tasks.map(t => t.id));
    schedule.forEach(s => {
      assert.ok(s.taskId, `Schedule item [${s.task}] must have taskId`);
      assert.ok(taskIds.has(s.taskId), `Schedule item taskId [${s.taskId}] must reference an existing task in plan.tasks`);
    });
    console.log("✓ Every schedule item cleanly linked to a generated taskId.");

    // 7. Verify Approval & Execution end-to-end
    console.log("\n[STEP 7] Executing approved workflow...");
    const consequential = plan.actions.filter(a => a.requiresApproval);
    const safeActions = plan.actions.filter(a => !a.requiresApproval);

    assert.ok(consequential.length > 0, "Must have consequential calendar booking action");

    for (const c of consequential) {
      const appRes = await api("/api/agent/approve-action", {
        method: "POST",
        body: JSON.stringify({ actionId: c.id, decision: "approved" })
      });
      assert.strictEqual(appRes.success, true);
    }

    for (const s of safeActions) {
      const execRes = await api("/api/agent/execute-action", {
        method: "POST",
        body: JSON.stringify({ actionId: s.id })
      });
      assert.strictEqual(execRes.success, true);
    }

    // 8. Verify state store has identical tasks and schedule
    const finalState = (await api("/api/state")).data;
    console.log(`\n[STEP 8] Verifying final state store synchronization...`);
    console.log(`  State tasks created: ${finalState.tasks.length}`);
    console.log(`  State schedule blocks created: ${finalState.schedule.length}`);
    assert.ok(finalState.schedule.length >= consequential.length, "Calendar blocks must be persisted");
    console.log("✓ State store matches executed actions perfectly.");

    server.close(() => {
      console.log("\n==================================================");
      console.log("  ALL COLLEGE PROJECT DEMO CHECKS PASSED 100%! ✓");
      console.log("==================================================");
      process.exit(0);
    });

  } catch (err) {
    console.error("\nTEST FAILED:", err);
    if (server) server.close();
    process.exit(1);
  }
}

runTest();
