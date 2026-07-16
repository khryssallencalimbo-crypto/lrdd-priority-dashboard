"use strict";

const SCHEDULE_GVIZ_URLS = [];
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
    const tasks = window.LRDD_LOCAL_DATA && window.LRDD_LOCAL_DATA.tasks;
    if (!Array.isArray(tasks) || !tasks.length) {
        throw new Error("The sanitized public demonstration data is unavailable.");
    }
    return tasks;
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


