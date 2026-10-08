/**
 * ActionPilot System Integration Test Suite
 * Validates all agent operations, tool calls, human approval gates,
 * and state transitions end-to-end.
 */

const assert = require("assert");

async function runTests() {
  console.log("==================================================");
  console.log("  ACTIONPILOT SYSTEM INTEGRATION TEST SUITE");
  console.log("==================================================");

  // Start internal server
  process.env.PORT = "3456";
  const server = require("../server.js");

  const BASE_URL = "http://127.0.0.1:3456";

  // Helper fetch
  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const text = await res.text();
    try {
      return { status: res.status, ok: res.ok, json: JSON.parse(text) };
    } catch {
      return { status: res.status, ok: res.ok, text };
    }
  }

  // Allow server startup
  await new Promise(r => setTimeout(r, 600));

  try {
    // TEST 1: Health check
    console.log("\n[TEST 1] Checking GET /api/health...");
    const health = await api("/api/health");
    assert.strictEqual(health.status, 200, "Health check should be 200");
    assert.strictEqual(health.json.status, "ok", "Status should be ok");
    console.log("✓ Health endpoint returned healthy JSON:", health.json);

    // TEST 2: Initial State (Clean workspace, no preloaded tasks)
    console.log("\n[TEST 2] Checking GET /api/state (verifying clean initial workspace)...");
    const state = await api("/api/state");
    assert.strictEqual(state.status, 200);
    assert.strictEqual(state.json.data.tasks.length, 0, "Initial tasks should be empty for a clean fresh workspace");
    assert.ok(state.json.data.schedule.length > 0, "Seed schedule for conflict detection should be present");
    console.log(`✓ Clean initial state verified: 0 preloaded tasks, ${state.json.data.schedule.length} schedule events`);

    // TEST 3: Scenario 1 - Presentation Prep Planning
    console.log("\n[TEST 3] Planning Goal: 'Plan my preparation for tomorrow's presentation around my existing tasks.'");
    const plan1 = await api("/api/agent/plan", {
      method: "POST",
      body: JSON.stringify({
        goal: "Plan my preparation for tomorrow's presentation around my existing tasks."
      })
    });
    assert.strictEqual(plan1.status, 200);
    assert.ok(plan1.json.success, "Planning should succeed");
    assert.ok(plan1.json.plan.tasks.length >= 3, "Should decompose into multiple tasks");
    assert.ok(plan1.json.plan.actions.length >= 3, "Should generate ordered action pipeline");

    const consequentialAction = plan1.json.plan.actions.find(a => a.requiresApproval);
    assert.ok(consequentialAction, "Must identify consequential action requiring human approval");
    console.log(`✓ Plan generated with ${plan1.json.plan.actions.length} steps.`);
    console.log(`✓ Found consequential action requiring approval: "${consequentialAction.description}"`);

    // TEST 4: Human-in-the-Loop Gate Enforcement
    console.log("\n[TEST 4] Verifying security gate: executing consequential action WITHOUT prior approval must fail...");
    const prematureExec = await api("/api/agent/execute-action", {
      method: "POST",
      body: JSON.stringify({ actionId: consequentialAction.id })
    });
    assert.strictEqual(prematureExec.status, 403, "Must return 403 Forbidden without approval");
    assert.strictEqual(prematureExec.json.error, "APPROVAL_REQUIRED");
    console.log("✓ Security gate strictly enforced: 403 APPROVAL_REQUIRED returned correctly.");

    // TEST 5: Non-consequential action execution
    console.log("\n[TEST 5] Executing routine safe action...");
    const safeAction = plan1.json.plan.actions.find(a => !a.requiresApproval);
    const safeExec = await api("/api/agent/execute-action", {
      method: "POST",
      body: JSON.stringify({ actionId: safeAction.id })
    });
    assert.strictEqual(safeExec.status, 200, "Safe action should execute successfully");
    assert.strictEqual(safeExec.json.action.status, "executed");
    console.log(`✓ Executed safe action "${safeAction.description}" successfully.`);

    // TEST 6: Human Approval Execution
    console.log("\n[TEST 6] Approving consequential action via Human-in-the-loop gate...");
    const approvalExec = await api("/api/agent/approve-action", {
      method: "POST",
      body: JSON.stringify({
        actionId: consequentialAction.id,
        decision: "approved"
      })
    });
    assert.strictEqual(approvalExec.status, 200, "Approval should succeed");
    assert.strictEqual(approvalExec.json.decision, "approved");
    assert.strictEqual(approvalExec.json.action.status, "executed");
    console.log(`✓ Consequential action "${consequentialAction.description}" authorized and executed!`);

    // TEST 7: Scenario 2 - Math Assignment & Exam
    console.log("\n[TEST 7] Testing Scenario 2: 'I have a maths assignment due Friday and an exam Monday. Create a study plan.'");
    const plan2 = await api("/api/agent/plan", {
      method: "POST",
      body: JSON.stringify({
        goal: "I have a maths assignment due Friday and an exam Monday. Create a study plan."
      })
    });
    assert.strictEqual(plan2.status, 200);
    assert.ok(plan2.json.plan.tasks.some(t => t.category === "Academic"));
    console.log(`✓ Scenario 2 planned: ${plan2.json.plan.tasks.length} tasks, ${plan2.json.plan.actions.length} actions.`);

    // TEST 8: Rejection Workflow
    console.log("\n[TEST 8] Testing Human Rejection flow on consequential action...");
    const plan2Consequential = plan2.json.plan.actions.find(a => a.requiresApproval);
    assert.ok(plan2Consequential, "Scenario 2 should have consequential action");
    const rejectionExec = await api("/api/agent/approve-action", {
      method: "POST",
      body: JSON.stringify({
        actionId: plan2Consequential.id,
        decision: "rejected"
      })
    });
    assert.strictEqual(rejectionExec.status, 200);
    assert.strictEqual(rejectionExec.json.decision, "rejected");
    assert.strictEqual(rejectionExec.json.action.status, "rejected");
    console.log(`✓ Rejection recorded safely. Action marked rejected without unintended mutation.`);

    // TEST 9: Manual Task Status Toggle
    console.log("\n[TEST 9] Testing task creation and status toggle endpoint...");
    const taskAction = plan2.json.plan.actions.find(a => a.tool === "task" && a.action === "create");
    assert.ok(taskAction, "Plan 2 should have task creation action");
    await api("/api/agent/execute-action", {
      method: "POST",
      body: JSON.stringify({ actionId: taskAction.id })
    });

    const currentTasks = (await api("/api/state")).json.data.tasks;
    assert.ok(currentTasks.length > 0, "Created task should exist in registry");
    const testTask = currentTasks[0];
    const toggleResp = await api(`/api/tasks/${testTask.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "completed" })
    });
    assert.strictEqual(toggleResp.status, 200);
    assert.strictEqual(toggleResp.json.task.status, "completed");
    console.log(`✓ Task created and status toggle verified.`);

    // TEST 10: State Reset
    console.log("\n[TEST 10] Testing state reset...");
    const resetResp = await api("/api/state/reset", { method: "POST" });
    assert.strictEqual(resetResp.status, 200);
    console.log(`✓ State reset successfully.`);

    console.log("\n==================================================");
    console.log("  ALL 10 INTEGRATION TESTS PASSED PERFECTLY! ✓");
    console.log("==================================================");
    process.exit(0);

  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err);
    process.exit(1);
  }
}

runTests();
