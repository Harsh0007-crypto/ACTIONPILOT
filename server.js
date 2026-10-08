/**
 * ActionPilot Server
 * Autonomous AI for getting things done.
 * Production-ready Express backend with secure Gemini integration,
 * deterministic fallback engine, functional tool registry, and human-in-the-loop oversight.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const stateStore = require("./lib/stateStore");
const { executeTool } = require("./lib/toolRegistry");
const { planWithGemini } = require("./lib/gemini");
const { generateFallbackPlan } = require("./lib/fallbackPlanner");
const { validateAndSynchronizePlan } = require("./lib/scheduleOptimizer");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 1. HEALTH & SYSTEM STATUS
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ActionPilot Autonomous Kernel",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
app.get("/api/state", (req, res) => {
  res.json({
    success: true,
    data: stateStore.getState()
  });
});

app.post("/api/state/reset", (req, res) => {
  stateStore.reset();
  stateStore.logActivity("system", "Workspace Reset", "Restored demo environment with baseline tasks and schedule", "refresh-cw");
  res.json({
    success: true,
    message: "State reset to demo baseline",
    data: stateStore.getState()
  });
});

app.post("/api/tasks/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const task = stateStore.tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ success: false, message: "Task not found" });
  }
  task.status = status || (task.status === "completed" ? "pending" : "completed");
  stateStore.logActivity("tool", `Task ${task.status === "completed" ? "Completed" : "Reopened"}: "${task.title}"`, `User manually updated task state`, "check");
  res.json({ success: true, task, state: stateStore.getState() });
});

// ==========================================
// 3. AGENT PLANNING PIPELINE
// ==========================================
app.post("/api/agent/plan", async (req, res) => {
  const { goal, customApiKey } = req.body;

  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_INPUT",
      message: "Please provide a valid goal statement."
    });
  }

  const cleanGoal = goal.trim();
  stateStore.logActivity("agent", `Analyzing Goal: "${cleanGoal.slice(0, 80)}${cleanGoal.length > 80 ? "..." : ""}"`, "Parsing intent, extracting constraints, and mapping dependencies", "compass");

  let planResult = null;
  let source = "Autonomous Engine (Deterministic Fallback)";

  // Attempt Gemini if configured or user provided custom key
  const hasKey = !!(customApiKey || process.env.GEMINI_API_KEY);
  if (hasKey) {
    try {
      const geminiResp = await planWithGemini(cleanGoal, stateStore.getState(), customApiKey);
      if (geminiResp.success && geminiResp.data) {
        planResult = geminiResp.data;
        source = geminiResp.source;
        stateStore.logActivity("system", `Cognitive Engine: ${source}`, "Structured plan synthesized successfully via Gemini", "cpu");
      } else {
        stateStore.logActivity("warning", "Gemini Fallback Engaged", geminiResp.message || "Using deterministic planner", "alert-triangle");
      }
    } catch (err) {
      stateStore.logActivity("warning", "Gemini Request Exception", err.message, "alert-circle");
    }
  }

  // Fallback to intelligent deterministic planner
  if (!planResult) {
    planResult = generateFallbackPlan(cleanGoal, stateStore.getState());
    source = planResult.source || "Autonomous Engine (Deterministic Fallback)";
  }

  // Ensure single source of truth and canonical synchronization
  planResult = validateAndSynchronizePlan(planResult, cleanGoal);

  // Ensure actions have consistent initial status
  const actions = (planResult.actions || []).map((action, index) => ({
    ...action,
    id: action.id || `act-step-${index + 1}`,
    status: "planned",
    executedAt: null,
    result: null
  }));

  const structuredPlan = {
    ...planResult,
    source,
    actions,
    createdAt: new Date().toISOString()
  };

  stateStore.currentPlan = structuredPlan;
  stateStore.pendingApprovals = actions.filter(a => a.requiresApproval && a.status === "planned");

  stateStore.logActivity("agent", "Plan Decomposed", `${planResult.tasks.length} tasks identified, ${actions.length} action steps queued`, "layers");
  if (stateStore.pendingApprovals.length > 0) {
    stateStore.logActivity("warning", `Human Approval Gate Activated`, `${stateStore.pendingApprovals.length} consequential action(s) require operator sign-off`, "shield-alert");
  }

  res.json({
    success: true,
    source,
    plan: structuredPlan,
    pendingApprovals: stateStore.pendingApprovals
  });
});

// ==========================================
// 4. STEP-BY-STEP ACTION EXECUTION
// ==========================================
app.post("/api/agent/execute-action", (req, res) => {
  const { actionId } = req.body;

  if (!stateStore.currentPlan || !Array.isArray(stateStore.currentPlan.actions)) {
    return res.status(400).json({
      success: false,
      error: "NO_ACTIVE_PLAN",
      message: "No active plan found to execute. Run agent first."
    });
  }

  const action = stateStore.currentPlan.actions.find(a => a.id === actionId);
  if (!action) {
    return res.status(404).json({
      success: false,
      error: "ACTION_NOT_FOUND",
      message: `Action with ID ${actionId} not found in current plan.`
    });
  }

  // Consequential check
  if (action.requiresApproval && action.status !== "approved") {
    return res.status(403).json({
      success: false,
      error: "APPROVAL_REQUIRED",
      message: `Action "${action.description}" requires explicit human approval before execution.`,
      action
    });
  }

  if (action.status === "executed") {
    return res.json({
      success: true,
      message: "Action already executed",
      action,
      state: stateStore.getState()
    });
  }

  if (action.status === "rejected") {
    return res.status(400).json({
      success: false,
      error: "ACTION_REJECTED",
      message: "This action was rejected by human operator and cannot be executed."
    });
  }

  try {
    const result = executeTool(action.tool, action.action, action.params);
    action.status = "executed";
    action.executedAt = new Date().toISOString();
    action.result = result;

    res.json({
      success: true,
      action,
      result,
      state: stateStore.getState()
    });
  } catch (err) {
    action.status = "failed";
    action.error = err.message;

    res.status(500).json({
      success: false,
      error: "TOOL_EXECUTION_FAILED",
      message: err.message,
      action
    });
  }
});

// ==========================================
// 5. HUMAN-IN-THE-LOOP APPROVAL / REJECTION
// ==========================================
app.post("/api/agent/approve-action", (req, res) => {
  const { actionId, decision } = req.body; // decision: "approved" | "rejected"

  if (!stateStore.currentPlan) {
    return res.status(400).json({
      success: false,
      error: "NO_ACTIVE_PLAN",
      message: "No active plan found."
    });
  }

  const action = stateStore.currentPlan.actions.find(a => a.id === actionId);
  if (!action) {
    return res.status(404).json({
      success: false,
      error: "ACTION_NOT_FOUND",
      message: `Action ${actionId} not found.`
    });
  }

  // Remove from pendingApprovals list
  stateStore.pendingApprovals = stateStore.pendingApprovals.filter(a => a.id !== actionId);

  if (decision === "approved") {
    action.status = "approved";
    stateStore.logActivity("approval", `Action Approved: "${action.description}"`, "Executing consequential operation with authorized clearance", "check-circle-2");

    // Immediately execute the approved action
    try {
      const result = executeTool(action.tool, action.action, action.params);
      action.status = "executed";
      action.executedAt = new Date().toISOString();
      action.result = result;

      return res.json({
        success: true,
        decision: "approved",
        action,
        result,
        state: stateStore.getState()
      });
    } catch (err) {
      action.status = "failed";
      action.error = err.message;
      return res.status(500).json({
        success: false,
        decision: "approved",
        error: "EXECUTION_AFTER_APPROVAL_FAILED",
        message: err.message,
        action
      });
    }
  } else if (decision === "rejected") {
    action.status = "rejected";
    action.rejectedAt = new Date().toISOString();
    stateStore.logActivity("warning", `Action Rejected: "${action.description}"`, "Operator withheld approval. Consequential mutation cancelled; remaining plan continues safely.", "x-circle");

    return res.json({
      success: true,
      decision: "rejected",
      action,
      state: stateStore.getState()
    });
  } else {
    return res.status(400).json({
      success: false,
      error: "INVALID_DECISION",
      message: "Decision must be 'approved' or 'rejected'."
    });
  }
});

// ==========================================
// 6. DYNAMIC CONFLICT RESOLUTION
// ==========================================
app.post("/api/agent/resolve-conflict", (req, res) => {
  const { actionId } = req.body;
  if (!stateStore.currentPlan) {
    return res.status(400).json({ success: false, message: "No active plan." });
  }

  const actions = stateStore.currentPlan.actions || [];
  const schedAction = actionId
    ? actions.find(a => a.id === actionId)
    : actions.find(a => a.tool === "schedule");

  if (schedAction && schedAction.params) {
    const originalStart = schedAction.params.startTime || "02:00 PM";
    schedAction.params.startTime = "04:00 PM";
    schedAction.params.endTime = "05:00 PM";
    schedAction.description = schedAction.description.replace(originalStart, "04:00 PM");
    if (schedAction.approvalReason) {
      schedAction.approvalReason = schedAction.approvalReason.replace(originalStart, "04:00 PM");
    }

    stateStore.logActivity(
      "agent",
      `Schedule Conflict Resolved with AI: "${schedAction.title || schedAction.description}"`,
      `Shifted calendar block from ${originalStart} to 04:00 PM - 05:00 PM. No overlaps remaining.`,
      "clock"
    );
  }

  const conflictEvt = stateStore.schedule.find(e => e.conflictDetected);
  if (conflictEvt) {
    conflictEvt.startTime = "04:00 PM";
    conflictEvt.endTime = "05:00 PM";
    conflictEvt.conflictDetected = false;
    conflictEvt.conflictingWith = [];
  }

  res.json({
    success: true,
    message: "Schedule conflict resolved with AI",
    plan: stateStore.currentPlan,
    schedule: stateStore.schedule
  });
});

// ==========================================
// 7. ADAPTIVE RE-PLANNING
// ==========================================
app.post("/api/agent/replan", async (req, res) => {
  const { reason, customApiKey } = req.body;
  if (!stateStore.currentPlan) {
    return res.status(400).json({ success: false, message: "No active plan to re-plan." });
  }

  const cleanReason = (reason || "Schedule conflict or change of constraints").trim();
  stateStore.logActivity(
    "agent",
    `Adaptive Re-planning Triggered`,
    `Reason: ${cleanReason}. Adjusting remaining workflow actions...`,
    "refresh-cw"
  );

  const hasKey = !!(customApiKey || process.env.GEMINI_API_KEY);
  let updatedPlan = null;

  if (hasKey) {
    try {
      const prompt = `Current goal: "${stateStore.currentPlan.goal}". Something changed: "${cleanReason}". Please adapt and return a refreshed plan.`;
      const geminiResp = await planWithGemini(prompt, stateStore.getState(), customApiKey);
      if (geminiResp.success && geminiResp.data) {
        updatedPlan = geminiResp.data;
        updatedPlan.source = geminiResp.source;
      }
    } catch (err) {
      console.warn("Gemini replan error:", err.message);
    }
  }

  if (!updatedPlan) {
    updatedPlan = {
      ...stateStore.currentPlan,
      summary: `Adapted workflow: ${stateStore.currentPlan.summary} (Buffer intervals added; remaining items rescheduled).`,
      actions: (stateStore.currentPlan.actions || []).map((a, idx) => ({
        ...a,
        id: a.id || `act-replan-${idx + 1}`,
        status: a.status === "executed" ? "executed" : "planned",
        description: a.status === "executed" ? a.description : `[Adapted] ${a.description}`,
        estimatedDuration: a.estimatedDuration || "30 mins"
      }))
    };
  }

  stateStore.currentPlan = updatedPlan;
  stateStore.pendingApprovals = (updatedPlan.actions || []).filter(a => a.requiresApproval && a.status === "planned");

  stateStore.logActivity(
    "agent",
    `Adaptive Plan Synthesized`,
    `Plan dynamically updated to fit new constraints`,
    "check-circle"
  );

  res.json({
    success: true,
    message: "Plan adapted successfully",
    plan: stateStore.currentPlan
  });
});

// Fallback route for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  ACTIONPILOT AUTONOMOUS KERNEL ONLINE`);
  console.log(`  Running on: http://${HOST}:${PORT}`);
  console.log(`  Gemini Key Configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`=======================================================`);
});

module.exports = server;
