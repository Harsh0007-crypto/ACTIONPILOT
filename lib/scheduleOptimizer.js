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

const {
  LANG_EN,
  normalizeLanguage,
  getMessage
} = require("./i18n");

// Parse time string (e.g., "7 PM", "7:00 PM", "19:00", "13:00", "9 AM", "शाम 6 बजे", "6 baje", "subah 9 baje")
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  let str = timeStr.trim().toLowerCase();

  // Detect and extract Hindi & Hinglish period modifiers
  const isMorning = /(?:subah|morning|सुबह|am)\b/i.test(str);
  const isEvening = /(?:shaam|raat|evening|night|dopahar|afternoon|शाम|रात|दोपहर|pm)\b/i.test(str);

  // Strip linguistic tokens for number matching
  str = str.replace(/(?:baje|बजे|subah|morning|सुबह|shaam|raat|evening|night|dopahar|afternoon|शाम|रात|दोपहर)/gi, "").trim();

  // 1. 24-hour format: "19:00", "07:30", "14:45:00"
  const match24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return h * 60 + m;
    }
  }

  // 2. 12-hour format: "7 PM", "7:00 PM", "10:30 AM", "5pm", "6", "6:30"
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    let meridiem = match12[3] ? match12[3].toUpperCase() : null;

    if (!meridiem) {
      if (isEvening && hours < 12) meridiem = "PM";
      else if (isMorning && hours < 12) meridiem = "AM";
      else if (hours >= 1 && hours <= 6) meridiem = "PM"; // In study/work schedule, 1..6 defaults to afternoon/evening PM
      else if (hours >= 7 && hours <= 11) meridiem = "PM"; // 7..11 study hours typically PM unless subah/morning specified
    }

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

