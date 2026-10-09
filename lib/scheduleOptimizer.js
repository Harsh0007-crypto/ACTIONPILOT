/**
 * ActionPilot Schedule Optimizer & Constraint Engine
 * Single Source of Truth for extracting user time constraints,
 * generating multi-day conflict-free schedules, and validating
 * consistency across tasks, calendar, and execution actions.
 *
 * NOTE: Dates are derived dynamically at runtime in the user's timezone (IST / Asia/Kolkata).
 * No dates are hardcoded.
 */

const {
  DEFAULT_TIMEZONE,
  getZonedDateParts,
  getRelativeDayInfo,
  resolveDateInfo
} = require("./dateTimeUtils");

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
function extractConstraints(goalText, timeZone = DEFAULT_TIMEZONE, baseDate = new Date()) {
  const rawText = goalText || "";
  const lower = rawText.toLowerCase();

  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

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
        dayLabel: todayInfo.dayLabel,
        dateNum: todayInfo.dateNum,
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
        dayLabel: tomorrowInfo.dayLabel,
        dateNum: tomorrowInfo.dateNum,
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
          const relDay = getRelativeDayInfo(d, baseDate, timeZone);
          windows.push({
            dayLabel: relDay.dayLabel,
            dateNum: relDay.dateNum,
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
    const dayLabel = lower.includes("tomorrow") ? tomorrowInfo.dayLabel : todayInfo.dayLabel;
    hardDeadline = {
      raw: deadTime,
      minutes: dMin,
      timeMin: dMin,
      formatted: formatMinutesToTime(dMin),
      label: `${dayLabel} at ${formatMinutesToTime(dMin)}`
    };
  }

  // 3. Generic extraction of tasks and durations directly from user's current input
  const tasks = extractRequestedTasks(rawText);

  // Reorder if user specified explicit priority ordering (e.g. "prioritizes presentation preparation first")
  const priorityMatch = rawText.match(/prioritizes?\s+([^,.\n]+?)\s+first/i);
  if (priorityMatch && tasks.length > 1) {
    const prioWords = priorityMatch[1].toLowerCase().split(/\s+/).filter(w => w.length > 3 && w !== "preparation" && w !== "prep");
    const idx = tasks.findIndex(t => prioWords.some(pw => t.title.toLowerCase().includes(pw)));
    if (idx > 0) {
      const [priorityTask] = tasks.splice(idx, 1);
      priorityTask.priority = "high";
      tasks.unshift(priorityTask);
    }
  }

  // Check for break preference
  let breakMinutes = 15;
  const breakMatch = rawText.match(/(?:break|interval)\s*(?:of\s*)?(\d+)\s*(?:mins?|minutes?)/i);
  if (breakMatch) {
    breakMinutes = parseInt(breakMatch[1], 10);
  }

  return {
    windows,
    hasExplicitWindows: windows.length > 0,
    hardDeadline,
    tasks,
    inferredTopics: tasks,
    breakMinutes,
    todayInfo,
    tomorrowInfo
  };
}

// Generic extraction of tasks directly from user text
function extractRequestedTasks(goalText) {
  if (!goalText || typeof goalText !== "string") return [];
  const text = goalText.trim();
  const tasks = [];
  const seenTitles = new Set();

  function addTask(rawTitle, explicitDuration = null, priority = "high") {
    if (!rawTitle) return;
    let clean = rawTitle
      .replace(/^\s*[-*•\d\.\)\(\]]+\s*/, "") // remove leading bullet or numbering
      .replace(/\s*\(\s*\d+\s*(?:mins?|minutes?|m|hours?|hrs?|h)\s*\)/i, "") // remove (45 mins)
      .replace(/\s*for\s+\d+\s*(?:mins?|minutes?|m|hours?|hrs?|h)/i, "")
      .replace(/[.;,]+$/, "")
      .trim();

    if (!clean || clean.length < 2) return;

    // Filter out meta-instructions and constraint lines
    const lowerClean = clean.toLowerCase();
    const metaPrefixes = [
      "create an optimized", "do not schedule", "avoids overlapping", "keeps all tasks",
      "includes reasonable", "shows the exact", "detects any", "i am available",
      "available today", "available tomorrow", "can study only", "can prepare only",
      "only from", "between", "priority for every", "prioritizes", "schedules practice before",
      "schedules demo before", "outside my stated"
    ];
    if (metaPrefixes.some(p => lowerClean.startsWith(p) || lowerClean.includes("outside my stated availability"))) {
      return;
    }

    const formattedTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
    const key = formattedTitle.toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);

      let dur = explicitDuration;
      if (!dur) {
        const durMatch = rawTitle.match(/(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hours?|hrs?|h)/i);
        if (durMatch) {
          const num = parseFloat(durMatch[1]);
          const unit = durMatch[2].toLowerCase();
          dur = (unit.startsWith("h")) ? Math.round(num * 60) : Math.round(num);
        }
      }

      tasks.push({
        id: `task-${tasks.length + 1}`,
        title: formattedTitle,
        durationMinutes: dur || 60,
        priority: priority || "high",
        category: "Focus"
      });
    }
  }

  // 1. Check for bulleted lines (- task or * task or 1. task)
  const lines = text.split(/[\r\n]+/);
  const bulletLines = lines.filter(l => /^\s*[-*•\d\.\)]+\s+\w+/i.test(l));
  if (bulletLines.length >= 1) {
    bulletLines.forEach(l => addTask(l));
  }

  // 2. Check for clauses: "need to X, Y, and Z" or "prepare X, practice Y, and review Z"
  if (tasks.length === 0) {
    const clauseMatch = text.match(/(?:need to|want to|have to|tasks?:\s*|plan for|schedule for|prepare|practice)\s+([^.]+)/i);
    if (clauseMatch) {
      let clause = clauseMatch[1];
      // Strip trailing availability and time expressions (e.g. "today between 2 PM and 5 PM", "from 6 PM to 9 PM")
      clause = clause.replace(/\s+(?:today|tomorrow|this evening)?\s*(?:only\s*)?(?:from|between)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until|and)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?.*$/i, "");
      const items = clause.split(/,\s*(?:and\s+)?|\s+and\s+|;\s*/i);
      items.forEach(item => addTask(item.trim()));
    }
  }

  // 3. Fallback: derive task directly from user's primary goal (stripping time constraints)
  if (tasks.length === 0) {
    let coreGoal = text
      .replace(/(?:today|tomorrow|this evening)\s*(?:only\s*)?(?:from|between)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until|and)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, "")
      .replace(/(?:demo|presentation|exam|submission|deadline)\s*(?:tomorrow|today)?\s*at\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, "")
      .replace(/do not schedule anything[^\.]*/gi, "")
      .replace(/create an optimized schedule[^\.]*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (coreGoal.length > 3) {
      addTask(coreGoal);
    }
  }

  return tasks;
}

