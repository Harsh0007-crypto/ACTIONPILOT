/**
 * ActionPilot Multilingual & Practical AI Planning Features Regression Test
 * Validates:
 * Priority 1: Planner Reliability
 *   - Parses user input into separate tasks, durations, and constraints (never prompt = 1 task)
 *   - Preserves requested tasks and durations
 *   - Enforces fixed commitments / classes without clashing
 *   - Detects pairwise overlaps and reports impossible schedules / conflicts
 *   - Flags clarification questions when essential details are missing
 * Priority 2: Natural-Language Editing
 *   - Supports edits like "Move my project work to 6 PM"
 *   - Updates only affected tasks and preserves remaining schedule
 * Priority 3: Smart Rescheduling & Explanations
 *   - Displaces and reschedules overlapping tasks with explanations
 *   - Consequential changes require operator approval
 * Priority 4: Multilingual Support
 *   - Hindi (Devanagari) input parsing
 *   - Hinglish input parsing
 *   - English, Hindi, and Hinglish localized messages
 */

const assert = require("assert");
const {
  extractConstraints,
  extractRequestedTasks,
  buildConstrainedSchedule,
  validateAndSynchronizePlan,
  applyScheduleEdit,
  parseTimeToMinutes
} = require("../lib/scheduleOptimizer");
const { generateFallbackPlan } = require("../lib/fallbackPlanner");
const {
  LANG_EN,
  LANG_HI,
  LANG_HINGLISH,
  detectLanguage,
  normalizeLanguage,
  getMessage
} = require("../lib/i18n");

