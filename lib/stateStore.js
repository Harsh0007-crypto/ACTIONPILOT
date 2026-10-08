/**
 * ActionPilot State Store
 * In-memory state storage with realistic seed data for immediate demonstration.
 */

class StateStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.tasks = [];
    this.schedule = [];
    this.notes = [];

    this.activityLog = [
      {
        id: "act-init-1",
        type: "system",
        icon: "zap",
        title: "ActionPilot Autonomous Kernel Initialized",
        timestamp: new Date().toLocaleTimeString(),
        detail: "State store active. Tools loaded: Task, Schedule, Notes, Information."
      }
    ];

    this.currentPlan = null;
    this.pendingApprovals = [];
    this.completedPlansCount = 0;
  }

  getState() {
    return {
      tasks: this.tasks,
      schedule: this.schedule,
      notes: this.notes,
      activityLog: this.activityLog.slice(-50), // keep recent 50 entries
      currentPlan: this.currentPlan,
      pendingApprovals: this.pendingApprovals
    };
  }

  logActivity(type, title, detail, icon = "check") {
    const entry = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type, // 'system' | 'agent' | 'tool' | 'approval' | 'warning' | 'success'
      icon,
      title,
      detail: detail || "",
      timestamp: new Date().toLocaleTimeString()
    };
    this.activityLog.push(entry);
    return entry;
  }
}

const stateStore = new StateStore();
module.exports = stateStore;
