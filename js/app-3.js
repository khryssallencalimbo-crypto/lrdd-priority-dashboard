function mapTask(row) {
    if (Object.prototype.hasOwnProperty.call(row, "taskID")) {
        return {
            taskID: row.taskID || "",
            received: row.received || "",
            subject: row.subject || "",
            committee: row.committee || "",
            personnel: row.personnel || "",
            task: row.task || "",
            completed: row.completed,
            duration: parseNumber(row.duration),
            target: row.target || "",
            deadline: row.deadline || "",
            nextAssignee: row.nextAssignee || "",
            diff: parseNumber(row.diff),
            rating: parseNumber(row.rating),
            remarks: row.remarks || "",
            sourceSheet: row.sourceSheet || ""
        };
    }

    return {
        taskID: getField(row, ["Task ID (auto)", "Task ID", "ID"]),
        received: getField(row, ["Date & Time Received", "Date Received", "Received"]),
        subject: getField(row, ["Subject Request", "Subject", "Request"]),
        committee: getField(row, ["Requesting Committee", "Committee"]),
        personnel: getField(row, ["Assigned Personnel", "Personnel", "Staff", "Name"]),
        task: getField(row, ["Task (Main Task | Sub-Task)", "Task", "Main Task", "Sub-Task"]),
        completed: getField(row, ["Task Completed?", "Completed", "Status"]),
        duration: parseNumber(getField(row, ["Working Duration", "Duration"])),
        target: getField(row, ["Target", "Target Date"]),
        deadline: getField(row, [
            "Deadline (before rating becomes < 3)",
            "Deadline",
            "Due Date",
            "Target Deadline"
        ]),
        nextAssignee: getField(row, ["Next Assignee", "Next Assigned Personnel"]),
        diff: parseNumber(getField(row, ["Difference", "Diff", "Time Remaining"])),
        rating: parseNumber(getField(row, ["Rating", "Performance Rating"])),
        remarks: getField(row, ["Remarks", "Notes"])
    };
}

function getField(row, names) {
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row, name) && row[name] !== "") {
            return row[name];
        }
    }
    return "";
}

function hasTaskContent(task) {
    return Boolean(task.taskID || task.received || task.subject || task.committee || task.personnel || task.task);
}