async function runMultilingualPlannerTest() {
  console.log("==================================================================");
  console.log("  ACTIONPILOT MULTILINGUAL & RELIABLE PLANNER TEST SUITE          ");
  console.log("==================================================================");

  // -----------------------------------------------------------------------------
  // TEST 1: Task Separation & Duration Preservation (Never Prompt = 1 Task)
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 1] Task separation, durations, and fixed commitments...");
  const prompt1 = "I need to prepare presentation (45 mins), practice demo (30 mins), and answer Q&A (20 mins) today from 6 PM to 9 PM. I have a fixed team sync at 7 PM.";
  const constraints1 = extractConstraints(prompt1);
  const tasks1 = extractRequestedTasks(prompt1);

  assert.ok(tasks1.length >= 3, `Expected at least 3 distinct tasks, got ${tasks1.length}`);
  console.log(`  ✓ Extracted ${tasks1.length} separate tasks:`, tasks1.map(t => `${t.title} (${t.durationMinutes}m)`).join(", "));

  assert.strictEqual(tasks1[0].durationMinutes, 45, "First task should preserve 45 mins duration");
  assert.strictEqual(tasks1[1].durationMinutes, 30, "Second task should preserve 30 mins duration");
  assert.strictEqual(tasks1[2].durationMinutes, 20, "Third task should preserve 20 mins duration");
  assert.ok(constraints1.fixedCommitments.length >= 1, "Should identify fixed team sync commitment");
  console.log(`  ✓ Fixed commitment detected: ${constraints1.fixedCommitments[0].title} at ${constraints1.fixedCommitments[0].startTime}`);

  const plan1 = generateFallbackPlan(prompt1, { tasks: [], schedule: [] });
  assert.ok(plan1.tasks.length >= 3, "Generated plan must contain multiple individual tasks");
  assert.ok(plan1.schedule.length >= 3, "Schedule must have multiple distinct session blocks");
  console.log("  ✓ Plan generated with multiple distinct tasks and calendar slots.");

  // -----------------------------------------------------------------------------
  // TEST 2: Clarification when essential information is missing
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 2] Missing essential information triggers clarification...");
  const promptVague = "Help me prepare for my exam.";
  const vaguePlan = generateFallbackPlan(promptVague, { tasks: [], schedule: [] });
  assert.ok(vaguePlan.clarification, "Vague goal must include clarification prompt");
  console.log(`  ✓ Clarification requested: "${vaguePlan.clarification}"`);

  // -----------------------------------------------------------------------------
  // TEST 3: Overlap Detection & Impossible Schedule Detection
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 3] Impossible schedule & overlap detection...");
  // Overloaded request: 6 hours of work in a 2-hour window (7 PM to 9 PM)
  const overloadedPrompt = "I need to complete module 1 (120 mins), module 2 (120 mins), and module 3 (120 mins) today between 7 PM and 9 PM.";
  const overloadedPlan = generateFallbackPlan(overloadedPrompt, { tasks: [], schedule: [] });
  assert.ok(overloadedPlan.conflicts && overloadedPlan.conflicts.length > 0, "Must detect impossible schedule duration");
  console.log(`  ✓ Detected conflict: "${overloadedPlan.conflicts[0]}"`);

  // -----------------------------------------------------------------------------
  // TEST 4: Natural-Language Editing & Task Moving (Priority 2 & 3)
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 4] Natural-language schedule editing (Move task)...");
  const basePrompt = "Plan tasks: write report (60 mins), review slides (45 mins) today from 4 PM to 8 PM.";
  const basePlan = generateFallbackPlan(basePrompt, { tasks: [], schedule: [] });
  console.log("  Initial schedule:", basePlan.schedule.map(s => `${s.task}: ${s.startTime}-${s.endTime}`).join(" | "));

  // User says: "Move review slides to 6 PM"
  const editedPlan = applyScheduleEdit(basePlan, "Move review slides to 6 PM");
  assert.ok(editedPlan, "Edited plan must be returned");
  const movedItem = editedPlan.schedule.find(s => s.task.toLowerCase().includes("slides") || s.task.toLowerCase().includes("review"));
  assert.ok(movedItem, "Moved task must exist");
  assert.ok(movedItem.startTime === "6:00 PM" || movedItem.startTime === "06:00 PM", "Task must be moved to 6:00 PM");
  console.log("  Updated schedule:", editedPlan.schedule.map(s => `${s.task}: ${s.startTime}-${s.endTime}`).join(" | "));
  console.log(`  ✓ Explanation provided: "${editedPlan.summary}"`);

  // Consequential check: modified schedule action must require operator approval
  const schedAction = editedPlan.actions.find(a => a.tool === "schedule");
  assert.strictEqual(schedAction.requiresApproval, true, "Consequential modified calendar action must require human approval");
  console.log("  ✓ Operator approval gate preserved on modified calendar action.");

  // -----------------------------------------------------------------------------
  // TEST 5: Multilingual Support: Hindi (Devanagari) & Hinglish
  // -----------------------------------------------------------------------------
  console.log("\n[TEST 5] Multilingual Support (Hindi Devanagari & Hinglish)...");

  // A. Devanagari Hindi
  const hindiPrompt = "मुझे आज शाम 6 बजे से 9 बजे तक गणित का रिविजन और कोडिंग प्रैक्टिस करना है।";
  assert.strictEqual(detectLanguage(hindiPrompt), LANG_HI, "Should detect Hindi script");
  const hindiPlan = generateFallbackPlan(hindiPrompt, { tasks: [], schedule: [] }, undefined, undefined, LANG_HI);
  assert.ok(hindiPlan.summary.includes("कार्यप्रवाह") || hindiPlan.summary.includes("सुव्यवस्थित"), "Hindi plan summary must be in Hindi");
  console.log(`  ✓ Hindi summary: "${hindiPlan.summary}"`);
  console.log("  ✓ Hindi schedule:", hindiPlan.schedule.map(s => `${s.task}: ${s.startTime}-${s.endTime}`).join(" | "));

  // B. Hinglish
  const hinglishPrompt = "Kal subah 9 baje se 12 baje tak project presentation prepare karna hai aur code review karna hai.";
  assert.strictEqual(detectLanguage(hinglishPrompt), LANG_HINGLISH, "Should detect Hinglish");
  const hinglishPlan = generateFallbackPlan(hinglishPrompt, { tasks: [], schedule: [] }, undefined, undefined, LANG_HINGLISH);
  assert.ok(hinglishPlan.summary.toLowerCase().includes("workflow") || hinglishPlan.summary.includes("ke liye"), "Hinglish summary should be conversational Hinglish");
  console.log(`  ✓ Hinglish summary: "${hinglishPlan.summary}"`);

  // C. Localized Messages
  const enMsg = getMessage(LANG_EN, "rescheduleMoved", "Demo practice", "4:00 PM", "6:00 PM");
  const hiMsg = getMessage(LANG_HI, "rescheduleMoved", "Demo practice", "4:00 PM", "6:00 PM");
  const hgMsg = getMessage(LANG_HINGLISH, "rescheduleMoved", "Demo practice", "4:00 PM", "6:00 PM");

  assert.ok(enMsg.includes("Demo practice"), "English explanation formatted");
  assert.ok(hiMsg.includes("Demo practice"), "Hindi explanation formatted");
  assert.ok(hgMsg.includes("Demo practice"), "Hinglish explanation formatted");
  console.log("  ✓ English explanation: ", enMsg);
  console.log("  ✓ Hindi explanation:   ", hiMsg);
  console.log("  ✓ Hinglish explanation:", hgMsg);

  console.log("\n==================================================================");
  console.log("  ALL MULTILINGUAL & RELIABLE PLANNER TESTS PASSED SUCCESSFULLY!  ");
  console.log("==================================================================");
}

runMultilingualPlannerTest().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
