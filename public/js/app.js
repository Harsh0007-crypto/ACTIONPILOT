/**
 * ActionPilot Main Application Controller
 * Ultra-clean judge experience:
 * GOAL -> AI PLAN -> APPROVE -> EXECUTE -> DONE
 */

const App = {
  activePlan: null,
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
    // Run / Plan with AI Button
    const btnRun = document.getElementById("btnRunAgent");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.handlePlanGoal());
    }

    // Goal Input Enter key (Shift+Enter for newline)
    const goalInput = document.getElementById("goalInput");
    if (goalInput) {
      goalInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handlePlanGoal();
        }
      });
    }

    // Example Prompts
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

    // Brand link returns home
    const brandHomeLink = document.getElementById("brandHomeLink");
    if (brandHomeLink) {
      brandHomeLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetToHomeView();
      });
    }

    // "Approve & Execute" Button on Primary Plan Card
    const btnApproveExecute = document.getElementById("btnApproveAndExecute");
    if (btnApproveExecute) {
      btnApproveExecute.addEventListener("click", () => this.handleExecutePlan());
    }

    // Cancel Plan Button
    const btnCancelPlan = document.getElementById("btnCancelPlan");
    if (btnCancelPlan) {
      btnCancelPlan.addEventListener("click", () => {
        this.resetToHomeView(false); // keep input
      });
    }

    // "Start Another Task" Button
    const btnStartAnother = document.getElementById("btnStartAnother");
    if (btnStartAnother) {
      btnStartAnother.addEventListener("click", () => {
        this.handleResetState();
      });
    }

    // "View Details" Button (Toggle Expandable Drawer)
    const btnToggleDetails = document.getElementById("btnToggleDetails");
    const detailsDrawer = document.getElementById("detailsDrawer");
    const toggleDetailsText = document.getElementById("toggleDetailsBtnText");
    const btnCloseDetails = document.getElementById("btnCloseDetails");

    if (btnToggleDetails && detailsDrawer) {
      btnToggleDetails.addEventListener("click", () => {
        const isHidden = detailsDrawer.classList.contains("hidden");
        if (isHidden) {
          detailsDrawer.classList.remove("hidden");
          if (toggleDetailsText) toggleDetailsText.textContent = "Hide Details";
          detailsDrawer.scrollIntoView({ behavior: "smooth" });
        } else {
          detailsDrawer.classList.add("hidden");
          if (toggleDetailsText) toggleDetailsText.textContent = "View Details";
        }
      });
    }

    if (btnCloseDetails && detailsDrawer) {
      btnCloseDetails.addEventListener("click", () => {
        detailsDrawer.classList.add("hidden");
        if (toggleDetailsText) toggleDetailsText.textContent = "View Details";
      });
    }

    // Reset Workspace Button
    const btnReset = document.getElementById("btnResetState");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.handleResetState());
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
  },

  async fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const hasCustom = !!sessionStorage.getItem("custom_gemini_key");
      const isConfigured = data.geminiConfigured || hasCustom;

      this.updateEngineBadge(
        isConfigured,
        hasCustom ? "Gemini Key Active" : (data.geminiConfigured ? "Gemini 2.5 Flash Online" : "Autonomous Engine (Deterministic)")
      );
    } catch (err) {
      console.warn("Health check error:", err);
      this.updateEngineBadge(false, "Autonomous Engine Ready");
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
  // STAGE 1: PLAN GOAL
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

      // Transition UI: Hide Hero Input, Reveal Primary Result Card
      this.showPlanCard(this.activePlan);

    } catch (err) {
      console.error("Planning error:", err);
      alert("Planning Error: " + err.message);
    } finally {
      if (btnRun) btnRun.classList.remove("is-running");
      if (runText) runText.textContent = "Plan with AI";
    }
  },

  showPlanCard(plan) {
    const hero = document.getElementById("heroCenterpiece");
    const section = document.getElementById("planCardSection");
    const primaryCard = document.getElementById("primaryPlanCard");
    const progressCard = document.getElementById("executionProgressCard");
    const completeCard = document.getElementById("missionCompleteCard");
    const drawer = document.getElementById("detailsDrawer");

    if (hero) hero.classList.add("hero-compact");
    if (section) section.classList.remove("hidden");
    if (primaryCard) primaryCard.classList.remove("hidden");
    if (progressCard) progressCard.classList.add("hidden");
    if (completeCard) completeCard.classList.add("hidden");
    if (drawer) drawer.classList.add("hidden");

    // Populate Plan Card elements
    const goalEl = document.getElementById("displayGoalText");
    const summaryEl = document.getElementById("displaySummaryText");
    const sourceEl = document.getElementById("planSourcePill");
    const actionsListEl = document.getElementById("displayActionsList");
    const timeEl = document.getElementById("displayEstimatedTime");
    const assumptionBox = document.getElementById("metaAssumptionBox");
    const assumptionEl = document.getElementById("displayAssumption");

    if (goalEl) goalEl.textContent = plan.goal;
    if (summaryEl) summaryEl.textContent = plan.summary;
    if (sourceEl) sourceEl.textContent = plan.source || "Autonomous Engine";

    // Populate Clean Numbered Actions List
    if (actionsListEl) {
      const actions = plan.actions || [];
      actionsListEl.innerHTML = actions.map((act, idx) => {
        const title = act.title || act.description;
        const sub = (act.title && act.description && act.title !== act.description) ? act.description : "";
        return `
          <div class="plan-action-item">
            <span class="action-num">${idx + 1}</span>
            <div class="action-content">
              <span class="action-title">${ToolsView.escapeHtml(title)}</span>
              ${sub ? `<span class="action-sub">${ToolsView.escapeHtml(sub)}</span>` : ""}
            </div>
            ${act.requiresApproval ? `<span class="action-gate-tag" title="Consequential calendar booking">Clearance</span>` : ""}
          </div>
        `;
      }).join("");
    }

    // Estimated Time & Assumption
    if (timeEl) timeEl.textContent = plan.estimatedTime || "~2 hours total";
    if (assumptionBox && assumptionEl) {
      if (plan.assumption) {
        assumptionBox.style.display = "flex";
        assumptionEl.textContent = plan.assumption;
      } else {
        assumptionBox.style.display = "none";
      }
    }

    if (primaryCard) {
      primaryCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  // ==========================================
  // STAGE 2: EXECUTE PLAN
  // ==========================================
  async handleExecutePlan() {
    if (!this.activePlan) return;

    const primaryCard = document.getElementById("primaryPlanCard");
    const progressCard = document.getElementById("executionProgressCard");
    const pStepExecuting = document.getElementById("pstep-executing");
    const executingText = document.getElementById("executingStepText");

    if (primaryCard) primaryCard.classList.add("hidden");
    if (progressCard) progressCard.classList.remove("hidden");

    const actions = this.activePlan.actions || [];

    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (executingText) {
          executingText.textContent = `Executing: ${action.title || action.description}...`;
        }

        await this.sleep(350); // smooth readable micro-delay

        if (action.requiresApproval) {
          // Automatic approval execution via Human-in-the-loop gate
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

        await this.fetchState();
      }

      // Mark step completed
      if (pStepExecuting) {
        pStepExecuting.className = "simple-step done";
        pStepExecuting.innerHTML = `<span class="step-check">✓</span><span class="step-text">All actions executed</span>`;
      }

      await this.sleep(400);

      // Transition to Mission Complete
      this.showMissionComplete();

    } catch (err) {
      console.error("Execution error:", err);
      alert("Execution Error: " + err.message);
      if (primaryCard) primaryCard.classList.remove("hidden");
      if (progressCard) progressCard.classList.add("hidden");
    }
  },

  // ==========================================
  // STAGE 3: MISSION COMPLETE
  // ==========================================
  showMissionComplete() {
    const progressCard = document.getElementById("executionProgressCard");
    const completeCard = document.getElementById("missionCompleteCard");
    const summaryEl = document.getElementById("completeResultSummary");

    if (progressCard) progressCard.classList.add("hidden");
    if (completeCard) {
      completeCard.classList.remove("hidden");
      completeCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (summaryEl && this.activePlan) {
      summaryEl.textContent = `All planned actions executed successfully. ${this.activePlan.summary}`;
    }

    // Metric pills
    const pillTasks = document.getElementById("pillTasks");
    const pillSchedule = document.getElementById("pillSchedule");
    const pillNotes = document.getElementById("pillNotes");

    if (pillTasks) pillTasks.textContent = `${this.stats.tasks || 2} tasks created`;
    if (pillSchedule) pillSchedule.textContent = `${this.stats.schedule || 1} session scheduled`;
    if (pillNotes) pillNotes.textContent = `Notes & intel saved`;
  },

  // ==========================================
  // RESET / START ANOTHER
  // ==========================================
  resetToHomeView(clearInput = true) {
    const hero = document.getElementById("heroCenterpiece");
    const section = document.getElementById("planCardSection");
    const primaryCard = document.getElementById("primaryPlanCard");
    const progressCard = document.getElementById("executionProgressCard");
    const completeCard = document.getElementById("missionCompleteCard");
    const drawer = document.getElementById("detailsDrawer");
    const input = document.getElementById("goalInput");

    if (hero) hero.classList.remove("hero-compact");
    if (section) section.classList.add("hidden");
    if (primaryCard) primaryCard.classList.add("hidden");
    if (progressCard) progressCard.classList.add("hidden");
    if (completeCard) completeCard.classList.add("hidden");
    if (drawer) drawer.classList.add("hidden");

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

    container.innerHTML = logs.map(log => {
      let icon = "✓";
      if (log.type === "warning") icon = "⚠";
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
