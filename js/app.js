"use strict";

const SHEET_ID = "1p6OM1xFRm0fda1RYYmch9xFcYRKQmyi8CUdP0MNHPy8";
const SHEET_GID = "531198136";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const SHEET_CSV_BACKUP_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
const SHEET_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}`;
const SCHEDULE_SHEET_ID = "1829YWLuvpU6ysiCu8SJ1_IFJUBT3QbGWU_cYdroqvO4";
const SCHEDULE_SHEET_GIDS = [
    "58812189",  // July 2026
    "633782130"  // August 2026
];
const SCHEDULE_GVIZ_URLS = SCHEDULE_SHEET_GIDS.map(gid =>
    `https://docs.google.com/spreadsheets/d/${SCHEDULE_SHEET_ID}/gviz/tq?gid=${gid}`
);
const DASHBOARD_REFRESH_MS = 60 * 1000;
const SCHEDULE_REFRESH_MS = 60 * 1000;

const LOCAL_HOLIDAYS = [
    { date: "2026-01-01", title: "New Year's Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-02-17", title: "Chinese New Year", time: "Special non-working day", type: "holiday-national" },
    { date: "2026-02-25", title: "EDSA People Power Revolution Anniversary", time: "Special working day", type: "holiday-working" },
    { date: "2026-03-20", title: "Eid'l Fitr", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-04-02", title: "Maundy Thursday", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-04-03", title: "Good Friday", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-04-04", title: "Black Saturday", time: "Special non-working day", type: "holiday-national" },
    { date: "2026-04-09", title: "Araw ng Kagitingan", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-05-01", title: "Labor Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-05-19", title: "Balangay Festival", time: "Butuan special non-working day", type: "holiday-local" },
    { date: "2026-05-27", title: "Eid'l Adha", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-06-12", title: "Independence Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-08-03", title: "Adlaw Hong Butuan (observed)", time: "Butuan special non-working day; Charter Day is August 2", type: "holiday-local" },
    { date: "2026-08-21", title: "Ninoy Aquino Day", time: "Special non-working day", type: "holiday-national" },
    { date: "2026-08-31", title: "National Heroes Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-11-01", title: "All Saints' Day", time: "Special non-working day", type: "holiday-national" },
    { date: "2026-11-02", title: "All Souls' Day", time: "Additional special non-working day", type: "holiday-national" },
    { date: "2026-11-30", title: "Bonifacio Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-12-08", title: "Feast of the Immaculate Conception", time: "Special non-working day", type: "holiday-national" },
    { date: "2026-12-24", title: "Christmas Eve", time: "Additional special non-working day", type: "holiday-national" },
    { date: "2026-12-25", title: "Christmas Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-12-30", title: "Rizal Day", time: "Regular holiday", type: "holiday-national" },
    { date: "2026-12-31", title: "Last Day of the Year", time: "Special non-working day", type: "holiday-national" }
].map(holiday => ({
    ...holiday,
    date: parseLocalDate(holiday.date)
}));

const state = {
    tasks: [],
    filtered: [],
    dashboardLoading: false,
    dashboardRefreshTimer: null,
    schedule: [],
    scheduleLoading: false,
    scheduleRefreshTimer: null,
    scheduleViewDate: null,
    sortKey: "received",
    sortDirection: "desc"
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    loadDashboard();
    startDashboardAutoRefresh();
    startScheduleAutoRefresh();
});

function cacheElements() {
    [
        "statusBadge",
        "lastUpdated",
        "refreshBtn",
        "exportBtn",
        "clearFiltersBtn",
        "totalTasks",
        "completedTasks",
        "pendingTasks",
        "completionRate",
        "averageRating",
        "personnelCount",
        "committeeCount",
        "monthCount",
        "monthFilter",
        "statusFilter",
        "committeeFilter",
        "personnelFilter",
        "searchInput",
        "resultCount",
        "calendarTaskTotal",
        "calendarStatus",
        "scheduleStatus",
        "scheduleUpdated",
        "scheduleCount",
        "scheduleMonthLabel",
        "schedulePrevMonth",
        "scheduleTodayBtn",
        "scheduleNextMonth",
        "scheduleMonthTabs",
        "scheduleList",
        "taskTableBody",
        "monthlyChart",
        "committeeChart",
        "priorityQuestBtn",
        "priorityQuestBadge",
        "priorityQuestPanel",
        "priorityQuestOverlay",
        "priorityQuestClose",
        "priorityQuestHero",
        "priorityMatrix"
    ].forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

function bindEvents() {
    elements.refreshBtn.addEventListener("click", () => loadDashboard());
    elements.exportBtn.addEventListener("click", exportFilteredCSV);
    elements.clearFiltersBtn.addEventListener("click", clearFilters);
    elements.schedulePrevMonth.addEventListener("click", () => changeScheduleMonth(-1));
    elements.scheduleNextMonth.addEventListener("click", () => changeScheduleMonth(1));
    elements.scheduleTodayBtn.addEventListener("click", showCurrentScheduleMonth);
    elements.priorityQuestBtn.addEventListener("click", openPriorityQuest);
    elements.priorityQuestClose.addEventListener("click", closePriorityQuest);
    elements.priorityQuestOverlay.addEventListener("click", closePriorityQuest);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && elements.priorityQuestPanel.getAttribute("aria-hidden") === "false") {
            closePriorityQuest();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadDashboard({ quiet: true, skipSchedule: true });
            loadSchedule({ quiet: true });
        }
    });

    [
        elements.monthFilter,
        elements.statusFilter,
        elements.committeeFilter,
        elements.personnelFilter,
        elements.searchInput
    ].forEach(control => {
        control.addEventListener("input", applyFilters);
        control.addEventListener("change", applyFilters);
    });

    document.querySelectorAll("th[data-sort]").forEach(header => {
        header.addEventListener("click", () => {
            const key = header.dataset.sort;
            if (state.sortKey === key) {
                state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
            }
            else {
                state.sortKey = key;
                state.sortDirection = "asc";
            }
            renderTable();
        });
    });
}

