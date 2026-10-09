/**
 * ActionPilot Tools Inspector View
 * Manages live rendering of Tasks, Schedule, and Notes tools in the UI.
 */

const ToolsView = {
  // Initialize tab listeners
  init() {
    const tabButtons = document.querySelectorAll(".tool-tab-btn");
    tabButtons.forEach(btn => {
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", btn.classList.contains("active") ? "true" : "false");
      btn.addEventListener("click", () => {
        tabButtons.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        const targetId = btn.getAttribute("data-tab");
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add("active");
      });
    });
  },

  // Render complete state
  render(state) {
    if (!state) return;
    this.renderTasks(state.tasks || []);
    this.renderSchedule(state.schedule || []);
    this.renderNotes(state.notes || []);
  },

  // Render Tasks Tool tab
  renderTasks(tasks) {
    const container = document.getElementById("tasksBoard");
    const countBadge = document.getElementById("toolTaskCount");
    if (countBadge) countBadge.textContent = tasks.length;
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder">
          <span>No tasks in registry</span>
        </div>`;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isCompleted = task.status === "completed";
      const escapedTitle = this.escapeHtml(task.title);
      return `
        <div class="task-item-card ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
          <input 
            type="checkbox" 
            class="task-checkbox" 
            ${isCompleted ? 'checked' : ''} 
            data-id="${task.id}"
            aria-label="Mark task ${escapedTitle} as ${isCompleted ? 'incomplete' : 'completed'}"
            title="Toggle status"
          />
          <div class="task-item-content">
            <div class="task-title">${this.escapeHtml(task.title)}</div>
            <div class="task-meta-row">
              <span class="priority-tag priority-${(task.priority || 'medium').toLowerCase()}">${task.priority || 'medium'}</span>
              <span class="deadline-tag">⏰ ${this.escapeHtml(task.deadline || 'Upcoming')}</span>
              <span class="duration-tag">⏱️ ${this.escapeHtml(task.duration || '30m')}</span>
              ${task.category ? `<span class="deadline-tag">📁 ${this.escapeHtml(task.category)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Attach checkbox toggle handlers
    container.querySelectorAll(".task-checkbox").forEach(box => {
      box.addEventListener("change", (e) => {
        const taskId = e.target.getAttribute("data-id");
        const newStatus = e.target.checked ? "completed" : "pending";
        if (window.App && window.App.updateTaskStatus) {
          window.App.updateTaskStatus(taskId, newStatus);
        }
      });
    });
  },

  // Render Schedule Tool tab
  renderSchedule(events) {
    const container = document.getElementById("scheduleBoard");
    const countBadge = document.getElementById("toolScheduleCount");
    if (countBadge) countBadge.textContent = events.length;
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder">
          <span>No events on schedule</span>
        </div>`;
      return;
    }

    container.innerHTML = events.map(evt => {
      const hasConflict = evt.conflictDetected;
      return `
        <div class="event-card ${hasConflict ? 'has-conflict' : ''}" data-id="${evt.id}">
          <div class="event-left">
            <div class="event-time-badge">${this.escapeHtml(evt.startTime)} - ${this.escapeHtml(evt.endTime)}</div>
            <div class="event-details">
              <div class="event-title">${this.escapeHtml(evt.title)}</div>
              <div class="event-date-tag">📅 ${this.escapeHtml(evt.date || 'Tomorrow')} &bull; Category: ${this.escapeHtml(evt.category || 'focus')}</div>
              ${hasConflict ? `<div class="event-conflict-warning">⚠️ Potential clash with: ${(evt.conflictingWith || []).join(", ") || 'Existing event'}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  // Render Notes Tool tab
  renderNotes(notes) {
    const container = document.getElementById("notesBoard");
    const countBadge = document.getElementById("toolNotesCount");
    if (countBadge) countBadge.textContent = notes.length;
    if (!container) return;

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-placeholder">
          <span>No notes or intel recorded</span>
        </div>`;
      return;
    }

    container.innerHTML = notes.map(note => {
      const tags = Array.isArray(note.tags) ? note.tags : [];
      return `
        <div class="note-card" data-id="${note.id}">
          <div class="note-title">📑 ${this.escapeHtml(note.title)}</div>
          <div class="note-body">${this.escapeHtml(note.content)}</div>
          <div class="note-tags">
            ${tags.map(t => `<span class="note-tag">#${this.escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
      `;
    }).join("");
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

window.ToolsView = ToolsView;
