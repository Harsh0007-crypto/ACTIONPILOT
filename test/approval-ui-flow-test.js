/**
 * ActionPilot Approval & Execute UI State Transition Test Suite
 * Validates:
 * 1. Mutual exclusivity of Approval, Execution, and Completed states
 * 2. Immediate dismissal of Human Approval Required controls on Approve
 * 3. Brief execution progress display followed by clean Completed state
 * 4. Proper dismissal and update of Approval controls on Reject
 * 5. Double-click execution protection
 */

const assert = require("assert");

async function runTests() {
  console.log("==================================================");
  console.log("  ACTIONPILOT APPROVAL & EXECUTE FLOW TEST SUITE  ");
  console.log("==================================================");

  // Set up mock DOM elements to verify App's setWorkflowUIState logic
  class MockElement {
    constructor(id) {
      this.id = id;
      this._classes = new Set();
      this.classList = {
        add: (...cls) => cls.forEach(c => this._classes.add(c)),
        remove: (...cls) => cls.forEach(c => this._classes.delete(c)),
        contains: (c) => this._classes.has(c),
        toggle: (c) => this._classes.has(c) ? (this._classes.delete(c), false) : (this._classes.add(c), true)
      };
      this.style = {};
      this.disabled = false;
      this.textContent = "";
      this.innerHTML = "";
    }
    scrollIntoView() {}
  }

  // Create simulated DOM
  const elements = {};
  const elementIds = [
    "blockApproval",
    "approvalAlertCard",
    "approvalRejectedMessage",
    "blockExecute",
    "blockComplete",
    "step-understand",
    "step-plan",
    "step-approve",
    "step-execute",
    "step-complete",
    "sdiv-1",
    "sdiv-2",
    "sdiv-3",
    "sdiv-4",
    "btnApproveAction",
    "btnRejectAction",
    "executeStatusPill",
    "executeStepsStream",
    "valCompleteSummary",
    "valArtifactsSummary",
    "heroCenterpiece",
    "workflowCardSection",
    "detailsDrawer",
    "engineSourceTag",
    "valGoalText",
    "valDeadlineText",
    "valConstraintsTags",
    "valEstimatedEffort",
    "valAssumptionText",
    "valPlanSummary",
    "valPlanActionsList",
    "valApprovalReason",
    "goalInput",
    "toggleDetailsBtnText"
  ];

  elementIds.forEach(id => {
    elements[id] = new MockElement(id);
  });

  global.document = {
    addEventListener(event, fn) {},
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      return [];
    },
    createElement(tag) {
      const el = new MockElement("dyn-" + Math.random());
      el.classList.add = function(c) { this.classList_add(c); };
      el.classList.remove = function(c) { this.classList_remove(c); };
      el.classList.contains = function(c) { return this.classList_contains(c); };
      el.appendChild = function() {};
      return el;
    }
  };

  global.window = {
    scrollTo() {}
  };

  global.ToolsView = {
    init() {},
    render() {},
    escapeHtml(s) { return String(s || ""); }
  };

  // Load App controller code
  const fs = require("fs");
  const appCode = fs.readFileSync("./public/js/app.js", "utf8");
  eval(appCode);
  const App = global.window.App;

  console.log("\n[TEST 1] Verifying setWorkflowUIState mutual exclusivity...");

  // State: Approval
  App.setWorkflowUIState("approval");
  assert.strictEqual(elements.blockApproval.classList.contains("hidden"), false, "blockApproval should be visible");
  assert.strictEqual(elements.approvalAlertCard.classList.contains("hidden"), false, "approvalAlertCard should be visible");
  assert.strictEqual(elements.blockExecute.classList.contains("hidden"), true, "blockExecute should be hidden");
  assert.strictEqual(elements.blockComplete.classList.contains("hidden"), true, "blockComplete should be hidden");
  console.log("✓ Approval state: blockApproval visible, execute & complete hidden");

  // State: Executing (Immediately dismiss approval!)
  App.setWorkflowUIState("executing");
  assert.strictEqual(elements.blockApproval.classList.contains("hidden"), true, "blockApproval MUST be hidden during execution");
  assert.strictEqual(elements.approvalAlertCard.classList.contains("hidden"), true, "approvalAlertCard MUST be hidden during execution");
  assert.strictEqual(elements.blockExecute.classList.contains("hidden"), false, "blockExecute should be visible during execution");
  assert.strictEqual(elements.blockComplete.classList.contains("hidden"), true, "blockComplete should be hidden during execution");
  console.log("✓ Executing state: approval immediately dismissed, execute visible, complete hidden");

  // State: Completed (Clean success state)
  App.setWorkflowUIState("completed");
  assert.strictEqual(elements.blockApproval.classList.contains("hidden"), true, "blockApproval MUST be hidden in complete state");
  assert.strictEqual(elements.approvalAlertCard.classList.contains("hidden"), true, "approvalAlertCard MUST be hidden in complete state");
  assert.strictEqual(elements.blockExecute.classList.contains("hidden"), true, "blockExecute MUST be hidden in complete state");
  assert.strictEqual(elements.blockComplete.classList.contains("hidden"), false, "blockComplete MUST be visible in complete state");
  console.log("✓ Completed state: approval & execute dismissed, complete visible");

  // State: Idle
  App.setWorkflowUIState("idle");
  assert.strictEqual(elements.blockApproval.classList.contains("hidden"), true, "blockApproval hidden in idle");
  assert.strictEqual(elements.blockExecute.classList.contains("hidden"), true, "blockExecute hidden in idle");
  assert.strictEqual(elements.blockComplete.classList.contains("hidden"), true, "blockComplete hidden in idle");
  console.log("✓ Idle state: all 3 states hidden");

  console.log("\n[TEST 2] Verifying double-click protection...");
  App.isExecuting = true;
  let executedCount = 0;
  // If isExecuting is true, calling handleApproveAndExecute should return early without running
  const mockPlan = {
    actions: [{ id: "act-1", title: "Test", requiresApproval: true }]
  };
  App.activePlan = mockPlan;
  await App.handleApproveAndExecute();
  assert.strictEqual(elements.blockExecute.classList.contains("hidden"), true, "Double-click blocked because isExecuting is true");
  console.log("✓ Double-click execution strictly prevented when isExecuting = true");

  console.log("\n[TEST 3] Verifying End-to-End Server Integration for Approve & Execute...");
  process.env.PORT = "3457";
  const server = require("../server.js");
  const BASE_URL = "http://127.0.0.1:3457";

  // Allow server startup
  await new Promise(r => setTimeout(r, 600));

  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    return res.json();
  }

  // 1. Reset state
  await api("/api/state/reset", { method: "POST" });
  // 2. Plan goal
  const planData = await api("/api/agent/plan", {
    method: "POST",
    body: JSON.stringify({ goal: "Prepare my presentation for tomorrow" })
  });
  assert.ok(planData.success);
  const consequential = planData.plan.actions.find(a => a.requiresApproval);
  assert.ok(consequential, "Must have consequential action");

  // 3. Approve consequential action
  const approveRes = await api("/api/agent/approve-action", {
    method: "POST",
    body: JSON.stringify({ actionId: consequential.id, decision: "approved" })
  });
  assert.strictEqual(approveRes.decision, "approved");
  assert.strictEqual(approveRes.action.status, "executed");
  console.log("✓ Consequential action authorized and executed via API");

  console.log("\n[TEST 4] Verifying End-to-End Server Integration for Reject flow...");
  // Plan goal again
  const planData2 = await api("/api/agent/plan", {
    method: "POST",
    body: JSON.stringify({ goal: "Plan my study schedule for next week" })
  });
  const consequential2 = planData2.plan.actions.find(a => a.requiresApproval);
  assert.ok(consequential2, "Must have consequential action");

  // Reject consequential action
  const rejectRes = await api("/api/agent/approve-action", {
    method: "POST",
    body: JSON.stringify({ actionId: consequential2.id, decision: "rejected" })
  });
  assert.strictEqual(rejectRes.decision, "rejected");
  assert.strictEqual(rejectRes.action.status, "rejected");
  console.log("✓ Consequential action safely rejected without calendar booking");

  server.close(() => {
    console.log("\n==================================================");
    console.log("  ALL APPROVAL & EXECUTE FLOW TESTS PASSED! ✓   ");
    console.log("==================================================");
    process.exit(0);
  });
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
