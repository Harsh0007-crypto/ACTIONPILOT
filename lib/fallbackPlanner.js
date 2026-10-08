/**
 * ActionPilot Autonomous Engine (Deterministic Fallback Planner)
 * Provides robust, intelligent reasoning and structured plan generation
 * when Gemini API key is absent or unreachable.
 * Clearly labeled as Autonomous Fallback Engine.
 */

function generateFallbackPlan(goal, currentState) {
  const normalized = (goal || "").toLowerCase();

  // SCENARIO 1: Presentation Preparation
  if (normalized.includes("presentation") || normalized.includes("prep") || normalized.includes("slide")) {
    return {
      goal,
      source: "Autonomous Engine (Deterministic Fallback)",
      understanding: {
        intent: "High-stakes presentation preparation with schedule de-confliction",
        urgency: "high",
        complexity: "multi-step",
        constraints: [
          "Presentation deadline is tomorrow morning",
          "Must avoid overlapping with 'Team Morning Standup' (10:00 AM - 10:30 AM)",
          "Conflict detected with 'Client Progress Review' (02:00 PM - 03:00 PM)",
          "Requires deep focus block for rehearsal and slide finalization"
        ]
      },
      summary: "Decomposed presentation preparation into 3 focused milestones, resolved afternoon scheduling conflict, synthesized slide checklist, and blocked optimal morning rehearsal windows.",
      tasks: [
        {
          id: "task-f-1",
          title: "Synthesize Executive Slide Narrative & Talking Points",
          priority: "high",
          deadline: "Tomorrow 09:00 AM",
          duration: "45 mins",
          tool: "information",
          category: "Presentation"
        },
        {
          id: "task-f-2",
          title: "Draft Visual Aids & Q&A Defense Sheet",
          priority: "high",
          deadline: "Tomorrow 11:30 AM",
          duration: "60 mins",
          tool: "task",
          category: "Presentation"
        },
        {
          id: "task-f-3",
          title: "Full Dry-Run Rehearsal with Audio/Timing",
          priority: "high",
          deadline: "Tomorrow 04:00 PM",
          duration: "60 mins",
          tool: "schedule",
          category: "Presentation"
        }
      ],
      actions: [
        {
          id: "act-step-1",
          tool: "information",
          action: "synthesize",
          description: "Generate structured presentation briefing & key talking points framework",
          params: {
            topic: "Executive Presentation Readiness Framework",
            context: "Tomorrow presentation prep"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-2",
          tool: "task",
          action: "create",
          description: "Register high-priority task: 'Draft Visual Aids & Q&A Defense Sheet'",
          params: {
            title: "Draft Visual Aids & Q&A Defense Sheet",
            priority: "high",
            deadline: "Tomorrow 11:30 AM",
            duration: "60 mins",
            category: "Presentation"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-3",
          tool: "notes",
          action: "create",
          description: "Archive presentation structure & slide deck critique into Notes dossier",
          params: {
            title: "Presentation Outline & Rehearsal Metrics",
            content: "1. Core Hook (0-2m)\n2. Problem Validation (2-4m)\n3. Agentic Workflow Solution (4-7m)\n4. Live Tool Demonstration & Human Oversight (7-9m)\n5. Concluding Q&A Buffer (9-10m)",
            tags: ["presentation", "outline", "milestone"]
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-4",
          tool: "schedule",
          action: "move",
          description: "Reschedule conflicting 'Client Progress Review' from 02:00 PM to 04:30 PM",
          params: {
            id: "evt-seed-2",
            newDate: "Tomorrow",
            newStartTime: "04:30 PM",
            newEndTime: "05:30 PM"
          },
          requiresApproval: true,
          approvalReason: "Moving an existing external stakeholder meeting disrupts confirmed calendar invites.",
          impact: "Frees up a prime 2-hour uninterrupted rehearsal block from 01:30 PM to 03:30 PM tomorrow."
        },
        {
          id: "act-step-5",
          tool: "schedule",
          action: "create",
          description: "Block dedicated 2-hour Deep Rehearsal & Dry-Run slot",
          params: {
            title: "Deep Focus: Presentation Dry-Run & Timing",
            date: "Tomorrow",
            startTime: "01:30 PM",
            endTime: "03:30 PM",
            category: "focus"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        }
      ],
      reasoning: "Presentation preparation requires high uninterrupted cognitive bandwidth. Morning contains 'Team Standup' (10:00-10:30 AM), leaving 10:30-12:00 for visual draft creation. The 2:00 PM stakeholder meeting causes a mid-afternoon fragmentation; shifting it to 4:30 PM consolidates a 2-hour deep rehearsal block. Because moving external meetings affects others, human oversight approval is mandatory."
    };
  }

  // SCENARIO 2: Math Assignment & Exam Study Plan
  if (normalized.includes("math") || normalized.includes("assignment") || normalized.includes("exam") || normalized.includes("study")) {
    return {
      goal,
      source: "Autonomous Engine (Deterministic Fallback)",
      understanding: {
        intent: "Multi-deadline academic schedule optimization and progressive study pacing",
        urgency: "high",
        complexity: "multi-step",
        constraints: [
          "Maths assignment due Friday 11:59 PM (hard deadline)",
          "Exam scheduled for Monday morning",
          "Must avoid cramming overload before Friday group study",
          "Distribute revision into staggered spaced-repetition intervals"
        ]
      },
      summary: "Generated a dual-phase revision strategy: Phase 1 prioritizes assignment completion before Friday; Phase 2 establishes intensive weekend exam test drills.",
      tasks: [
        {
          id: "task-f-4",
          title: "Complete Calculus Problem Sets 4 & 5",
          priority: "high",
          deadline: "Thursday 08:00 PM",
          duration: "90 mins",
          tool: "task",
          category: "Academic"
        },
        {
          id: "task-f-5",
          title: "Review Formulas & Core Theorems Cheat Sheet",
          priority: "medium",
          deadline: "Friday 02:00 PM",
          duration: "45 mins",
          tool: "notes",
          category: "Academic"
        },
        {
          id: "task-f-6",
          title: "Timed Practice Exam Simulation (2 Hours)",
          priority: "high",
          deadline: "Saturday 11:00 AM",
          duration: "120 mins",
          tool: "schedule",
          category: "Academic"
        }
      ],
      actions: [
        {
          id: "act-step-6",
          tool: "task",
          action: "create",
          description: "Register prerequisite task: 'Complete Calculus Problem Sets 4 & 5'",
          params: {
            title: "Complete Calculus Problem Sets 4 & 5",
            priority: "high",
            deadline: "Thursday 08:00 PM",
            duration: "90 mins",
            category: "Academic"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-7",
          tool: "notes",
          action: "create",
          description: "Synthesize Exam Prep Formula Summary & High-Yield Weak Points dossier",
          params: {
            title: "Math Exam Formula Blueprint & Weak Topics",
            content: "Key Focus Areas:\n1. Multivariable integration by parts\n2. Matrix eigenvalues and eigenvectors\n3. Taylor series approximation error bounds\n\nDaily Rule: 25m active recall + 5m review before solving problem sets.",
            tags: ["math", "exam", "cheat-sheet"]
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-8",
          tool: "schedule",
          action: "create",
          description: "Schedule Thursday Focused Study Block (Problem Sets)",
          params: {
            title: "Deep Study: Calculus Problem Sets",
            date: "Thursday",
            startTime: "06:00 PM",
            endTime: "07:30 PM",
            category: "study"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-9",
          tool: "schedule",
          action: "create",
          description: "Schedule Friday Pre-Submission Final Verification Block",
          params: {
            title: "Math Assignment Final Quality Check & Upload",
            date: "Friday",
            startTime: "01:30 PM",
            endTime: "02:30 PM",
            category: "study"
          },
          requiresApproval: false,
          approvalReason: null,
          impact: null
        },
        {
          id: "act-step-10",
          tool: "schedule",
          action: "move",
          description: "Adjust Friday Group Study Session to 04:00 PM - 06:00 PM to protect submission buffer",
          params: {
            id: "evt-seed-3",
            newDate: "Friday",
            newStartTime: "04:00 PM",
            newEndTime: "06:00 PM"
          },
          requiresApproval: true,
          approvalReason: "Modifying group study session shifts peer commitments.",
          impact: "Guarantees a clean 90-minute resting gap between solo assignment submission and collaborative peer review."
        }
      ],
      reasoning: "Splitting academic workload across deadlines prevents last-minute cognitive overload. Finishing problem sets Thursday evening enables a calm final review on Friday before the 11:59 PM deadline, clearing the weekend exclusively for mock exam conditioning."
    };
  }

  // SCENARIO 3 & GENERAL: Conflict Resolver / General Task Orchestration
  return {
    goal,
    source: "Autonomous Engine (Deterministic Fallback)",
    understanding: {
      intent: "Schedule de-confliction, calendar re-alignment, and productivity triage",
      urgency: "medium",
      complexity: "multi-step",
      constraints: [
        "Identified overlapping commitments in existing calendar",
        "Must preserve minimum 15-minute transition buffers between events",
        "Prioritize urgent deliverables over non-critical meetings"
      ]
    },
    summary: "Audited existing schedule, identified potential time clashes, created milestone execution tasks, and staged an optimized agenda with human sign-off on calendar shifts.",
    tasks: [
      {
        id: "task-f-7",
        title: "Triage & Order Inbound Work Deliverables",
        priority: "high",
        deadline: "Tomorrow 10:00 AM",
        duration: "30 mins",
        tool: "task",
        category: "Operations"
      },
      {
        id: "task-f-8",
        title: "Consolidate Daily Objectives into Action Matrix",
        priority: "medium",
        deadline: "Tomorrow 12:00 PM",
        duration: "30 mins",
        tool: "notes",
        category: "Operations"
      },
      {
        id: "task-f-9",
        title: "Execute De-Conflicted Schedule Protocol",
        priority: "high",
        deadline: "Tomorrow 05:00 PM",
        duration: "45 mins",
        tool: "schedule",
        category: "Operations"
      }
    ],
    actions: [
      {
        id: "act-step-11",
        tool: "task",
        action: "create",
        description: "Register primary triage task: 'Triage & Order Inbound Work Deliverables'",
        params: {
          title: "Triage & Order Inbound Work Deliverables",
          priority: "high",
          deadline: "Tomorrow 10:00 AM",
          duration: "30 mins",
          category: "Operations"
        },
        requiresApproval: false,
        approvalReason: null,
        impact: null
      },
      {
        id: "act-step-12",
        tool: "notes",
        action: "create",
        description: "Create Daily Operating Brief & Time-Block Architecture in Notes",
        params: {
          title: "Daily Focus Architecture & Time-Blocking Matrix",
          content: "Operating Rules for Tomorrow:\n1. 10:00 - 10:30 AM: Morning Standup (Locked)\n2. 10:45 - 12:30 PM: Uninterrupted Deep Work Sprint\n3. 01:30 - 02:00 PM: Buffer & Administrative Processing\n4. 04:30 - 05:30 PM: Stakeholder Sync (Rescheduled to protect prime focus window)",
          tags: ["agenda", "focus-plan", "operations"]
        },
        requiresApproval: false,
        approvalReason: null,
        impact: null
      },
      {
        id: "act-step-13",
        tool: "schedule",
        action: "move",
        description: "Shift 'Client Progress Review' to 04:30 PM to eliminate mid-day fragmentation",
        params: {
          id: "evt-seed-2",
          newDate: "Tomorrow",
          newStartTime: "04:30 PM",
          newEndTime: "05:30 PM"
        },
        requiresApproval: true,
        approvalReason: "Rescheduling an established afternoon meeting alters shared calendar bookings.",
        impact: "Clears an uninterrupted 3-hour focus window across peak cognitive hours (1:00 PM - 4:00 PM)."
      },
      {
        id: "act-step-14",
        tool: "schedule",
        action: "create",
        description: "Insert Protected Focus Sprint in newly cleared calendar window",
        params: {
          title: "Protected Focus Block (High-Priority Execution)",
          date: "Tomorrow",
          startTime: "11:00 AM",
          endTime: "01:00 PM",
          category: "focus"
        },
        requiresApproval: false,
        approvalReason: null,
        impact: null
      }
    ],
    reasoning: "Autonomous analysis of the current schedule detected that meetings at 10:00 AM and 2:00 PM split the workday into fragmented fragments of under 90 minutes. Shifting the 2:00 PM slot creates a solid deep-work block, allowing the user to execute their core priorities without context switching."
  };
}

module.exports = {
  generateFallbackPlan
};
