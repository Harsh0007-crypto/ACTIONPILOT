/**
 * ActionPilot Workflow & AI Core Visualizer
 * Coordinates sequential 5-stage progression:
 * 1. UNDERSTAND -> 2. PLAN -> 3. APPROVE -> 4. EXECUTE -> 5. DONE
 * Along with Holographic AI Core visualizer & telemetry.
 */

const STAGES = ["understand", "plan", "approve", "execute", "done"];

const STATUS_TEXTS = {
  idle: "AWAITING GOAL DIRECTIVE",
  understand: "UNDERSTANDING GOAL INTENT",
  plan: "PLANNING WORKFLOW & TOOLS",
  approve: "WAITING FOR HUMAN APPROVAL",
  execute: "EXECUTING AUTHORIZED ACTIONS",
  done: "MISSION COMPLETE",
  failed: "EXECUTION HALTED / ERROR"
};

const WorkflowManager = {
  currentStageIndex: -1,

  init() {
    this.reset();
  },

  reset() {
    this.currentStageIndex = -1;
    STAGES.forEach((stage) => {
      const el = document.getElementById(`stage-${stage}`);
      if (el) {
        el.classList.remove("active", "completed", "paused", "failed");
      }
    });

    for (let i = 1; i <= 4; i++) {
      const line = document.getElementById(`line-${i}`);
      if (line) {
        line.classList.remove("completed");
      }
    }

    this.setStatus("idle");
    this.setProgress(0, "Pipeline Ready");
    this.setCoreState("idle");
  },

  setStage(stageName, state = "active") {
    const stageIdx = STAGES.indexOf(stageName);
    if (stageIdx === -1) return;

    this.currentStageIndex = stageIdx;

    // Mark previous stages as completed
    for (let i = 0; i < stageIdx; i++) {
      const prevEl = document.getElementById(`stage-${STAGES[i]}`);
      if (prevEl) {
        prevEl.classList.remove("active", "paused", "failed");
        prevEl.classList.add("completed");
      }
      const line = document.getElementById(`line-${i + 1}`);
      if (line) {
        line.classList.add("completed");
      }
    }

    // Set current stage
    const currentEl = document.getElementById(`stage-${stageName}`);
    if (currentEl) {
      currentEl.classList.remove("completed", "paused", "failed");
      currentEl.classList.add(state);
    }

    // Update status text & AI Core
    this.setStatus(stageName);

    if (state === "paused") {
      this.setCoreState("warning");
    } else if (stageName === "done") {
      this.setCoreState("complete");
      if (currentEl) currentEl.classList.add("completed");
      // Mark all 4 lines completed
      for (let i = 1; i <= 4; i++) {
        const line = document.getElementById(`line-${i}`);
        if (line) line.classList.add("completed");
      }
    } else {
      this.setCoreState("active");
    }
  },

  setStatus(key) {
    const statusTextEl = document.getElementById("agentStatusText");
    if (statusTextEl) {
      statusTextEl.textContent = STATUS_TEXTS[key] || key.toUpperCase();
    }
  },

  setProgress(percent, title = null) {
    const bar = document.getElementById("agentProgressBar");
    const pctLabel = document.getElementById("progressPercent");
    const titleLabel = document.getElementById("progressTitle");

    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    if (bar) bar.style.width = `${clamped}%`;
    if (pctLabel) pctLabel.textContent = `${clamped}%`;
    if (title && titleLabel) titleLabel.textContent = title;
  },

  setCoreState(state) {
    // state: 'idle' | 'active' | 'warning' | 'complete' | 'failed'
    const visualizer = document.getElementById("aiCoreVisualizer");
    if (!visualizer) return;

    visualizer.classList.remove("active", "warning", "complete", "failed");
    if (state !== "idle") {
      visualizer.classList.add(state);
    }
  }
};

window.WorkflowManager = WorkflowManager;