/**
 * Builds a clean, single-source-of-truth schedule for multi-window / constrained goals
 * Used when building deterministic plans or fallback schedules.
 */
function buildConstrainedSchedule(goalText, constraints, timeZone = DEFAULT_TIMEZONE, baseDate = new Date()) {
  const { windows, hardDeadline, tasks: inputTasks, breakMinutes = 15 } = constraints;
  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

  const rawTasks = (inputTasks && inputTasks.length > 0)
    ? inputTasks
    : [{ id: "task-1", title: goalText.slice(0, 60).trim(), durationMinutes: 60, priority: "high", category: "Focus" }];

  const schedule = [];
  const tasks = [];
  const actions = [];
  const conflicts = [];

  // Check if constraints conflict
  const totalRequestedMinutes = rawTasks.reduce((sum, t) => sum + (t.durationMinutes || 60), 0);
  const totalWindowMinutes = windows.reduce((sum, w) => sum + (w.endMin - w.startMin), 0);

  if (windows.length > 0 && totalRequestedMinutes > totalWindowMinutes) {
    conflicts.push(`Requested tasks require ${totalRequestedMinutes} minutes, but stated availability is only ${totalWindowMinutes} minutes.`);
  }

  if (windows.length > 0) {
    // Distribute tasks across stated availability windows
    let taskIdx = 0;
    windows.forEach((win, winIdx) => {
      let curMin = win.startMin;
      const isLastWindow = winIdx === windows.length - 1;

      while (taskIdx < rawTasks.length && curMin < win.endMin) {
        // Leave remaining tasks for upcoming windows if not in last window
        const remainingWindows = windows.length - 1 - winIdx;
        const remainingTasks = rawTasks.length - taskIdx;
        if (!isLastWindow && remainingTasks <= remainingWindows && curMin > win.startMin) {
          break;
        }

        const taskItem = rawTasks[taskIdx];
        let dur = taskItem.durationMinutes || 60;

        // If on deadline day and before deadline
        if (hardDeadline && win.dateNum === constraints.tomorrowInfo?.dateNum) {
          if (curMin + dur > hardDeadline.minutes) {
            dur = Math.max(15, hardDeadline.minutes - curMin);
          }
        }

        // Clamp to window end
        if (curMin + dur > win.endMin) {
          dur = Math.max(15, win.endMin - curMin);
        }

        const endMin = curMin + dur;
        const sId = `sched-${taskIdx + 1}`;
        const tId = taskItem.id || `task-${taskIdx + 1}`;

        schedule.push({
          id: sId,
          taskId: tId,
          date: win.dayLabel,
          dateNum: win.dateNum,
          startTime: formatMinutesToTime(curMin),
          endTime: formatMinutesToTime(endMin),
          task: taskItem.title,
          durationMinutes: dur,
          priority: taskItem.priority || "high",
          category: taskItem.category || "Focus"
        });

        tasks.push({
          id: tId,
          title: taskItem.title,
          description: taskItem.description || `Dedicated deep-work session for ${taskItem.title}`,
          priority: taskItem.priority || "high",
          durationMinutes: dur,
          deadline: `${win.dayLabel} ${formatMinutesToTime(endMin)}`,
          category: taskItem.category || "Focus"
        });

        taskIdx++;
        curMin = endMin + breakMinutes;
      }
    });

    // If there were more windows than tasks (e.g. 1 task across 2 days):
    if (taskIdx < windows.length && schedule.length < windows.length) {
      for (let w = schedule.length; w < windows.length; w++) {
        const win = windows[w];
        const baseTask = rawTasks[0];
        const dur = Math.min(90, win.endMin - win.startMin);
        const endMin = win.startMin + dur;
        const sId = `sched-followup-${w + 1}`;
        const tId = `task-followup-${w + 1}`;
        const phaseTitle = `${baseTask.title} (Phase ${w + 1})`;

        schedule.push({
          id: sId,
          taskId: tId,
          date: win.dayLabel,
          dateNum: win.dateNum,
          startTime: formatMinutesToTime(win.startMin),
          endTime: formatMinutesToTime(endMin),
          task: phaseTitle,
          durationMinutes: dur,
          priority: "high",
          category: "Focus"
        });

        tasks.push({
          id: tId,
          title: phaseTitle,
          description: `Continuation and completion session for ${baseTask.title}`,
          priority: "high",
          durationMinutes: dur,
          deadline: `${win.dayLabel} ${formatMinutesToTime(endMin)}`,
          category: "Focus"
        });
      }
    }

  } else {
    // No explicit windows: schedule consecutively starting at 10:00 AM on today
    let curMin = 10 * 60; // 10:00 AM
    rawTasks.forEach((taskItem, idx) => {
      let dur = taskItem.durationMinutes || 60;
      if (hardDeadline && curMin + dur > hardDeadline.minutes) {
        dur = Math.max(15, hardDeadline.minutes - curMin);
      }
      const endMin = curMin + dur;
      const sId = `sched-${idx + 1}`;
      const tId = taskItem.id || `task-${idx + 1}`;

      schedule.push({
        id: sId,
        taskId: tId,
        date: todayInfo.dayLabel,
        dateNum: todayInfo.dateNum,
        startTime: formatMinutesToTime(curMin),
        endTime: formatMinutesToTime(endMin),
        task: taskItem.title,
        durationMinutes: dur,
        priority: taskItem.priority || "high",
        category: taskItem.category || "Focus"
      });

      tasks.push({
        id: tId,
        title: taskItem.title,
        description: `Execute dedicated focus block for ${taskItem.title}`,
        priority: taskItem.priority || "high",
        durationMinutes: dur,
        deadline: `${todayInfo.dayLabel} ${formatMinutesToTime(endMin)}`,
        category: taskItem.category || "Focus"
      });

      curMin = endMin + breakMinutes;
    });
  }

  // Generate actions from scheduled sessions and tasks
  tasks.forEach((t, idx) => {
    actions.push({
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
      approvalReason: `Booking calendar slot for ${s.task} on ${s.date} at ${s.startTime} - ${s.endTime}.`
    });
  });

  // Calculate total duration
  const totalMinutes = schedule.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = totalMinutes / 60;
  const totalDurationStr = Number.isInteger(totalHours)
    ? `${totalHours} hours total`
    : `${totalHours.toFixed(1)} hours total`;

  return {
    schedule,
    tasks,
    actions,
    conflicts,
    totalMinutes,
    totalDurationStr
  };
}

