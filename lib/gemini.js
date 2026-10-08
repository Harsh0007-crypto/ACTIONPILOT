/**
 * ActionPilot Gemini AI Client
 * Connects securely to Google Gemini REST API using server-side key.
 * Never exposes API key to client or logs.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION = `You are ActionPilot, an autonomous AI personal assistant.
Your job is to analyze the user's natural language goal, decompose it into 3-4 concrete actions, assign appropriate tools, and generate an ordered executable action plan.

Do NOT invent unrelated clients, fake companies, or nonexistent meetings. Only generate realistic tasks directly tied to the user's goal.

You have access to 4 internal tools:
1. "task":
   - "create" { title, priority ("high"|"medium"|"low"), deadline, duration, category }
   - "update" { id, updates }
   - "complete" { id }
2. "schedule":
   - "create" { title, date, startTime, endTime, category }
   - "move" { id, newDate, newStartTime, newEndTime }
3. "notes":
   - "create" { title, content, tags }
4. "information":
   - "synthesize" { topic, context }

CONSEQUENTIAL ACTIONS REQUIRE HUMAN APPROVAL:
Actions that schedule dedicated calendar blocks or alter commitments MUST have "requiresApproval": true, along with a clear "approvalReason". Routine note-taking or task creation has "requiresApproval": false.

Output ONLY valid JSON matching this exact schema:
{
  "goal": string,
  "summary": string,
  "estimatedTime": string,
  "assumption": string | null,
  "tasks": [
    {
      "id": string,
      "title": string,
      "priority": "high" | "medium" | "low",
      "deadline": string,
      "duration": string,
      "tool": "task" | "schedule" | "notes" | "information",
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
      "params": object,
      "requiresApproval": boolean,
      "approvalReason": string | null
    }
  ]
}`;

async function planWithGemini(userGoal, currentState, overrideApiKey = null) {
  const apiKey = overrideApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "NO_API_KEY",
      message: "No Gemini API key configured. Switch to Autonomous Engine Fallback."
    };
  }

  // Models to attempt in order
  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];

  let lastError = null;

  for (const model of models) {
    try {
      const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

      const contextPrompt = `
Current System Context:
- Existing Schedule Events: ${JSON.stringify(currentState.schedule.map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime })))}
- Existing Tasks: ${JSON.stringify(currentState.tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority })))}

User Goal:
"${userGoal}"

Analyze this goal, extract constraints, schedule without conflicts, flag any consequential actions for human approval, and return JSON.`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: contextPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = new Error(`Gemini API error [${response.status}]: ${errText.slice(0, 300)}`);
        continue; // Try next model fallback
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Empty candidate response received from Gemini API");
      }

      // Safe JSON parsing
      const cleaned = rawText.trim().replace(/^```json/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        success: true,
        source: `Gemini (${model})`,
        data: parsed
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