async function loadDashboard(options = {}) {
    if (state.dashboardLoading) return;

    state.dashboardLoading = true;
    const savedFilters = captureFilterState();

    if (!options.quiet || !state.tasks.length) {
        setStatus("loading", "Loading");
    }
    if (!options.skipSchedule) {
        loadSchedule({ quiet: true });
    }

    try {
        const rows = await loadSheetRows();

        state.tasks = rows.map(mapTask).filter(hasTaskContent);
        state.filtered = [...state.tasks];

        if (!state.tasks.length) {
            throw new Error("The Google Sheet loaded, but no task rows matched the expected columns.");
        }

        populateFilters();
        restoreFilterState(savedFilters);
        applyFilters();
        setStatus("online", "Live");
        updateLastRefresh();
    }
    catch (error) {
        console.error(error);
        setStatus("offline", error.message || "Sheet unavailable");
        elements.taskTableBody.innerHTML = `<tr><td colspan="9" class="empty">${escapeHTML(error.message)}</td></tr>`;
    }
    finally {
        state.dashboardLoading = false;
    }
}

function startDashboardAutoRefresh() {
    if (state.dashboardRefreshTimer) {
        clearInterval(state.dashboardRefreshTimer);
    }

    state.dashboardRefreshTimer = setInterval(() => {
        loadDashboard({ quiet: true, skipSchedule: true });
    }, DASHBOARD_REFRESH_MS);
}

function captureFilterState() {
    if (!elements.monthFilter) return {};
    return {
        month: elements.monthFilter.value,
        status: elements.statusFilter.value,
        committee: elements.committeeFilter.value,
        personnel: elements.personnelFilter.value,
        search: elements.searchInput.value
    };
}

function restoreFilterState(filters) {
    restoreSelectValue(elements.monthFilter, filters.month);
    restoreSelectValue(elements.statusFilter, filters.status);
    restoreSelectValue(elements.committeeFilter, filters.committee);
    restoreSelectValue(elements.personnelFilter, filters.personnel);
    elements.searchInput.value = filters.search || "";
}

function restoreSelectValue(select, value) {
    const exists = Array.from(select.options).some(option => option.value === value);
    select.value = exists ? value : "";
}

