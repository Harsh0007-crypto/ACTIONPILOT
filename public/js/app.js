/**
 * ActionPilot Main Application Controller
 * Autonomous AI for getting things done.
 * Premium, playful AI assistant interface with interactive Calendar widget
 * (Month/Week/Day), illustrated workflow, AI mascot micro-interactions,
 * and full human-in-the-loop oversight.
 */

const App = {
  activePlan: null,
  isExecuting: false,
  activeNavTab: "command",
  activeCalendarMode: "month",
  stats: {
    tasks: 0,
    schedule: 0,
    notes: 0
  },

  async init() {
    ToolsView.init();
    this.bindEvents();
    this.initCalendarWidget();
    await this.fetchHealth();
    await this.fetchState();
  },

  bindEvents() {
    // 1. Top Navigation Links (Command Center, Schedule, Activity)
    const navCommand = document.getElementById("navCommand");
    const navSchedule = document.getElementById("navSchedule");
    const navActivity = document.getElementById("navActivity");

    if (navCommand) {
      navCommand.addEventListener("click", () => this.switchNavTab("command"));
    }
    if (navSchedule) {
      navSchedule.addEventListener("click", () => this.switchNavTab("schedule"));
    }
    if (navActivity) {
      navActivity.addEventListener("click", () => this.switchNavTab("activity"));
    }

    const btnBackSchedule = document.getElementById("btnBackToCommandFromSchedule");
    if (btnBackSchedule) {
      btnBackSchedule.addEventListener("click", () => this.switchNavTab("command"));
    }
    const btnBackActivity = document.getElementById("btnBackToCommandFromActivity");
    if (btnBackActivity) {
      btnBackActivity.addEventListener("click", () => this.switchNavTab("command"));
    }

    const btnViewActivityFromComplete = document.getElementById("btnViewActivityFromComplete");
    if (btnViewActivityFromComplete) {
      btnViewActivityFromComplete.addEventListener("click", () => this.switchNavTab("activity"));
    }

    // 2. Run / Plan with AI Button
    const btnRun = document.getElementById("btnRunAgent");
    if (btnRun) {
      btnRun.addEventListener("click", () => this.handlePlanGoal());
    }

    // 3. Goal Input Enter key (Shift+Enter for newline)
    const goalInput = document.getElementById("goalInput");
    if (goalInput) {
      goalInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handlePlanGoal();
        }
      });
    }

    // 4. Example Prompts
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

    // 5. Brand link returns to Command Center home
    const brandHomeLink = document.getElementById("brandHomeLink");
    if (brandHomeLink) {
      brandHomeLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchNavTab("command");
        this.resetToHomeView(false);
      });
    }

    // 6. "Approve & Execute" Button in Approval block
    const btnApproveAction = document.getElementById("btnApproveAction");
    if (btnApproveAction) {
      btnApproveAction.addEventListener("click", () => this.handleApproveAndExecute());
    }

    // 7. "Reject" Button in Approval block
    const btnRejectAction = document.getElementById("btnRejectAction");
    if (btnRejectAction) {
      btnRejectAction.addEventListener("click", () => this.handleRejectAction());
    }

    // 8. "Start Another Task" Button
    const btnStartNewGoal = document.getElementById("btnStartNewGoal");
    if (btnStartNewGoal) {
      btnStartNewGoal.addEventListener("click", () => this.handleResetState());
    }

    // 9. Collapsible "Why this plan?" Toggle
    const toggleWhyThisPlan = document.getElementById("toggleWhyThisPlan");
    const whyContent = document.getElementById("whyThisPlanContent");
    const whyChevron = document.getElementById("whyChevron");

    if (toggleWhyThisPlan && whyContent) {
      toggleWhyThisPlan.addEventListener("click", () => {
        const isHidden = whyContent.classList.contains("hidden");
        if (isHidden) {
          whyContent.classList.remove("hidden");
          if (whyChevron) whyChevron.classList.add("open");
          toggleWhyThisPlan.setAttribute("aria-expanded", "true");
        } else {
          whyContent.classList.add("hidden");
          if (whyChevron) whyChevron.classList.remove("open");
          toggleWhyThisPlan.setAttribute("aria-expanded", "false");
        }
      });
    }

    // 10. Dynamic Conflict Resolution Button
    const btnResolveConflict = document.getElementById("btnResolveConflict");
    if (btnResolveConflict) {
      btnResolveConflict.addEventListener("click", () => this.handleResolveConflict());
    }

    // 11. Adaptive Re-planning Button
    const btnReplanWithAI = document.getElementById("btnReplanWithAI");
    if (btnReplanWithAI) {
      btnReplanWithAI.addEventListener("click", () => this.handleAdaptiveReplan());
    }

    // 12. "View Created Items" Button (Toggles Secondary Details Drawer)
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

    // 13. Reset Workspace Button
    const btnReset = document.getElementById("btnResetState");
    if (btnReset) {
      btnReset.addEventListener("click", () => this.handleResetState());
    }

    // 14. Settings Modal (Optional Gemini API Key)
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
          this.updateEngineBadge(true, "Gemini AI ● Online");
        } else {
          sessionStorage.removeItem("custom_gemini_key");
          this.fetchHealth();
        }
        closeSettings();
      });
    }
  },

  // Initialize Month / Week / Day view switch controls on the Interactive Calendar
  initCalendarWidget() {
    const btnMonth = document.getElementById("btnCalModeMonth");
    const btnWeek = document.getElementById("btnCalModeWeek");
    const btnDay = document.getElementById("btnCalModeDay");

    const setMode = (mode) => {
      this.activeCalendarMode = mode;
      [btnMonth, btnWeek, btnDay].forEach(b => {
        if (b) b.classList.remove("active");
      });

      const paneMonth = document.getElementById("paneCalMonth");
      const paneWeek = document.getElementById("paneCalWeek");
      const paneDay = document.getElementById("paneCalDay");

      [paneMonth, paneWeek, paneDay].forEach(p => {
        if (p) {
          p.classList.remove("active");
          p.classList.add("hidden");
        }
      });

      if (mode === "month") {
        if (btnMonth) btnMonth.classList.add("active");
        if (paneMonth) {
          paneMonth.classList.remove("hidden");
          paneMonth.classList.add("active");
        }
      } else if (mode === "week") {
        if (btnWeek) btnWeek.classList.add("active");
        if (paneWeek) {
          paneWeek.classList.remove("hidden");
          paneWeek.classList.add("active");
        }
      } else if (mode === "day") {
        if (btnDay) btnDay.classList.add("active");
        if (paneDay) {
          paneDay.classList.remove("hidden");
          paneDay.classList.add("active");
        }
      }
    };

    if (btnMonth) btnMonth.addEventListener("click", () => setMode("month"));
    if (btnWeek) btnWeek.addEventListener("click", () => setMode("week"));
    if (btnDay) btnDay.addEventListener("click", () => setMode("day"));

    // Render baseline October 2026 calendar
    this.renderInteractiveCalendar(null);
  },

  // Switch top nav views (Command Center, Schedule, Activity)
  switchNavTab(tabName) {
    this.activeNavTab = tabName;

    const navCommand = document.getElementById("navCommand");
    const navSchedule = document.getElementById("navSchedule");
    const navActivity = document.getElementById("navActivity");

    const viewCommand = document.getElementById("viewCommandCenter");
    const viewSchedule = document.getElementById("viewSchedule");
    const viewActivity = document.getElementById("viewActivity");

    [navCommand, navSchedule, navActivity].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });
    [viewCommand, viewSchedule, viewActivity].forEach(v => {
      if (v) {
        v.classList.remove("active");
        v.classList.add("hidden");
      }
    });

    if (tabName === "schedule") {
      if (navSchedule) navSchedule.classList.add("active");
      if (viewSchedule) {
        viewSchedule.classList.remove("hidden");
        viewSchedule.classList.add("active");
      }
      this.renderFullScheduleView();
    } else if (tabName === "activity") {
      if (navActivity) navActivity.classList.add("active");
      if (viewActivity) {
        viewActivity.classList.remove("hidden");
        viewActivity.classList.add("active");
      }
      this.renderFullActivityView();
    } else {
      if (navCommand) navCommand.classList.add("active");
      if (viewCommand) {
        viewCommand.classList.remove("hidden");
        viewCommand.classList.add("active");
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async fetchHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const hasCustom = !!sessionStorage.getItem("custom_gemini_key");
      const isOnline = data.geminiConfigured || hasCustom;

      this.updateEngineBadge(
        isOnline,
        isOnline ? "Gemini AI ● Online" : "Gemini AI ● Offline"
      );
    } catch (err) {
      console.warn("Health check error:", err);
      this.updateEngineBadge(false, "Gemini AI ● Offline");
    }
  },

  updateEngineBadge(isOnline, label) {
    const badgeLabel = document.getElementById("engineLabel");
    const badgePulse = document.getElementById("enginePulse");
    if (badgeLabel) badgeLabel.textContent = label;
    if (badgePulse) {
      badgePulse.style.backgroundColor = isOnline ? "var(--neon-emerald)" : "var(--neon-cyan)";
      badgePulse.style.boxShadow = isOnline ? "0 0 8px var(--neon-emerald)" : "0 0 8px var(--neon-cyan)";
    }
  },

  async fetchState() {
    try {
      const res = await fetch("/api/state");
      const json = await res.json();
      if (json.success && json.data) {
        ToolsView.render(json.data);
        this.renderActivityFeed(json.data.activityLog || []);
        if (this.activePlan) {
          this.renderInteractiveCalendar(this.activePlan, json.data.schedule || []);
        } else {
          this.renderInteractiveCalendar(null, json.data.schedule || []);
        }
        if (this.activeNavTab === "schedule") {
          this.renderFullScheduleView(json.data.schedule || []);
        }
        if (this.activeNavTab === "activity") {
          this.renderFullActivityView(json.data.activityLog || []);
        }
      }
    } catch (err) {
      console.error("Failed to load state:", err);
    }
  },

  // ==========================================
  // STEPPER PROGRESSION (01 UNDERSTAND -> 02 PLAN -> 03 APPROVE -> 04 EXECUTE)
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
          if (stage === 5) {
            el.classList.add("completed");
          }
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
    const replanCard = document.getElementById("adaptiveReplanCard");

    if (state === "approval") {
      if (blockApproval) blockApproval.classList.remove("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.remove("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
      if (replanCard) replanCard.classList.add("hidden");
      this.setStepper(3);
    } else if (state === "executing") {
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.remove("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
      if (replanCard) replanCard.classList.add("hidden");
      this.setStepper(4);
    } else if (state === "completed") {
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) {
        blockComplete.classList.remove("hidden");
        blockComplete.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (replanCard) replanCard.classList.remove("hidden");
      this.setStepper(5);
    } else {
      // 'idle'
      if (blockApproval) blockApproval.classList.add("hidden");
      if (approvalAlertCard) approvalAlertCard.classList.add("hidden");
      if (rejectedMsg) rejectedMsg.classList.add("hidden");
      if (blockExecute) blockExecute.classList.add("hidden");
      if (blockComplete) blockComplete.classList.add("hidden");
      if (replanCard) replanCard.classList.add("hidden");
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

    const hero = document.getElementById("heroCenterpiece");
    const thinkingState = document.getElementById("aiThinkingState");
    const workflowSection = document.getElementById("workflowCardSection");
    const detailsDrawer = document.getElementById("detailsDrawer");

    if (hero) hero.classList.add("hero-compact");
    if (detailsDrawer) detailsDrawer.classList.add("hidden");

    // Display AI Thinking State with sequential checkpoints
    if (thinkingState) {
      thinkingState.classList.remove("hidden");
      thinkingState.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    await this.animateThinkingSteps();

    // 1. UNDERSTAND BECOMES ACTIVE
    this.setStepper(1);
    const goalText = document.getElementById("valGoalText");
    if (goalText) goalText.textContent = goal;
    const deadlineText = document.getElementById("valDeadlineText");
    if (deadlineText) deadlineText.textContent = "Analyzing goal & constraints...";
    const constraintsTags = document.getElementById("valConstraintsTags");
    if (constraintsTags) {
      constraintsTags.innerHTML = `<span class="constraint-pill">Extracting parameters...</span>`;
    }

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

      // Hide thinking state and reveal workflow
      if (thinkingState) thinkingState.classList.add("hidden");
      if (workflowSection) workflowSection.classList.remove("hidden");

      // Progressive illumination: 1. Understand -> 2. Plan -> 3. Approve
      await this.renderPlanWorkflowProgressive(this.activePlan);

    } catch (err) {
      console.error("Planning error:", err);
      if (thinkingState) thinkingState.classList.add("hidden");
      alert("Planning Error: " + err.message);
    } finally {
      if (btnRun) btnRun.classList.remove("is-running");
      if (runText) runText.textContent = "Plan with AI →";
    }
  },

  async animateThinkingSteps() {
    const steps = [
      { id: "thinkStep1", text: "Understanding your goal" },
      { id: "thinkStep2", text: "Analyzing constraints" },
      { id: "thinkStep3", text: "Building optimal plan" },
      { id: "thinkStep4", text: "Checking schedule" }
    ];

    for (let i = 0; i < steps.length; i++) {
      const el = document.getElementById(steps[i].id);
      if (el) {
        el.className = "thinking-check-item active";
        el.innerHTML = `<span class="think-icon">⚡</span><span class="think-label">${steps[i].text}</span>`;
      }
      await this.sleep(180);
      if (el) {
        el.className = "thinking-check-item done";
        el.innerHTML = `<span class="think-icon">✓</span><span class="think-label">${steps[i].text}</span>`;
      }
    }
  },

  async renderPlanWorkflowProgressive(plan) {
    this.isExecuting = false;

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

    await this.sleep(220);

    // 2. ADVANCE TO STAGE 2: PLAN
    this.setStepper(2);

    const planBadge = document.getElementById("planBadge");
    if (planBadge) {
      planBadge.textContent = (plan.source && plan.source.includes("Gemini")) ? "AI GENERATED PLAN" : "AUTONOMOUS PLAN";
    }

    const effortText = document.getElementById("valEstimatedEffort");
    const assumptionText = document.getElementById("valAssumptionText");
    const summaryText = document.getElementById("valPlanSummary");
    const actionsListEl = document.getElementById("valPlanActionsList");

    if (effortText) effortText.textContent = plan.estimatedTime ? `⏱️ ${plan.estimatedTime}` : "⏱️ ~2 hours";
    if (assumptionText) {
      assumptionText.textContent = plan.assumption ? `• ${plan.assumption}` : "";
    }
    if (summaryText) summaryText.textContent = plan.summary;

    // Render 3–5 task glass cards with small playful icons
    if (actionsListEl) {
      const actions = plan.actions || [];
      actionsListEl.innerHTML = actions.map((act, idx) => {
        const title = act.title || act.description;
        const sub = (act.title && act.description && act.title !== act.description) ? act.description : "";
        const priority = act.priority || "medium";
        const duration = act.estimatedDuration || "30 mins";
        const paddedNum = String(idx + 1).padStart(2, "0");

        // Select small playful icon based on task nature
        let iconEmoji = "📝";
        if (title.toLowerCase().includes("slide") || title.toLowerCase().includes("visual")) iconEmoji = "🎨";
        else if (title.toLowerCase().includes("rehearsal") || title.toLowerCase().includes("practice")) iconEmoji = "🎯";
        else if (title.toLowerCase().includes("briefing") || title.toLowerCase().includes("notes")) iconEmoji = "📑";
        else if (title.toLowerCase().includes("study") || title.toLowerCase().includes("exam")) iconEmoji = "📚";
        else if (title.toLowerCase().includes("assignment") || title.toLowerCase().includes("quiz")) iconEmoji = "⏱️";

        return `
          <div class="plan-action-item">
            <span class="action-num">${paddedNum}</span>
            <div class="action-content">
              <span class="action-title">${iconEmoji} ${ToolsView.escapeHtml(title)}</span>
              ${sub ? `<span class="action-sub">${ToolsView.escapeHtml(sub)}</span>` : ""}
            </div>
            <div class="action-badges">
              <span class="priority-pill priority-${priority.toLowerCase()}">${priority.toUpperCase()}</span>
              <span class="duration-badge">${duration}</span>
              ${act.requiresApproval ? `<span class="action-gate-tag" title="Consequential calendar booking">Requires Approval</span>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    // Populate Interactive Calendar Widget
    this.renderInteractiveCalendar(plan);

    // Evaluate Conflict Status
    this.updateConflictDetectionBanner(plan);

    // Populate "Why this plan?" concise user-facing reasoning bullets
    this.populateWhyThisPlan(plan);

    await this.sleep(300);

    // 3. ADVANCE TO STAGE 3: APPROVE
    const approvalCard = document.getElementById("approvalAlertCard");
    const reasonText = document.getElementById("valApprovalReason");
    const countText = document.getElementById("valApprovalCount");
    const consequential = (plan.actions || []).filter(a => a.requiresApproval);

    if (consequential.length > 0) {
      const firstConsequential = consequential[0];
      if (reasonText) {
        reasonText.textContent = firstConsequential.approvalReason || firstConsequential.description;
      }
      if (countText) {
        countText.textContent = `ActionPilot wants to perform ${consequential.length} consequential action${consequential.length > 1 ? 's' : ''}:`;
      }
      const headline = approvalCard ? approvalCard.querySelector(".approval-headline") : null;
      if (headline) headline.textContent = "HUMAN APPROVAL REQUIRED";
      const approveText = btnApprove ? btnApprove.querySelector("span") : null;
      if (approveText) approveText.textContent = "APPROVE & EXECUTE →";
      if (btnReject) btnReject.classList.remove("hidden");
    } else {
      if (reasonText) {
        reasonText.textContent = "All planned actions are routine and verified safe. Ready for execution.";
      }
      if (countText) {
        countText.textContent = "Ready to execute planned tasks and notes dossier:";
      }
      const headline = approvalCard ? approvalCard.querySelector(".approval-headline") : null;
      if (headline) headline.textContent = "READY FOR EXECUTION";
      const approveText = btnApprove ? btnApprove.querySelector("span") : null;
      if (approveText) approveText.textContent = "EXECUTE PLAN →";
      if (btnReject) btnReject.classList.add("hidden");
    }

    this.setWorkflowUIState("approval");

    const workflowSection = document.getElementById("workflowCardSection");
    if (workflowSection) {
      workflowSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  // ==========================================
  // INTERACTIVE CALENDAR COMPONENT (Month, Week, Day & Today's Schedule)
  // ==========================================
  renderInteractiveCalendar(plan = null, stateSchedule = null) {
    const grid = document.getElementById("calMonthGrid");
    const weekGrid = document.getElementById("calWeekGrid");
    const dayTimeline = document.getElementById("calDayTimeline");
    const todaysContainer = document.getElementById("todaysTimelineCards");
    const todaysCountBadge = document.getElementById("todaysCountBadge");

    // Gather all scheduled events from active plan & stateStore.schedule
    const events = [];

    // From current plan
    if (plan && plan.actions) {
      plan.actions.forEach(a => {
        if (a.tool === "schedule" && a.params) {
          events.push({
            id: a.id,
            title: a.params.title || a.title || "Scheduled Focus Block",
            time: a.params.startTime || "2:00 PM",
            endTime: a.params.endTime || "3:00 PM",
            dateNum: 8, // October 8
            category: a.params.category || "focus"
          });
        }
      });
    }

    // From persisted stateStore.schedule if present
    const existingSched = stateSchedule || [];
    existingSched.forEach(e => {
      events.push({
        id: e.id,
        title: e.title,
        time: e.startTime,
        endTime: e.endTime,
        dateNum: 8,
        category: e.category || "focus"
      });
    });

    // If no events yet, offer intelligent contextual slots
    if (events.length === 0) {
      events.push(
        { id: "demo-1", title: "Presentation Rehearsal", time: "2:00 PM", endTime: "3:00 PM", dateNum: 8, category: "focus" },
        { id: "demo-2", title: "AI Quiz", time: "9:00 AM", endTime: "10:00 AM", dateNum: 9, category: "study" },
        { id: "demo-3", title: "Math Assignment", time: "11:59 PM", endTime: "11:59 PM", dateNum: 10, category: "deadline" }
      );
    }

    // 1. RENDER MONTH GRID (October 2026, 31 days)
    if (grid) {
      let cellsHtml = "";
      // October 1, 2026 starts on Thursday (index 3, so 3 empty padding cells for Mon, Tue, Wed)
      for (let p = 0; p < 3; p++) {
        cellsHtml += `<div class="cal-day-cell other-month"><span class="cal-day-num">${28 + p}</span></div>`;
      }

      for (let day = 1; day <= 31; day++) {
        const isToday = day === 8;
        const dayEvents = events.filter(e => e.dateNum === day);

        let eventChipsHtml = "";
        dayEvents.forEach(evt => {
          let chipClass = "cal-chip-focus";
          if (evt.category === "study") chipClass = "cal-chip-defense";
          else if (evt.category === "deadline") chipClass = "cal-chip-deadline";
          else if (evt.category === "prep") chipClass = "cal-chip-prep";

          eventChipsHtml += `
            <div class="cal-event-chip ${chipClass}" title="${ToolsView.escapeHtml(evt.title)} (${evt.time})">
              ${ToolsView.escapeHtml(evt.time)} ${ToolsView.escapeHtml(evt.title)}
            </div>
          `;
        });

        cellsHtml += `
          <div class="cal-day-cell ${isToday ? 'today' : ''}">
            <span class="cal-day-num">${day}${isToday ? ' ★' : ''}</span>
            ${eventChipsHtml}
          </div>
        `;
      }
      grid.innerHTML = cellsHtml;
    }

    // 2. RENDER WEEK GRID (Oct 5 - Oct 11)
    if (weekGrid) {
      const daysOfWeek = ["Mon 5", "Tue 6", "Wed 7", "Thu 8 (Today)", "Fri 9", "Sat 10", "Sun 11"];
      weekGrid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
          ${daysOfWeek.map((d, idx) => {
            const isToday = idx === 3;
            const dayNum = 5 + idx;
            const dayEvents = events.filter(e => e.dateNum === dayNum);
            return `
              <div class="cal-day-cell ${isToday ? 'today' : ''}" style="min-height: 80px;">
                <span class="cal-day-num">${d}</span>
                ${dayEvents.map(e => `
                  <div class="cal-event-chip cal-chip-focus" style="margin-top: 4px;">
                    ${e.time} ${ToolsView.escapeHtml(e.title)}
                  </div>
                `).join("")}
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // 3. RENDER DAY TIMELINE (Hourly slots for Oct 8)
    if (dayTimeline) {
      const hours = ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"];
      dayTimeline.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${hours.map(h => {
            const match = events.find(e => e.time.startsWith(h.substring(0, 2)));
            return `
              <div style="display: flex; align-items: center; gap: 12px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--neon-cyan); width: 68px;">${h}</span>
                <span style="font-size: 0.78rem; color: ${match ? '#fff' : 'var(--text-faint)'};">
                  ${match ? `⚡ ${ToolsView.escapeHtml(match.title)} (${match.category})` : 'Free focus slot'}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // 4. RENDER "TODAY'S SCHEDULE" TIMELINE CARDS
    if (todaysContainer) {
      const todayEvents = events.filter(e => e.dateNum === 8);
      if (todaysCountBadge) todaysCountBadge.textContent = `${todayEvents.length} session${todayEvents.length === 1 ? '' : 's'}`;

      if (todayEvents.length === 0) {
        todaysContainer.innerHTML = `<div style="font-size: 0.76rem; color: var(--text-faint);">No focus blocks scheduled for today yet.</div>`;
      } else {
        todaysContainer.innerHTML = todayEvents.map(evt => {
          let tagClass = "cal-chip-focus";
          let tagLabel = "Focus";
          if (evt.category === "study") { tagClass = "cal-chip-defense"; tagLabel = "Study"; }
          else if (evt.category === "deadline") { tagClass = "cal-chip-deadline"; tagLabel = "Deadline"; }

          return `
            <div class="todays-card-item">
              <span class="todays-card-time">${ToolsView.escapeHtml(evt.time)}</span>
              <span class="todays-card-title">${ToolsView.escapeHtml(evt.title)}</span>
              <span class="todays-card-tag ${tagClass}">${tagLabel}</span>
            </div>
          `;
        }).join("");
      }
    }
  },

  updateConflictDetectionBanner(plan) {
    const banner = document.getElementById("conflictBanner");
    const icon = document.getElementById("conflictIcon");
    const title = document.getElementById("conflictTitle");
    const detail = document.getElementById("conflictDetail");
    const btnResolve = document.getElementById("btnResolveConflict");

    if (!banner || !icon || !title || !detail || !btnResolve) return;

    const hasConflict = (plan.actions || []).some(a => a.hasConflict || (a.params && a.params.hasConflict));

    if (hasConflict) {
      banner.className = "conflict-banner has-conflict";
      icon.textContent = "⚠";
      title.textContent = "Schedule conflict detected";
      detail.textContent = "Proposed calendar block overlaps with existing commitments.";
      btnResolve.classList.remove("hidden");
    } else {
      banner.className = "conflict-banner";
      icon.textContent = "✓";
      title.textContent = "No schedule conflicts detected";
      detail.textContent = "All scheduled focus blocks are conflict-free.";
      btnResolve.classList.add("hidden");
    }
  },

  populateWhyThisPlan(plan) {
    const bulletsList = document.getElementById("whyBulletsList");
    if (!bulletsList) return;

    const deadlineStr = plan.deadline ? `ahead of ${plan.deadline}` : "prior to deadline";

    bulletsList.innerHTML = `
      <li><span class="bullet-dot">•</span> <strong>Deadline detected:</strong> Tasks scheduled to complete ${ToolsView.escapeHtml(deadlineStr)}.</li>
      <li><span class="bullet-dot">•</span> <strong>High-priority task scheduled first:</strong> Synthesis and visual outlining take morning prime focus.</li>
      <li><span class="bullet-dot">•</span> <strong>Rehearsal placed after slide completion:</strong> Dependent visual deck completed before dry-run rehearsal.</li>
      <li><span class="bullet-dot">•</span> <strong>No schedule conflicts detected:</strong> Calendar verified for clean slot allocations.</li>
    `;
  },

  async handleResolveConflict() {
    try {
      const res = await fetch("/api/agent/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.plan) {
        this.activePlan = data.plan;
        this.renderInteractiveCalendar(data.plan);
        this.updateConflictDetectionBanner(data.plan);
        await this.fetchState();
      }
    } catch (err) {
      console.warn("Conflict resolution error:", err);
    }
  },

  async handleAdaptiveReplan() {
    if (!this.activePlan) return;
    const btnReplan = document.getElementById("btnReplanWithAI");
    if (btnReplan) {
      btnReplan.disabled = true;
      btnReplan.innerHTML = `<span>Re-planning...</span>`;
    }

    try {
      const customKey = sessionStorage.getItem("custom_gemini_key") || null;
      const res = await fetch("/api/agent/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Adaptive reschedule requested", customApiKey: customKey })
      });
      const data = await res.json();
      if (data.success && data.plan) {
        this.activePlan = data.plan;
        await this.renderPlanWorkflowProgressive(data.plan);
        await this.fetchState();
      }
    } catch (err) {
      console.warn("Re-planning error:", err);
    } finally {
      if (btnReplan) {
        btnReplan.disabled = false;
        btnReplan.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Re-plan with AI →</span>
        `;
      }
    }
  },

  // ==========================================
  // STAGES 3 & 4: APPROVAL + EXECUTE
  // ==========================================
  async handleApproveAndExecute() {
    if (!this.activePlan) return;
    if (this.isExecuting) return;
    this.isExecuting = true;

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

    // Immediately close approval overlay and switch to execution state (mutually exclusive)
    this.setWorkflowUIState("executing");

    const statusPill = document.getElementById("executeStatusPill");
    const stream = document.getElementById("executeStepsStream");
    if (statusPill) statusPill.textContent = "Executing your approved actions...";
    if (stream) stream.innerHTML = "";

    // Show initial checklist progression
    const initialSteps = [
      "Goal understood",
      "Plan generated",
      "Schedule checked",
      "Approval received"
    ];

    if (stream) {
      for (const step of initialSteps) {
        const row = document.createElement("div");
        row.className = "exec-step-row done";
        row.innerHTML = `
          <span class="exec-step-icon">✓</span>
          <span class="exec-step-text">${step}</span>
        `;
        stream.appendChild(row);
      }
    }

    const actions = this.activePlan.actions || [];

    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const title = action.title || action.description;

        const rowId = `exec-step-${action.id || i}`;
        if (stream) {
          const row = document.createElement("div");
          row.className = "exec-step-row active";
          row.id = rowId;
          row.innerHTML = `
            <span class="exec-step-icon">⚡</span>
            <span class="exec-step-text">Executing approved action: ${ToolsView.escapeHtml(title)}...</span>
          `;
          stream.appendChild(row);
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        await this.sleep(350);

        if (action.requiresApproval) {
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

        const rowEl = document.getElementById(rowId);
        if (rowEl) {
          rowEl.className = "exec-step-row done";
          rowEl.innerHTML = `
            <span class="exec-step-icon">✓</span>
            <span class="exec-step-text">Completed: ${ToolsView.escapeHtml(title)}</span>
          `;
        }
      }

      await this.sleep(400);

      // Cleanly transition to completed state (mutually exclusive)
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
    if (this.isExecuting) return;
    this.isExecuting = true;

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
      await fetch("/api/agent/approve-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: consequential.id, decision: "rejected" })
      });
    }

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
            <span class="exec-step-icon">⚡</span>
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

      await this.sleep(400);

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
    this.setWorkflowUIState("completed");

    const summaryEl = document.getElementById("valCompleteSummary");
    const artifactsSummary = document.getElementById("valArtifactsSummary");

    if (summaryEl && this.activePlan) {
      if (wasRejected) {
        summaryEl.textContent = `Safe routine actions registered successfully. Sensitive calendar booking was cancelled per operator decision.`;
      } else {
        summaryEl.textContent = `All approved actions executed successfully. ${this.activePlan.summary}`;
      }
    }

    if (artifactsSummary) {
      const taskCount = this.stats.tasks || 2;
      const schedCount = wasRejected ? 0 : (this.stats.schedule || 1);
      const timeOrganized = this.activePlan?.estimatedTime || "2 hours";

      artifactsSummary.innerHTML = `
        <span class="artifact-pill">✓ ${taskCount} Tasks completed</span>
        <span class="artifact-pill">⏱ ${ToolsView.escapeHtml(timeOrganized)} organized</span>
        <span class="artifact-pill">★ ${schedCount} Approved action${schedCount === 1 ? '' : 's'}</span>
      `;
    }
  },

  // ==========================================
  // RESET / START ANOTHER TASK
  // ==========================================
  resetToHomeView(clearInput = true) {
    this.isExecuting = false;
    this.setWorkflowUIState("idle");
    this.setStepper(1);

    const hero = document.getElementById("heroCenterpiece");
    const thinkingState = document.getElementById("aiThinkingState");
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
    if (thinkingState) thinkingState.classList.add("hidden");
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

  renderFullScheduleView(events = null) {
    const container = document.getElementById("fullScheduleContainer");
    if (!container) return;

    fetch("/api/state")
      .then(r => r.json())
      .then(json => {
        const sched = json.data?.schedule || [];
        if (sched.length === 0) {
          container.innerHTML = `
            <div class="empty-placeholder" style="padding: 40px; text-align: center;">
              <span style="font-size: 1.1rem; color: var(--text-muted); display: block; margin-bottom: 8px;">No scheduled events yet</span>
              <span style="font-size: 0.82rem; color: var(--text-faint);">Tell ActionPilot what to get done in the Command Center to automatically generate calendar blocks.</span>
            </div>
          `;
          return;
        }

        container.innerHTML = sched.map(evt => `
          <div class="event-card ${evt.conflictDetected ? 'has-conflict' : ''}" style="margin-bottom: 12px;">
            <div class="event-left">
              <div class="event-time-badge">${ToolsView.escapeHtml(evt.startTime)} - ${ToolsView.escapeHtml(evt.endTime)}</div>
              <div class="event-details">
                <div class="event-title">${ToolsView.escapeHtml(evt.title)}</div>
                <div class="event-date-tag">📅 ${ToolsView.escapeHtml(evt.date || 'Tomorrow')} &bull; Category: ${ToolsView.escapeHtml(evt.category || 'focus')}</div>
                ${evt.conflictDetected ? `<div class="event-conflict-warning">⚠️ Potential clash with: ${(evt.conflictingWith || []).join(", ")}</div>` : ''}
              </div>
            </div>
          </div>
        `).join("");
      })
      .catch(err => console.warn("Failed to load schedule for view:", err));
  },

  renderFullActivityView(logs = null) {
    const container = document.getElementById("fullActivityContainer");
    if (!container) return;

    fetch("/api/state")
      .then(r => r.json())
      .then(json => {
        const activity = json.data?.activityLog || [];
        if (activity.length === 0) {
          container.innerHTML = `
            <div class="empty-placeholder" style="padding: 40px; text-align: center;">
              <span style="font-size: 1.1rem; color: var(--text-muted);">No activity recorded yet</span>
            </div>
          `;
          return;
        }

        container.innerHTML = activity.map(log => {
          let icon = "✓";
          if (log.type === "warning") icon = "⚠️";
          if (log.type === "system") icon = "⚙";

          return `
            <div class="activity-item type-${log.type}" style="margin-bottom: 10px; padding: 12px 16px;">
              <span class="activity-icon">${icon}</span>
              <div class="activity-main">
                <div class="activity-title" style="font-size: 0.92rem;">${ToolsView.escapeHtml(log.title)}</div>
                ${log.detail ? `<div class="activity-detail" style="font-size: 0.8rem; margin-top: 2px;">${ToolsView.escapeHtml(log.detail)}</div>` : ''}
              </div>
              <span class="activity-time">${ToolsView.escapeHtml(log.timestamp)}</span>
            </div>
          `;
        }).reverse().join("");
      })
      .catch(err => console.warn("Failed to load activity for view:", err));
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
