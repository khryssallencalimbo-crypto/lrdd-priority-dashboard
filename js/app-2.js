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
                <div class="calendar-events">
                    ${shown.map(event => `
                        <div class="calendar-event ${escapeHTML(event.type || "schedule")}" tabindex="0">
                            <span class="calendar-event-label">${escapeHTML(compactScheduleTitle(event.title))}</span>
                            <div class="calendar-event-popover">
                                <strong>${escapeHTML(event.time)}</strong>
                                <p>${escapeHTML(event.title)}</p>
                            </div>
                        </div>
                    `).join("")}
                    ${events.length > shown.length ? `
                        <div class="calendar-more" tabindex="0">
                            +${events.length - shown.length} more
                            <div class="calendar-more-popover">
                                <strong>${date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</strong>
                                ${events.slice(shown.length).map(event => `
                                    <div class="calendar-popover-event">
                                        <span>${escapeHTML(event.time)}</span>
                                        <p>${escapeHTML(event.title)}</p>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                </div>
            </div>
        `);
    }

    elements.scheduleList.innerHTML = cells.join("");
}

function renderScheduleMonthTabs() {
    if (!elements.scheduleMonthTabs) return;

    const active = getScheduleViewDate();
    const eventCounts = getCalendarEvents().reduce((counts, event) => {
        if (event.date.getFullYear() !== active.getFullYear()) return counts;

        counts[event.date.getMonth()] = (counts[event.date.getMonth()] || 0) + 1;
        return counts;
    }, {});

    elements.scheduleMonthTabs.innerHTML = Array.from({ length: 12 }, (_, month) => {
        const label = new Date(active.getFullYear(), month, 1).toLocaleString("en-PH", { month: "short" });
        const activeClass = month === active.getMonth() ? " active" : "";
        const count = eventCounts[month] || 0;

        return `
            <button type="button" class="calendar-month-tab${activeClass}" data-month="${month}">
                <span>${label}</span>
                <small>${count}</small>
            </button>
        `;
    }).join("");

    elements.scheduleMonthTabs.querySelectorAll("[data-month]").forEach(button => {
        button.addEventListener("click", () => showScheduleMonth(Number(button.dataset.month)));
    });
}

function groupScheduleByDate(events) {
    return events.reduce((groups,event)=>{
        const key = dateKey(event.date);
        groups[key] = groups[key] || [];
        groups[key].push(event);
        return groups;
    },{});
}

function dateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth()+1).padStart(2,"0"),
        String(date.getDate()).padStart(2,"0")
    ].join("-");
}

function compactScheduleTitle(title) {
    return title.replace(/\s+/g," ").trim();
}

function parseCSV(csv) {
    const records = [];
    let record = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < csv.length; index++) {
        const char = csv[index];
        const next = csv[index + 1];

        if (char === "\"" && quoted && next === "\"") {
            value += "\"";
            index++;
        }
        else if (char === "\"") {
            quoted = !quoted;
        }
        else if (char === "," && !quoted) {
            record.push(value);
            value = "";
        }
        else if ((char === "\n" || char === "\r") && !quoted) {
            if (char === "\r" && next === "\n") {
                index++;
            }
            record.push(value);
            records.push(record);
            record = [];
            value = "";
        }
        else {
            value += char;
        }
    }

    if (value || record.length) {
        record.push(value);
        records.push(record);
    }

    const headers = (records.shift() || []).map(header => header.trim());
    return records.map(values => {
        const row = {};
        headers.forEach((header, index) => {
            if (header) {
                row[header] = (values[index] || "").trim();
            }
        });
        return row;
    });
}


