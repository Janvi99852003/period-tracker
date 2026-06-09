import { useState, useEffect } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "period_tracker_data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { periods: [], symptoms: [], notes: {} };
  } catch {
    return { periods: [], symptoms: [], notes: {} };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function toDateStr(date) {
  // Returns "YYYY-MM-DD" string from a Date object
  return date.toISOString().split("T")[0];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const today = new Date();
  const [data, setData] = useState(loadData);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [markingMode, setMarkingMode] = useState(false); // true = user is selecting a range
  const [rangeStart, setRangeStart] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Persist every time data changes
  useEffect(() => {
    saveData(data);
  }, [data]);

  // ── Derived: which dates are period days ──────────────────────────────────
  const periodDates = new Set();
  data.periods.forEach(({ start, end }) => {
    const s = new Date(start);
    const e = new Date(end || start);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      periodDates.add(toDateStr(new Date(d)));
    }
  });

  // ── Simple next-period prediction ─────────────────────────────────────────
  function getNextPeriodDate() {
    if (data.periods.length < 2) return null;
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i].start) - new Date(sorted[i-1].start)) / (1000 * 60 * 60 * 24);
      gaps.push(diff);
    }
    const avgCycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const last = new Date(sorted[sorted.length - 1].start);
    const next = new Date(last);
    next.setDate(next.getDate() + avgCycle);
    return { date: next, cycleLength: avgCycle };
  }

  const prediction = getNextPeriodDate();

  // Predicted period days (5 days starting from prediction)
  const predictedDates = new Set();
  if (prediction) {
    for (let i = 0; i < 5; i++) {
      const d = new Date(prediction.date);
      d.setDate(d.getDate() + i);
      predictedDates.add(toDateStr(d));
    }
  }

  // ── Calendar navigation ───────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── Date click logic ──────────────────────────────────────────────────────
  function handleDateClick(dateStr) {
    if (markingMode) {
      if (!rangeStart) {
        setRangeStart(dateStr);
      } else {
        // Save period range
        const start = rangeStart < dateStr ? rangeStart : dateStr;
        const end   = rangeStart < dateStr ? dateStr : rangeStart;
        setData(prev => ({
          ...prev,
          periods: [...prev.periods, { start, end, id: Date.now() }]
        }));
        setRangeStart(null);
        setMarkingMode(false);
      }
      return;
    }
    // Normal click: open note modal
    setSelectedDate(dateStr);
    setNoteText(data.notes[dateStr] || "");
    setShowModal(true);
  }

  function saveNote() {
    setData(prev => ({
      ...prev,
      notes: { ...prev.notes, [selectedDate]: noteText }
    }));
    setShowModal(false);
  }

  function removePeriodDay(dateStr) {
    // Remove this date from any period it belongs to
    setData(prev => {
      const updated = prev.periods.filter(p => {
        const s = new Date(p.start);
        const e = new Date(p.end || p.start);
        const d = new Date(dateStr);
        return !(d >= s && d <= e);
      });
      return { ...prev, periods: updated };
    });
    setShowModal(false);
  }

  // ── Build calendar grid ───────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>🌸 Cyra </span>
          <span style={styles.headerSub}>Period Tracker</span>
        </div>
      </header>

      <main style={styles.main}>
        {/* Prediction Banner */}
        {prediction && (
          <div style={styles.predBanner}>
            <span style={styles.predIcon}>🔮</span>
            <div>
              <div style={styles.predTitle}>Next period predicted</div>
              <div style={styles.predSub}>
                Around <strong>{prediction.date.toDateString()}</strong> &nbsp;·&nbsp;
                Average cycle: <strong>{prediction.cycleLength} days</strong>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Card */}
        <div style={styles.card}>
          {/* Month navigation */}
          <div style={styles.calNav}>
            <button style={styles.navBtn} onClick={prevMonth}>‹</button>
            <span style={styles.monthTitle}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button style={styles.navBtn} onClick={nextMonth}>›</button>
          </div>

          {/* Day name headers */}
          <div style={styles.dayGrid}>
            {DAY_NAMES.map(d => (
              <div key={d} style={styles.dayName}>{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div style={styles.dayGrid}>
            {/* Empty cells before month starts */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Actual days */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isPeriod = periodDates.has(dateStr);
              const isPredicted = predictedDates.has(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = rangeStart === dateStr;
              const hasNote = !!data.notes[dateStr];

              let cellBg = "transparent";
              let cellColor = "var(--text)";
              let cellBorder = "1px solid transparent";

              if (isPeriod) { cellBg = "#F4C0D1"; cellColor = "#72243E"; }
              else if (isPredicted) { cellBg = "#FAC775"; cellColor = "#633806"; }
              if (isToday) cellBorder = "2px solid #D4537E";
              if (isSelected) { cellBg = "#D4537E"; cellColor = "#fff"; }

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateClick(dateStr)}
                  style={{
                    ...styles.dayCell,
                    background: cellBg,
                    color: cellColor,
                    border: cellBorder,
                    fontWeight: isToday ? "600" : "400",
                    position: "relative",
                  }}
                  title={dateStr}
                >
                  {day}
                  {hasNote && (
                    <span style={styles.noteDot} title="Has note" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#F4C0D1", border: "1px solid #D4537E" }} />
              Period
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#FAC775" }} />
              Predicted
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, border: "2px solid #D4537E" }} />
              Today
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, background: markingMode && !rangeStart ? "#D4537E" : "#F4C0D1", color: markingMode && !rangeStart ? "#fff" : "#72243E" }}
            onClick={() => { setMarkingMode(true); setRangeStart(null); }}
          >
            {markingMode && !rangeStart ? "📍 Click start date…" : "➕ Log Period"}
          </button>
          {markingMode && rangeStart && (
            <button
              style={{ ...styles.actionBtn, background: "#D4537E", color: "#fff" }}
            >
              📍 Now click end date…
            </button>
          )}
          {markingMode && (
            <button
              style={{ ...styles.actionBtn, background: "#F1EFE8", color: "#444441" }}
              onClick={() => { setMarkingMode(false); setRangeStart(null); }}
            >
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{data.periods.length}</div>
            <div style={styles.statLabel}>Cycles logged</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>
              {prediction ? `${prediction.cycleLength}d` : "—"}
            </div>
            <div style={styles.statLabel}>Avg cycle</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNum}>{periodDates.size}</div>
            <div style={styles.statLabel}>Period days</div>
          </div>
        </div>

        {/* Instructions for Day 1 */}
        <div style={styles.helpBox}>
          <strong>How to use:</strong>
          <ol style={{ margin: "8px 0 0 16px", lineHeight: "1.8" }}>
            <li>Click <em>Log Period</em> → click the <strong>start date</strong> on the calendar</li>
            <li>Then click the <strong>end date</strong> — dates turn pink 🌸</li>
            <li>Click any date to add a personal note</li>
            <li>Add 2+ cycles to see predictions (shown in orange)</li>
          </ol>
        </div>
      </main>

      {/* Note Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>📝 {selectedDate}</h3>

            {periodDates.has(selectedDate) && (
              <button
                style={{ ...styles.actionBtn, background: "#FAECE7", color: "#712B13", marginBottom: 12 }}
                onClick={() => removePeriodDay(selectedDate)}
              >
                🗑 Remove period mark
              </button>
            )}

            <textarea
              style={styles.textarea}
              rows={4}
              placeholder="How are you feeling today? Any symptoms, mood, or notes…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{ ...styles.actionBtn, flex: 1, background: "#D4537E", color: "#fff" }} onClick={saveNote}>
                Save note
              </button>
              <button style={{ ...styles.actionBtn, flex: 1 }} onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  app: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    background: "#FFF5F8",
    color: "#2C2C2A",
  },
  header: {
    background: "#fff",
    borderBottom: "0.5px solid #F4C0D1",
    padding: "14px 20px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: { display: "flex", alignItems: "center", gap: 10 },
  logo: { fontSize: 22, fontWeight: 600 },
  headerSub: { fontSize: 13, color: "#888780" },
  main: { maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px" },
  predBanner: {
    background: "#fff",
    border: "1px solid #FAC775",
    borderRadius: 12,
    padding: "12px 16px",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  predIcon: { fontSize: 22 },
  predTitle: { fontWeight: 600, fontSize: 14, marginBottom: 2 },
  predSub: { fontSize: 13, color: "#5F5E5A" },
  card: {
    background: "#fff",
    borderRadius: 16,
    border: "0.5px solid #F4C0D1",
    padding: "16px",
    marginBottom: 16,
  },
  calNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    background: "none",
    border: "0.5px solid #F4C0D1",
    borderRadius: 8,
    width: 32,
    height: 32,
    fontSize: 18,
    cursor: "pointer",
    color: "#D4537E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontWeight: 600, fontSize: 16 },
  dayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 3,
    marginBottom: 4,
  },
  dayName: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "#888780",
    padding: "4px 0",
    textTransform: "uppercase",
  },
  dayCell: {
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 8,
    aspectRatio: "1",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    minHeight: 36,
  },
  noteDot: {
    position: "absolute",
    bottom: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#D4537E",
  },
  legend: {
    display: "flex",
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTop: "0.5px solid #F4C0D1",
    flexWrap: "wrap",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5F5E5A" },
  legendDot: { width: 14, height: 14, borderRadius: 4, display: "inline-block" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  actionBtn: {
    padding: "9px 16px",
    borderRadius: 10,
    border: "none",
    background: "#F4C0D1",
    color: "#72243E",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  statCard: {
    background: "#fff",
    border: "0.5px solid #F4C0D1",
    borderRadius: 12,
    padding: "12px 10px",
    textAlign: "center",
  },
  statNum: { fontSize: 22, fontWeight: 600, color: "#D4537E" },
  statLabel: { fontSize: 11, color: "#888780", marginTop: 2 },
  helpBox: {
    background: "#FBEAF0",
    border: "0.5px solid #F4C0D1",
    borderRadius: 12,
    padding: "14px 16px",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#4B1528",
  },
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  },
  modalTitle: { margin: "0 0 14px", fontSize: 16 },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #F4C0D1",
    fontFamily: "inherit",
    fontSize: 13,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
    background: "#FFF5F8",
  },
};