function startScheduleAutoRefresh() {
    if (state.scheduleRefreshTimer) {
        clearInterval(state.scheduleRefreshTimer);
    }

    state.scheduleRefreshTimer = setInterval(() => {
        loadSchedule({ quiet: true });
    }, SCHEDULE_REFRESH_MS);
}

async function loadSchedule(options = {}) {
    if (state.scheduleLoading) return;

    state.scheduleLoading = true;

    if (!options.quiet || !state.schedule.length) {
        setScheduleStatus("loading", "Loading");
    }

    try {
        const tables = await Promise.all(SCHEDULE_GVIZ_URLS.map((url, index) =>
            loadGvizTable(url, `schedule_${index}`)
        ));
        state.schedule = deduplicateScheduleEvents(tables.flatMap(parseScheduleTable));
        renderSchedule();
        setScheduleStatus("online", "Live");
        updateScheduleRefresh();
    }
    catch (error) {
        console.error(error);
        setScheduleStatus("offline", "Holidays only");
        if (!state.schedule.length) {
            renderSchedule();
        }
        else {
            updateScheduleRefresh("Last synced");
        }
    }
    finally {
        state.scheduleLoading = false;
    }
}

async function loadSheetRows() {
    try {
        return await loadSheetRowsWithScript(new Error("Script loader primary path."));
    }
    catch (scriptError) {
        console.warn("Script loader failed. Trying fetch loader.", scriptError);
        const csv = await fetchSheetCSV();
        return parseCSV(csv);
    }
}

async function fetchSheetCSV() {
    const urls = [
        `${SHEET_CSV_URL}&cacheBust=${Date.now()}`,
        `${SHEET_CSV_BACKUP_URL}&cacheBust=${Date.now()}`
    ];
    const errors = [];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(`Google returned HTTP ${response.status}`);
            }

            const csv = await response.text();

            if (/^\s*</.test(csv)) {
                throw new Error("Google returned a sign-in or web page instead of CSV.");
            }

            if (!csv.includes("Task ID") && !csv.includes("Subject Request")) {
                throw new Error("Google returned CSV, but it does not look like the monitoring sheet.");
            }

            return csv;
        }
        catch (error) {
            errors.push(error.message);
        }
    }

    throw new Error(`Sheet unavailable: ${errors.join(" | ")}`);
}

function loadSheetRowsWithScript(fetchError) {
    return new Promise((resolve, reject) => {
        loadGvizTable(SHEET_GVIZ_URL, "task")
            .then(table=>resolve(gvizTableToRows(table)))
            .catch(()=>reject(new Error(`Sheet unavailable. Fetch failed (${fetchError.message}) and script loading was blocked.`)));
    });
}

