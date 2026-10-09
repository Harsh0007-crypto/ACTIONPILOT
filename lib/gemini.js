/**
 * ActionPilot Gemini AI Client
 * Connects securely to Google Gemini REST API using server-side key.
 * Never exposes API key to client or logs.
 * Supports model fallback rotation and controlled syntax repair.
 * Injects dynamic date and user timezone context.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const { validateAndSynchronizePlan } = require("./scheduleOptimizer");
const { DEFAULT_TIMEZONE, getRelativeDayInfo } = require("./dateTimeUtils");

function buildSystemInstruction(today, tomorrow, timeZone) {
  return `You are ActionPilot, an autonomous AI personal assistant.
Your job is to analyze the user's natural language goal, decompose it into concrete actions, assign appropriate tools, and generate an ordered executable action plan.

SOURCE OF TRUTH & INPUT-DRIVEN PLANNING:
- The user's actual current request is the ABSOLUTE source of truth.
- Extract the user's exact requested tasks, durations, deadlines, fixed events, breaks, and other constraints.
- Preserve the user's intent and requested task names; never replace them with unrelated default tasks or generic placeholders.
- Schedule only according to the supplied requirements and availability.
- If information is missing or constraints conflict, explain the conflict in "constraints" and "assumption" instead of inventing requirements.

DATE & TIMEZONE SYNCHRONIZATION:
- The user is operating in timezone: ${timeZone}
- TODAY'S DATE: ${today.dayLabel} (${today.isoDate}) [${today.weekday}]
- TOMORROW'S DATE: ${tomorrow.dayLabel} (${tomorrow.isoDate}) [${tomorrow.weekday}]
- For tasks and events occurring today: use date "${today.dayLabel}" or "${today.isoDate}", and set dateNum to ${today.dateNum}.
- For tasks and events occurring tomorrow: use date "${tomorrow.dayLabel}" or "${tomorrow.isoDate}", and set dateNum to ${tomorrow.dateNum}.
- Anchor all dates around ${today.isoDate}. Never output stale years (e.g. 2023).

TOOLS:
1. "task": "create" { title, priority ("high"|"medium"|"low"), deadline, duration, category }
2. "schedule": "create" { title, date, startTime, endTime, category }
3. "notes": "create" { title, content, tags }
4. "information": "synthesize" { topic, context }

CONSTRAINTS & AVAILABILITY (HARD CONSTRAINTS):
- Explicit user availability (e.g. "today only from 7 PM to 10 PM, and tomorrow from 1 PM to 4 PM") MUST be strictly honored.
- NEVER schedule any session outside the stated availability windows.
- Conclude preparatory sessions before stated deadlines or fixed events.
- Avoid overlapping sessions; include sensible short breaks between sessions.
- Every schedule item MUST reference a real generated task via "taskId".

CONSEQUENTIAL ACTIONS REQUIRE OPERATOR APPROVAL:
- Calendar bookings ("schedule" tool "create") are consequential mutations and MUST have "requiresApproval": true and a clear "approvalReason".
- Safe actions (routine tasks, notes, information synthesis) have "requiresApproval": false.

Output ONLY strictly valid JSON matching this exact schema:
{
  "goal": string,
  "deadline": string,
  "constraints": string[],
  "summary": string,
  "estimatedTime": string,
  "assumption": string,
  "tasks": [
    {
      "id": string,
      "title": string,
      "description": string,
      "priority": "high" | "medium" | "low",
      "durationMinutes": number,
      "deadline": string,
      "category": string
    }
  ],
  "schedule": [
    {
      "id": string,
      "date": string,
      "dateNum": number,
      "startTime": string,
      "endTime": string,
      "taskId": string,
      "task": string,
      "durationMinutes": number,
      "priority": "high" | "medium" | "low",
      "category": string
    }
  ],
  "actions": [
    {
      "id": string,
      "title": string,
      "description": string,
      "tool": "task" | "schedule" | "notes" | "information",
      "action": string,
      "priority": "high" | "medium" | "low",
      "estimatedDuration": string,
      "params": object,
      "requiresApproval": boolean,
      "approvalReason": string | null
    }
  ],
  "conflicts": []
}`;
}

async function planWithGemini(userGoal, currentState, overrideApiKey = null, timeZone = DEFAULT_TIMEZONE, baseDate = new Date()) {
  const apiKey = overrideApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "NO_API_KEY",
      message: "No Gemini API key configured. Switch to Autonomous Engine Fallback."
    };
  }

  const effectiveTz = timeZone || DEFAULT_TIMEZONE;
  const today = getRelativeDayInfo(0, baseDate, effectiveTz);
  const tomorrow = getRelativeDayInfo(1, baseDate, effectiveTz);
  const systemInstruction = buildSystemInstruction(today, tomorrow, effectiveTz);

  // Active production models in order of priority & availability
  const models = [
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

      const contextPrompt = `
Current System Context:
- Current Local Date in User Timezone (${effectiveTz}): ${today.dayLabel} (${today.isoDate}) [${today.weekday}]
- Next Calendar Day (Tomorrow): ${tomorrow.dayLabel} (${tomorrow.isoDate}) [${tomorrow.weekday}]
- Existing Schedule Events: ${JSON.stringify(currentState.schedule.map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime })))}
- Existing Tasks: ${JSON.stringify(currentState.tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority })))}

User Goal:
"${userGoal}"

Analyze this goal, extract constraints, schedule without conflicts, ensure every schedule item references a real generated task ("taskId"), flag consequential calendar bookings for human approval, and return strictly valid JSON matching the schema.`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(9000),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: contextPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = new Error(`Gemini API error [${model}] status ${response.status}: ${errText.slice(0, 150)}`);
        continue; // Try next model in fallback rotation
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastError = new Error(`Empty candidate text returned by ${model}`);
        continue;
      }

      // Safe JSON parsing with repair attempt if needed
      let parsed = null;
      try {
        const cleaned = rawText.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn(`[ActionPilot] JSON parse error on ${model}. Attempting controlled repair...`);
        // One controlled repair call
        try {
          const repairUrl = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
          const repairResp = await fetch(repairUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: `The following text had invalid JSON syntax:\n\n${rawText}\n\nRepair it and return ONLY strictly valid JSON matching the schema.` }] }
              ],
              generationConfig: {
                temperature: 0.0,
                responseMimeType: "application/json"
              }
            })
          });
          if (repairResp.ok) {
            const repairData = await repairResp.json();
            const repairedText = repairData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (repairedText) {
              const cleanedRepair = repairedText.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
              parsed = JSON.parse(cleanedRepair);
            }
          }
        } catch (repairErr) {
          lastError = new Error(`JSON syntax repair failed: ${repairErr.message}`);
          continue;
        }
      }

      if (!parsed || typeof parsed !== "object") {
        lastError = new Error("Invalid plan object parsed from Gemini response");
        continue;
      }

      // Synchronize and validate plan (guarantees taskId links, time formats, total duration, dynamic dates)
      const validated = validateAndSynchronizePlan(parsed, userGoal, effectiveTz, baseDate);

      return {
        success: true,
        source: `Gemini (${model})`,
        data: validated
      };

    } catch (err) {
      lastError = err;
    }
  }

  return {
    success: false,
    error: "GEMINI_EXECUTION_FAILED",
    message: lastError ? lastError.message : "Failed to query Gemini model"
  };
}

module.exports = {
  planWithGemini
};
