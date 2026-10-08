/**
 * ActionPilot Autonomous Engine (Deterministic Fallback Planner)
 * Provides clean, realistic reasoning and structured plan generation
 * when Gemini API key is absent or unreachable.
 * Clearly labeled as Autonomous Engine (Deterministic).
 */

function generateFallbackPlan(goal, currentState) {
  const normalized = (goal || "").toLowerCase();

  // SCENARIO 1: Presentation Preparation
  if (normalized.includes("presentation") || normalized.includes("prep") || normalized.includes("slide")) {
    return {
      goal,
      source: "Autonomous Engine (Deterministic)",
      summary: "Organized your presentation workflow into 3 focused stages: outline creation, slide review, and a dedicated rehearsal block.",
      estimatedTime: "2 hours total",
      assumption: "Rehearsal scheduled for tomorrow afternoon to allow morning preparation.",
      tasks: [
        {
          id: "task-f-1",
          title: "Synthesize Slide Narrative & Talking Points",
          priority: "high",
          deadline: "Tomorrow 10:00 AM",
          duration: "45 mins",
          category: "Presentation"
        },
        {
          id: "task-f-2",
          title: "Draft Visual Aids & Q&A Defense Sheet",
          priority: "high",
          deadline: "Tomorrow 01:00 PM",
          duration: "45 mins",
          category: "Presentation"
        }
      ],
      actions: [
        {
          id: "act-step-1",
          title: "Create presentation outline & talking points",
          description: "Synthesize core presentation narrative, hook, and key takeaways",
          tool: "information",
          action: "synthesize",
          params: {
            topic: "Presentation Delivery & Key Talking Points",
            context: goal
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-2",
          title: "Draft visual slide structure & Q&A notes",
          description: "Register high-priority task for slide deck review and defense sheet",
          tool: "task",
          action: "create",
          params: {
            title: "Draft Visual Aids & Q&A Defense Sheet",
            priority: "high",
            deadline: "Tomorrow 01:00 PM",
            duration: "45 mins",
            category: "Presentation"
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-3",
          title: "Save presentation briefing to Notes",
          description: "Archive presentation structure and rehearsal benchmarks into Notes dossier",
          tool: "notes",
          action: "create",
          params: {
            title: "Presentation Outline & Rehearsal Checklist",
            content: "1. Core Hook (0-2m)\n2. Problem Statement (2-4m)\n3. Autonomous Agent Solution (4-7m)\n4. Tool Orchestration & Human-in-the-Loop (7-9m)\n5. Q&A Buffer (9-10m)",
            tags: ["presentation", "outline"]
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-4",
          title: "Schedule 60-minute rehearsal session",
          description: "Book dedicated dry-run rehearsal block on calendar tomorrow at 02:00 PM",
          tool: "schedule",
          action: "create",
          params: {
            title: "Presentation Dry-Run Rehearsal",
            date: "Tomorrow",
            startTime: "02:00 PM",
            endTime: "03:00 PM",
            category: "focus"
          },
          requiresApproval: true,
          approvalReason: "Adding a new 60-minute rehearsal block to your calendar tomorrow at 02:00 PM.",
          impact: "Reserves prime afternoon focus time for dry-run practice."
        }
      ]
    };
  }

  // SCENARIO 2: Study Schedule / Academic Plan
  if (normalized.includes("study") || normalized.includes("exam") || normalized.includes("math")) {
    return {
      goal,
      source: "Autonomous Engine (Deterministic)",
      summary: "Structured a balanced study plan with spaced-repetition focus intervals, revision notes, and calendar sessions.",
      estimatedTime: "3.5 hours total",
      assumption: "Daily focus sessions capped at 45-60 minutes to prevent fatigue.",
      tasks: [
        {
          id: "task-f-3",
          title: "Review Core Concepts & Problem Sets",
          priority: "high",
          deadline: "Next Week",
          duration: "60 mins",
          category: "Study"
        },
        {
          id: "task-f-4",
          title: "Complete Timed Practice Simulation",
          priority: "high",
          deadline: "Next Week",
          duration: "60 mins",
          category: "Study"
        }
      ],
      actions: [
        {
          id: "act-step-5",
          title: "Break down key study topics & milestones",
          description: "Register high-priority study milestones for progressive revision",
          tool: "task",
          action: "create",
          params: {
            title: "Review Core Concepts & Problem Sets",
            priority: "high",
            deadline: "Next Week",
            duration: "60 mins",
            category: "Study"
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-6",
          title: "Compile revision summary cheat-sheet",
          description: "Synthesize high-yield study notes and active recall checklist into Notes",
          tool: "notes",
          action: "create",
          params: {
            title: "Study Blueprint & High-Yield Summary",
            content: "Study Strategy:\n1. 25m active recall\n2. 5m review\n3. Practice questions\n\nPriority Topics:\n- Core theorems\n- Multi-step applications\n- Edge cases",
            tags: ["study", "cheat-sheet"]
          },
          requiresApproval: false,
          approvalReason: null
        },
        {
          id: "act-step-7",
          title: "Schedule Tuesday & Thursday focus study blocks",
          description: "Book dedicated 60-minute study blocks on calendar for next week",
          tool: "schedule",
          action: "create",
          params: {
            title: "Deep Study: Core Topics Revision",
            date: "Next Week",
            startTime: "10:00 AM",
            endTime: "11:00 AM",
            category: "study"
          },
          requiresApproval: true,
          approvalReason: "Reserving dedicated 60-minute study blocks on your calendar for next week.",
          impact: "Locks in protected deep-work time to ensure steady progress."
        }
      ]
    };
  }

  // SCENARIO 3 & GENERAL: Assignment Organization / Everyday Task Management
  return {
    goal,
    source: "Autonomous Engine (Deterministic)",
    summary: "Prioritized upcoming deliverables, compiled an execution checklist, and scheduled dedicated focus sprints.",
    estimatedTime: "2.5 hours total",
    assumption: "Highest-priority deliverable tackled first in an uninterrupted sprint.",
    tasks: [
      {
        id: "task-f-5",
        title: "Triage & Complete Primary Deliverables",
        priority: "high",
        deadline: "Friday 05:00 PM",
        duration: "90 mins",
        category: "Deliverables"
      }
    ],
    actions: [
      {
        id: "act-step-8",
        title: "Prioritize deliverables by deadline",
        description: "Register primary execution task in the task registry",
        tool: "task",
        action: "create",
        params: {
          title: "Triage & Complete Primary Deliverables",
          priority: "high",
          deadline: "Friday 05:00 PM",
          duration: "90 mins",
          category: "Deliverables"
        },
        requiresApproval: false,
        approvalReason: null
      },
      {
        id: "act-step-9",
        title: "Compile execution checklist in Notes",
        description: "Create structured milestone checklist and progress criteria in Notes dossier",
        tool: "notes",
        action: "create",
        params: {
          title: "Assignment Milestone Checklist",
          content: "1. Clarify requirements and rubrics\n2. Complete first draft\n3. Review edge cases and quality check\n4. Final submission before deadline",
          tags: ["assignments", "checklist"]
        },
        requiresApproval: false,
        approvalReason: null
      },
      {
        id: "act-step-10",
        title: "Schedule dedicated focus sprint on calendar",
        description: "Book uninterrupted deep-work sprint on calendar",
        tool: "schedule",
        action: "create",
        params: {
          title: "Focus Sprint: Assignment Completion",
          date: "Thursday",
          startTime: "02:00 PM",
          endTime: "03:30 PM",
          category: "focus"
        },
        requiresApproval: true,
        approvalReason: "Reserving a dedicated 90-minute completion sprint on your calendar for Thursday.",
        impact: "Guarantees uninterrupted focus to wrap up deliverables ahead of Friday."
      }
    ]
  };
}

module.exports = {
  generateFallbackPlan
};