function loadGvizTable(baseUrl, prefix) {
    return new Promise((resolve, reject) => {
        const callbackName = `lrdd${prefix}Callback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement("script");
        const cleanup = () => {
            delete window[callbackName];
            script.remove();
        };

        window[callbackName] = response => {
            cleanup();

            if (!response || response.status !== "ok" || !response.table) {
                reject(new Error("Google Sheet script loader returned no table data."));
                return;
            }

            resolve(response.table);
        };

        script.onerror = () => {
            cleanup();
            reject(new Error("Google Sheet script loading was blocked."));
        };

        script.src = `${baseUrl}&tqx=responseHandler:${callbackName};out:json&cacheBust=${Date.now()}`;
        document.head.appendChild(script);
    });
}

function gvizTableToRows(table) {
    const headers = table.cols.map((col, index) => col.label || `Column ${index + 1}`);

    return (table.rows || []).map(row => {
        const item = {};

        headers.forEach((header, index) => {
            const cell = row.c && row.c[index];
            item[header] = cell
                ? String(cell.f ?? cell.v ?? "").trim()
                : "";
        });

        return item;
    });
}

function parseScheduleTable(table) {
    const rawRows = (table.rows || []).map(row => (row.c || []).map(cell => cell ? String(cell.f ?? cell.v ?? "").trim() : ""));
    const dateColumns = [0, 3, 6, 9, 12, 15, 16];
    const events = [];
    let monthContext = "";
    let activeDates = {};

    rawRows.forEach(row => {
        const monthCell = row[0] || "";
        if (/^[A-Za-z]+\s+\d{4}$/.test(monthCell)) {
            monthContext = monthCell;
            activeDates = {};
            return;
        }

        if (!monthContext) return;

        const dateCells = {};
        let hasDateCell = false;

        dateColumns.forEach(column => {
            const value = row[column] || "";
            if (/^\d{1,2}$/.test(value)) {
                dateCells[column] = buildScheduleDate(monthContext, value);
                hasDateCell = true;
            }
        });

        if (hasDateCell) {
            activeDates = {
                ...activeDates,
                ...dateCells
            };
            return;
        }

        dateColumns.forEach(column => {
            const value = row[column] || "";
            const date = activeDates[column];

            if (!date || !isScheduleEvent(value)) return;

            events.push({
                date,
                title: value,
                time: extractScheduleTime(value),
                type: "schedule"
            });
        });
    });

    return events
        .filter(event=>event.date && event.title)
        .sort((a,b)=>a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}

function deduplicateScheduleEvents(events) {
    const seen = new Set();

    return events.filter(event => {
        const key = `${dateKey(event.date)}|${event.time}|${event.title}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}

function buildScheduleDate(monthContext, day) {
    const match = monthContext.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return null;

    const date = new Date(`${match[1]} ${day}, ${match[2]}`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseLocalDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function getCalendarEvents() {
    return [...state.schedule, ...LOCAL_HOLIDAYS]
        .filter(event => event.date && !Number.isNaN(event.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime() ||
            Number(b.type?.startsWith("holiday")) - Number(a.type?.startsWith("holiday")) ||
            a.title.localeCompare(b.title));
}

function isScheduleEvent(value) {
    if (!value) return false;
    if (/^#N\/A$/i.test(value)) return false;
    if (/^(Frequency|Day|Lead Committee|BSI\/ Stenographer|BS III\/II|Session)$/i.test(value)) return false;
    if (/^\d+(\.\d+)?$/.test(value)) return false;
    return /(?:AM|PM|Session|CH |TWG|Meeting|Committee|Hearing|Forum|Regular)/i.test(value);
}

function extractScheduleTime(value) {
    const match = value.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN)?(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|NN)?)?/i);
    return match ? match[0].replace(/\s+/g, " ").trim() : "Scheduled";
}

function changeScheduleMonth(offset) {
    const current = getScheduleViewDate();
    state.scheduleViewDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    renderSchedule();
}

function showCurrentScheduleMonth() {
    const today = new Date();
    const year = state.scheduleViewDate ? state.scheduleViewDate.getFullYear() : getScheduleYear();
    state.scheduleViewDate = new Date(year, today.getMonth(), 1);
    renderSchedule();
}

function showScheduleMonth(month) {
    state.scheduleViewDate = new Date(getScheduleYear(), month, 1);
    renderSchedule();
}

function getScheduleViewDate() {
    if (state.scheduleViewDate) {
        return new Date(state.scheduleViewDate.getFullYear(), state.scheduleViewDate.getMonth(), 1);
    }

    const today = new Date();
    const firstEvent = getCalendarEvents().find(event => event.date);
    const year = firstEvent ? firstEvent.date.getFullYear() : today.getFullYear();
    state.scheduleViewDate = new Date(year, today.getMonth(), 1);
    return state.scheduleViewDate;
}

function getScheduleYear() {
    if (state.scheduleViewDate) return state.scheduleViewDate.getFullYear();

    const firstEvent = getCalendarEvents().find(event => event.date);
    return firstEvent ? firstEvent.date.getFullYear() : new Date().getFullYear();
}

function renderSchedule() {
    const visibleEvents = getCalendarEvents();
    const anchorDate = getScheduleViewDate();
    const month = anchorDate.getMonth();
    const year = anchorDate.getFullYear();
    const monthEvents = visibleEvents.filter(event => event.date.getFullYear() === year && event.date.getMonth() === month);

    elements.scheduleCount.textContent = `${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"} this month`;
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());
    const todayKey = dateKey(new Date());

    if (elements.scheduleMonthLabel) {
        elements.scheduleMonthLabel.textContent = anchorDate.toLocaleString("en-PH", {
            month: "long",
            year: "numeric"
        });
    }

    renderScheduleMonthTabs();

    const grouped = groupScheduleByDate(visibleEvents);
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const cells = weekdays.map(day => `<div class="calendar-weekday">${day}</div>`);

    for (let index = 0; index < 42; index++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        const key = dateKey(date);
        const events = grouped[key] || [];
        const shown = events.slice(0, 3);
        const outside = date.getMonth() !== month ? " outside" : "";
        const today = key === todayKey ? " today" : "";

        cells.push(`
            <div class="calendar-day${outside}${today}">
                <span class="calendar-day-number">${date.getDate()}</span>
 …2773 tokens truncated…ided")}</p>
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

function renderCharts() {
    renderMonthlyChart();
    renderCommitteeChart();
}

function renderMonthlyChart() {
    const grouped = {};
    state.filtered.forEach(task => {
        const key = monthKey(task.received);
        if (!key) return;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    elements.monthCount.textContent = `${entries.length} month${entries.length === 1 ? "" : "s"}`;
    drawBarChart(elements.monthlyChart, entries.map(([label, value]) => ({
        label,
        value
    })), "#008b8b");
}

function renderCommitteeChart() {
    const grouped = {};
    state.filtered.forEach(task => {
        const key = task.committee || "Unspecified";
        grouped[key] = (grouped[key] || 0) + 1;
    });

    const entries = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    drawHorizontalBarChart(elements.committeeChart, entries.map(([label, value]) => ({
        label,
        value
    })), "#c9961a");
}

function drawHorizontalBarChart(canvas, items, color) {
    const ctx = canvas.getContext("2d");
    const scale = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = Number(canvas.getAttribute("height"));
    const width = canvas.width = cssWidth * scale;
    const height = canvas.height = cssHeight * scale;
    const outerPadding = 18 * scale;
    const valueSpace = 44 * scale;
    const labelWidth = Math.min(300, Math.max(150, cssWidth * 0.43)) * scale;
    const plotLeft = outerPadding + labelWidth;
    const plotWidth = Math.max(40 * scale, width - plotLeft - valueSpace - outerPadding);
    const rowHeight = (height - outerPadding * 2) / Math.max(1, items.length);
    const barHeight = Math.min(22 * scale, rowHeight * 0.42);
    const max = Math.max(1, ...items.map(item => item.value));

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (!items.length) {
        ctx.fillStyle = "#65758b";
        ctx.font = `${14 * scale}px Segoe UI`;
        ctx.fillText("No data for current filters", outerPadding, height / 2);
        return;
    }

    items.forEach((item, index) => {
        const centerY = outerPadding + rowHeight * index + rowHeight / 2;
        const barY = centerY - barHeight / 2;
        const barWidth = Math.max(3 * scale, (item.value / max) * plotWidth);

        ctx.fillStyle = "#f2f5f8";
        ctx.fillRect(plotLeft, barY, plotWidth, barHeight);
        ctx.fillStyle = color;
        ctx.fillRect(plotLeft, barY, barWidth, barHeight);

        ctx.fillStyle = "#142033";
        ctx.font = `700 ${12 * scale}px Segoe UI`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(String(item.value), plotLeft + barWidth + 8 * scale, centerY);

        drawWrappedLabel(
            ctx,
            item.label,
            outerPadding,
            centerY,
            labelWidth - 18 * scale,
            12 * scale,
            3
        );

        if (index < items.length - 1) {
            const lineY = outerPadding + rowHeight * (index + 1);
            ctx.strokeStyle = "#edf1f5";
            ctx.lineWidth = 1 * scale;
            ctx.beginPath();
            ctx.moveTo(outerPadding, lineY);
            ctx.lineTo(width - outerPadding, lineY);
            ctx.stroke();
        }
    });
}

function drawWrappedLabel(ctx, label, x, centerY, maxWidth, fontSize, maxLines) {
    const words = label.split(/\s+/);
    const lines = [];
    let line = "";

    ctx.fillStyle = "#344256";
    ctx.font = `600 ${fontSize}px Segoe UI`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !line) {
            line = candidate;
        } else {
            lines.push(line);
            line = word;
        }
    });
    if (line) lines.push(line);

    if (lines.length > maxLines) {
        const remaining = lines.slice(maxLines - 1).join(" ");
        lines.splice(maxLines - 1, lines.length, remaining);
    }

    const lineHeight = fontSize * 1.25;
    const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((text, index) => {
        ctx.fillText(text, x, startY + index * lineHeight, maxWidth);
    });
}

function drawBarChart(canvas, items, color) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
    const height = canvas.height = Number(canvas.getAttribute("height")) * window.devicePixelRatio;
    const scale = window.devicePixelRatio;
    const padding = 36 * scale;
    const bottom = 58 * scale;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding - bottom;
    const max = Math.max(1, ...items.map(item => item.value));

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#d9e3ec";
    ctx.lineWidth = 1 * scale;

    for (let i = 0; i <= 4; i++) {
        const y = padding + chartHeight - (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    if (!items.length) {
        ctx.fillStyle = "#65758b";
        ctx.font = `${14 * scale}px Segoe UI`;
        ctx.fillText("No data for current filters", padding, height / 2);
        return;
    }

    const gap = 10 * scale;
    const barWidth = Math.max(12 * scale, (chartWidth - gap * (items.length - 1)) / items.length);

    items.forEach((item, index) => {
        const x = padding + index * (barWidth + gap);
        const barHeight = (item.value / max) * chartHeight;
        const y = padding + chartHeight - barHeight;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = "#142033";
        ctx.font = `${12 * scale}px Segoe UI`;
        ctx.textAlign = "center";
        ctx.fillText(String(item.value), x + barWidth / 2, y - 6 * scale);

        ctx.save();
        ctx.translate(x + barWidth / 2, height - 12 * scale);
        ctx.rotate(-Math.PI / 5);
        ctx.fillStyle = "#65758b";
        ctx.font = `${11 * scale}px Segoe UI`;
        ctx.textAlign = "right";
        ctx.fillText(item.label.slice(0, 18), 0, 0);
        ctx.restore();
    });
}

function clearFilters() {
    elements.monthFilter.value = "";
    elements.statusFilter.value = "";
    elements.committeeFilter.value = "";
    elements.personnelFilter.value = "";
    elements.searchInput.value = "";
    applyFilters();
}

function exportFilteredCSV() {
    const headers = ["ID", "Received", "Personnel", "Committee", "Subject", "Task", "Status", "Duration", "Rating", "Remarks"];
    const rows = state.filtered.map(task => [
        task.taskID,
        task.received,
        task.personnel,
        task.committee,
        task.subject,
        task.task,
        isCompleted(task.completed) ? "Completed" : "Pending",
        task.duration,
        task.rating,
        task.remarks
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LRDD Task Monitoring ${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

function isCompleted(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["yes", "true", "completed", "complete", "done", "1"].includes(normalized);
}

function unique(values) {
    return [...new Set(values)];
}

function monthKey(value) {
    const date = parseDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value) {
    const date = parseDate(value);
    return date ? date.getTime() : 0;
}

function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return value || "";
    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-PH");
}

function updateLastRefresh() {
    const generated = new Date();

    const text = generated.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
    elements.lastUpdated.textContent = `Synced ${text}`;
}

function setStatus(type, text) {
    elements.statusBadge.className = `status-badge ${type}`;
    elements.statusBadge.textContent = text;
    if (elements.calendarStatus) {
        elements.calendarStatus.textContent = text;
    }
}

function setScheduleStatus(type, text) {
    if (!elements.scheduleStatus) return;

    elements.scheduleStatus.className = `mini-status ${type}`;
    elements.scheduleStatus.textContent = text;
}

function updateScheduleRefresh(label = "Synced") {
    if (!elements.scheduleUpdated) return;

    elements.scheduleUpdated.textContent = `${label} ${new Date().toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    })}`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.addEventListener("resize", () => {
    if (state.filtered.length) {
        renderCharts();
    }
});

