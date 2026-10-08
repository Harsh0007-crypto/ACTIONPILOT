# ACTIONPILOT ⚡
> **"Turn intentions into actions."**  
> *Autonomous AI for getting things done.*

[![Hackathon Track: AI Personal Assistant & Autonomous Agents](https://img.shields.io/badge/Track-AI%20Personal%20Assistant%20%26%20Autonomous%20Agents-00f0ff?style=for-the-badge)](https://github.com)
[![Engine: Gemini 2.5 Flash + Fallback](https://img.shields.io/badge/Cognitive%20Engine-Gemini%202.5%20Flash%20%2B%20Fallback-8b5cf6?style=for-the-badge)](https://ai.google.dev)
[![Architecture: Human--in--the--Loop](https://img.shields.io/badge/Safety-Human--in--the--Loop%20Gated-10b981?style=for-the-badge)](#human-in-the-loop-oversight)
[![Repo Size: < 0.2 MB](https://img.shields.io/badge/Repo%20Size-174%20KB-f59e0b?style=for-the-badge)](#hackathon-specifications)

---

## 🎯 Executive Summary & The Problem

Most conversational AI assistants are passive text generators: they respond to messy, high-stress prompts with long markdown paragraphs, leaving the human to manually read, decompose, schedule, and execute the actual work.

**ACTIONPILOT** transforms unstructured, messy human goals into concrete, autonomous action pipelines. It does not just chat; it:
1. **Decomposes** vague requests into prioritized subtasks.
2. **Orchestrates 4 genuinely functional internal tools** (Tasks, Calendar Schedule with Conflict Detection, Notes Dossier, and Knowledge Synthesizer).
3. **Enforces Human-in-the-Loop Safety Gates** before consequential or disruptive actions (e.g., rescheduling existing stakeholder meetings).
4. **Executes live mutations** and displays live progress telemetry.
5. **Produces executive completion debriefs** with measurable outcomes.

---

## 🔄 The 10-Step Autonomous Agent Workflow

```
 USER GOAL ("I have a presentation tomorrow, two assignments due Friday, and an exam Monday...")
    │
    ▼
[ 1. UNDERSTAND ] ─── Parses intent, urgency level, and hard constraints
    │
    ▼
[ 2. PLAN ] ──────── Breaks goal into discrete, prioritized tasks with time estimates
    │
    ▼
[ 3. SELECT TOOLS ] ─ Maps each milestone to Task, Schedule, Notes, or Info tools
    │
    ▼
[ 4. DETECT CONFLICTS ] ── Audits current calendar against existing commitments
    │
    ▼
[ 5. HUMAN APPROVAL GATE ] ── Pauses execution on consequential actions (e.g. moving external meetings)
    │                  ┌───────────────┴───────────────┐
    │                  ▼                               ▼
    │           [ APPROVED ✓ ]                  [ REJECTED ✕ ]
    │           Executes mutation               Safely skips mutation & adapts
    │                  └───────────────┬───────────────┘
    ▼                                  │
[ 6. EXECUTE ACTIONS ] ────────────────┘
    │   - Creates Tasks in registry
    │   - Books de-conflicted Calendar focus blocks
    │   - Synthesizes Intel Dossier & Briefings in Notes
    │
    ▼
[ 7. AUDIT LOGGING ] ── Streams real-time telemetric activity to live feed
    │
    ▼
[ 8. MISSION COMPLETE ] ─ Renders outcome analytics, metrics, and executive summary
```

---

## 🛡️ Human-In-The-Loop (HITL) Oversight

A major judging criterion for autonomous agents is **safety and governance**. Full autonomy without guardrails leads to accidental disruption (e.g. silently moving an external client sync or deleting critical tasks).

ACTIONPILOT implements a strict **two-tier execution model**:
- **Routine Non-Destructive Actions** (`requiresApproval: false`): Creating draft tasks, compiling briefing notes, and booking unreserved focus time execute automatically.
- **Consequential Actions** (`requiresApproval: true`): Rescheduling established calendar events, altering commitments with third parties, or resolving schedule clashes **halt the execution pipeline immediately**.

### The Approval Experience:
1. The Agent visualizer shifts to **Amber Warning Alert** (`WAITING FOR HUMAN APPROVAL`).
2. An interactive high-contrast **Approval Card** surfaces displaying:
   - **Proposed Action**: e.g., `Reschedule 'Client Progress Review' from 02:00 PM to 04:30 PM`
   - **Reason**: `Moving an existing external stakeholder meeting disrupts confirmed calendar invites.`
   - **Anticipated Impact**: `Frees up a prime 2-hour uninterrupted rehearsal block from 01:30 PM to 03:30 PM tomorrow.`
3. The user can either:
   - **`[ APPROVE & EXECUTE ]`**: Authorizes the consequential mutation. The tool executes immediately, updates calendar state, and logs the authorization.
   - **`[ REJECT ACTION ]`**: Denies the mutation. The agent notes the operator veto in the activity log and proceeds safely with remaining non-dependent steps without breaking the workflow.

---

## 🛠️ The 4 Functional Internal Tools

ACTIONPILOT does not use static mockups or fake buttons. All tools execute against the server-side tool registry and update live state:

| Tool | Operations | Real-World Behavior in ACTIONPILOT |
| :--- | :--- | :--- |
| 📋 **Task Tool** | `create`, `update`, `complete`, `list` | Decomposes goals into tasks with priority badges (`HIGH`, `MEDIUM`, `LOW`), durations, and interactive completion checkboxes. |
| 📅 **Schedule Tool** | `create`, `move`, `detectConflicts`, `list` | Books dedicated focus sprints and study blocks. Calculates minute-level time overlap and flags conflicts in amber. |
| 📝 **Notes Tool** | `create`, `read`, `list` | Compiles detailed checklists, formula cheat-sheets, and rehearsal guidelines with hashtag categorization. |
| 💡 **Information Synthesizer** | `synthesize` | Generates structured domain frameworks and briefing dossiers tailored to the user's specific objective. |

---

## 🎬 3 Interactive Judge Demo Scenarios

The UI includes 3 one-click scenario chips (clicking populates the goal input for judge review without premature auto-firing):

1. **🎯 Presentation Prep**
   > *"Plan my preparation for tomorrow's presentation around my existing tasks."*  
   > **Agent Behavior**: Detects a crowded afternoon calendar with an existing 2:00 PM stakeholder sync. Proposes shifting the meeting to 4:30 PM (gated with Human Approval) to create a continuous 2-hour morning dry-run rehearsal block. Synthesizes an executive slide briefing in Notes.

2. **📚 Math & Exam Plan**
   > *"I have a maths assignment due Friday and an exam Monday. Create a study plan."*  
   > **Agent Behavior**: Analyzes multi-deadline dependencies. Phases workload into Phase 1 (problem sets due Friday evening) and Phase 2 (weekend mock exam pacing). Detects Friday group study overlap and requests approval to shift buffer time.

3. **⚡ Conflict Resolver**
   > *"I need to organize my tasks for tomorrow and resolve any scheduling conflicts."*  
   > **Agent Behavior**: Audits current day slots, eliminates fragmented 30-minute gaps, isolates peak focus hours (11:00 AM - 1:00 PM), and re-aligns non-urgent meetings.

---

## 🧠 Dual Cognitive Architecture: Real Gemini AI + Deterministic Fallback

- **Real Gemini Integration**: Connects via secure server-side REST client to `gemini-2.5-flash` (with automated cascade to `gemini-1.5-flash`). Enforces structured JSON schema validation.
- **Autonomous Deterministic Engine (Zero-Key Fallback)**: If no Gemini API key is configured or the external network is unreachable, ActionPilot automatically engages its built-in heuristic reasoning planner.
- **Transparency**: The status indicator clearly displays whether live Gemini or the Autonomous Engine is active. Judges can also optionally enter their own Gemini API key directly via the **Settings Modal** (saved only in browser session memory, never written to disk or logs).

---

## 🔒 Defensive Security & Production Readiness

- **Zero API Key Exposure**: The Gemini API key is read solely on the Node.js server (`process.env.GEMINI_API_KEY`). It is never passed to frontend client bundles or network responses.
- **Zero Secrets in Git**: `.env` and `.env.local` are explicitly excluded via `.gitignore`.
- **Input Sanitization**: Client strings are escaped against XSS before DOM rendering.
- **Cloud & Container Ready**: Server binds to `0.0.0.0` and respects dynamic `process.env.PORT` (defaults to `3000`).

---

## 🚀 Quickstart & Installation

### Prerequisites
- Node.js v18+ (tested on Node.js v24.19)
- npm

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd ACTIONPILOT
npm install
```
*(Dependencies are strictly minimal: `express`, `cors`, and `dotenv`).*

### 2. (Optional) Configure Gemini API Key
Copy the example environment template:
```bash
cp .env.example .env
```
Edit `.env`:
```ini
PORT=3000
HOST=0.0.0.0
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If omitted, ActionPilot operates seamlessly in Autonomous Deterministic Fallback Mode).*

### 3. Start the Server
```bash
npm start
```
Open your browser to: **`http://localhost:3000`**

### 4. Run the Automated Test Suite
To verify all 10 core integration flows, security gates, and tool executions:
```bash
node test/system-test.js
```

---

## 📊 Hackathon Specifications & Constraints

- **Repository Size**: **~174 KB** (Massively under the 10 MB limit; 0 large assets, 0 bloat).
- **Git Structure**: Single branch (`main`).
- **Dependencies**: 3 lightweight packages (`express`, `cors`, `dotenv`).
- **Tech Stack**: Vanilla HTML5, CSS3 Glassmorphism, Vanilla ES6+ JavaScript, Node.js Express.
