/**
 * ActionPilot Autonomous Engine (Deterministic Fallback Planner)
 * Fully input-driven and generic.
 * Derives tasks, durations, and constraints directly from the user's actual request.
 * Never substitutes unrelated topics or uses hardcoded demo templates.
 * Derives dates dynamically at runtime using the user's timezone.
 */

const {
  DEFAULT_TIMEZONE,
  getRelativeDayInfo
} = require("./dateTimeUtils");

const {
  extractConstraints,
  buildConstrainedSchedule,
  validateAndSynchronizePlan
} = require("./scheduleOptimizer");

function generateFallbackPlan(goal, currentState, timeZone = DEFAULT_TIMEZONE, baseDate = new Date()) {
  const userConstraints = extractConstraints(goal, timeZone, baseDate);
  const constrained = buildConstrainedSchedule(goal, userConstraints, timeZone, baseDate);
  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

  const windowSummary = userConstraints.windows.length > 0
    ? userConstraints.windows.map(w => `${w.dayLabel}: ${w.startStr} - ${w.endStr}`).join("; ")
    : "Sequential focus blocks paced with recovery intervals";

  const taskSummary = (constrained.tasks && constrained.tasks.length > 0)
    ? constrained.tasks.map(t => t.title).join(", ")
    : "requested activities";

  const constraintsList = [];
  if (userConstraints.hasExplicitWindows) {
    constraintsList.push(`All focus blocks restricted to stated windows: ${windowSummary}`);
  }
  if (userConstraints.hardDeadline) {
    constraintsList.push(`All preparatory milestones completed before ${userConstraints.hardDeadline.label}`);
  }
  if (constrained.conflicts && constrained.conflicts.length > 0) {
    constraintsList.push(...constrained.conflicts);
  } else {
    constraintsList.push("Zero schedule conflicts permitted");
  }

  const customPlan = {
    goal,
    source: "Autonomous Engine (Deterministic Fallback)",
    deadline: userConstraints.hardDeadline ? userConstraints.hardDeadline.label : tomorrowInfo.dayLabel,
    constraints: constraintsList,
    summary: `Synthesized an optimized workflow for ${taskSummary}. Tasks prioritized and paced strictly according to requirements.`,
    estimatedTime: constrained.totalDurationStr,
    assumption: userConstraints.hardDeadline
      ? `All activities conclude prior to ${userConstraints.hardDeadline.label} deadline.`
      : "Sequential focus blocks prioritized by urgency and cognitive load.",
    tasks: constrained.tasks,
    schedule: constrained.schedule,
    actions: [
      ...constrained.actions,
      {
        id: "act-prep-notes",
        title: "Synthesize Key Points & Execution Checklist",
        description: "Archive talking points, milestones, and verification checklist into Notes dossier",
        tool: "notes",
        action: "create",
        priority: "medium",
        estimatedDuration: "15 mins",
        params: {
          title: "Execution Blueprint & Notes",
          content: `# Workflow Blueprint\nGoal: ${goal}\n\nKey Milestones:\n${constrained.tasks.map((t, idx) => `${idx + 1}. ${t.title} (${t.durationMinutes || 60}m)`).join("\n")}`,
          tags: ["blueprint", "workflow", "notes"]
        },
        requiresApproval: false,
        approvalReason: null
      }
    ],
    conflicts: constrained.conflicts || []
  };

  return validateAndSynchronizePlan(customPlan, goal, timeZone, baseDate);
}

module.exports = {
  generateFallbackPlan
};