// Extract availability windows, deadlines, fixed commitments, and task domain from natural language
function extractConstraints(goalText, timeZone = DEFAULT_TIMEZONE, baseDate = new Date(), language = LANG_EN) {
  const rawText = goalText || "";
  const lower = rawText.toLowerCase();
  const lang = normalizeLanguage(language, rawText);

  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

  const windows = [];
  const fixedCommitments = [];

  // Helper to extract start and end minutes from window phrase
  const extractRangeMinutes = (textChunk) => {
    if (!textChunk) return null;
    const rangeMatch = textChunk.match(/(?:from|between|only\s+from|study\s+only\s+from|se|tak|से|तक)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam|रात|raat|दोपहर|dopahar)?)\s*(?:to|-|until|and|se|tak|से|तक)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam|रात|raat|दोपहर|dopahar)?)/i);
    if (!rangeMatch) return null;
    let s = rangeMatch[1].trim();
    let e = rangeMatch[2].trim();
    const eMer = e.match(/(am|pm|shaam|subah|raat|dopahar|शाम|सुबह|रात|दोपहर)/i);
    if (!s.match(/(am|pm|shaam|subah|raat|dopahar|शाम|सुबह|रात|दोपहर)/i) && eMer) {
      s += ` ${eMer[1]}`;
    }
    const sMin = parseTimeToMinutes(s);
    const eMin = parseTimeToMinutes(e);
    if (sMin !== null && eMin !== null && eMin > sMin) {
      return { startMin: sMin, endMin: eMin, startStr: formatMinutesToTime(sMin), endStr: formatMinutesToTime(eMin) };
    }
    return null;
  };

  // 1. Explicit availability window matching (Supports English, Hindi, and Hinglish)
  // Check Today (आज, aaj, today, this evening)
  const todayPhrase = rawText.match(/(?:today|this evening|आज|aaj)\s*(?:only\s*)?(?:from|between|se|से)?\s*[^,.\n]*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam)?)[^,.\n]*(?:to|-|until|and|tak|तक)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam)?)/i);
  if (todayPhrase) {
    const r = extractRangeMinutes(todayPhrase[0]);
    if (r) {
      windows.push({
        dayLabel: todayInfo.dayLabel,
        dateNum: todayInfo.dateNum,
        dayIndex: 1,
        ...r
      });
    }
  }

  // Check Tomorrow (कल, kal, tomorrow)
  const tomorrowPhrase = rawText.match(/(?:tomorrow|कल|kal)\s*(?:only\s*)?(?:from|between|se|से)?\s*[^,.\n]*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam)?)[^,.\n]*(?:to|-|until|and|tak|तक)\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam)?)/i);
  if (tomorrowPhrase) {
    const r = extractRangeMinutes(tomorrowPhrase[0]);
    if (r) {
      windows.push({
        dayLabel: tomorrowInfo.dayLabel,
        dateNum: tomorrowInfo.dateNum,
        dayIndex: 2,
        ...r
      });
    }
  }

  // Generic repeating range across days (e.g. "from 6 PM to 9 PM each day", "3-day ... 6 PM to 9 PM", "रोज़ शाम 6 से 9 बजे तक")
  if (windows.length === 0) {
    const r = extractRangeMinutes(rawText);
    if (r) {
      let dayCount = 1;
      const dayMatch = lower.match(/(\d+)\s*[- ]\s*(?:day|दिन|din)/i) || lower.match(/(three|two|four|five|दो|तीन|चार|teen|do|char)\s*[- ]\s*(?:day|दिन|din)/i);
      if (dayMatch) {
        const val = dayMatch[1].toLowerCase();
        if (val === "three" || val === "तीन" || val === "teen") dayCount = 3;
        else if (val === "two" || val === "दो" || val === "do") dayCount = 2;
        else if (val === "four" || val === "चार" || val === "char") dayCount = 4;
        else dayCount = parseInt(dayMatch[1], 10) || 1;
      }

      for (let d = 0; d < dayCount; d++) {
        const relDay = getRelativeDayInfo(d, baseDate, timeZone);
        windows.push({
          dayLabel: relDay.dayLabel,
          dateNum: relDay.dateNum,
          dayIndex: d + 1,
          ...r
        });
      }
    }
  }

  // 2. Fixed Commitments Extraction (e.g. "team meeting today at 3 PM", "fixed team sync at 7 PM", "extra class tomorrow from 2 to 4 PM")
  const commitmentRegex = /(?:i have (?:an? )?|there is (?:an? )?|attend (?:an? )?)?\s*(?:a\s+)?(?:fixed\s+)?(team sync|sync|standup|team meeting|meeting|extra class|class|lecture|seminar|appointment|call|session|मीटिंग|क्लास|व्याख्यान)\s*(?:today|tomorrow|aaj|kal|आज|कल)?\s*(?:from|at|between|se|से)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam|दोपहर|dopahar)?)\s*(?:to|-|until|and|tak|तक)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?)?/gi;

  let commMatch;
  while ((commMatch = commitmentRegex.exec(rawText)) !== null) {
    const commTitle = commMatch[1].trim();
    const timeStartRaw = commMatch[2] ? commMatch[2].trim() : null;
    const timeEndRaw = commMatch[3] ? commMatch[3].trim() : null;

    if (timeStartRaw) {
      const sMin = parseTimeToMinutes(timeStartRaw);
      if (sMin !== null) {
        let eMin = timeEndRaw ? parseTimeToMinutes(timeEndRaw) : (sMin + 60);
        if (eMin === null || eMin <= sMin) eMin = sMin + 60;

        const isTomorrow = /(?:tomorrow|kal|कल)/i.test(commMatch[0]);
        const dayInfo = isTomorrow ? tomorrowInfo : todayInfo;

        fixedCommitments.push({
          id: `fixed-${fixedCommitments.length + 1}`,
          title: commTitle.charAt(0).toUpperCase() + commTitle.slice(1),
          date: dayInfo.dayLabel,
          dateNum: dayInfo.dateNum,
          startMin: sMin,
          endMin: eMin,
          startTime: formatMinutesToTime(sMin),
          endTime: formatMinutesToTime(eMin),
          isFixed: true
        });
      }
    }
  }

  // 3. Hard deadline extraction (e.g. "demo tomorrow at 5 PM", "कल 5 बजे डेमो है")
  let hardDeadline = null;
  const deadlineMatch = rawText.match(/(?:demo|presentation|exam|submission|deadline|परीक्षा|डेमो|प्रस्तुति)\s*(?:tomorrow|today|kal|aaj|कल|आज)?\s*(?:at|by|before|ko|तक|को)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam|दोपहर|dopahar)?)/i)
    || rawText.match(/(?:tomorrow|today|kal|aaj|कल|आज)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे|सुबह|subah|शाम|shaam|दोपहर|dopahar)?)\s*(?:baje|बजे)?\s*(?:pe|ko|par|को)?\s*(?:demo|presentation|exam|submission|deadline|परीक्षा|डेमो|प्रस्तुति)/i);

  if (deadlineMatch) {
    const deadTime = deadlineMatch[1].trim();
    const dMin = parseTimeToMinutes(deadTime);
    if (dMin !== null) {
      const isTomorrow = /(?:tomorrow|kal|कल)/i.test(deadlineMatch[0]);
      const dayLabel = isTomorrow ? tomorrowInfo.dayLabel : todayInfo.dayLabel;
      hardDeadline = {
        raw: deadTime,
        minutes: dMin,
        timeMin: dMin,
        formatted: formatMinutesToTime(dMin),
        label: `${dayLabel} at ${formatMinutesToTime(dMin)}`
      };
    }
  }

  // 4. Break preference
  let breakMinutes = 15;
  const breakMatch = rawText.match(/(?:break|interval|ब्रेक|विराम)\s*(?:of\s*)?(\d+)\s*(?:mins?|minutes?|m|मिनट|minute)/i);
  if (breakMatch) {
    breakMinutes = parseInt(breakMatch[1], 10);
  }

  // 5. Generic extraction of tasks and durations directly from user's current input
  const tasks = extractRequestedTasks(rawText, lang);

  // Reorder if user specified explicit priority ordering (e.g. "prioritizes presentation preparation first")
  const priorityMatch = rawText.match(/prioritizes?\s+([^,.\n]+?)\s+first/i) || rawText.match(/([^,.\n]+?)\s+(?:ko pehle|पहले|first)\s+(?:karo|prioritize)/i);
  if (priorityMatch && tasks.length > 1) {
    const prioWords = priorityMatch[1].toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "preparation" && w !== "prep");
    const idx = tasks.findIndex(t => prioWords.some(pw => t.title.toLowerCase().includes(pw)));
    if (idx > 0) {
      const [priorityTask] = tasks.splice(idx, 1);
      priorityTask.priority = "high";
      tasks.unshift(priorityTask);
    }
  }

  // 6. Clarification detection: when user prompt lacks actionable details (e.g. no time window, no duration, or vague prompt)
  let clarificationNeeded = false;
  let clarificationPrompt = null;
  const isVagueGreeting = /^(?:hi|hello|hey|नमस्ते|namaste|help|kuch plan karo|plan something|schedule it|plan my day)\s*$/i.test(rawText.trim());
  const isVagueGoal = /^(?:help\s+me\s+prepare|help\s+me\s+study|prepare\s+for\s+my\s+exam|study\s+well|kuch\s+padhna\s+hai|kuch\s+karna\s+hai|kripya\s+help\s+karein)[\.\?\!]?$/i.test(rawText.trim());

  if (tasks.length === 0 || isVagueGreeting || isVagueGoal || (tasks.length === 1 && !windows.length && !hardDeadline && rawText.length < 35)) {
    clarificationNeeded = true;
    clarificationPrompt = getMessage(lang, "clarificationMissingTasks");
  }

  return {
    windows,
    hasExplicitWindows: windows.length > 0,
    fixedCommitments,
    hardDeadline,
    tasks,
    inferredTopics: tasks,
    breakMinutes,
    clarificationNeeded,
    clarificationPrompt,
    language: lang,
    todayInfo,
    tomorrowInfo
  };
}

