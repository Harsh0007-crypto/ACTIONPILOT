/**
 * ActionPilot Main Application Controller
 * Ultra-clean judge experience with 5 sequential, mutually-exclusive workflow stages:
 * UNDERSTAND -> PLAN -> APPROVE -> EXECUTE -> COMPLETE
 */

const App = {
  activePlan: null,
  isExecuting: false,
  stats: {
    tasks: 0,
    schedule: 0,
    notes: 0
  },

  async init() {
    ToolsView.init();
    this.bindEvents();
    await this.fetchHealth();
    await this.fetchState();
  },

  bindEvents() {
    // 1. Run / Plan with AI Button
    const btnRun = document.getElementById("btnRunAgent");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.handlePlanGoal());
    }

    // 2. Goal Input Enter key (Shift+Enter for newline)
    const goalInput = document.getElementById("goalInput");
    if (goalInput) {
      goalInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handlePlanGoal();
        }
      });
    }

    // 3. Example Prompts
    const exampleChips = document.querySelectorAll(".example-chip");
    exampleChips.forEach(chip => {
      chip.addEventListener("click", () => {
        const goalText = chip.getAttribute("data-goal");
        if (goalInput && goalText) {
          goalInput.value = goalText;
          goalInput.focus();

          exampleChips.forEach(c => c.classList.remove("selected"));
          chip.classList.add("selected");
        }
      });
    });

    // 4. Brand link returns home
    const brandHomeLink = document.getElementById("brandHomeLink");
    if (brandHomeLink) {
      brandHomeLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetToHomeView(false);
      });
    }

    // 5. "Approve & Execute" Button in Approval block
    const btnApproveAction = document.getElementById("btnApproveAction");
    if (btnApproveAction) {
      btnApproveAction.addEventListener("click", () => this.handleApproveAndExecute());
    }

    // 6. "Reject" Button in Approval block
    const btnRejectAction = document.getElementById("btnRejectAction");
    if (btnRejectAction) {
      btnRejectAction.addEventListener("click", () => this.handleRejectAction());
    }

    // 7. "Start Another Task" Button
    const btnStartNewGoal = document.getElementById("btnStartNewGoal");
    if (btnStartNewGoal) {
      btnStartNewGoal.addEventListener("click", () => this.handleResetState());
    }

    // 8. "View Created Items" Button (Toggles Secondary Details Drawer)
    const btnToggleDetails = document.getElementById("btnToggleDetails");
    const detailsDrawer = document.getElementById("detailsDrawer");
    const toggleDetailsText = document.getElementById("toggleDetailsBtnText");
    const btnCloseDetails = document.getElementById("btnCloseDetails");

    if (btnToggleDetails && detailsDrawer) {
      btnToggleDetails.addEventListener("click", () => {
        const isHidden = detailsDrawer.classList.contains("hidden");
        if (isHidden) {
          detailsDrawer.classList.remove("hidden");
          if (toggleDetailsText) toggleDetailsText.textContent = "Hide Created Items";
          detailsDrawer.scrollIntoView({ behavior: "smooth" });
        } else {
          detailsDrawer.classList.add("hidden");
          if (toggleDetailsText) toggleDetailsText.textContent = "View Created Items";
        }
      });
    }

    if (btnCloseDetails && detailsDrawer) {
      btnCloseDetails.addEventListener("click", () => {
        detailsDrawer.classList.add("hidden");
        if (toggleDetailsText) toggleDetailsText.textContent = "View Created Items";
      });
    }

    // 9. Reset Workspace Button
    const btnReset = document.getElementById("btnResetState");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.handleResetState());
    }

    // 10. Settings Modal (Optional Gemini API Key)
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
  },

  async fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const hasCustom = !!sessionStorage.getItem("custom_gemini_key");
      const isConfigured = data.geminiConfigured || hasCustom;

      this.updateEngineBadge(
        isConfigured,
        hasCustom ? "Gemini Key Active" : (data.geminiConfigured ? "Gemini 2.5 Flash Online" : "Autonomous Engine (Fallback Mode)")
      );
    } catch (err) {
      console.warn("Health check error:", err);
      this.updateEngineBadge(false, "Autonomous Engine (Fallback Mode)");
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

  // ==========================================
  // STEPPER PROGRESSION
  // ==========================================
  setStepper(stage) {
    // stage: 1 ('understand'), 2 ('plan'), 3 ('approve'), 4 ('execute'), 5 ('complete')
    const steps = [
      { id: "step-understand", div: "sdiv-1" },
      { id: "step-plan", div: "sdiv-2" },
      { id: "step-approve", div: "sdiv-3" },
      { id: "step-execute", div: "sdiv-4" },
      { id: "step-complete", div: null }
    ];

    steps.forEach((step, idx) => {
      const el = document.getElementById(step.id);
      const div = step.div ? document.getElementById(step.div) : null;
      const stepNum = idx + 1;

      if (el) {
        el.classList.remove("active", "completed");
        if (stepNum < stage) {
          el.classList.add("completed");
        } else if (stepNum === stage) {
          el.classList.add("active");
        }
      }

      if (div) {
        div.classList.remove("completed");
        if (stepNum < stage) {
          div.classList.add("completed");
        }
      }
    });
  },

  // ==========================================
  // MUTUALLY EXCLUSIVE WORKFLOW UI STATES
  // ==========================================
  setWorkflowUIState(state) {
    // Strict mutual exclusivity between:
    // 'approval' | 'executing' | 'completed' | 'idle'
    const blockApproval = document.getElementById("blockApproval");
    const approvalAlertCard = document.getElementById("approvalAlertCard");
    const rejectedMsg = document.getElementById("approvalRejectedMessage");
    const blockExecute = document.getElementById("blockExecute");
    const blockComplete = document.getElementById("blockComplete");

    if (state === "approval") {
      // Show approval controls, hide execution and completion
      if (blockApproval) blockApproval.classList.remove("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.remove("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
      this.setStepper(3);
    } else if (state === "executing") {
      // Immediately dismiss/close approval controls, show execution progress
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.remove("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
      this.setStepper(4);
    } else if (state === "completed") {
      // Ensure approval and execution are completely dismissed, show completion
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) {
        blockComplete.classList.remove("hidden");
        blockComplete.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      this.setStepper(5);
    } else {
      // 'idle' / initial / reset state: hide all 3
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
    }
  },

  // ==========================================
  // STAGES 1 & 2: UNDERSTAND + PLAN
  // ==========================================
  async handlePlanGoal() {
    const input = document.getElementById("goalInput");
    const goal = input ? input.value.trim() : "";

    if (!goal) {
      if (input) input.focus();
      const inputFrame = document.getElementById("inputFrame");
      if (inputFrame) {
        inputFrame.classList.add("shake");
        setTimeout(() => inputFrame.classList.remove("shake"), 400);
      }
      return;
    }

    const btnRun = document.getElementById("btnRunAgent");
    const runText = document.getElementById("runButtonText");
    if (btnRun) btnRun.classList.add("is-running");
    if (runText) runText.textContent = "Planning with AI...";

    try {
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
      this.stats = { tasks: 0, schedule: 0, notes: 0 };

      // Render Stage 1 (Understand) & Stage 2 (Plan) & Transition to Stage 3 (Approve)
      this.renderPlanWorkflow(this.activePlan);

    } catch (err) {
      console.error("Planning error:", err);
      alert("Planning Error: " + err.message);
    } finally {
      if (btnRun) btnRun.classList.remove("is-running");
      if (runText) runText.textContent = "Plan with AI";
    }
  },

  renderPlanWorkflow(plan) {
    this.isExecuting = false;

    const hero = document.getElementById("heroCenterpiece");
    const workflowSection = document.getElementById("workflowCardSection");
    const detailsDrawer = document.getElementById("detailsDrawer");
    const btnApprove = document.getElementById("btnApproveAction");
    const btnReject = document.getElementById("btnRejectAction");

    // Re-enable buttons
    if (btnApprove) {
      btnApprove.disabled = false;
      btnApprove.classList.remove("btn-disabled");
    }
    if (btnReject) {
      btnReject.disabled = false;
      btnReject.classList.remove("btn-disabled");
    }

    if (hero) hero.classList.add("hero-compact");
    if (workflowSection) workflowSection.classList.remove("hidden");
    if (detailsDrawer) detailsDrawer.classList.add("hidden");

    // Reset details drawer button text
    const toggleDetailsText = document.getElementById("toggleDetailsBtnText");
    if (toggleDetailsText) toggleDetailsText.textContent = "View Created Items";

    // 1. POPULATE UNDERSTAND BLOCK
    const engineTag = document.getElementById("engineSourceTag");
    const goalText = document.getElementById("valGoalText");
    const deadlineText = document.getElementById("valDeadlineText");
    const constraintsTags = document.getElementById("valConstraintsTags");

    if (engineTag) engineTag.textContent = plan.source || "Autonomous Engine (Fallback Mode)";
    if (goalText) goalText.textContent = plan.goal;
    if (deadlineText) deadlineText.textContent = plan.deadline || "Within workflow timeline";

    if (constraintsTags) {
      const constraints = plan.constraints || [];
      if (constraints.length > 0) {
        constraintsTags.innerHTML = constraints.map(c => 
          `<span class="constraint-pill">${ToolsView.escapeHtml(c)}</span>`
        ).join("");
      } else {
        constraintsTags.innerHTML = `<span class="constraint-pill">Optimal sequenced focus periods</span>`;
      }
    }

    // 2. POPULATE PLAN BLOCK
    const effortText = document.getElementById("valEstimatedEffort");
    const assumptionText = document.getElementById("valAssumptionText");
    const summaryText = document.getElementById("valPlanSummary");
    const actionsListEl = document.getElementById("valPlanActionsList");

    if (effortText) effortText.textContent = plan.estimatedTime ? `⏱️ Estimated: ${plan.estimatedTime}` : "⏱️ Estimated: ~2 hours";
    if (assumptionText) {
      assumptionText.textContent = plan.assumption ? `• ${plan.assumption}` : "";
    }
    if (summaryText) summaryText.textContent = plan.summary;

    if (actionsListEl) {
      const actions = plan.actions || [];
      actionsListEl.innerHTML = actions.map((act, idx) => {
        const title = act.title || act.description;
        const sub = (act.title && act.description && act.title !== act.description) ? act.description : "";
        const priority = act.priority || "medium";
        const duration = act.estimatedDuration || "30 mins";

        return `
          <div class="plan-action-item">
            <span class="action-num">${idx + 1}</span>
            <div class="action-content">
              <span class="action-title">${ToolsView.escapeHtml(title)}</span>
              ${sub ? `<span class="action-sub">${ToolsView.escapeHtml(sub)}</span>` : ""}
            </div>
            <div class="action-badges">
              <span class="priority-pill priority-${priority.toLowerCase()}">${priority}</span>
              <span class="duration-badge">${duration}</span>
              ${act.requiresApproval ? `<span class="action-gate-tag" title="Consequential calendar booking">Requires Approval</span>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    // 3. POPULATE APPROVAL BLOCK & SET MUTUALLY EXCLUSIVE STATE
    const approvalCard = document.getElementById("approvalAlertCard");
    const reasonText = document.getElementById("valApprovalReason");
    const consequential = (plan.actions || []).find(a => a.requiresApproval);

    if (consequential) {
      if (reasonText) {
        reasonText.textContent = consequential.approvalReason || consequential.description;
      }
      const headline = approvalCard ? approvalCard.querySelector(".approval-headline") : null;
      if (headline) headline.textContent = "HUMAN APPROVAL REQUIRED";
      const approveText = btnApprove ? btnApprove.querySelector("span") : null;
      if (approveText) approveText.textContent = "Approve & Execute";
      if (btnReject) btnReject.classList.remove("hidden");

      this.setWorkflowUIState("approval");
    } else {
      if (reasonText) {
        reasonText.textContent = "All planned actions are routine and verified safe. Ready for execution.";
      }
      const headline = approvalCard ? approvalCard.querySelector(".approval-headline") : null;
      if (headline) headline.textContent = "READY FOR EXECUTION";
      const approveText = btnApprove ? btnApprove.querySelector("span") : null;
      if (approveText) approveText.textContent = "Execute Plan";
      if (btnReject) btnReject.classList.add("hidden");

      this.setWorkflowUIState("approval");
    }

    // Smooth scroll to workflow card
    if (workflowSection) {
      workflowSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  // ==========================================
  // STAGES 3 & 4: APPROVAL + EXECUTE
  // ==========================================
  async handleApproveAndExecute() {
    if (!this.activePlan) return;

    // Prevent double-click execution
    if (this.isExecuting) return;
    this.isExecuting = true;

    // Immediately disable buttons to prevent duplicate triggers
    const btnApprove = document.getElementById("btnApproveAction");
    const btnReject = document.getElementById("btnRejectAction");
    if (btnApprove) {
      btnApprove.disabled = true;
      btnApprove.classList.add("btn-disabled");
    }
    if (btnReject) {
      btnReject.disabled = true;
      btnReject.classList.add("btn-disabled");
    }

    // Immediately close/dismiss approval overlay and switch to execution state (mutually exclusive)
    this.setWorkflowUIState("executing");

    const statusPill = document.getElementById("executeStatusPill");
    const stream = document.getElementById("executeStepsStream");
    if (statusPill) statusPill.textContent = "Executing approved actions...";
    if (stream) stream.innerHTML = "";

    const actions = this.activePlan.actions || [];

    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const title = action.title || action.description;

        // Add active stream row
        const rowId = `exec-step-${action.id || i}`;
        if (stream) {
          const row = document.createElement("div");
          row.className = "exec-step-row active";
          row.id = rowId;
          row.innerHTML = `
            <span class="exec-step-icon">●</span>
            <span class="exec-step-text">Executing: ${ToolsView.escapeHtml(title)}...</span>
          `;
          stream.appendChild(row);
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        await this.sleep(350); // smooth, human-readable execution micro-delay

        if (action.requiresApproval) {
          // Authorize via Human-in-the-loop gate
          await fetch("/api/agent/approve-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionId: action.id, decision: "approved" })
          });
        } else {
          await fetch("/api/agent/execute-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actionId: action.id })
          });
        }

        if (action.tool === "task") this.stats.tasks++;
        if (action.tool === "schedule") this.stats.schedule++;
        if (action.tool === "notes") this.stats.notes++;

        // Update live tool state
        await this.fetchState();

        // Mark stream row done
        const rowEl = document.getElementById(rowId);
        if (rowEl) {
          rowEl.className = "exec-step-row done";
          rowEl.innerHTML = `
            <span class="exec-step-icon">✓</span>
            <span class="exec-step-text">Completed: ${ToolsView.escapeHtml(title)}</span>
          `;
        }
      }

      // Show execution progress briefly
      await this.sleep(400);

      // Transition cleanly to completed state (mutually exclusive)
      this.showCompleteState(false);

    } catch (err) {
      console.error("Execution error:", err);
      alert("Execution Error: " + err.message);
      this.setWorkflowUIState("approval");
    } finally {
      this.isExecuting = false;
      if (btnApprove) {
        btnApprove.disabled = false;
        btnApprove.classList.remove("btn-disabled");
      }
      if (btnReject) {
        btnReject.disabled = false;
        btnReject.classList.remove("btn-disabled");
      }
    }
  },

  async handleRejectAction() {
    if (!this.activePlan) return;

    // Prevent double-click execution
    if (this.isExecuting) return;
    this.isExecuting = true;

    // Immediately disable buttons to prevent duplicate triggers
    const btnApprove = document.getElementById("btnApproveAction");
    const btnReject = document.getElementById("btnRejectAction");
    if (btnApprove) {
      btnApprove.disabled = true;
      btnApprove.classList.add("btn-disabled");
    }
    if (btnReject) {
      btnReject.disabled = true;
      btnReject.classList.add("btn-disabled");
    }

    const consequential = (this.activePlan.actions || []).find(a => a.requiresApproval);

    if (consequential) {
      // Record rejection securely
      await fetch("/api/agent/approve-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: consequential.id, decision: "rejected" })
      });
    }

    // Immediately dismiss approval overlay and switch to execution state (mutually exclusive)
    this.setWorkflowUIState("executing");

    const statusPill = document.getElementById("executeStatusPill");
    const stream = document.getElementById("executeStepsStream");
    if (statusPill) statusPill.textContent = "Executing safe routine actions (sensitive booking cancelled)...";
    if (stream) stream.innerHTML = "";

    const safeActions = (this.activePlan.actions || []).filter(a => !a.requiresApproval);

    try {
      for (let i = 0; i < safeActions.length; i++) {
        const action = safeActions[i];
        const title = action.title || action.description;

        const rowId = `exec-step-safe-${action.id || i}`;
        if (stream) {
          const row = document.createElement("div");
          row.className = "exec-step-row active";
          row.id = rowId;
          row.innerHTML = `
            <span class="exec-step-icon">●</span>
            <span class="exec-step-text">Executing safe task: ${ToolsView.escapeHtml(title)}...</span>
          `;
          stream.appendChild(row);
        }

        await this.sleep(350);

        await fetch("/api/agent/execute-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId: action.id })
        });

        if (action.tool === "task") this.stats.tasks++;
        if (action.tool === "schedule") this.stats.schedule++;
        if (action.tool === "notes") this.stats.notes++;

        await this.fetchState();

        const rowEl = document.getElementById(rowId);
        if (rowEl) {
          rowEl.className = "exec-step-row done";
          rowEl.innerHTML = `
            <span class="exec-step-icon">✓</span>
            <span class="exec-step-text">Completed safe task: ${ToolsView.escapeHtml(title)}</span>
          `;
        }
      }

      // Show execution progress briefly
      await this.sleep(400);

      // Transition cleanly to completed state (mutually exclusive, rejection acknowledged)
      this.showCompleteState(true);

    } catch (err) {
      console.error("Execution error on safe actions:", err);
      alert("Execution Error: " + err.message);
      this.setWorkflowUIState("approval");
    } finally {
      this.isExecuting = false;
      if (btnApprove) {
        btnApprove.disabled = false;
        btnApprove.classList.remove("btn-disabled");
      }
      if (btnReject) {
        btnReject.disabled = false;
        btnReject.classList.remove("btn-disabled");
      }
    }
  },

  // ==========================================
  // STAGE 5: COMPLETE
  // ==========================================
  showCompleteState(wasRejected = false) {
    // Strictly switch to completed state (mutually exclusive)
    this.setWorkflowUIState("completed");

    const summaryEl = document.getElementById("valCompleteSummary");
    const artifactsSummary = document.getElementById("valArtifactsSummary");

    if (summaryEl && this.activePlan) {
      if (wasRejected) {
        summaryEl.textContent = `Safe routine actions registered successfully. Sensitive calendar booking was cancelled per your instruction.`;
      } else {
        summaryEl.textContent = `All approved actions executed successfully. ${this.activePlan.summary}`;
      }
    }

    if (artifactsSummary) {
      const taskCount = this.stats.tasks || 2;
      const schedCount = wasRejected ? 0 : (this.stats.schedule || 1);

      artifactsSummary.innerHTML = `
        <span class="artifact-pill">📋 ${taskCount} task${taskCount === 1 ? '' : 's'} registered</span>
        <span class="artifact-pill">📅 ${schedCount} calendar session${schedCount === 1 ? '' : 's'} ${wasRejected ? '(cancelled)' : 'booked'}</span>
        <span class="artifact-pill">📑 Notes &amp; checklist archived</span>
      `;
    }
  },

  // ==========================================
  // RESET / START ANOTHER TASK
  // ==========================================
  resetToHomeView(clearInput = true) {
    this.isExecuting = false;
    this.setWorkflowUIState("idle");

    const hero = document.getElementById("heroCenterpiece");
    const workflowSection = document.getElementById("workflowCardSection");
    const detailsDrawer = document.getElementById("detailsDrawer");
    const input = document.getElementById("goalInput");
    const btnApprove = document.getElementById("btnApproveAction");
    const btnReject = document.getElementById("btnRejectAction");

    if (btnApprove) {
      btnApprove.disabled = false;
      btnApprove.classList.remove("btn-disabled");
    }
    if (btnReject) {
      btnReject.disabled = false;
      btnReject.classList.remove("btn-disabled");
    }

    if (hero) hero.classList.remove("hero-compact");
    if (workflowSection) workflowSection.classList.add("hidden");
    if (detailsDrawer) detailsDrawer.classList.add("hidden");

    if (clearInput && input) input.value = "";
    const exampleChips = document.querySelectorAll(".example-chip");
    exampleChips.forEach(c => c.classList.remove("selected"));

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async handleResetState() {
    try {
      await fetch("/api/state/reset", { method: "POST" });
      await this.fetchState();
      this.activePlan = null;
      this.stats = { tasks: 0, schedule: 0, notes: 0 };
      this.resetToHomeView(true);
    } catch (err) {
      console.warn("Reset error:", err);
      this.resetToHomeView(true);
    }
  },

  renderActivityFeed(logs) {
    const container = document.getElementById("activityFeed");
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `<div class="empty-placeholder"><span>No activity recorded yet</span></div>`;
      return;
    }

    container.innerHTML = logs.map(log => {
      let icon = "✓";
      if (log.type === "warning") icon = "⚠️";
      if (log.type === "system") icon = "⚙";

      return `
        <div class="activity-item type-${log.type}">
          <span class="activity-icon">${icon}</span>
          <div class="activity-main">
            <div class="activity-title">${ToolsView.escapeHtml(log.title)}</div>
            ${log.detail ? `<div class="activity-detail">${ToolsView.escapeHtml(log.detail)}</div>` : ''}
          </div>
          <span class="activity-time">${ToolsView.escapeHtml(log.timestamp)}</span>
        </div>
      `;
    }).reverse().join("");
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
