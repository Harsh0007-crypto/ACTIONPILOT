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

    this.schedule = [
      {
        id: "evt-seed-1",
        title: "Team Morning Standup",
        date: "Tomorrow",
        startTime: "10:00 AM",
        endTime: "10:30 AM",
        category: "meeting",
        locked: true
      },
      {
        id: "evt-seed-2",
        title: "Client Progress Review (External Stakeholders)",
        date: "Tomorrow",
        startTime: "02:00 PM",
        endTime: "03:00 PM",
        category: "meeting",
        locked: false
      },
      {
        id: "evt-seed-3",
        title: "Group Study Session",
        date: "Friday",
        startTime: "03:00 PM",
        endTime: "05:00 PM",
        category: "study",
        locked: false
      }
    ];

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
