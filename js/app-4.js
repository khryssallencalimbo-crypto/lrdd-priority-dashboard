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

