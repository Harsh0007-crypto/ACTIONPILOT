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
  selectedLanguage: (typeof localStorage !== "undefined" && localStorage.getItem) ? (localStorage.getItem("actionpilot_lang") || "en") : "en",
  stats: {
    tasks: 0,
    schedule: 0,
    notes: 0
  },

  async init() {
    ToolsView.init();
    this.initLanguageSelector();
    this.bindEvents();
    this.initCalendarWidget();
    await this.fetchHealth();
    await this.fetchState();
  },

  initLanguageSelector() {
    const langSelect = document.getElementById("langSelect");
    if (langSelect) {
      langSelect.value = this.selectedLanguage;
      langSelect.addEventListener("change", (e) => {
        this.selectedLanguage = e.target.value;
        localStorage.setItem("actionpilot_lang", this.selectedLanguage);
        // Language switch preserves active plan seamlessly
        if (this.activePlan) {
          this.renderPlanWorkflowProgressive(this.activePlan);
        }
      });
    }
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

    // 11. Adaptive Re-planning Button & Enter Key
    const btnReplanWithAI = document.getElementById("btnReplanWithAI");
    if (btnReplanWithAI) {
      btnReplanWithAI.addEventListener("click", () => this.handleAdaptiveReplan());
    }
    const replanInput = document.getElementById("replanInput");
    if (replanInput) {
      replanInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleAdaptiveReplan();
        }
      });
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

  // Dynamic user timezone & runtime date helpers (Asia/Kolkata default)
  getUserTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    } catch (e) {
      return "Asia/Kolkata";
    }
  },

  getZonedDateParts(date = new Date()) {
    const tz = this.getUserTimeZone();
    const d = (typeof date === "string" || typeof date === "number") ? new Date(date) : (date || new Date());
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    });
    const partMap = {};
    dtf.formatToParts(d).forEach(p => { partMap[p.type] = p.value; });
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    const weekday = partMap.weekday;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthShorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      year,
      month,
      day,
      weekday,
      monthName: monthNames[month - 1] || "October",
      monthShort: monthShorts[month - 1] || "Oct",
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    };
  },

  getRelativeDayInfo(offsetDays = 0) {
    const todayParts = this.getZonedDateParts(new Date());
    const targetUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + offsetDays, 12, 0, 0));
    const targetParts = this.getZonedDateParts(targetUtc);
    let dayPrefix = "";
    if (offsetDays === 0) dayPrefix = "Today";
    else if (offsetDays === 1) dayPrefix = "Tomorrow";
    else dayPrefix = `Day ${offsetDays + 1}`;

    return {
      ...targetParts,
      offsetDays,
      dateNum: targetParts.day,
      dayLabel: `${dayPrefix} (${targetParts.monthShort} ${targetParts.day})`,
      dateLabel: `${targetParts.monthShort} ${targetParts.day}, ${targetParts.year}`
    };
  },

  getWeekDays() {
    const todayParts = this.getZonedDateParts(new Date());
    const weekdayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
    const currentWeekDayIndex = weekdayMap[todayParts.weekday] !== undefined ? weekdayMap[todayParts.weekday] : 0;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const offsetFromToday = i - currentWeekDayIndex;
      const dayInfo = this.getRelativeDayInfo(offsetFromToday);
      const isToday = offsetFromToday === 0;
      days.push({
        ...dayInfo,
        weekIndex: i,
        isToday,
        headerLabel: `${dayInfo.weekday} ${dayInfo.day}${isToday ? " (Today)" : ""}`
      });
    }
    return days;
  },

  getMonthCalendarGrid() {
    const todayParts = this.getZonedDateParts(new Date());
    const year = todayParts.year;
    const month = todayParts.month;
    const daysInCurrentMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
    const firstDayParts = this.getZonedDateParts(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
    const weekdayMap = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
    const firstDayWeekIndex = weekdayMap[firstDayParts.weekday] !== undefined ? weekdayMap[firstDayParts.weekday] : 0;

    const prevPadding = [];
    for (let p = 0; p < firstDayWeekIndex; p++) {
      prevPadding.push({
        dayNum: daysInPrevMonth - firstDayWeekIndex + 1 + p,
        isOtherMonth: true
      });
    }

    const currentDays = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      currentDays.push({
        dayNum: d,
        isToday: d === todayParts.day,
        dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      });
    }

    return {
      monthTitle: `${todayParts.monthName} ${year}`,
      year,
      month,
      todayDayNum: todayParts.day,
      prevPadding,
      days: currentDays
    };
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
      const userTz = this.getUserTimeZone();

      // Launch network fetch and animated cognition checkpoints concurrently for maximum responsiveness
      const fetchPromise = fetch("/api/agent/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-timezone": userTz,
          "x-language": this.selectedLanguage
        },
        body: JSON.stringify({
          goal,
          customApiKey: customKey,
          timeZone: userTz,
          language: this.selectedLanguage
        })
      });

      const animPromise = this.animateThinkingSteps();
      const [planResp] = await Promise.all([fetchPromise, animPromise]);

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

    // Render clean, readable task cards with clear time, duration & priority
    if (actionsListEl) {
      const actions = plan.actions || [];
      const schedMap = new Map();
      (plan.schedule || []).forEach(s => {
        if (s.taskId) schedMap.set(s.taskId, s);
        if (s.task) schedMap.set(s.task.toLowerCase(), s);
      });

      actionsListEl.innerHTML = actions.map((act, idx) => {
        const title = act.title || act.description;
        const priority = act.priority || "medium";
        const duration = act.estimatedDuration || "30 mins";
        const paddedNum = String(idx + 1).padStart(2, "0");

        // Link with scheduled time if available
        const matchingSched = (act.tool === "schedule" && act.params) 
          ? act.params 
          : schedMap.get(act.id) || schedMap.get(title.toLowerCase());
        
        const timeBadge = matchingSched && matchingSched.startTime 
          ? `<span class="task-time-badge">${ToolsView.escapeHtml(matchingSched.startTime)}${matchingSched.endTime ? ` – ${ToolsView.escapeHtml(matchingSched.endTime)}` : ''}</span>`
          : '';

        // Select clean icon based on task nature
        let iconEmoji = "📝";
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("slide") || lowerTitle.includes("visual")) iconEmoji = "🎨";
        else if (lowerTitle.includes("rehearsal") || lowerTitle.includes("practice") || lowerTitle.includes("demo")) iconEmoji = "🎯";
        else if (lowerTitle.includes("notes") || lowerTitle.includes("checklist")) iconEmoji = "📑";
        else if (lowerTitle.includes("study") || lowerTitle.includes("exam") || lowerTitle.includes("math")) iconEmoji = "📚";
        else if (lowerTitle.includes("schedule") || act.tool === "schedule") iconEmoji = "📅";
        else if (lowerTitle.includes("sync") || lowerTitle.includes("meeting") || lowerTitle.includes("class")) iconEmoji = "👥";

        // Clean display title: remove "Create task: " prefix if present
        const displayTitle = title.replace(/^Create task:\s*/i, "").replace(/^Schedule\s+/i, "");

        return `
          <div class="plan-action-item">
            <span class="action-num">${paddedNum}</span>
            <div class="action-content">
              <div class="action-title-row">
                <span class="action-title">${iconEmoji} ${ToolsView.escapeHtml(displayTitle)}</span>
              </div>
            </div>
            <div class="action-badges">
              ${timeBadge}
              <span class="duration-badge">${duration}</span>
              ${priority ? `<span class="priority-pill priority-${priority.toLowerCase()}">${priority.toUpperCase()}</span>` : ""}
              ${act.requiresApproval ? `<span class="action-gate-tag" title="Sensitive action requiring your approval">Needs Approval</span>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    // Populate Interactive Calendar Widget
    this.renderInteractiveCalendar(plan);

    // Evaluate Conflict Status
    this.updateConflictDetectionBanner(plan);

    // Evaluate Clarification Status (Priority 1)
    const clarCard = document.getElementById("clarificationAlertCard");
    const clarText = document.getElementById("valClarificationText");
    if (clarCard && clarText) {
      if (plan.clarification) {
        clarText.textContent = plan.clarification;
        clarCard.classList.remove("hidden");
      } else {
        clarCard.classList.add("hidden");
      }
    }

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

    const today = this.getRelativeDayInfo(0);
    const tomorrow = this.getRelativeDayInfo(1);

    const parseEventDateNum = (s) => {
      if (s.dateNum !== undefined && s.dateNum !== null && !isNaN(s.dateNum)) return parseInt(s.dateNum, 10);
      const rawDate = (s.date || "").toLowerCase();
      if (rawDate.includes("today") || rawDate.includes("this evening")) return today.dateNum;
      if (rawDate.includes("tomorrow")) return tomorrow.dateNum;
      const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch) return parseInt(isoMatch[3], 10);
      const mMatch = rawDate.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
      if (mMatch) return parseInt(mMatch[1], 10);
      const dayMatch = rawDate.match(/day\s*(\d+)/i);
      if (dayMatch) {
        const off = parseInt(dayMatch[1], 10) - 1;
        return this.getRelativeDayInfo(off).dateNum;
      }
      return today.dateNum;
    };

    // Update Calendar Header Title (e.g. October 2026)
    const monthGridData = this.getMonthCalendarGrid();
    const calMonthTitle = document.getElementById("calMonthTitle");
    if (calMonthTitle) {
      calMonthTitle.textContent = monthGridData.monthTitle;
    }

    // Helper to format clean, concise event titles for calendar chips & cards
    const formatConciseTitle = (raw) => {
      if (!raw) return "Focus Block";
      let t = String(raw).trim();
      // Remove leading "Schedule " if present
      t = t.replace(/^Schedule\s+/i, "");
      // Remove trailing time ranges like "(7:00 PM - 8:30 PM)"
      t = t.replace(/\s*\(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\)/i, "");
      // If it's a huge sentence, take first clause
      t = t.split(/[.\n!?]/)[0].trim();
      if (t.length > 36) {
        const trunc = t.slice(0, 34).replace(/\s+\S*$/, "");
        t = (trunc.length >= 10 ? trunc : t.slice(0, 34)).trim() + "…";
      }
      return t || "Focus Block";
    };

    // Gather all scheduled events from active plan & stateStore.schedule
    const events = [];
    const seenEventKeys = new Set();

    // From canonical plan.schedule if available
    if (plan && Array.isArray(plan.schedule) && plan.schedule.length > 0) {
      plan.schedule.forEach((s, idx) => {
        const id = s.id || `plan-sched-${idx}`;
        const key = `${s.task || s.title}-${s.startTime}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          const dNum = parseEventDateNum(s);
          const rawTitle = s.task || s.title || "Focus Block";
          events.push({
            id,
            title: formatConciseTitle(rawTitle),
            rawTitle: rawTitle,
            time: s.startTime || "7:00 PM",
            endTime: s.endTime || "8:30 PM",
            dateNum: dNum,
            date: s.date || today.dayLabel,
            category: s.category || "focus"
          });
        }
      });
    } else if (plan && Array.isArray(plan.actions)) {
      // Fallback from actions if plan.schedule was absent
      plan.actions.forEach(a => {
        if (a.tool === "schedule" && a.params) {
          const key = `${a.params.title || a.title}-${a.params.startTime}`;
          if (!seenEventKeys.has(key)) {
            seenEventKeys.add(key);
            const rawDate = a.params.date || today.dayLabel;
            const dNum = parseEventDateNum({ dateNum: a.params.dateNum, date: rawDate });
            const rawTitle = a.params.title || a.title || "Scheduled Focus Block";
            events.push({
              id: a.id,
              title: formatConciseTitle(rawTitle),
              rawTitle: rawTitle,
              time: a.params.startTime || "7:00 PM",
              endTime: a.params.endTime || "8:30 PM",
              dateNum: dNum,
              date: rawDate,
              category: a.params.category || "focus"
            });
          }
        }
      });
    }

    // From persisted stateStore.schedule if present (after tool execution)
    const existingSched = stateSchedule || [];
    existingSched.forEach(e => {
      const key = `${e.title}-${e.startTime}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        const rawDate = e.date || today.dayLabel;
        const dNum = parseEventDateNum(e);
        const rawTitle = e.title || "Focus Block";
        events.push({
          id: e.id,
          title: formatConciseTitle(rawTitle),
          rawTitle: rawTitle,
          time: e.startTime,
          endTime: e.endTime,
          dateNum: dNum,
          date: rawDate,
          category: e.category || "focus"
        });
      }
    });

    // ONLY show placeholder demo events if NO plan and NO state schedule exists at all
    if (events.length === 0 && !plan) {
      events.push(
        { id: "demo-1", title: "Presentation Rehearsal", rawTitle: "Presentation Rehearsal", time: "2:00 PM", endTime: "3:00 PM", dateNum: today.dateNum, date: today.dayLabel, category: "focus" },
        { id: "demo-2", title: "Project Demo Walkthrough", rawTitle: "Project Demo Walkthrough", time: "1:00 PM", endTime: "2:30 PM", dateNum: tomorrow.dateNum, date: tomorrow.dayLabel, category: "study" },
        { id: "demo-3", title: "Final Deliverable", rawTitle: "Final Deliverable", time: "05:00 PM", endTime: "05:00 PM", dateNum: tomorrow.dateNum, date: tomorrow.dayLabel, category: "deadline" }
      );
    }

    // 1. RENDER MONTH GRID (Dynamic days in month & padding)
    if (grid) {
      let cellsHtml = "";
      monthGridData.prevPadding.forEach(p => {
        cellsHtml += `<div class="cal-day-cell other-month"><span class="cal-day-num">${p.dayNum}</span></div>`;
      });

      monthGridData.days.forEach(dayObj => {
        const isToday = dayObj.isToday;
        const dayEvents = events.filter(e => e.dateNum === dayObj.dayNum);

        let eventChipsHtml = "";
        dayEvents.forEach(evt => {
          let chipClass = "cal-chip-focus";
          if (evt.category === "study") chipClass = "cal-chip-defense";
          else if (evt.category === "deadline") chipClass = "cal-chip-deadline";
          else if (evt.category === "prep") chipClass = "cal-chip-prep";

          const chipText = evt.title.length > 18 ? evt.title.slice(0, 16) + "…" : evt.title;

          eventChipsHtml += `
            <div class="cal-event-chip ${chipClass}" title="${ToolsView.escapeHtml(evt.rawTitle || evt.title)} (${evt.time})">
              ${ToolsView.escapeHtml(evt.time)} ${ToolsView.escapeHtml(chipText)}
            </div>
          `;
        });

        cellsHtml += `
          <div class="cal-day-cell ${isToday ? 'today' : ''}">
            <span class="cal-day-num">${dayObj.dayNum}${isToday ? ' ★' : ''}</span>
            ${eventChipsHtml}
          </div>
        `;
      });
      grid.innerHTML = cellsHtml;
    }

    // 2. RENDER WEEK GRID (Dynamic 7 days of current week)
    if (weekGrid) {
      const weekDays = this.getWeekDays();
      weekGrid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; width: 100%; box-sizing: border-box;">
          ${weekDays.map(wd => {
            const dayEvents = events.filter(e => e.dateNum === wd.dateNum);
            return `
              <div class="cal-day-cell ${wd.isToday ? 'today' : ''}" style="min-height: 80px;">
                <span class="cal-day-num">${wd.headerLabel}</span>
                ${dayEvents.map(e => {
                  const chipText = e.title.length > 18 ? e.title.slice(0, 16) + "…" : e.title;
                  return `
                    <div class="cal-event-chip cal-chip-focus" style="margin-top: 4px;" title="${ToolsView.escapeHtml(e.rawTitle || e.title)} (${e.time})">
                      ${e.time} ${ToolsView.escapeHtml(chipText)}
                    </div>
                  `;
                }).join("")}
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    // 3. RENDER DAY TIMELINE (Hourly slots for dynamic Today)
    if (dayTimeline) {
      const todayEvts = events.filter(e => e.dateNum === today.dateNum || (e.date && e.date.toLowerCase().includes("today")));
      const activeHours = new Set();
      todayEvts.forEach(e => {
        if (e.time) activeHours.add(e.time);
      });
      if (activeHours.size === 0) {
        ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"].forEach(h => activeHours.add(h));
      }
      const sortedHours = Array.from(activeHours);

      dayTimeline.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sortedHours.map(h => {
            const match = todayEvts.find(e => e.time === h || e.time.startsWith(h.substring(0, 2)));
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
      const todayEvents = events.filter(e => e.dateNum === today.dateNum || (e.date && e.date.toLowerCase().includes("today")));
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
            <div class="todays-card-item" title="${ToolsView.escapeHtml(evt.rawTitle || evt.title)}">
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

    const conflicts = Array.isArray(plan.conflicts) ? plan.conflicts : [];
    const hasConflict = conflicts.length > 0 || (plan.actions || []).some(a => a.hasConflict || (a.params && a.params.hasConflict));

    if (hasConflict) {
      banner.className = "conflict-banner has-conflict";
      icon.textContent = "⚠";
      title.textContent = "Schedule conflict detected";
      const conflictMsg = conflicts.length > 0
        ? conflicts.join("; ")
        : "Proposed calendar block overlaps with existing commitments.";
      detail.textContent = conflictMsg;
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
    const constraintText = (plan.constraints && plan.constraints.length > 0)
      ? plan.constraints[0]
      : "All sessions scheduled strictly within your stated availability.";

    const conflicts = Array.isArray(plan.conflicts) ? plan.conflicts : [];
    const hasConflict = conflicts.length > 0;
    const conflictBullet = hasConflict
      ? `<li><span class="bullet-dot" style="color: #f87171;">⚠</span> <strong style="color: #f87171;">Conflict Detected:</strong> ${ToolsView.escapeHtml(conflicts[0])}</li>`
      : `<li><span class="bullet-dot">•</span> <strong>No schedule conflicts:</strong> Calendar blocks verified for zero clashes.</li>`;

    bulletsList.innerHTML = `
      <li><span class="bullet-dot">•</span> <strong>Objective:</strong> ${ToolsView.escapeHtml(plan.summary || 'Optimized personal workflow generated.')}</li>
      <li><span class="bullet-dot">•</span> <strong>Availability preserved:</strong> ${ToolsView.escapeHtml(constraintText)}</li>
      <li><span class="bullet-dot">•</span> <strong>Milestone sequencing:</strong> Tasks prioritized to complete ${ToolsView.escapeHtml(deadlineStr)}.</li>
      ${conflictBullet}
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
    const replanInput = document.getElementById("replanInput");
    const editInstruction = (replanInput ? replanInput.value.trim() : "") || "Adaptive reschedule requested";

    if (btnReplan) {
      btnReplan.disabled = true;
      btnReplan.innerHTML = `<span>Updating plan...</span>`;
    }

    try {
      const customKey = sessionStorage.getItem("custom_gemini_key") || null;
      const userTz = this.getUserTimeZone();
      const res = await fetch("/api/agent/replan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-timezone": userTz,
          "x-language": this.selectedLanguage
        },
        body: JSON.stringify({
          instruction: editInstruction,
          reason: editInstruction,
          customApiKey: customKey,
          timeZone: userTz,
          language: this.selectedLanguage
        })
      });
      const data = await res.json();
      if (data.success && data.plan) {
        this.activePlan = data.plan;
        if (replanInput) replanInput.value = "";
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
          <span>Re-plan &rarr;</span>
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