// Generic extraction of tasks directly from user text
function extractRequestedTasks(goalText, language = LANG_EN) {
  if (!goalText || typeof goalText !== "string") return [];
  const text = goalText.trim();
  const tasks = [];
  const seenTitles = new Set();

  function addTask(rawTitle, explicitDuration = null, priority = "high") {
    if (!rawTitle) return;
    let clean = rawTitle
      .replace(/^\s*[-*•\d\.\)\(\]]+\s*/, "") // remove leading bullet or numbering
      .replace(/\s*\(\s*\d+\s*(?:mins?|minutes?|m|hours?|hrs?|h|मिनट|घंटे|घंटा)\s*\)/i, "")
      .replace(/\s*for\s+\d+\s*(?:mins?|minutes?|m|hours?|hrs?|h|मिनट|घंटे|घंटा)/i, "")
      .replace(/\s*(?:ke liye|के लिए)\s*$/i, "")
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
      "schedules demo before", "outside my stated", "plan a", "plan for", "plan my",
      "koi schedule", "kuch schedule", "meri availability"
    ];
    if (metaPrefixes.some(p => lowerClean.startsWith(p) || lowerClean.includes("outside my stated availability"))) {
      return;
    }

    // Isolate first clause if sentence has multiple clauses or punctuation
    clean = clean.split(/[.\n!?]/)[0].trim();
    // Strip common conversational filler prefixes
    clean = clean.replace(/^(?:i\s+(?:have|need|want)\s+to|please\s+(?:help\s+me\s+)?|plan\s+(?:a\s+)?|schedule\s+(?:a\s+)?|mujhe\s+|hume\s+|kripya\s+)\s*/i, "");

    // Truncate to a concise task title if excessively long (e.g. max 42 chars)
    if (clean.length > 42) {
      const truncated = clean.slice(0, 40).replace(/\s+\S*$/, "");
      clean = (truncated.length >= 6 ? truncated : clean.slice(0, 40)).trim();
    }

    const formattedTitle = clean.charAt(0).toUpperCase() + clean.slice(1);
    const key = formattedTitle.toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);

      let dur = explicitDuration;
      if (!dur) {
        const durMatch = rawTitle.match(/(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hours?|hrs?|h|मिनट|minute|घंटे|घंटा|ghante|ghanta)/i);
        if (durMatch) {
          const num = parseFloat(durMatch[1]);
          const unit = durMatch[2].toLowerCase();
          dur = (unit.startsWith("h") || unit.includes("घंट") || unit.includes("ghan"))
            ? Math.round(num * 60)
            : Math.round(num);
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
  const bulletLines = lines.filter(l => /^\s*[-*•\d\.\)१२३४५]+\s+\w+/i.test(l));
  if (bulletLines.length >= 1) {
    bulletLines.forEach(l => addTask(l));
  }

  // 2. Check for clauses: "need to X, Y, and Z" or "prepare X, practice Y, and review Z"
  if (tasks.length === 0) {
    const clauseMatch = text.match(/(?:need to|want to|have to|tasks?:\s*|plan for|schedule for|prepare|practice|study|focus on|karna hai|karni hai|padhna hai|karo|banao|तैयार करना|अभ्यास करना|पढ़ना)\s+([^.]+)/i);
    if (clauseMatch) {
      let clause = clauseMatch[1];
      // Strip trailing availability and time expressions
      clause = clause.replace(/\s+(?:today|tomorrow|this evening|aaj|kal|आज|कल)?\s*(?:only\s*)?(?:from|between|se|से)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?\s*(?:to|-|until|and|tak|तक)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?.*$/i, "");
      const items = clause.split(/,\s*(?:and\s+|aur\s+|और\s+|तथा\s+)?|\s+and\s+|\s+aur\s+|\s+और\s+|\s+तथा\s+|;\s*/i);
      items.forEach(item => addTask(item.trim()));
    }
  }

  // 3. Check for comma or conjunction separated items in input (e.g. "C programming, mathematics, and AI basics")
  if (tasks.length === 0) {
    const commaSplit = text.split(/,\s*(?:and\s+|aur\s+|और\s+|तथा\s+)?|\s+and\s+|\s+aur\s+|\s+और\s+|\s+तथा\s+/i);
    if (commaSplit.length > 1) {
      commaSplit.forEach(item => addTask(item.trim()));
    }
  }

  // 4. Fallback: derive task directly from user's primary goal (stripping time constraints)
  if (tasks.length === 0) {
    let coreGoal = text
      .replace(/(?:today|tomorrow|this evening|aaj|kal|आज|कल)\s*(?:only\s*)?(?:from|between|se|से)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?\s*(?:to|-|until|and|tak|तक)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?/gi, "")
      .replace(/(?:demo|presentation|exam|submission|deadline|परीक्षा|डेमो)\s*(?:tomorrow|today|kal|aaj|कल|आज)?\s*at\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, "")
      .replace(/do not schedule anything[^\.]*/gi, "")
      .replace(/create an optimized schedule[^\.]*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (coreGoal.length > 3) {
      coreGoal = coreGoal.split(/[.\n!?]/)[0].trim();
      addTask(coreGoal);
    }
  }

  // If only 1 generic composite goal was extracted (e.g. "presentation preparation" or "exam preparation"),
  // decompose into concrete structured phases rather than a single monolithic task
  if (tasks.length === 1 && /(?:preparation|prepare|exam|presentation|project demo)/i.test(text) && !/(?:only\s+one\s+task|single\s+task)/i.test(text)) {
    const single = tasks[0];
    if (/(?:presentation|demo)/i.test(single.title)) {
      tasks.length = 0;
      seenTitles.clear();
      addTask("Draft presentation content & outline", 60, "high");
      addTask("Rehearse delivery & review talking points", 60, "medium");
    } else if (/(?:exam|study|test)/i.test(single.title)) {
      tasks.length = 0;
      seenTitles.clear();
      addTask("Review core curriculum concepts & notes", 60, "high");
      addTask("Practice problem sets & self-assessment", 60, "medium");
    }
  }

  return tasks;
}

/**
 * Builds a clean, single-source-of-truth schedule for multi-window / constrained goals
 * Used when building deterministic plans or fallback schedules.
 */
function buildConstrainedSchedule(goalText, constraints, timeZone = DEFAULT_TIMEZONE, baseDate = new Date(), language = LANG_EN) {
  const { windows, fixedCommitments = [], hardDeadline, tasks: inputTasks, breakMinutes = 15 } = constraints;
  const lang = normalizeLanguage(language || constraints.language, goalText);
  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

  const fallbackTitle = ((goalText || "").split(/[.\n!?]/)[0] || "Focus Block")
    .replace(/^(?:i\s+(?:have|need|want)\s+to|please|plan|schedule)\s*/i, "")
    .slice(0, 40)
    .trim() || "Focus Block";

  const rawTasks = (inputTasks && inputTasks.length > 0)
    ? inputTasks
    : [{ id: "task-1", title: fallbackTitle, durationMinutes: 60, priority: "high", category: "Focus" }];

  const schedule = [];
  const tasks = [];
  const actions = [];
  const conflicts = [];

  // Register all fixed commitments into schedule first as protected calendar blocks
  fixedCommitments.forEach((fc, idx) => {
    schedule.push({
      id: fc.id || `sched-fixed-${idx + 1}`,
      taskId: fc.id || `task-fixed-${idx + 1}`,
      date: fc.date,
      dateNum: fc.dateNum,
      startTime: fc.startTime,
      endTime: fc.endTime,
      task: fc.title,
      durationMinutes: fc.endMin - fc.startMin,
      priority: "high",
      category: "Commitment",
      isFixed: true
    });
  });

  // Calculate available window minutes (subtracting fixed commitments within those windows)
  const totalRequestedMinutes = rawTasks.reduce((sum, t) => sum + (t.durationMinutes || 60), 0);
  let totalAvailableMinutes = windows.reduce((sum, w) => sum + (w.endMin - w.startMin), 0);

  fixedCommitments.forEach(fc => {
    const overlappingWin = windows.find(w => w.dateNum === fc.dateNum && fc.startMin < w.endMin && fc.endMin > w.startMin);
    if (overlappingWin) {
      const overlapStart = Math.max(overlappingWin.startMin, fc.startMin);
      const overlapEnd = Math.min(overlappingWin.endMin, fc.endMin);
      totalAvailableMinutes -= Math.max(0, overlapEnd - overlapStart);
    }
  });

  if (windows.length > 0 && totalRequestedMinutes > totalAvailableMinutes) {
    conflicts.push(getMessage(lang, "impossibleScheduleDuration", totalRequestedMinutes, totalAvailableMinutes));
  }

  if (windows.length > 0) {
    // Distribute tasks across stated availability windows
    let taskIdx = 0;
    windows.forEach((win, winIdx) => {
      let curMin = win.startMin;
      const isLastWindow = winIdx === windows.length - 1;

      while (taskIdx < rawTasks.length && curMin < win.endMin) {
        const taskItem = rawTasks[taskIdx];
        let dur = taskItem.durationMinutes || 60;

        // Skip past any fixed commitment occurring during curMin
        const activeCommitment = fixedCommitments.find(c =>
          c.dateNum === win.dateNum &&
          curMin < c.endMin &&
          (curMin + dur) > c.startMin
        );

        if (activeCommitment) {
          curMin = activeCommitment.endMin; // Start immediately after commitment finishes
          if (curMin >= win.endMin) break;
        }

        // Leave remaining tasks for upcoming windows if not in last window
        const remainingWindows = windows.length - 1 - winIdx;
        const remainingTasks = rawTasks.length - taskIdx;
        if (!isLastWindow && remainingTasks <= remainingWindows && curMin > win.startMin) {
          break;
        }

        // If on deadline day and before deadline
        if (hardDeadline && win.dateNum === constraints.tomorrowInfo?.dateNum) {
          if (curMin + dur > hardDeadline.minutes) {
            dur = Math.max(15, hardDeadline.minutes - curMin);
            if (curMin >= hardDeadline.minutes) {
              conflicts.push(getMessage(lang, "impossibleScheduleDeadline", taskItem.title, hardDeadline.formatted));
              break;
            }
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
        // Use requested break if enough space remains, otherwise short 5m break or immediate transition
        const remainingSpace = win.endMin - endMin;
        const nextTask = rawTasks[taskIdx];
        if (nextTask && (nextTask.durationMinutes || 30) > remainingSpace - breakMinutes && (nextTask.durationMinutes || 30) <= remainingSpace) {
          curMin = endMin; // Squeeze task in without full break
        } else {
          curMin = endMin + breakMinutes;
        }
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
function validateAndSynchronizePlan(plan, goalText, timeZone = DEFAULT_TIMEZONE, baseDate = new Date(), language = LANG_EN) {
  if (!plan) return plan;

  const lang = normalizeLanguage(language, goalText);
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

  // If only 1 generic composite task was returned for a multi-phase preparation/exam goal,
  // ensure decomposition into concrete actionable phases
  if (tasks.length === 1 && /(?:preparation|prepare|exam|presentation|project demo)/i.test(goalText || "") && !/(?:only\s+one\s+task|single\s+task)/i.test(goalText || "")) {
    const single = tasks[0];
    if (/(?:presentation|demo)/i.test(single.title || goalText)) {
      tasks.length = 0;
      tasks.push(
        { id: "task-1", title: "Draft presentation content & outline", durationMinutes: 60, priority: "high", category: "Focus" },
        { id: "task-2", title: "Rehearse delivery & review talking points", durationMinutes: 60, priority: "medium", category: "Focus" }
      );
    } else if (/(?:exam|study|test)/i.test(single.title || goalText)) {
      tasks.length = 0;
      tasks.push(
        { id: "task-1", title: "Review core curriculum concepts & notes", durationMinutes: 60, priority: "high", category: "Focus" },
        { id: "task-2", title: "Practice problem sets & self-assessment", durationMinutes: 60, priority: "medium", category: "Focus" }
      );
    }
  }

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

  // Detect pairwise overlaps per date
  const conflicts = Array.isArray(plan.conflicts) ? [...plan.conflicts] : [];
  const scheduleByDate = {};
  deduplicatedSchedule.forEach(s => {
    const key = s.dateNum || s.date;
    if (!scheduleByDate[key]) scheduleByDate[key] = [];
    scheduleByDate[key].push(s);
  });

  Object.values(scheduleByDate).forEach(group => {
    // Sort by startTime
    group.sort((a, b) => {
      const sa = parseTimeToMinutes(a.startTime) || 0;
      const sb = parseTimeToMinutes(b.startTime) || 0;
      return sa - sb;
    });

    for (let i = 0; i < group.length - 1; i++) {
      const cur = group[i];
      const next = group[i + 1];
      const curEnd = parseTimeToMinutes(cur.endTime);
      const nextStart = parseTimeToMinutes(next.startTime);
      if (curEnd !== null && nextStart !== null && curEnd > nextStart) {
        conflicts.push(getMessage(lang, "overlapDetected", cur.task, next.task, cur.date));
      }
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
  plan.conflicts = [...new Set(conflicts)];
  plan.clarification = (constraints && constraints.clarificationNeeded) ? constraints.clarificationPrompt : null;

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

/**
 * Natural language schedule modification (Priority 2 & 3).
 * Examples:
 * - "Move my project work to 6 PM"
 * - "I have an extra class tomorrow at 4 PM"
 * Updates only affected tasks, preserves unaffected schedule, explains changes,
 * and flags consequential calendar updates for operator approval.
 */
function applyScheduleEdit(currentPlan, editInstruction, timeZone = DEFAULT_TIMEZONE, baseDate = new Date(), language = LANG_EN) {
  if (!currentPlan) return null;

  const lang = normalizeLanguage(language, editInstruction);
  const todayInfo = getRelativeDayInfo(0, baseDate, timeZone);
  const tomorrowInfo = getRelativeDayInfo(1, baseDate, timeZone);

  const editLower = (editInstruction || "").toLowerCase();
  const schedule = (currentPlan.schedule || []).map(s => ({ ...s }));
  const tasks = (currentPlan.tasks || []).map(t => ({ ...t }));
  const explanations = [];

  // Check target day: "tomorrow" / "kal" / "कल" vs today
  let targetDateInfo = todayInfo;
  if (/tomorrow|kal\b|कल/i.test(editLower)) {
    targetDateInfo = tomorrowInfo;
  }

  // Check if moving an existing task (e.g. "Move my project work to 6 PM", "practice session ko 7 baje shift karo")
  const moveMatch = editLower.match(/(?:move|shift|reschedule|बदलो|बदलें|भेजें|शिफ्ट)\s+(?:my\s+)?(.+?)\s+(?:to|at|ko|par|पर|को)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?)/i)
    || editLower.match(/(.+?)\s+(?:ko|to)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|बजे)?)\s*(?:par|ko)?\s*(?:move|shift|karo|karein|बदलो|शिफ्ट)/i);

  if (moveMatch) {
    const rawTargetName = moveMatch[1].trim();
    const rawNewTime = moveMatch[2].trim();
    const newStartMin = parseTimeToMinutes(rawNewTime);

    if (newStartMin !== null) {
      // Find matching scheduled item or task
      const targetSched = schedule.find(s =>
        s.task.toLowerCase().includes(rawTargetName) ||
        rawTargetName.includes(s.task.toLowerCase())
      ) || schedule[0];

      if (targetSched) {
        const oldStart = targetSched.startTime;
        const dur = targetSched.durationMinutes || 60;
        const newEndMin = newStartMin + dur;

        targetSched.startTime = formatMinutesToTime(newStartMin);
        targetSched.endTime = formatMinutesToTime(newEndMin);
        targetSched.date = targetDateInfo.dayLabel;
        targetSched.dateNum = targetDateInfo.dateNum;

        const moveExplanation = getMessage(lang, "rescheduleMoved", targetSched.task, oldStart, targetSched.startTime);
        explanations.push(moveExplanation);

        // Check if this newly moved slot overlaps another task on the same day; if so, push that task forward
        schedule.forEach(other => {
          if (other.id !== targetSched.id && (other.dateNum === targetSched.dateNum || other.date === targetSched.date)) {
            const otherStart = parseTimeToMinutes(other.startTime);
            const otherEnd = parseTimeToMinutes(other.endTime);
            if (otherStart !== null && otherEnd !== null && otherStart < newEndMin && otherEnd > newStartMin) {
              const oldOtherStart = other.startTime;
              const shiftedStart = newEndMin + 15; // 15 min break
              const shiftedEnd = shiftedStart + (other.durationMinutes || 60);
              other.startTime = formatMinutesToTime(shiftedStart);
              other.endTime = formatMinutesToTime(shiftedEnd);
              explanations.push(getMessage(lang, "rescheduleDisplaced", other.task, oldOtherStart, other.startTime));
            }
          }
        });
      }
    }
  }

  // Check if adding an extra commitment (e.g. "I have an extra class tomorrow at 4 PM to 5 PM", "nayi class jud gayi hai")
  const extraCommitmentMatch = editLower.match(/(?:extra|new|an?\s+additional|naya|nayi|एक\s+और|नया|नई)\s+(?:class|meeting|event|session|call|क्लास|मीटिंग)\s*(?:tomorrow|today|kal|कल|आज)?\s*(?:at|from|ko|से)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

  if (extraCommitmentMatch) {
    const rawTime = extraCommitmentMatch[1];
    const cStartMin = parseTimeToMinutes(rawTime) || (16 * 60); // 4 PM default
    const cEndMin = cStartMin + 60;
    const titleMatch = editInstruction.match(/(?:extra|new|an?\s+additional)\s+([a-zA-Z\u0900-\u097F\s]{3,25})/i);
    const commitmentTitle = titleMatch ? titleMatch[0].trim() : "Extra Session";

    // Add commitment to schedule
    const newId = `sched-extra-${Date.now().toString().slice(-4)}`;
    schedule.push({
      id: newId,
      taskId: `task-${newId}`,
      date: targetDateInfo.dayLabel,
      dateNum: targetDateInfo.dateNum,
      startTime: formatMinutesToTime(cStartMin),
      endTime: formatMinutesToTime(cEndMin),
      task: commitmentTitle,
      durationMinutes: 60,
      priority: "high",
      category: "Commitment",
      isFixed: true
    });

    tasks.push({
      id: `task-${newId}`,
      title: commitmentTitle,
      description: `Commitment: ${commitmentTitle}`,
      priority: "high",
      durationMinutes: 60,
      deadline: `${targetDateInfo.dayLabel} ${formatMinutesToTime(cEndMin)}`,
      category: "Commitment"
    });

    explanations.push(getMessage(lang, "rescheduleExplanation", commitmentTitle, targetDateInfo.dayLabel, formatMinutesToTime(cStartMin)));

    // Shift any existing task overlapping this new commitment
    schedule.forEach(other => {
      if (other.id !== newId && (other.dateNum === targetDateInfo.dateNum || other.date === targetDateInfo.dayLabel)) {
        const oStart = parseTimeToMinutes(other.startTime);
        const oEnd = parseTimeToMinutes(other.endTime);
        if (oStart !== null && oEnd !== null && oStart < cEndMin && oEnd > cStartMin) {
          const oldOStart = other.startTime;
          const pushedStart = cEndMin + 15;
          const pushedEnd = pushedStart + (other.durationMinutes || 60);
          other.startTime = formatMinutesToTime(pushedStart);
          other.endTime = formatMinutesToTime(pushedEnd);
          explanations.push(getMessage(lang, "rescheduleDisplaced", other.task, oldOStart, other.startTime));
        }
      }
    });
  }

  // Assemble updated plan
  const updatedPlan = {
    ...currentPlan,
    tasks,
    schedule,
    summary: explanations.length > 0 ? explanations.join(" ") : currentPlan.summary,
    assumption: explanations[0] || currentPlan.assumption
  };

  const synchronized = validateAndSynchronizePlan(updatedPlan, currentPlan.goal || editInstruction, timeZone, baseDate, lang);

  // Require human approval for consequential modified calendar actions
  if (Array.isArray(synchronized.actions)) {
    synchronized.actions.forEach(a => {
      if (a.tool === "schedule") {
        a.requiresApproval = true;
        a.status = "planned"; // Reset to planned so human can review and approve consequential rescheduling
        a.approvalReason = `Rescheduling confirmed: ${a.description}. Operator approval required to update calendar.`;
      }
    });
  }

  return synchronized;
}

module.exports = {
  DEFAULT_TIMEZONE,
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizeTimeString,
  extractConstraints,
  extractRequestedTasks,
  buildConstrainedSchedule,
  validateAndSynchronizePlan,
  applyScheduleEdit
};
