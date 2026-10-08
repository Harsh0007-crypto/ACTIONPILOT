/**
 * ActionPilot Autonomous Engine (Deterministic Fallback Planner)
 * Provides clean, domain-aware reasoning and structured plan generation
 * ONLY when Gemini API key is absent or unreachable.
 * Clearly labeled as Autonomous Engine (Fallback Mode).
 * Strictly honors user time constraints, availability windows, and multi-day pacing.
 * NEVER substitutes unrelated topics or hardcodes "AI Basics".
 */

const {
  extractConstraints,
  buildConstrainedSchedule,
  validateAndSynchronizePlan
} = require("./scheduleOptimizer");

function generateFallbackPlan(goal, currentState) {
  const normalized = (goal || "").toLowerCase();
  const userConstraints = extractConstraints(goal);

  // 1. If explicit availability windows or multiple domain topics detected
  if (userConstraints.hasExplicitWindows || userConstraints.inferredTopics.length >= 2) {
    const constrained = buildConstrainedSchedule(goal, userConstraints);

    const windowSummary = userConstraints.windows.map(w => `${w.dayLabel}: ${w.startStr} - ${w.endStr}`).join("; ");
    const topicSummary = (userConstraints.inferredTopics.length > 0)
      ? userConstraints.inferredTopics.map(t => t.title).join(", ")
      : "high-priority preparation items";

    const customPlan = {
      goal,
      source: "Autonomous Engine (Fallback Mode)",
      deadline: userConstraints.hardDeadline ? userConstraints.hardDeadline.label : "Tomorrow",
      constraints: [
        userConstraints.hasExplicitWindows
          ? `All focus blocks restricted to stated windows: ${windowSummary}`
          : "Space focus sessions to avoid cognitive fatigue",
        userConstraints.hardDeadline
          ? `Complete all rehearsal sessions before ${userConstraints.hardDeadline.label}`
          : "Maintain clear milestone sequencing",
        "Zero schedule conflicts permitted"
      ],
      summary: `Synthesized an optimized workflow for ${topicSummary}. All focus blocks paced strictly within stated availability.`,
      estimatedTime: constrained.totalDurationStr,
      assumption: userConstraints.hardDeadline
        ? `Rehearsals conclude prior to ${userConstraints.hardDeadline.label} demo deadline.`
        : "Sequential focus blocks prioritized by urgency.",
      tasks: constrained.tasks,
      schedule: constrained.schedule,
      actions: [
        ...constrained.actions,
        {
          id: "act-prep-notes",
          title: "Synthesize Key Points & Rehearsal Checklist",
          description: "Archive talking points, Q&A defense prompts, and verification checklist into Notes dossier",
          tool: "notes",
          action: "create",
          priority: "medium",
          estimatedDuration: "15 mins",
          params: {
            title: "Project Preparation & Rehearsal Notes",
            content: `# Preparation Blueprint\nGoal: ${goal}\n\nKey Milestones:\n${constrained.tasks.map((t, idx) => `${idx + 1}. ${t.title} (${t.durationMinutes || 60}m)`).join("\n")}`,
            tags: ["prep", "workflow", "notes"]
          },
          requiresApproval: false,
          approvalReason: null
        }
      ],
      conflicts: []
    };

    return validateAndSynchronizePlan(customPlan, goal);
  }

  // 2. SCENARIO: Presentation / Demo Preparation
  if (normalized.includes("presentation") || normalized.includes("demo") || normalized.includes("slide")) {
    const presentationPlan = {
      goal,
      source: "Autonomous Engine (Fallback Mode)",
      deadline: "Tomorrow 05:00 PM",
      constraints: [
        "Complete slide deck structure before live rehearsal",
        "Finish dry-run rehearsal ahead of demo time",
        "No schedule overlaps allowed"
      ],
      summary: "Organized your demo workflow into 3 sequential phases: slide preparation, dry-run practice, and defense Q&A review.",
      estimatedTime: "3.5 hours total",
      assumption: "Practice scheduled prior to demo time with buffer for setup.",
      tasks: [
        {
          id: "task-f-1",
          title: "Prepare Presentation Slides & Talking Points",
          description: "Synthesize narrative, core hook, and visual slide hierarchy",
          priority: "high",
          durationMinutes: 90,
          deadline: "Today 08:30 PM",
          category: "Presentation"
        },
        {
          id: "task-f-2",
          title: "Practice Demo Run-through",
          description: "Conduct full dry-run of project demo features and test transitions",
          priority: "high",
          durationMinutes: 75,
          deadline: "Tomorrow 02:30 PM",
          category: "Project Demo"
        },
        {
          id: "task-f-3",
          title: "Review Defense Questions & Q&A",
          description: "Review anticipated technical questions and architecture edge cases",
          priority: "medium",
          durationMinutes: 45,
          deadline: "Tomorrow 03:45 PM",
          category: "Defense Prep"
        }
      ],
      schedule: [
        {
          id: "sched-f-1",
          taskId: "task-f-1",
          date: "Today (Oct 8)",
          dateNum: 8,
          startTime: "07:00 PM",
          endTime: "08:30 PM",
          task: "Prepare Presentation Slides & Talking Points",
          durationMinutes: 90,
          priority: "high",
          category: "Presentation"
        },
        {
          id: "sched-f-2",
          taskId: "task-f-2",
          date: "Tomorrow (Oct 9)",
          dateNum: 9,
          startTime: "01:00 PM",
          endTime: "02:15 PM",
          task: "Practice Demo Run-through",
          durationMinutes: 75,
          priority: "high",
          category: "Project Demo"
        },
        {
          id: "sched-f-3",
          taskId: "task-f-3",
          date: "Tomorrow (Oct 9)",
          dateNum: 9,
          startTime: "02:30 PM",
          endTime: "03:15 PM",
          task: "Review Defense Questions & Q&A",
          durationMinutes: 45,
          priority: "medium",
          category: "Defense Prep"
        }
      ],
      actions: [
        {
          id: "act-step-1",
          title: "Synthesize presentation briefing & defense sheet",
          description: "Generate structured presentation briefing and anticipated Q&A",
          tool: "information",
          action: "synthesize",
          priority: "high",
          estimatedDuration: "15 mins",
          params: {
            topic: "Presentation Delivery & Defense Q&A",
            context: goal
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-2",
          title: "Schedule Presentation Preparation (07:00 PM - 08:30 PM)",
          description: "Reserve focus block on Today (Oct 8) for slide preparation",
          tool: "schedule",
          action: "create",
          priority: "high",
          estimatedDuration: "90 mins",
          params: {
            title: "Prepare Presentation Slides & Talking Points",
            date: "Today (Oct 8)",
            startTime: "07:00 PM",
            endTime: "08:30 PM",
            category: "Presentation"
          },
          requiresApproval: true,
          approvalReason: "Booking calendar slot on Today (Oct 8) at 07:00 PM - 08:30 PM."
        },
        {
          id: "act-step-3",
          title: "Schedule Demo Practice Run-through (01:00 PM - 02:15 PM)",
          description: "Reserve focus block on Tomorrow (Oct 9) for live demo practice",
          tool: "schedule",
          action: "create",
          priority: "high",
          estimatedDuration: "75 mins",
          params: {
            title: "Practice Demo Run-through",
            date: "Tomorrow (Oct 9)",
            startTime: "01:00 PM",
            endTime: "02:15 PM",
            category: "Project Demo"
          },
          requiresApproval: true,
          approvalReason: "Booking calendar slot on Tomorrow (Oct 9) at 01:00 PM - 02:15 PM."
        },
        {
          id: "act-step-4",
          title: "Schedule Q&A Review (02:30 PM - 03:15 PM)",
          description: "Reserve focus block on Tomorrow (Oct 9) for questions review",
          tool: "schedule",
          action: "create",
          priority: "medium",
          estimatedDuration: "45 mins",
          params: {
            title: "Review Defense Questions & Q&A",
            date: "Tomorrow (Oct 9)",
            startTime: "02:30 PM",
            endTime: "03:15 PM",
            category: "Defense Prep"
          },
          requiresApproval: true,
          approvalReason: "Booking calendar slot on Tomorrow (Oct 9) at 02:30 PM - 03:15 PM."
        }
      ],
      conflicts: []
    };

    return validateAndSynchronizePlan(presentationPlan, goal);
  }

  // 3. SCENARIO: Academic Study / Assignments / Exam
  if (normalized.includes("exam") || normalized.includes("assignment") || normalized.includes("study") || normalized.includes("math")) {
    const studyPlan = {
      goal,
      source: "Autonomous Engine (Fallback Mode)",
      deadline: "Upcoming Deadlines",
      constraints: [
        "Prioritize urgent assignment completion before exam review",
        "Space focus blocks with recovery intervals",
        "No schedule conflicts allowed"
      ],
      summary: "Structured academic plan prioritizing assignment completion followed by focused exam preparation.",
      estimatedTime: "3 hours total",
      assumption: "Urgent problem sets tackled first, followed by revision sessions.",
      tasks: [
        {
          id: "task-study-1",
          title: "Assignment Core Problem Sets",
          description: "Work through primary assignment deliverables and proofs",
          priority: "high",
          durationMinutes: 90,
          deadline: "Upcoming",
          category: "Study"
        },
        {
          id: "task-study-2",
          title: "Exam Core Concepts & Practice Revision",
          description: "Active recall revision and mock problem review",
          priority: "high",
          durationMinutes: 90,
          deadline: "Upcoming",
          category: "Study"
        }
      ],
      schedule: [
        {
          id: "sched-study-1",
          taskId: "task-study-1",
          date: "Today (Oct 8)",
          dateNum: 8,
          startTime: "06:00 PM",
          endTime: "07:30 PM",
          task: "Assignment Core Problem Sets",
          durationMinutes: 90,
          priority: "high",
          category: "Study"
        },
        {
          id: "sched-study-2",
          taskId: "task-study-2",
          date: "Tomorrow (Oct 9)",
          dateNum: 9,
          startTime: "06:00 PM",
          endTime: "07:30 PM",
          task: "Exam Core Concepts & Practice Revision",
          durationMinutes: 90,
          priority: "high",
          category: "Study"
        }
      ],
      actions: [
        {
          id: "act-step-1",
          title: "Create Assignment Problem Set Task",
          description: "Register high-priority academic task in registry",
          tool: "task",
          action: "create",
          priority: "high",
          estimatedDuration: "90 mins",
          params: {
            title: "Assignment Core Problem Sets",
            priority: "high",
            deadline: "Upcoming",
            duration: "90 mins",
            category: "Study"
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-2",
          title: "Schedule Assignment Focus Block (06:00 PM - 07:30 PM)",
          description: "Reserve calendar slot for assignment completion",
          tool: "schedule",
          action: "create",
          priority: "high",
          estimatedDuration: "90 mins",
          params: {
            title: "Assignment Core Problem Sets",
            date: "Today (Oct 8)",
            startTime: "06:00 PM",
            endTime: "07:30 PM",
            category: "Study"
          },
          requiresApproval: true,
          approvalReason: "Booking calendar slot on Today (Oct 8) at 06:00 PM - 07:30 PM."
        },
        {
          id: "act-step-3",
          title: "Schedule Exam Revision Block (06:00 PM - 07:30 PM)",
          description: "Reserve calendar slot on Tomorrow (Oct 9) for exam revision",
          tool: "schedule",
          action: "create",
          priority: "high",
          estimatedDuration: "90 mins",
          params: {
            title: "Exam Core Concepts & Practice Revision",
            date: "Tomorrow (Oct 9)",
            startTime: "06:00 PM",
            endTime: "07:30 PM",
            category: "Study"
          },
          requiresApproval: true,
          approvalReason: "Booking calendar slot on Tomorrow (Oct 9) at 06:00 PM - 07:30 PM."
        }
      ],
      conflicts: []
    };

    return validateAndSynchronizePlan(studyPlan, goal);
  }

  // 4. GENERAL PURPOSE WORKFLOW FALLBACK
  const generalPlan = {
    goal,
    source: "Autonomous Engine (Fallback Mode)",
    deadline: "Tomorrow",
    constraints: [
      "Break goal down into actionable milestones",
      "Reserve protected focus time without overlaps"
    ],
    summary: `Structured execution plan for: "${goal.slice(0, 70)}${goal.length > 70 ? '...' : ''}"`,
    estimatedTime: "2 hours total",
    assumption: "Action steps sequenced by priority with protected calendar slots.",
    tasks: [
      {
        id: "task-gen-1",
        title: `Primary Focus: ${goal.slice(0, 40)}`,
        description: "Execute primary milestone for the goal",
        priority: "high",
        durationMinutes: 60,
        deadline: "Today",
        category: "General"
      },
      {
        id: "task-gen-2",
        title: "Review & Quality Check",
        description: "Review deliverables and verify readiness",
        priority: "medium",
        durationMinutes: 60,
        deadline: "Tomorrow",
        category: "General"
      }
    ],
    schedule: [
      {
        id: "sched-gen-1",
        taskId: "task-gen-1",
        date: "Today (Oct 8)",
        dateNum: 8,
        startTime: "02:00 PM",
        endTime: "03:00 PM",
        task: `Primary Focus: ${goal.slice(0, 40)}`,
        durationMinutes: 60,
        priority: "high",
        category: "focus"
      }
    ],
    actions: [
      {
        id: "act-step-1",
        title: `Create task: ${goal.slice(0, 40)}`,
        description: "Register high-priority task in registry",
        tool: "task",
        action: "create",
        priority: "high",
        estimatedDuration: "60 mins",
        params: {
          title: `Primary Focus: ${goal.slice(0, 40)}`,
          priority: "high",
          deadline: "Today",
          duration: "60 mins",
          category: "General"
        },
        requiresApproval: false,
        approvalReason: null
      },
      {
        id: "act-step-2",
        title: "Schedule Focus Block (02:00 PM - 03:00 PM)",
        description: "Reserve focus block on calendar",
        tool: "schedule",
        action: "create",
        priority: "high",
        estimatedDuration: "60 mins",
        params: {
          title: `Primary Focus: ${goal.slice(0, 40)}`,
          date: "Today (Oct 8)",
          startTime: "02:00 PM",
          endTime: "03:00 PM",
          category: "focus"
        },
        requiresApproval: true,
        approvalReason: "Booking calendar slot on Today (Oct 8) at 02:00 PM - 03:00 PM."
      }
    ],
    conflicts: []
  };

  return validateAndSynchronizePlan(generalPlan, goal);
}

module.exports = {
  generateFallbackPlan
};