function parseNumber(value) {
    const number = Number.parseFloat(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(number) ? number : 0;
}

function populateFilters() {
    fillSelect(elements.monthFilter, unique(state.tasks.map(task => monthKey(task.received))).filter(Boolean), "All months");
    fillSelect(elements.committeeFilter, unique(state.tasks.map(task => task.committee)).filter(Boolean), "All committees");
    fillSelect(elements.personnelFilter, unique(state.tasks.map(task => task.personnel)).filter(Boolean), "All personnel");
}

function fillSelect(select, values, label) {
    select.innerHTML = "";
    select.appendChild(new Option(label, ""));
    values.sort((a, b) => a.localeCompare(b)).forEach(value => {
        select.appendChild(new Option(value, value));
    });
}

function applyFilters() {
    const month = elements.monthFilter.value;
    const status = elements.statusFilter.value;
    const committee = elements.committeeFilter.value;
    const personnel = elements.personnelFilter.value;
    const search = elements.searchInput.value.trim().toLowerCase();

    state.filtered = state.tasks.filter(task => {
        const haystack = [
            task.taskID,
            task.received,
            task.subject,
            task.committee,
            task.personnel,
            task.task,
            task.completed,
            task.remarks
        ].join(" ").toLowerCase();

        return (!month || monthKey(task.received) === month) &&
            (!status || (status === "completed" ? isCompleted(task.completed) : !isCompleted(task.completed))) &&
            (!committee || task.committee === committee) &&
            (!personnel || task.personnel === personnel) &&
            (!search || haystack.includes(search));
    });

    updateSummary();
    renderCharts();
    renderTable();
    renderPriorityQuest();
}

function openPriorityQuest() {
    renderPriorityQuest();
    elements.priorityQuestPanel.classList.add("open");
    elements.priorityQuestPanel.setAttribute("aria-hidden", "false");
    elements.priorityQuestBtn.setAttribute("aria-expanded", "true");
    elements.priorityQuestOverlay.hidden = false;
    requestAnimationFrame(() => elements.priorityQuestOverlay.classList.add("visible"));
    elements.priorityQuestClose.focus();
}

function closePriorityQuest() {
    elements.priorityQuestPanel.classList.remove("open");
    elements.priorityQuestPanel.setAttribute("aria-hidden", "true");
    elements.priorityQuestBtn.setAttribute("aria-expanded", "false");
    elements.priorityQuestOverlay.classList.remove("visible");
    window.setTimeout(() => {
        elements.priorityQuestOverlay.hidden = true;
    }, 220);
    elements.priorityQuestBtn.focus();
}

function renderPriorityQuest() {
    const pendingTasks = state.filtered.filter(task => !isCompleted(task.completed));
    const assessed = pendingTasks.map(assessTaskPriority).sort(compareTaskPriority);
    const quadrants = [
        { id: "do", label: "Do first", hint: "Urgent + important", action: "Start now" },
        { id: "schedule", label: "Schedule", hint: "Important, not urgent", action: "Protect time" },
        { id: "delegate", label: "Coordinate", hint: "Urgent, less important", action: "Hand off or follow up" },
        { id: "defer", label: "Defer", hint: "Neither urgent nor important", action: "Review later" }
    ];

    elements.priorityQuestBadge.textContent = String(pendingTasks.length);

    if (!assessed.length) {
        elements.priorityQuestHero.innerHTML = `
            <span class="quest-level">Quest complete</span>
            <h3>No pending tasks in this view</h3>
            <p>Clear or change the Task Explorer filters to look for another quest.</p>
        `;
    }
    else {
        const next = assessed[0];
        elements.priorityQuestHero.innerHTML = `
            <span class="quest-level">Next best action Â· ${escapeHTML(next.quadrantLabel)}</span>
            <h3>${escapeHTML(next.task.task || next.task.subject || "Review this task")}</h3>
            <div class="quest-subject">
                <span>Subject</span>
                <p>${escapeHTML(next.task.subject || "No subject provided")}</p>
            </div>
            <div class="quest-reason">${escapeHTML(next.reason)}</div>
            <dl class="quest-meta">
                <div><dt>Task ID</dt><dd>${escapeHTML(next.task.taskID || "â€”")}</dd></div>
                <div><dt>Assigned</dt><dd>${escapeHTML(next.task.personnel || "Unassigned")}</dd></div>
                <div><dt>Due</dt><dd>${escapeHTML(next.deadlineLabel)}</dd></div>
            </dl>
        `;
    }

    elements.priorityMatrix.innerHTML = quadrants.map(quadrant => {
        const tasks = assessed.filter(item => item.quadrant === quadrant.id);
        return `
            <section class="matrix-quadrant ${quadrant.id}">
                <div class="matrix-heading">
                    <div>
                        <span>${escapeHTML(quadrant.action)}</span>
                        <h3>${escapeHTML(quadrant.label)}</h3>
                        <p>${escapeHTML(quadrant.hint)}</p>
                    </div>
                    <strong>${tasks.length}</strong>
                </div>
                <div class="matrix-task-list">
                    ${tasks.slice(0, 4).map(item => `
                        <article class="matrix-task">
                            <span>${escapeHTML(item.task.taskID || "Task")}</span>
                            <h4>${escapeHTML(item.task.task || item.task.subject || "Untitled task")}</h4>
                            <p class="matrix-task-subject"><strong>Subject:</strong> ${escapeHTML(item.task.subject || "No subject provided")}</p>
                            <p class="matrix-task-deadline"><strong>Deadline:</strong> ${escapeHTML(item.deadlineLabel)}</p>
                            <p>${escapeHTML(item.task.personnel || "Unassigned")}</p>
                        </article>
                    `).join("") || `<p class="matrix-empty">No tasks here</p>`}
                    ${tasks.length > 4 ? `<p class="matrix-more">+${tasks.length - 4} more in Task Explorer</p>` : ""}
                </div>
            </section>
        `;
    }).join("");
}

function assessTaskPriority(task) {
    const now = new Date();
    const deadline = parseDate(task.deadline);
    const received = parseDate(task.received);
    const text = [task.subject, task.task, task.remarks, task.committee].join(" ").toLowerCase();
    const daysToDeadline = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null;
    const ageDays = received ? Math.max(0, Math.floor((now.getTime() - received.getTime()) / 86400000)) : 0;
    const urgentWords = /\b(urgent|immediate|asap|today|tomorrow|hearing|session|deadline|overdue)\b/i.test(text);
    const importantWords = /\b(ordinance|resolution|legal|administrative|budget|appropriation|contract|memorandum|policy|recommendation|opinion|research|code)\b/i.test(text);
    const routineWords = /\b(recording|filing|receipt|encoding|photocopy|hard copy)\b/i.test(text);

    let urgencyScore = urgentWords ? 3 : 0;
    if (daysToDeadline !== null) {
        if (daysToDeadline < 0) urgencyScore += 7;
        else if (daysToDeadline <= 1) urgencyScore += 6;
        else if (daysToDeadline <= 3) urgencyScore += 5;
        else if (daysToDeadline <= 7) urgencyScore += 2;
    }
    else if (ageDays >= 14) urgencyScore += 4;
    else if (ageDays >= 7) urgencyScore += 2;

    let importanceScore = importantWords ? 5 : 0;
    if (task.committee && !/^(none|unspecified)$/i.test(task.committee)) importanceScore += 2;
    if (routineWords) importanceScore -= 4;

    const urgent = urgencyScore >= 3;
    const important = importanceScore >= 3;
    const quadrant = urgent ? (important ? "do" : "delegate") : (important ? "schedule" : "defer");
    const quadrantLabels = { do: "Do first", schedule: "Schedule", delegate: "Coordinate", defer: "Defer" };
    const deadlineLabel = formatPriorityDeadline(deadline, daysToDeadline, ageDays);
    const reason = buildPriorityReason({ urgent, important, daysToDeadline, ageDays, routineWords });
    const deadlinePriority = daysToDeadline === null
        ? 4
        : daysToDeadline < 0
            ? 0
            : daysToDeadline <= 3
                ? 1
                : daysToDeadline <= 7
                    ? 2
                    : 3;

    return {
        task,
        quadrant,
        quadrantLabel: quadrantLabels[quadrant],
        urgencyScore,
        importanceScore,
        deadlinePriority,
        daysToDeadline,
        deadlineLabel,
        reason
    };
}

function compareTaskPriority(a, b) {
    const quadrantOrder = { do: 0, delegate: 1, schedule: 2, defer: 3 };
    return a.deadlinePriority - b.deadlinePriority ||
        quadrantOrder[a.quadrant] - quadrantOrder[b.quadrant] ||
        (a.daysToDeadline ?? Number.POSITIVE_INFINITY) - (b.daysToDeadline ?? Number.POSITIVE_INFINITY) ||
        b.urgencyScore - a.urgencyScore ||
        b.importanceScore - a.importanceScore ||
        dateValue(a.task.received) - dateValue(b.task.received);
}

function formatPriorityDeadline(deadline, daysToDeadline, ageDays) {
    if (!deadline) return ageDays ? `Open ${ageDays} days` : "No deadline";
    const deadlineDate = deadline.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    if (daysToDeadline < 0) {
        const overdueDays = Math.abs(daysToDeadline);
        return `${deadlineDate} Â· ${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
    }
    if (daysToDeadline === 0) return `${deadlineDate} Â· Due today`;
    if (daysToDeadline === 1) return `${deadlineDate} Â· Due tomorrow`;
    return `Due ${deadlineDate}`;
}

function buildPriorityReason({ urgent, important, daysToDeadline, ageDays, routineWords }) {
    const urgency = daysToDeadline !== null && daysToDeadline < 0
        ? `It is ${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? "" : "s"} overdue`
        : daysToDeadline !== null && daysToDeadline <= 3
            ? "Its deadline is close"
            : ageDays >= 7
                ? `It has been open for ${ageDays} days`
                : "It is not time-sensitive yet";
    const importance = important
        ? "it affects a substantive legislative or legal deliverable"
        : routineWords
            ? "it is primarily a routine processing step"
            : "it has fewer high-impact signals";
    return `${urgency}, and ${importance}.`;
}

function updateSummary() {
    const total = state.filtered.length;
    const completed = state.filtered.filter(task => isCompleted(task.completed)).length;
    const pending = total - completed;
    const rated = state.filtered.filter(task => task.rating > 0);
    const averageRating = rated.length ? rated.reduce((sum, task) => sum + task.rating, 0) / rated.length : 0;
    const personnel = unique(state.filtered.map(task => task.personnel).filter(Boolean)).length;
    const committees = unique(state.filtered.map(task => task.committee).filter(Boolean)).length;
    const rate = total ? (completed / total) * 100 : 0;

    elements.totalTasks.textContent = formatNumber(total);
    elements.completedTasks.textContent = formatNumber(completed);
    elements.pendingTasks.textContent = formatNumber(pending);
    elements.completionRate.textContent = `${rate.toFixed(1)}% completion`;
    elements.averageRating.textContent = averageRating.toFixed(2);
    elements.personnelCount.textContent = formatNumber(personnel);
    elements.committeeCount.textContent = formatNumber(committees);
    elements.resultCount.textContent = `${formatNumber(total)} record${total === 1 ? "" : "s"}`;
    if (elements.calendarTaskTotal) {
        elements.calendarTaskTotal.textContent = `${formatNumber(state.tasks.length)} Tasks`;
    }
    if (elements.calendarStatus) {
        elements.calendarStatus.textContent = elements.statusBadge.textContent;
    }
}

function renderTable() {
    const sorted = [...state.filtered].sort(compareTasks);
    const rows = sorted.map(task => `
        <tr>
            <td>${escapeHTML(task.taskID)}</td>
            <td>${escapeHTML(formatDateTime(task.received))}</td>
            <td>${escapeHTML(task.personnel)}</td>
            <td>${escapeHTML(task.committee)}</td>
            <td>${escapeHTML(task.subject)}</td>
            <td>${escapeHTML(task.task)}</td>
            <td>
                <div class="completion-cell">
                    <input
                        class="completion-checkbox"
                        type="checkbox"
                        ${isCompleted(task.completed) ? "checked" : ""}
                        disabled
                        aria-label="${isCompleted(task.completed) ? "Task completed" : "Task pending"}"
                    >
                    <span class="status ${isCompleted(task.completed) ? "done" : "pending"}">${isCompleted(task.completed) ? "Completed" : "Pending"}</span>
                </div>
            </td>
            <td>${task.duration ? task.duration.toFixed(2) : ""}</td>
            <td>${task.rating ? task.rating.toFixed(2) : ""}</td>
        </tr>
    `);

    elements.taskTableBody.innerHTML = rows.length
        ? rows.join("")
        : `<tr><td colspan="9" class="empty">No records match the current filters.</td></tr>`;
}

function compareTasks(a, b) {
    const direction = state.sortDirection === "asc" ? 1 : -1;
    const key = state.sortKey;
    let left = a[key];
    let right = b[key];

    if (key === "received") {
        left = dateValue(left);
        right = dateValue(right);
    }
    else if (key === "duration" || key === "rating") {
        left = Number(left) || 0;
        right = Number(right) || 0;
    }
    else {
        left = String(left || "").toLowerCase();
        right = String(right || "").toLowerCase();
    }

    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
}


