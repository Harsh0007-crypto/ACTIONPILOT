/**
 * ACTIONPILOT CRITICAL PLANNER PARSING & CONSTRAINT REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Fixed-commitment immutability: College 9 AM to 3 PM cannot be violated or overlapped.
 * 2. Conversational purity: No instruction fragments ("Tomorrow", "Bhai", etc.) become tasks.
 * 3. Schedule conflict detection: Impossible time requests are detected and explained.
 * 4. Fallback resilience: Malformed AI response safely falls back without fabricating tasks.
 * 5. Natural-language editing: Contextual edit ("Move my gym to 7 PM") correctly updates the slot.
 */

const assert = require("assert");
const {
  extractConstraints,
  extractRequestedTasks,
  isValidTaskTitle,
  buildConstrainedSchedule,
  validateAndSynchronizePlan,
  applyScheduleEdit,
  parseTimeToMinutes
} = require("../lib/scheduleOptimizer");
const { generateFallbackPlan } = require("../lib/fallbackPlanner");

async function runRegressionTests() {
  console.log("==================================================================");
  console.log("  ACTIONPILOT PLANNER PURITY & CONSTRAINT REGRESSION SUITE        ");
  console.log("==================================================================");

  // -----------------------------------------------------------------------------
  // TEST 1: College fixed from 9 AM to 3 PM with AI/ML study, project work, gym
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 1] Verifying fixed-commitment immutability (College 9 AM - 3 PM)...");
  const prompt1 = "Tomorrow I have college from 9 AM to 3 PM, which must not change. After that, I need to do 2 hours of AI/ML study, 1 hour of project work, and 1 hour of evening gym.";

  const constraints1 = extractConstraints(prompt1);
  assert.ok(constraints1.fixedCommitments.length >= 1, "Must detect college as a fixed commitment");
  const college = constraints1.fixedCommitments.find(fc => fc.title.toLowerCase().includes("college"));
  assert.ok(college, "Must extract College commitment");
  assert.strictEqual(college.startTime, "9:00 AM");
  assert.strictEqual(college.endTime, "3:00 PM");
  console.log(`  ✓ Detected fixed commitment: ${college.title} (${college.startTime} - ${college.endTime})`);

  const plan1 = generateFallbackPlan(prompt1, { tasks: [], schedule: [] });

  // Verify task names: only real activities
  const taskTitles1 = plan1.tasks.map(t => t.title.toLowerCase());
  console.log(`  Extracted task titles: ${plan1.tasks.map(t => t.title).join(", ")}`);
  assert.ok(!taskTitles1.includes("tomorrow"), "Must NOT create a task named 'Tomorrow'");
  assert.ok(!taskTitles1.includes("bhai"), "Must NOT create a task named 'Bhai'");
  assert.ok(!taskTitles1.includes("after that"), "Must NOT create a task named 'After that'");
  assert.ok(taskTitles1.some(t => t.includes("ai/ml") || t.includes("study")), "Must contain AI/ML study task");
  assert.ok(taskTitles1.some(t => t.includes("project")), "Must contain Project work task");
  assert.ok(taskTitles1.some(t => t.includes("gym")), "Must contain Gym task");

  // Verify schedule: NO task scheduled during 9 AM - 3 PM!
  const userSessions1 = plan1.schedule.filter(s => !s.isFixed);
  userSessions1.forEach(s => {
    const sMin = parseTimeToMinutes(s.startTime);
    const eMin = parseTimeToMinutes(s.endTime);
    const overlapsCollege = sMin < 15 * 60 && eMin > 9 * 60;
    assert.strictEqual(overlapsCollege, false, `Task '${s.task}' (${s.startTime} - ${s.endTime}) MUST NOT overlap college hours (9 AM - 3 PM)!`);
    console.log(`  ✓ Verified user session '${s.task}': ${s.startTime} - ${s.endTime} (Strictly outside college hours)`);
  });

  // Verify college is present in schedule as a fixed commitment
  const collegeSched = plan1.schedule.find(s => s.isFixed && s.task.toLowerCase().includes("college"));
  assert.ok(collegeSched, "College must be visible in schedule as an immutable commitment");
  console.log(`  ✓ College confirmed in calendar: ${collegeSched.startTime} - ${collegeSched.endTime} [Fixed Commitment]`);

  // -----------------------------------------------------------------------------
  // TEST 2: Conversational language, "tomorrow", "bhai", and complex instructions
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 2] Verifying conversational purity (Discards 'Tomorrow', 'Bhai', filler)...");
  const promptConversational = "Bhai, please kal ke liye plan banao. Tomorrow I have college from 9 AM to 3 PM. After that, I want to do 2 hours of AI/ML study, 1 hour of project work, and 1 hour of evening gym. Please do not schedule anything outside my availability.";

  const tasksConv = extractRequestedTasks(promptConversational);
  const titlesConv = tasksConv.map(t => t.title.toLowerCase());
  console.log(`  Extracted tasks from conversational prompt: ${tasksConv.map(t => t.title).join(", ")}`);
  assert.ok(!titlesConv.includes("bhai"), "Must filter out 'Bhai'");
  assert.ok(!titlesConv.includes("tomorrow"), "Must filter out 'Tomorrow'");
  assert.ok(!titlesConv.includes("please"), "Must filter out 'Please'");
  assert.ok(!titlesConv.includes("kal ke liye plan banao"), "Must filter out 'kal ke liye plan banao'");
  assert.ok(!titlesConv.includes("after that"), "Must filter out 'After that'");

  // All extracted tasks must be genuine activities
  tasksConv.forEach(t => {
    assert.ok(isValidTaskTitle(t.title), `Task '${t.title}' must be a genuine activity`);
  });
  console.log("  ✓ All conversational fragments, temporal words, and filler strictly rejected from task creation.");

  // -----------------------------------------------------------------------------
  // TEST 3: Overloaded request that cannot fit into available time
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 3] Verifying impossible schedule duration conflict detection...");
  // 5 hours of requested work (300 mins) inside a 2-hour window (7 PM to 9 PM = 120 mins)
  const promptOverloaded = "I need to do 2 hours of AI/ML study, 2 hours of project work, and 1 hour of gym today only between 7 PM and 9 PM.";
  const overloadedPlan = generateFallbackPlan(promptOverloaded, { tasks: [], schedule: [] });

  assert.ok(overloadedPlan.conflicts && overloadedPlan.conflicts.length > 0, "Must detect schedule conflict for overloaded time");
  console.log(`  ✓ Conflict detected: "${overloadedPlan.conflicts[0]}"`);
  assert.ok(overloadedPlan.conflicts[0].toLowerCase().includes("impossible schedule") || overloadedPlan.conflicts[0].toLowerCase().includes("conflict"), "Must explain conflict clearly");

  // -----------------------------------------------------------------------------
  // TEST 4: Malformed AI response fallback resilience
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 4] Verifying safe fallback when AI response is malformed or invalid...");
  const malformedPlan = {
    goal: "Study math and physics",
    tasks: [{ id: "t1", title: "Tomorrow" }, { id: "t2", title: "Bhai" }], // Garbage fragments
    schedule: [{ id: "s1", task: "Tomorrow", startTime: "10:00 AM", endTime: "11:00 AM" }],
    actions: []
  };

  const validated = validateAndSynchronizePlan(malformedPlan, "Study math and physics");
  const validatedTitles = validated.tasks.map(t => t.title.toLowerCase());
  assert.ok(!validatedTitles.includes("tomorrow"), "Validator must strip 'Tomorrow'");
  assert.ok(!validatedTitles.includes("bhai"), "Validator must strip 'Bhai'");
  assert.ok(validated.tasks.length > 0, "Validator must re-extract valid tasks");
  console.log(`  ✓ Malformed AI tasks sanitized. Clean tasks restored: ${validated.tasks.map(t => t.title).join(", ")}`);

  // -----------------------------------------------------------------------------
  // TEST 5: Contextual schedule edit ("Move my gym to 7 PM")
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 5] Verifying contextual schedule edit ('Move my gym to 7 PM')...");
  const basePlan = {
    goal: "Daily routine",
    tasks: [
      { id: "task-1", title: "AI/ML Study", durationMinutes: 120 },
      { id: "task-2", title: "Evening Gym", durationMinutes: 60 }
    ],
    schedule: [
      { id: "sched-1", taskId: "task-1", task: "AI/ML Study", startTime: "3:15 PM", endTime: "5:15 PM", durationMinutes: 120, date: "Today (Oct 9)" },
      { id: "sched-2", taskId: "task-2", task: "Evening Gym", startTime: "5:30 PM", endTime: "6:30 PM", durationMinutes: 60, date: "Today (Oct 9)" }
    ],
    actions: []
  };

  const edited = applyScheduleEdit(basePlan, "Move my gym to 7 PM");
  const gymSched = edited.schedule.find(s => s.task.toLowerCase().includes("gym"));
  assert.ok(gymSched, "Must retain Gym in schedule");
  assert.strictEqual(gymSched.startTime, "7:00 PM");
  assert.strictEqual(gymSched.endTime, "8:00 PM");
  console.log(`  ✓ Moved Gym to new slot: ${gymSched.startTime} - ${gymSched.endTime}`);

  // Study task preserved
  const studySched = edited.schedule.find(s => s.task.toLowerCase().includes("ai/ml"));
  assert.strictEqual(studySched.startTime, "3:15 PM");
  console.log(`  ✓ Other task preserved: ${studySched.task} at ${studySched.startTime}`);

  // Summary explains change
  console.log(`  ✓ Re-plan explanation: "${edited.summary}"`);
  assert.ok(edited.summary.includes("Gym") || edited.summary.includes("7:00 PM"), "Summary must explain the move");

  console.log("\n==================================================================");
  console.log("  ALL PLANNER PURITY & CONSTRAINT REGRESSION TESTS PASSED! ✓     ");
  console.log("==================================================================");
}

runRegressionTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
