/**
 * ActionPilot Main Application Controller
 * Orchestrates user interactions, agent execution pipeline, human oversight gates,
 * and live synchronization with backend tools.
 */

const App = {
  activePlan: null,
  currentActionIndex: 0,
  approvalResolver: null,
  stats: {
    tasks: 0,
    schedule: 0,
    approved: 0,
    rejected: 0
  },

  async init() {
    ToolsView.init();
    WorkflowManager.init();
    this.bindEvents();
    await this.fetchHealth();
    await this.fetchState();
  },

  bindEvents() {
    // Run Agent Button
    const btnRun = document.getElementById("btnRunAgent");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.handleRunAgent());
    }

    // Goal Enter key handler (Shift+Enter for newline)
    const goalInput = document.getElementById("goalInput");
    if (goalInput) {
      goalInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleRunAgent();
        }
      });
    }

    // Demo Scenario Chips (Populate without auto-executing per hackathon guidelines)
    const demoChips = document.querySelectorAll(".demo-chip");
    demoChips.forEach(chip => {
      chip.addEventListener("click", () => {
        const goalText = chip.getAttribute("data-goal");
        if (goalInput && goalText) {
          goalInput.value = goalText;
          goalInput.focus();
          // Visual highlight
          demoChips.forEach(c => c.style.borderColor = "var(--border-subtle)");
          chip.style.borderColor = "var(--neon-cyan)";
          setTimeout(() => {
            chip.style.borderColor = "";
          }, 1500);
        }
      });
    });

    // Human-in-the-Loop Approval Buttons
    const btnApprove = document.getElementById("btnApproveAction");
    const btnReject = document.getElementById("btnRejectAction");
    if (btnApprove) {
      btnApprove.addEventListener("click", () => this.handleApprovalDecision("approved"));
    }
    if (btnReject) {
      btnReject.addEventListener("click", () => this.handleApprovalDecision("rejected"));
    }

    // Reset State
    const btnReset = document.getElementById("btnResetState");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.handleResetState());
    }

    // Clear Activity Log
    const btnClearAct = document.getElementById("btnClearActivity");
    if (btnClearAct) {
      btnClearAct.addEventListener("click", () => {
        const feed = document.getElementById("activityFeed");
        if (feed) feed.innerHTML = "";
      });
    }

    // Settings Modal
    const btnSettings = document.getElementById("btnSettings");
    const settingsModal = document.getElementById("settingsModal");
    const btnCloseSettings = document.getElementById("btnCloseSettings");
    const btnCancelSettings = document.getElementById("btnCancelSettings");
    const btnSaveSettings = document.getElementById("btnSaveSettings");
    const apiKeyInput = document.getElementById("apiKeyInput");

    if (btnSettings && settingsModal) {
      btnSettings.addEventListener("click", () => {
        const storedKey = sessionStorage.getItem("custom_gemini_key") || "";
        if (apiKeyInput) apiKeyInput.value = storedKey;
        settingsModal.classList.remove("hidden");
      });
    }

    const closeSettings = () => {
      if (settingsModal) settingsModal.classList.add("hidden");
    };

    if (btnCloseSettings) btnCloseSettings.addEventListener("click", closeSettings);
    if (btnCancelSettings) btnCancelSettings.addEventListener("click", closeSettings);

    if (btnSaveSettings) {
      btnSaveSettings.addEventListener("click", () => {
        const key = apiKeyInput ? apiKeyInput.value.trim() : "";
        if (key) {
          sessionStorage.setItem("custom_gemini_key", key);
          this.updateEngineBadge(true, "Custom Gemini Key Active");
        } else {
          sessionStorage.removeItem("custom_gemini_key");
          this.fetchHealth();
        }
        closeSettings();
      });
    }

    // Mission Complete Modal
    const completionModal = document.getElementById("completionModal");
    const btnDismissCompletion = document.getElementById("btnDismissCompletion");
    const btnViewActivityFeed = document.getElementById("btnViewActivityFeed");

    if (btnDismissCompletion && completionModal) {
      btnDismissCompletion.addEventListener("click", () => {
        completionModal.classList.add("hidden");
      });
    }

    if (btnViewActivityFeed && completionModal) {
      btnViewActivityFeed.addEventListener("click", () => {
        completionModal.classList.add("hidden");
        const actPanel = document.getElementById("activityPanel");
        if (actPanel) actPanel.scrollIntoView({ behavior: "smooth" });
      });
    }
  },

  async fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const hasCustom = !!sessionStorage.getItem("custom_gemini_key");
      const isConfigured = data.geminiConfigured || hasCustom;

      this.updateEngineBadge(
        isConfigured,
        hasCustom ? "Gemini Key (Active)" : (data.geminiConfigured ? "Gemini 2.5 Flash Online" : "Autonomous Fallback Engine")
      );
    } catch (err) {
      console.warn("Health check error:", err);
      this.updateEngineBadge(false, "Offline / Autonomous Fallback");
    }
  },

  updateEngineBadge(isActive, label) {
    const badgeLabel = document.getElementById("engineLabel");
    const badgePulse = document.getElementById("enginePulse");
    if (badgeLabel) badgeLabel.textContent = label;
    if (badgePulse) {
      badgePulse.style.backgroundColor = isActive ? "var(--neon-emerald)" : "var(--neon-cyan)";
      badgePulse.style.boxShadow = isActive ? "0 0 8px var(--neon-emerald)" : "0 0 8px var(--neon-cyan)";
    }
  },

  async fetchState() {
    try {
      const res = await fetch("/api/state");
      const json = await res.json();
      if (json.success && json.data) {
        ToolsView.render(json.data);
        this.renderActivityFeed(json.data.activityLog || []);
      }
    } catch (err) {
      console.error("Failed to load state:", err);
    }
  },

  async handleResetState() {
    try {
      const res = await fetch("/api/state/reset", { method: "POST" });
      const json = await res.json();
      if (json.success && json.data) {
        ToolsView.render(json.data);
        this.renderActivityFeed(json.data.activityLog || []);
      }
      this.activePlan = null;
      this.currentActionIndex = 0;
      this.stats = { tasks: 0, schedule: 0, approved: 0, rejected: 0 };
      WorkflowManager.reset();
      this.resetReasoningView();
      this.resetActionsView();
      const approvalCard = document.getElementById("approvalCardWrapper");
      if (approvalCard) approvalCard.classList.add("hidden");
    } catch (err) {
      alert("Failed to reset state: " + err.message);
    }
  },

  resetReasoningView() {
    const intentText = document.getElementById("intentText");
    const urgencyPill = document.getElementById("urgencyPill");
    const constraintsList = document.getElementById("constraintsList");
    const reasoningText = document.getElementById("reasoningText");
    const sourceBadge = document.getElementById("sourceBadge");

    if (intentText) intentText.textContent = "Input a goal or select a scenario above. ActionPilot will decompose requirements, parse deadlines, and construct an execution plan.";
    if (urgencyPill) {
      urgencyPill.textContent = "Ready";
      urgencyPill.className = "urgency-pill";
    }
    if (constraintsList) {
      constraintsList.innerHTML = `<li class="empty-state-hint">Constraints will be extracted automatically upon goal analysis.</li>`;
    }
    if (reasoningText) {
      reasoningText.textContent = "Awaiting directive. Once analyzed, ActionPilot will display step-by-step reasoning logic and tool orchestration strategy here.";
    }
    if (sourceBadge) sourceBadge.textContent = "Autonomous Engine";
  },

  resetActionsView() {
    const list = document.getElementById("actionsList");
    const badge = document.getElementById("actionCountBadge");
    if (badge) badge.textContent = "0 Steps";
    if (list) {
      list.innerHTML = `
        <div class="empty-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <span>No action pipeline generated yet</span>
        </div>`;
    }
  },

  // ==========================================
  // AGENT RUN ORCHESTRATION
  // ==========================================
  async handleRunAgent() {
    const input = document.getElementById("goalInput");
    const goal = input ? input.value.trim() : "";

    if (!goal) {
      input.focus();
      input.classList.add("shake");
      setTimeout(() => input.classList.remove("shake"), 500);
      return;
    }

    const btnRun = document.getElementById("btnRunAgent");
    const runText = document.getElementById("runButtonText");
    if (btnRun) btnRun.classList.add("is-running");
    if (runText) runText.textContent = "Orchestrating...";

    // Reset stats
    this.stats = { tasks: 0, schedule: 0, approved: 0, rejected: 0 };

    try {
      // 1. UNDERSTAND STAGE
      WorkflowManager.setStage("understand", "active");
      WorkflowManager.setProgress(15, "Parsing Goal & Intent...");
      await this.sleep(400);

      const customKey = sessionStorage.getItem("custom_gemini_key") || null;

      const planResp = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, customApiKey: customKey })
      });

      const planData = await planResp.json();
      if (!planData.success || !planData.plan) {
        throw new Error(planData.message || "Failed to generate plan");
      }

      this.activePlan = planData.plan;

      // 2. PLAN STAGE
      WorkflowManager.setStage("plan", "active");
      WorkflowManager.setProgress(35, "Decomposing Tasks & Dependencies...");
      this.renderReasoning(this.activePlan);
      await this.sleep(450);

      // 3. TOOLS STAGE
      WorkflowManager.setStage("tools", "active");
      WorkflowManager.setProgress(50, "Binding Tool Actions...");
      this.renderActions(this.activePlan.actions);
      await this.sleep(450);

      // 4 & 5. EXECUTION PIPELINE WITH HUMAN APPROVAL GATE
      await this.executeActionPipeline(this.activePlan.actions);

      // 6. COMPLETE STAGE
      WorkflowManager.setStage("complete", "completed");
      WorkflowManager.setProgress(100, "Mission Accomplished");
      await this.sleep(300);

      this.showCompletionModal(this.activePlan);

    } catch (err) {
      console.error("Agent execution failed:", err);
      WorkflowManager.setStatus("failed");
      WorkflowManager.setCoreState("failed");
      alert("Agent Execution Error: " + err.message);
    } finally {
      if (btnRun) btnRun.classList.remove("is-running");
      if (runText) runText.textContent = "Run Agent";
    }
  },

  async executeActionPipeline(actions) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      this.currentActionIndex = i;

      const progressPct = 50 + Math.round(((i + 1) / actions.length) * 45);

      if (action.requiresApproval && action.status !== "approved") {
        // Pauses for Human Approval!
        WorkflowManager.setStage("approval", "paused");
        WorkflowManager.setProgress(progressPct, "Paused: Operator Approval Required");
        this.updateActionCardStatus(action.id, "awaiting");

        // Show approval card and await user decision
        const decision = await this.promptApproval(action);

        if (decision === "rejected") {
          this.stats.rejected++;
          this.updateActionCardStatus(action.id, "rejected");
          await this.fetchState();
          await this.sleep(350);
          continue; // Safely proceed to next actions!
        } else {
          this.stats.approved++;
          this.updateActionCardStatus(action.id, "executed");
          if (action.tool === "schedule") this.stats.schedule++;
          if (action.tool === "task") this.stats.tasks++;
          await this.fetchState();
          await this.sleep(350);
          continue;
        }
      }

      // Non-consequential safe action
      WorkflowManager.setStage("execute", "active");
      WorkflowManager.setProgress(progressPct, `Executing: ${action.tool}.${action.action}`);
      this.updateActionCardStatus(action.id, "running");

      await this.sleep(300); // realistic micro-delay

      const execResp = await fetch("/api/agent/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id })
      });

      const execResult = await execResp.json();
      if (!execResult.success) {
        throw new Error(execResult.message || `Execution of ${action.id} failed`);
      }

      this.updateActionCardStatus(action.id, "executed");
      if (action.tool === "task") this.stats.tasks++;
      if (action.tool === "schedule") this.stats.schedule++;

      await this.fetchState();
      await this.sleep(300);
    }
  },

  promptApproval(action) {
    return new Promise((resolve) => {
      this.approvalResolver = resolve;

      const wrapper = document.getElementById("approvalCardWrapper");
      const titleEl = document.getElementById("approvalActionTitle");
      const reasonEl = document.getElementById("approvalReasonText");
      const impactEl = document.getElementById("approvalImpactText");

      if (titleEl) titleEl.textContent = action.description;
      if (reasonEl) reasonEl.textContent = action.approvalReason || "Modifying this resource impacts external schedules.";
      if (impactEl) impactEl.textContent = action.impact || "Action will adjust existing resource allocation.";

      if (wrapper) {
        wrapper.classList.remove("hidden");
        wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  },

  async handleApprovalDecision(decision) {
    const wrapper = document.getElementById("approvalCardWrapper");
    if (wrapper) wrapper.classList.add("hidden");

    if (!this.activePlan || this.currentActionIndex >= this.activePlan.actions.length) {
      if (this.approvalResolver) this.approvalResolver(decision);
      return;
    }

    const action = this.activePlan.actions[this.currentActionIndex];

    try {
      const res = await fetch("/api/agent/approve-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: action.id, decision })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to submit approval decision");
      }
    } catch (err) {
      console.error("Approval submit error:", err);
    }

    if (this.approvalResolver) {
      const resolver = this.approvalResolver;
      this.approvalResolver = null;
      resolver(decision);
    }
  },

  renderReasoning(plan) {
    const intentText = document.getElementById("intentText");
    const urgencyPill = document.getElementById("urgencyPill");
    const constraintsList = document.getElementById("constraintsList");
    const reasoningText = document.getElementById("reasoningText");
    const sourceBadge = document.getElementById("sourceBadge");

    if (sourceBadge) sourceBadge.textContent = plan.source || "Autonomous Engine";

    if (intentText && plan.understanding) {
      intentText.textContent = plan.understanding.intent || plan.summary;
    }

    if (urgencyPill && plan.understanding) {
      const urgency = (plan.understanding.urgency || "medium").toLowerCase();
      urgencyPill.textContent = urgency;
      urgencyPill.className = `urgency-pill urgency-${urgency}`;
    }

    if (constraintsList && plan.understanding && Array.isArray(plan.understanding.constraints)) {
      if (plan.understanding.constraints.length === 0) {
        constraintsList.innerHTML = `<li class="empty-state-hint">No binding time constraints detected.</li>`;
      } else {
        constraintsList.innerHTML = plan.understanding.constraints.map(c => `
          <li class="constraint-item">
            <span>&bull;</span>
            <span>${ToolsView.escapeHtml(c)}</span>
          </li>
        `).join("");
      }
    }

    if (reasoningText) {
      reasoningText.textContent = plan.reasoning || plan.summary;
    }
  },

  renderActions(actions) {
    const list = document.getElementById("actionsList");
    const countBadge = document.getElementById("actionCountBadge");

    if (countBadge) countBadge.textContent = `${actions.length} Steps`;
    if (!list) return;

    if (!actions || actions.length === 0) {
      list.innerHTML = `
        <div class="empty-placeholder">
          <span>No action steps in pipeline</span>
        </div>`;
      return;
    }

    list.innerHTML = actions.map((act, idx) => `
      <div class="action-card" id="action-card-${act.id}" data-id="${act.id}">
        <div class="action-left">
          <span class="action-step-num">#${idx + 1}</span>
          <span class="tool-badge tool-${act.tool}">${act.tool}</span>
          <span class="action-desc">${ToolsView.escapeHtml(act.description)}</span>
        </div>
        <div class="action-right">
          ${act.requiresApproval ? '<span class="approval-agent-tag" title="Requires Human Clearance">GATE</span>' : ''}
          <span class="action-status-badge planned" id="action-status-${act.id}">PLANNED</span>
        </div>
      </div>
    `).join("");
  },

  updateActionCardStatus(actionId, status) {
    const card = document.getElementById(`action-card-${actionId}`);
    const badge = document.getElementById(`action-status-${actionId}`);

    if (card) {
      card.classList.remove("status-awaiting-approval", "status-executed", "status-rejected");
      if (status === "awaiting") card.classList.add("status-awaiting-approval");
      if (status === "executed") card.classList.add("status-executed");
      if (status === "rejected") card.classList.add("status-rejected");
    }

    if (badge) {
      badge.className = `action-status-badge ${status}`;
      badge.textContent = status.toUpperCase();
    }
  },

  renderActivityFeed(logs) {
    const container = document.getElementById("activityFeed");
    if (!container) return;

    container.innerHTML = logs.map(log => {
      let iconSvg = "✓";
      if (log.type === "warning") iconSvg = "⚠";
      if (log.type === "system") iconSvg = "⚙";
      if (log.type === "approval") iconSvg = "🛡️";

      return `
        <div class="activity-item type-${log.type}">
          <span class="activity-icon">${iconSvg}</span>
          <div class="activity-main">
            <div class="activity-title">${ToolsView.escapeHtml(log.title)}</div>
            ${log.detail ? `<div class="activity-detail">${ToolsView.escapeHtml(log.detail)}</div>` : ''}
          </div>
          <span class="activity-time">${ToolsView.escapeHtml(log.timestamp)}</span>
        </div>
      `;
    }).reverse().join("");
  },

  showCompletionModal(plan) {
    const modal = document.getElementById("completionModal");
    const goalText = document.getElementById("completeGoalText");
    const summaryText = document.getElementById("completeSummaryText");
    const mTasks = document.getElementById("metricTasks");
    const mSchedule = document.getElementById("metricSchedule");
    const mApproved = document.getElementById("metricApproved");
    const mRejected = document.getElementById("metricRejected");

    if (goalText) goalText.textContent = `Goal: "${plan.goal}"`;
    if (summaryText) summaryText.textContent = plan.summary || "All prioritized tasks orchestrated with autonomous execution and human oversight.";

    if (mTasks) mTasks.textContent = this.stats.tasks;
    if (mSchedule) mSchedule.textContent = this.stats.schedule;
    if (mApproved) mApproved.textContent = this.stats.approved;
    if (mRejected) mRejected.textContent = this.stats.rejected;

    if (modal) modal.classList.remove("hidden");
  },

  async updateTaskStatus(taskId, status) {
    try {
      await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      await this.fetchState();
    } catch (err) {
      console.warn("Task status toggle error:", err);
    }
  },

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};

window.App = App;

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
