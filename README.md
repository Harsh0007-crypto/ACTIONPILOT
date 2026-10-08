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

## 🔄 The Progressive AI Workflow

A judge understands what ActionPilot does within 5 seconds. The homepage is centered on one clear question:  
**"Tell ActionPilot what you want to get done."**

After submitting a goal, ActionPilot reveals the execution pipeline progressively:

```
  [ 1. UNDERSTAND ] ── Parses intent, urgency level, and hard constraints
          │
          ▼
  [ 2. PLAN ] ──────── Breaks goal into discrete, prioritized tasks and tool actions
          │
          ▼
  [ 3. APPROVE ] ───── Halts on consequential actions for Human-in-the-Loop oversight
       ┌──┴──┐
       ▼     ▼
    [YES]  [NO]
       └──┬──┘
          ▼
  [ 4. EXECUTE ] ───── Executes approved tasks, calendar blocks, and research notes
          │
          ▼
  [ 5. DONE ] ──────── Delivers executive debrief and outcome metrics
```

Advanced technical state (Tasks Created, Calendar Schedule with Conflict Alerts, Notes Dossier, and Live Activity Log) are preserved cleanly inside secondary inspection tabs that appear after planning.

---

## 🎬 3 Instant Example Prompts

The UI includes 3 small, sleek example prompts that judges can click directly:

1. **"Plan my study schedule for next week"**  
   *Analyzes multi-deadline dependencies, establishes spaced-repetition study blocks, and generates formula cheat-sheets.*

2. **"Prepare my presentation for tomorrow"**  
   *Detects an afternoon calendar conflict with an external sync, requests Human Approval to shift it to 4:30 PM, creates a dedicated 2-hour rehearsal window, and compiles a slide briefing.*

3. **"Organize my assignments before Friday"**  
   *Decomposes assignment deliverables, resolves fragmented time gaps, and books protected focus sprints.*

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
