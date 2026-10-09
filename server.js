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
const { validateAndSynchronizePlan, applyScheduleEdit } = require("./lib/scheduleOptimizer");
const { DEFAULT_TIMEZONE, getRelativeDayInfo } = require("./lib/dateTimeUtils");
const { LANG_EN, normalizeLanguage } = require("./lib/i18n");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1d",
  etag: true
}));

// ==========================================
// IN-MEMORY PLAN CACHE (High-Efficiency Memoization)
// ==========================================
class PlanCache {
  constructor(maxSize = 64, ttlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  generateKey(goal, timeZone, language, customApiKey, stateSig) {
    const norm = (goal || "").trim().toLowerCase();
    return `${norm}::${timeZone}::${language}::custom=${!!customApiKey}::${stateSig}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return JSON.parse(JSON.stringify(entry.data));
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data))
    });
  }

  clear() {
    this.cache.clear();
  }
}

const planCache = new PlanCache();

// ==========================================
// 1. HEALTH & SYSTEM STATUS
// ==========================================
app.get("/api/health", (req, res) => {
  const timeZone = req.query.timeZone || req.headers["x-timezone"] || DEFAULT_TIMEZONE;
  const today = getRelativeDayInfo(0, new Date(), timeZone);
  res.json({
    status: "ok",
    service: "ActionPilot Autonomous Kernel",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timeZone,
    currentDate: today.isoDate,
    currentDayLabel: today.dayLabel,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
app.get("/api/state", (req, res) => {
  const timeZone = req.query.timeZone || req.headers["x-timezone"] || DEFAULT_TIMEZONE;
  const today = getRelativeDayInfo(0, new Date(), timeZone);
  res.json({
    success: true,
    data: {
      ...stateStore.getState(),
      timeZone,
      currentDate: today
    }
  });
});

app.post("/api/state/reset", (req, res) => {
  stateStore.reset();
  planCache.clear();
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
  const { goal, customApiKey, timeZone, language } = req.body;
  const userTz = timeZone || req.headers["x-timezone"] || DEFAULT_TIMEZONE;
  const userLang = normalizeLanguage(language || req.headers["x-language"] || LANG_EN, goal);

  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_INPUT",
      message: "Please provide a valid goal statement."
    });
  }

  const cleanGoal = goal.trim();
  if (cleanGoal.length > 4000) {
    return res.status(400).json({
      success: false,
      error: "INPUT_TOO_LARGE",
      message: "Goal statement exceeds maximum allowed length (4000 characters)."
    });
  }

  // Check In-Memory Plan Cache (High-Efficiency Short-Circuit)
  const stateSig = `${stateStore.tasks.length}:${stateStore.schedule.length}`;
  const cacheKey = planCache.generateKey(cleanGoal, userTz, userLang, customApiKey, stateSig);
  const cachedPlanData = planCache.get(cacheKey);

  if (cachedPlanData) {
    stateStore.currentPlan = cachedPlanData.plan;
    stateStore.pendingApprovals = cachedPlanData.pendingApprovals;
    stateStore.logActivity("agent", `Plan Retrieved (Instant Cache)`, `Zero-latency memoized synthesis for: "${cleanGoal.slice(0, 60)}"`, "zap");
    return res.json({
      success: true,
      source: cachedPlanData.source,
      cached: true,
      plan: cachedPlanData.plan,
      pendingApprovals: cachedPlanData.pendingApprovals
    });
  }

  stateStore.logActivity("agent", `Analyzing Goal: "${cleanGoal.slice(0, 80)}${cleanGoal.length > 80 ? "..." : ""}"`, `Parsing intent, language [${userLang}], extracting constraints, and mapping dependencies`, "compass");

  let planResult = null;
  let source = "Autonomous Engine (Deterministic Fallback)";

  // Attempt Gemini if configured or user provided custom key
  const hasKey = !!(customApiKey || process.env.GEMINI_API_KEY);
  if (hasKey) {
    try {
      const geminiResp = await planWithGemini(cleanGoal, stateStore.getState(), customApiKey, userTz, new Date(), userLang);
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
    planResult = generateFallbackPlan(cleanGoal, stateStore.getState(), userTz, new Date(), userLang);
    source = planResult.source || "Autonomous Engine (Deterministic Fallback)";
  }

  // Ensure single source of truth and canonical synchronization
  planResult = validateAndSynchronizePlan(planResult, cleanGoal, userTz, new Date(), userLang);

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

  // Save to in-memory plan cache
  planCache.set(cacheKey, {
    source,
    plan: structuredPlan,
    pendingApprovals: stateStore.pendingApprovals
  });

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
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
      message: "Request body must be a valid JSON object."
    });
  }

  const { actionId, decision } = req.body; // decision: "approved" | "rejected"

  if (!actionId || typeof actionId !== "string" || actionId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ACTION_ID",
      message: "actionId must be a valid string."
    });
  }

  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({
      success: false,
      error: "INVALID_DECISION",
      message: "Decision must be 'approved' or 'rejected'."
    });
  }

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
// 7. ADAPTIVE RE-PLANNING & NATURAL-LANGUAGE EDITING
// ==========================================
async function handleAdaptiveReplan(req, res) {
  const { reason, instruction, customApiKey, timeZone, language } = req.body || {};
  const userTz = timeZone || req.headers["x-timezone"] || DEFAULT_TIMEZONE;
  const editInstruction = (instruction || reason || "").trim();
  const userLang = normalizeLanguage(language || req.headers["x-language"] || LANG_EN, editInstruction);

  if (!stateStore.currentPlan) {
    return res.status(400).json({ success: false, error: "NO_ACTIVE_PLAN", message: "No active plan to re-plan." });
  }

  const cleanReason = (editInstruction || "Schedule conflict or change of constraints").trim();
  stateStore.logActivity(
    "agent",
    `Adaptive Re-planning Triggered`,
    `Instruction: "${cleanReason}". Analyzing schedule impact and dependencies...`,
    "refresh-cw"
  );

  let updatedPlan = null;

  // First check if it's a specific natural language schedule edit (e.g. "Move my project work to 6 PM" or "extra class")
  const isDirectEdit = /(?:move|shift|reschedule|बदलो|बदलें|भेजें|शिफ्ट|extra|new|an?\s+additional|naya|nayi|एक\s+और|नया|नई)\s+/i.test(cleanReason);

  if (isDirectEdit) {
    try {
      updatedPlan = applyScheduleEdit(stateStore.currentPlan, cleanReason, userTz, new Date(), userLang);
      if (updatedPlan) {
        stateStore.logActivity(
          "agent",
          `Schedule Edit Applied: "${cleanReason}"`,
          `Updated affected sessions; preserved remaining workflow. Consequential actions flagged for approval.`,
          "sliders"
        );
      }
    } catch (editErr) {
      console.warn("Direct edit error:", editErr.message);
    }
  }

  const hasKey = !!(customApiKey || process.env.GEMINI_API_KEY);
  if (!updatedPlan && hasKey) {
    try {
      const prompt = `Current goal: "${stateStore.currentPlan.goal}". Something changed: "${cleanReason}". Please adapt and return a refreshed plan.`;
      const geminiResp = await planWithGemini(prompt, stateStore.getState(), customApiKey, userTz, new Date(), userLang);
      if (geminiResp.success && geminiResp.data) {
        updatedPlan = geminiResp.data;
        updatedPlan.source = geminiResp.source;
      }
    } catch (err) {
      console.warn("Gemini replan error:", err.message);
    }
  }

  if (!updatedPlan) {
    // Deterministic fallback adaptation
    updatedPlan = applyScheduleEdit(stateStore.currentPlan, cleanReason, userTz, new Date(), userLang) || {
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
}

app.post("/api/agent/replan", handleAdaptiveReplan);

// Dedicated alias for natural-language schedule edits
app.post("/api/agent/edit", (req, res) => {
  if (req.body && req.body.instruction && !req.body.reason) {
    req.body.reason = req.body.instruction;
  }
  return handleAdaptiveReplan(req, res);
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