/**
 * Validates and synchronizes plan data to ensure Single Source of Truth.
 * CRITICAL RULE:
 * - Dates are dynamically resolved at runtime in the specified timezone.
 * - If Gemini generated tasks, NEVER replace Gemini's tasks with fake demo topics.
 * - Validates schedule references existing taskId.
 * - Normalizes time formatting, deduplicates by ID.
 * - Computes exact total estimatedTime.
 */
function validateAndSynchronizePlan(plan, goalText, timeZone = DEFAULT_TIMEZONE, baseDate = new Date()) {
  if (!plan) return plan;

  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

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
        const dateInfo = resolveDateInfo(a.params.date || "Today", baseDate, timeZone);

        schedule.push({
          id: a.id || `sched-sync-${idx + 1}`,
          date: dateInfo.dayLabel,
          dateNum: dateInfo.dateNum,
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

  const constraints = extractConstraints(goalText, timeZone, baseDate);

  // Deduplicate schedule items by ID
  const seenIds = new Set();
  const deduplicatedSchedule = [];

  schedule.forEach((item, idx) => {
    const id = item.id || `sched-${idx + 1}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);

      // Parse initial start and end minutes
      const startMin = parseTimeToMinutes(item.startTime);
      const endMin = parseTimeToMinutes(item.endTime);

      // Dynamically resolve date & dateNum in user timezone
      const dateInfo = resolveDateInfo(item.date || item.dateNum, baseDate, timeZone);

      // Enforce constraint clamping if explicit windows exist
      let adjustedStartMin = startMin;
      let adjustedEndMin = endMin;

      if (constraints && constraints.hasExplicitWindows) {
        const matchingWindow = constraints.windows.find(w =>
          w.dateNum === dateInfo.dateNum ||
          (w.dayLabel && item.date && String(item.date).toLowerCase().includes(w.dayLabel.toLowerCase())) ||
          (dateInfo.dayLabel && dateInfo.dayLabel.toLowerCase().includes(w.dayLabel.toLowerCase()))
        );

        if (matchingWindow) {
          if (adjustedStartMin !== null && adjustedStartMin < matchingWindow.startMin) {
            adjustedStartMin = matchingWindow.startMin;
          }
          if (adjustedEndMin !== null && adjustedEndMin > matchingWindow.endMin) {
            adjustedEndMin = matchingWindow.endMin;
          }
          if (adjustedStartMin !== null && adjustedEndMin !== null && adjustedEndMin <= adjustedStartMin) {
            adjustedEndMin = Math.min(matchingWindow.endMin, adjustedStartMin + 30);
          }
        }
      }

      if (constraints && constraints.hardDeadline && dateInfo.dateNum === constraints.tomorrowInfo?.dateNum) {
        if (adjustedEndMin !== null && adjustedEndMin > constraints.hardDeadline.timeMin) {
          adjustedEndMin = constraints.hardDeadline.timeMin;
          if (adjustedStartMin !== null && adjustedStartMin >= adjustedEndMin) {
            adjustedStartMin = adjustedEndMin - 30;
          }
        }
      }

      const startTimeNorm = adjustedStartMin !== null ? formatMinutesToTime(adjustedStartMin) : item.startTime;
      const endTimeNorm = adjustedEndMin !== null ? formatMinutesToTime(adjustedEndMin) : item.endTime;
      const dur = (adjustedStartMin !== null && adjustedEndMin !== null && adjustedEndMin > adjustedStartMin)
        ? (adjustedEndMin - adjustedStartMin)
        : (item.durationMinutes || 60);

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
        date: dateInfo.dayLabel,
        dateNum: dateInfo.dateNum,
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

  // If no routine non-schedule actions exist, synthesize routine task creation actions
  if (nonSchedActions.length === 0 && tasks.length > 0) {
    tasks.forEach((t, idx) => {
      nonSchedActions.push({
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
  }

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
  DEFAULT_TIMEZONE,
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizeTimeString,
  extractConstraints,
  buildConstrainedSchedule,
  validateAndSynchronizePlan
};
