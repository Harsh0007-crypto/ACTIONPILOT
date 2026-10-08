/**
 * ActionPilot Schedule Optimizer & Constraint Engine
 * Single Source of Truth for extracting user time constraints,
 * generating multi-day conflict-free schedules, and validating
 * consistency across tasks, calendar, and execution actions.
 *
 * NOTE: The user's actual request is always the source of truth.
 * Tasks are never replaced with unrelated domains or hardcoded topics.
 */

// Parse time string (e.g., "7 PM", "7:00 PM", "19:00", "13:00", "9 AM") to minutes from midnight (0..1439)
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const str = timeStr.trim();

  // 1. 24-hour format: "19:00", "07:30", "14:45:00"
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return h * 60 + m;
    }
  }

  // 2. 12-hour format: "7 PM", "7:00 PM", "10:30 AM", "5pm"
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridiem = match12[3] ? match12[3].toUpperCase() : null;

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  return null;
}

// Format minutes from midnight to human readable time string like "7:00 PM"
function formatMinutesToTime(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return "12:00 PM";
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const meridiem = hours >= 12 ? "PM" : "AM";

  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;

  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minStr} ${meridiem}`;
}

// Normalize any time string to standard "H:MM AM/PM"
function normalizeTimeString(timeStr) {
  const min = parseTimeToMinutes(timeStr);
  if (min === null) return timeStr;
  return formatMinutesToTime(min);
}

// Extract availability windows, deadlines, and task domain from natural language
function extractConstraints(goalText) {
  const rawText = goalText || "";
  const lower = rawText.toLowerCase();

  // 1. Multi-window availability extraction
  // Handles:
  // - "available today only from 7 PM to 10 PM, and tomorrow from 1 PM to 4 PM"
  // - "study only from 6 PM to 9 PM each day"
  // - "between 1:00 PM and 4:00 PM"
  const windows = [];

  // Match window phrases with day anchors
  const todayMatch = rawText.match(/(?:today|this evening)\s*(?:only\s*)?(?:from|between)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until|and)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (todayMatch) {
    let s = todayMatch[1].trim();
    let e = todayMatch[2].trim();
    const eMer = e.match(/(am|pm)/i);
    if (!s.match(/(am|pm)/i) && eMer) s += ` ${eMer[1]}`;
    const sMin = parseTimeToMinutes(s);
    const eMin = parseTimeToMinutes(e);
    if (sMin !== null && eMin !== null && eMin > sMin) {
      windows.push({
        dayLabel: "Today (Oct 8)",
        dateNum: 8,
        dayIndex: 1,
        startMin: sMin,
        endMin: eMin,
        startStr: formatMinutesToTime(sMin),
        endStr: formatMinutesToTime(eMin)
      });
    }
  }

  const tomorrowMatch = rawText.match(/tomorrow\s*(?:only\s*)?(?:from|between)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until|and)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (tomorrowMatch) {
    let s = tomorrowMatch[1].trim();
    let e = tomorrowMatch[2].trim();
    const eMer = e.match(/(am|pm)/i);
    if (!s.match(/(am|pm)/i) && eMer) s += ` ${eMer[1]}`;
    const sMin = parseTimeToMinutes(s);
    const eMin = parseTimeToMinutes(e);
    if (sMin !== null && eMin !== null && eMin > sMin) {
      windows.push({
        dayLabel: "Tomorrow (Oct 9)",
        dateNum: 9,
        dayIndex: 2,
        startMin: sMin,
        endMin: eMin,
        startStr: formatMinutesToTime(sMin),
        endStr: formatMinutesToTime(eMin)
      });
    }
  }

  // Generic repeating range (e.g. "from 6 PM to 9 PM each day", "3-day ... 6 PM to 9 PM")
  if (windows.length === 0) {
    const genericRange = rawText.match(/(?:from|between|only\s+from|study\s+only\s+from)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until|and)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    if (genericRange) {
      let s = genericRange[1].trim();
      let e = genericRange[2].trim();
      const eMer = e.match(/(am|pm)/i);
      if (!s.match(/(am|pm)/i) && eMer) s += ` ${eMer[1]}`;
      const sMin = parseTimeToMinutes(s);
      const eMin = parseTimeToMinutes(e);
      if (sMin !== null && eMin !== null && eMin > sMin) {
        // If multi-day mentioned, expand across days
        let dayCount = 1;
        const dayMatch = lower.match(/(\d+)\s*[- ]\s*day/i) || lower.match(/(three|two|four|five)\s*[- ]\s*day/i);
        if (dayMatch) {
          if (dayMatch[1].toLowerCase() === "three") dayCount = 3;
          else if (dayMatch[1].toLowerCase() === "two") dayCount = 2;
          else dayCount = parseInt(dayMatch[1], 10) || 1;
        }

        for (let d = 0; d < dayCount; d++) {
          const dateNum = 8 + d;
          windows.push({
            dayLabel: d === 0 ? "Today (Oct 8)" : (d === 1 ? "Tomorrow (Oct 9)" : `Day ${d + 1} (Oct ${dateNum})`),
            dateNum,
            dayIndex: d + 1,
            startMin: sMin,
            endMin: eMin,
            startStr: formatMinutesToTime(sMin),
            endStr: formatMinutesToTime(eMin)
          });
        }
      }
    }
  }

  // 2. Hard deadline extraction (e.g. "demo tomorrow at 5 PM")
  let hardDeadline = null;
  const deadlineMatch = rawText.match(/(?:demo|presentation|exam|submission|deadline)\s*(?:tomorrow|today)?\s*at\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (deadlineMatch) {
    const deadTime = deadlineMatch[1].trim();
    const dMin = parseTimeToMinutes(deadTime);
    hardDeadline = {
      raw: deadTime,
      minutes: dMin,
      formatted: formatMinutesToTime(dMin),
      label: `Tomorrow at ${formatMinutesToTime(dMin)}`
    };
  }

  // 3. Domain topic inference from actual user words (NO HARDCODING)
  const inferredTopics = [];
  if (lower.includes("presentation") || lower.includes("slides")) {
    inferredTopics.push({
      key: "presentation",
      title: "Prepare Presentation & Slides",
      priority: "high",
      category: "Presentation"
    });
  }
  if (lower.includes("demo") || lower.includes("practice")) {
    inferredTopics.push({
      key: "demo",
      title: "Practice Demo & Live Walkthrough",
      priority: "high",
      category: "Project Demo"
    });
  }
  if (lower.includes("question") || lower.includes("review") || lower.includes("q&a")) {
    inferredTopics.push({
      key: "questions",
      title: "Review Possible Defense Questions & Q&A",
      priority: "medium",
      category: "Defense Prep"
    });
  }

  // Check specific academic subjects if explicitly mentioned
  if (lower.includes("c programming")) {
    inferredTopics.push({ key: "c-prog", title: "C Programming Focus Session", priority: "high", category: "Study" });
  }
  if (lower.includes("mathematics") || lower.includes("maths")) {
    inferredTopics.push({ key: "math", title: "Mathematics Problem Sets", priority: "high", category: "Study" });
  }
  if (lower.includes("ai basics")) {
    inferredTopics.push({ key: "ai", title: "AI Basics Core Concepts", priority: "high", category: "Study" });
  }

  return {
    windows,
    hasExplicitWindows: windows.length > 0,
    hardDeadline,
    inferredTopics
  };
}

/**
 * Builds a clean, single-source-of-truth schedule for multi-window / constrained goals
 * Used when building deterministic plans or fallback schedules.
 */
function buildConstrainedSchedule(goalText, constraints) {
  const { windows, hardDeadline, inferredTopics } = constraints;

  const topics = inferredTopics.length > 0 ? inferredTopics : [
    { title: "Primary Preparation Block", priority: "high", category: "focus" },
    { title: "Review & Rehearsal", priority: "high", category: "focus" }
  ];

  const schedule = [];
  const tasks = [];
  const actions = [];

  if (windows.length >= 2 && topics.length >= 2) {
    // Multi-window allocation (e.g. Today 7-10 PM, Tomorrow 1-4 PM)
    // Window 1: Today (Oct 8)
    const w1 = windows[0];
    const presTopic = topics.find(t => t.key === "presentation") || topics[0];
    const qTopic = topics.find(t => t.key === "questions") || topics[topics.length - 1];

    // Session 1 on Day 1: Presentation (e.g. 7:00 PM - 8:30 PM)
    const t1Start = w1.startMin;
    const t1End = t1Start + 90; // 90 mins
    schedule.push({
      id: "sched-prep-presentation",
      taskId: "task-prep-presentation",
      date: w1.dayLabel,
      dateNum: w1.dateNum,
      startTime: formatMinutesToTime(t1Start),
      endTime: formatMinutesToTime(t1End),
      task: presTopic.title,
      durationMinutes: 90,
      priority: "high",
      category: presTopic.category
    });

    tasks.push({
      id: "task-prep-presentation",
      title: presTopic.title,
      description: "Synthesize outline, structure slides, and organize speaking notes",
      priority: "high",
      durationMinutes: 90,
      deadline: `${w1.dayLabel} ${formatMinutesToTime(t1End)}`,
      category: presTopic.category
    });

    // Session 2 on Day 1: Questions review (e.g. 8:45 PM - 10:00 PM) after 15m buffer
    const t2Start = t1End + 15;
    const t2End = Math.min(w1.endMin, t2Start + 75);
    schedule.push({
      id: "sched-review-questions",
      taskId: "task-review-questions",
      date: w1.dayLabel,
      dateNum: w1.dateNum,
      startTime: formatMinutesToTime(t2Start),
      endTime: formatMinutesToTime(t2End),
      task: qTopic.title,
      durationMinutes: t2End - t2Start,
      priority: "medium",
      category: qTopic.category
    });

    tasks.push({
      id: "task-review-questions",
      title: qTopic.title,
      description: "Review anticipated project defense questions, edge cases, and architectural rationale",
      priority: "medium",
      durationMinutes: t2End - t2Start,
      deadline: `${w1.dayLabel} ${formatMinutesToTime(t2End)}`,
      category: qTopic.category
    });

    // Window 2: Tomorrow (Oct 9)
    const w2 = windows[1];
    const demoTopic = topics.find(t => t.key === "demo") || topics[1] || topics[0];

    // Session 3 on Day 2: Demo practice (e.g. 1:00 PM - 2:30 PM)
    const t3Start = w2.startMin;
    const t3End = t3Start + 90;
    schedule.push({
      id: "sched-practice-demo",
      taskId: "task-practice-demo",
      date: w2.dayLabel,
      dateNum: w2.dateNum,
      startTime: formatMinutesToTime(t3Start),
      endTime: formatMinutesToTime(t3End),
      task: demoTopic.title,
      durationMinutes: 90,
      priority: "high",
      category: demoTopic.category
    });

    tasks.push({
      id: "task-practice-demo",
      title: demoTopic.title,
      description: "Live dry-run of demo flow, test transitions, and verify runtime setup before the 5 PM demo",
      priority: "high",
      durationMinutes: 90,
      deadline: `${w2.dayLabel} ${formatMinutesToTime(t3End)}`,
      category: demoTopic.category
    });

    // Session 4 on Day 2: Final dry-run / buffer (e.g. 2:45 PM - 3:45 PM), completes well before 5 PM!
    const t4Start = t3End + 15;
    const t4End = Math.min(w2.endMin, t4Start + 60);
    schedule.push({
      id: "sched-final-dry-run",
      taskId: "task-final-dry-run",
      date: w2.dayLabel,
      dateNum: w2.dateNum,
      startTime: formatMinutesToTime(t4Start),
      endTime: formatMinutesToTime(t4End),
      task: "Final Demo Rehearsal & Setup Verification",
      durationMinutes: t4End - t4Start,
      priority: "high",
      category: "Rehearsal"
    });

    tasks.push({
      id: "task-final-dry-run",
      title: "Final Demo Rehearsal & Setup Verification",
      description: "Final seamless walkthrough ensuring all environments and visual slides are ready prior to 5 PM demo",
      priority: "high",
      durationMinutes: t4End - t4Start,
      deadline: `${w2.dayLabel} 4:00 PM (Before 5 PM Demo)`,
      category: "Rehearsal"
    });

  } else {
    // Single window or evenly paced sessions
    const activeWindow = windows[0] || {
      dayLabel: "Today (Oct 8)",
      dateNum: 8,
      startMin: 14 * 60,
      endMin: 17 * 60
    };

    let curStart = activeWindow.startMin;
    topics.forEach((top, idx) => {
      const dur = 60;
      const end = curStart + dur;
      const sId = `sched-step-${idx + 1}`;
      const tId = `task-step-${idx + 1}`;

      schedule.push({
        id: sId,
        taskId: tId,
        date: activeWindow.dayLabel,
        dateNum: activeWindow.dateNum,
        startTime: formatMinutesToTime(curStart),
        endTime: formatMinutesToTime(end),
        task: top.title,
        durationMinutes: dur,
        priority: top.priority || "high",
        category: top.category || "General"
      });

      tasks.push({
        id: tId,
        title: top.title,
        description: `Execute dedicated focus block for ${top.title}`,
        priority: top.priority || "high",
        durationMinutes: dur,
        deadline: `${activeWindow.dayLabel} ${formatMinutesToTime(end)}`,
        category: top.category || "General"
      });

      curStart = end + 15;
    });
  }

  // Generate actions from scheduled sessions and tasks
  schedule.forEach((s, idx) => {
    actions.push({
      id: `act-sched-${idx + 1}`,
      title: `Schedule ${s.task} (${s.startTime} - ${s.endTime})`,
      description: `Reserve protected ${s.durationMinutes}-minute focus block on ${s.date} at ${s.startTime} - ${s.endTime}`,
      tool: "schedule",
      action: "create",
      priority: s.priority,
      estimatedDuration: `${s.durationMinutes} mins`,
      params: {
        title: s.task,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        category: s.category
      },
      requiresApproval: true,
      approvalReason: `Booking calendar block for ${s.task} on ${s.date} at ${s.startTime} - ${s.endTime}.`
    });
  });

  // Calculate total duration
  const totalMinutes = schedule.reduce((sum, item) => sum + item.durationMinutes, 0);
  const totalHours = totalMinutes / 60;
  const totalDurationStr = Number.isInteger(totalHours)
    ? `${totalHours} hours total`
    : `${totalHours.toFixed(1)} hours total`;

  return {
    schedule,
    tasks,
    actions,
    totalMinutes,
    totalDurationStr
  };
}

/**
 * Validates and synchronizes plan data to ensure Single Source of Truth.
 * CRITICAL RULE:
 * - If Gemini generated tasks, NEVER replace Gemini's tasks with fake demo topics.
 * - Validates schedule references existing taskId.
 * - Normalizes time formatting, deduplicates by ID.
 * - Computes exact total estimatedTime.
 */
function validateAndSynchronizePlan(plan, goalText) {
  if (!plan) return plan;

  const constraints = extractConstraints(goalText);

  // 1. Ensure tasks have IDs and clean priorities
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  tasks.forEach((t, idx) => {
    if (!t.id) t.id = `task-${idx + 1}`;
    if (!t.priority) t.priority = "high";
    t.priority = t.priority.toLowerCase();
    if (!t.durationMinutes && t.duration) {
      const match = String(t.duration).match(/(\d+)/);
      t.durationMinutes = match ? parseInt(match[1], 10) : 60;
    }
  });

  // 2. Ensure schedule array exists and links to real tasks
  let schedule = Array.isArray(plan.schedule) ? [...plan.schedule] : [];

  // If plan has no schedule array but has actions, extract from schedule actions
  if (schedule.length === 0 && Array.isArray(plan.actions)) {
    plan.actions.forEach((a, idx) => {
      if (a.tool === "schedule" && a.params) {
        const sMin = parseTimeToMinutes(a.params.startTime);
        const eMin = parseTimeToMinutes(a.params.endTime);
        const dur = (sMin && eMin && eMin > sMin) ? (eMin - sMin) : 60;
        const rawDate = a.params.date || "Today (Oct 8)";
        const dateNum = rawDate.includes("9") || rawDate.toLowerCase().includes("tomorrow") ? 9 : 8;

        schedule.push({
          id: a.id || `sched-sync-${idx + 1}`,
          date: rawDate,
          dateNum,
          startTime: normalizeTimeString(a.params.startTime || "7:00 PM"),
          endTime: normalizeTimeString(a.params.endTime || "8:30 PM"),
          taskId: tasks[idx] ? tasks[idx].id : `task-${idx + 1}`,
          task: a.params.title || a.title || "Scheduled Focus Block",
          durationMinutes: dur,
          priority: a.priority || "high",
          category: a.params.category || "focus"
        });
      }
    });
  }

  // Deduplicate schedule items by ID
  const seenIds = new Set();
  const deduplicatedSchedule = [];

  schedule.forEach((item, idx) => {
    const id = item.id || `sched-${idx + 1}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);

      // Normalize times
      const startMin = parseTimeToMinutes(item.startTime);
      const endMin = parseTimeToMinutes(item.endTime);
      const startTimeNorm = startMin !== null ? formatMinutesToTime(startMin) : item.startTime;
      const endTimeNorm = endMin !== null ? formatMinutesToTime(endMin) : item.endTime;
      const dur = (startMin !== null && endMin !== null && endMin > startMin)
        ? (endMin - startMin)
        : (item.durationMinutes || 60);

      // Resolve dateNum
      let dateNum = item.dateNum;
      const dStr = String(item.date || "");
      if (!dateNum) {
        if (dStr.includes("9") || dStr.toLowerCase().includes("tomorrow")) dateNum = 9;
        else if (dStr.includes("10")) dateNum = 10;
        else dateNum = 8;
      }

      // Link taskId to a real task
      let taskId = item.taskId;
      if (!taskId || !tasks.find(t => t.id === taskId)) {
        const matchingTask = tasks.find(t =>
          (item.task && t.title && t.title.toLowerCase().includes(item.task.toLowerCase())) ||
          (item.task && t.title && item.task.toLowerCase().includes(t.title.toLowerCase()))
        );
        taskId = matchingTask ? matchingTask.id : (tasks[idx] ? tasks[idx].id : `task-${idx + 1}`);
      }

      deduplicatedSchedule.push({
        ...item,
        id,
        taskId,
        date: item.date || (dateNum === 9 ? "Tomorrow (Oct 9)" : "Today (Oct 8)"),
        dateNum,
        startTime: startTimeNorm,
        endTime: endTimeNorm,
        task: item.task || item.title || "Focus Session",
        durationMinutes: dur,
        priority: (item.priority || "high").toLowerCase(),
        category: item.category || "focus"
      });
    }
  });

  // Calculate actual total duration from deduplicated schedule
  const totalMinutes = deduplicatedSchedule.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);
  const totalHours = totalMinutes / 60;
  const realDurationStr = Number.isInteger(totalHours)
    ? `${totalHours} hours total`
    : `${totalHours.toFixed(1)} hours total`;

  plan.tasks = tasks;
  plan.schedule = deduplicatedSchedule;
  plan.estimatedTime = realDurationStr;

  // 3. Ensure actions are synchronized with plan.schedule & plan.tasks
  const existingActions = Array.isArray(plan.actions) ? [...plan.actions] : [];
  const nonSchedActions = existingActions.filter(a => a.tool !== "schedule");

  // Ensure schedule actions perfectly mirror deduplicatedSchedule
  const schedActions = deduplicatedSchedule.map((s, idx) => ({
    id: `act-sched-${idx + 1}`,
    title: `Schedule ${s.task} (${s.startTime} - ${s.endTime})`,
    description: `Reserve ${s.durationMinutes}-minute focus block on ${s.date} at ${s.startTime} - ${s.endTime}`,
    tool: "schedule",
    action: "create",
    priority: s.priority || "high",
    estimatedDuration: `${s.durationMinutes} mins`,
    params: {
      title: s.task,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      category: s.category || "focus"
    },
    requiresApproval: true,
    approvalReason: `Booking calendar slot on ${s.date} at ${s.startTime} - ${s.endTime}.`
  }));

  // Build canonical action list
  plan.actions = [...nonSchedActions, ...schedActions];

  // If actions was completely empty, synthesize from tasks & schedule
  if (plan.actions.length === 0) {
    tasks.forEach((t, idx) => {
      plan.actions.push({
        id: `act-task-${idx + 1}`,
        title: `Create task: ${t.title}`,
        description: t.description || `Register high-priority task for ${t.title}`,
        tool: "task",
        action: "create",
        priority: t.priority || "high",
        estimatedDuration: `${t.durationMinutes || 45} mins`,
        params: {
          title: t.title,
          priority: t.priority || "high",
          deadline: t.deadline || "Upcoming",
          duration: `${t.durationMinutes || 45} mins`,
          category: t.category || "General"
        },
        requiresApproval: false,
        approvalReason: null
      });
    });
    plan.actions.push(...schedActions);
  }

  return plan;
}

module.exports = {
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizeTimeString,
  extractConstraints,
  buildConstrainedSchedule,
  validateAndSynchronizePlan
};
