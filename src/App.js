import { useState, useEffect } from "react";

const STORAGE_KEY = "cyra_data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { periods: [], notes: {} };
  } catch {
    return { periods: [], notes: {} };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function App() {
  const today = new Date();
  const [data, setData] = useState(loadData);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [markingMode, setMarkingMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [activeTab, setActiveTab] = useState("calendar");

  useEffect(() => { saveData(data); }, [data]);

  const periodDates = new Set();
  data.periods.forEach(({ start, end }) => {
    const s = new Date(start);
    const e = new Date(end || start);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      periodDates.add(toDateStr(new Date(d)));
    }
  });

  function getPrediction() {
    if (data.periods.length < 2) return null;
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i-1].start)) / 86400000);
    }
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const last = new Date(sorted[sorted.length - 1].start);
    const next = new Date(last);
    next.setDate(next.getDate() + avg);
    return { date: next, cycleLength: avg };
  }

  const prediction = getPrediction();

  const predictedDates = new Set();
  if (prediction) {
    for (let i = 0; i < 5; i++) {
      const d = new Date(prediction.date);
      d.setDate(d.getDate() + i);
      predictedDates.add(toDateStr(d));
    }
  }

  const ovulationDates = new Set();
  if (prediction) {
    for (let i = -2; i <= 2; i++) {
      const d = new Date(prediction.date);
      d.setDate(d.getDate() - 14 + i);
      ovulationDates.add(toDateStr(d));
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDateClick(dateStr) {
    if (markingMode) {
      if (!rangeStart) { setRangeStart(dateStr); return; }
      const start = rangeStart < dateStr ? rangeStart : dateStr;
      const end   = rangeStart < dateStr ? dateStr : rangeStart;
      setData(prev => ({ ...prev, periods: [...prev.periods, { start, end, id: Date.now() }] }));
      setRangeStart(null);
      setMarkingMode(false);
      return;
    }
    setSelectedDate(dateStr);
    setNoteText(data.notes[dateStr] || "");
    setShowModal(true);
  }

  function saveNote() {
    setData(prev => ({ ...prev, notes: { ...prev.notes, [selectedDate]: noteText } }));
    setShowModal(false);
  }

  function removePeriod(dateStr) {
    setData(prev => ({
      ...prev,
      periods: prev.periods.filter(p => {
        const s = new Date(p.start), e = new Date(p.end || p.start), d = new Date(dateStr);
        return !(d >= s && d <= e);
      })
    }));
    setShowModal(false);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);
  const daysUntil = prediction ? Math.ceil((prediction.date - today) / 86400000) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0a14; color: #f0eaf8; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 420px; margin: 0 auto; min-height: 100vh; background: #0f0a14; position: relative; overflow-x: hidden; }
        .app::before { content: ''; position: fixed; top: -100px; left: 50%; transform: translateX(-50%); width: 500px; height: 400px; background: radial-gradient(ellipse, rgba(180,100,255,0.15) 0%, transparent 70%); pointer-events: none; z-index: 0; }
        .header { padding: 20px 20px 0; position: relative; z-index: 1; }
        .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 26px; background: linear-gradient(135deg, #e879f9, #a855f7, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .log-btn { background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff; border: none; border-radius: 20px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px; }
        .log-btn:hover { opacity: 0.85; }
        .log-btn.active { background: linear-gradient(135deg, #ec4899, #a855f7); }
        .hero { background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1)); border: 1px solid rgba(168,85,247,0.2); border-radius: 20px; padding: 20px; margin-bottom: 20px; position: relative; overflow: hidden; }
        .hero::after { content: '🌙'; position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 48px; opacity: 0.15; }
        .hero-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em; color: #a855f7; margin-bottom: 6px; }
        .hero-number { font-family: 'DM Serif Display', serif; font-size: 52px; line-height: 1; background: linear-gradient(135deg, #e879f9, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
        .hero-sub { font-size: 13px; color: rgba(240,234,248,0.5); }
        .hero-empty { font-size: 14px; color: rgba(240,234,248,0.5); line-height: 1.6; }
        .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 10px; text-align: center; }
        .stat-num { font-family: 'DM Serif Display', serif; font-size: 24px; color: #e879f9; line-height: 1; margin-bottom: 4px; }
        .stat-label { font-size: 10px; color: rgba(240,234,248,0.4); text-transform: uppercase; letter-spacing: 0.05em; }
        .cal-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 16px; margin-bottom: 20px; }
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-nav-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: rgba(240,234,248,0.7); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cal-nav-btn:hover { background: rgba(168,85,247,0.2); border-color: rgba(168,85,247,0.4); }
        .cal-month { font-size: 15px; font-weight: 500; color: #f0eaf8; }
        .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .day-name { text-align: center; font-size: 10px; font-weight: 600; color: rgba(240,234,248,0.3); padding: 4px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .day-cell { aspect-ratio: 1; border-radius: 10px; border: 1px solid transparent; background: transparent; color: rgba(240,234,248,0.7); font-size: 12px; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; min-height: 36px; }
        .day-cell:hover { background: rgba(168,85,247,0.15); color: #f0eaf8; }
        .day-cell.is-period { background: linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.2)); color: #f9a8d4; border-color: rgba(236,72,153,0.3); }
        .day-cell.is-predicted { background: rgba(251,191,36,0.1); color: #fcd34d; border-color: rgba(251,191,36,0.2); border-style: dashed; }
        .day-cell.is-ovulation { background: rgba(52,211,153,0.1); color: #6ee7b7; border-color: rgba(52,211,153,0.2); }
        .day-cell.is-today { border-color: #a855f7 !important; color: #e879f9 !important; font-weight: 600; }
        .day-cell.is-range-start { background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff; border-color: transparent; }
        .note-dot { position: absolute; bottom: 4px; right: 4px; width: 4px; height: 4px; border-radius: 50%; background: #a855f7; }
        .legend { display: flex; gap: 12px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(240,234,248,0.4); }
        .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
        .mode-banner { background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.15)); border: 1px solid rgba(168,85,247,0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #d8b4fe; }
        .cancel-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px 10px; color: rgba(240,234,248,0.6); font-size: 12px; cursor: pointer; font-family: inherit; }
        .tab-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 420px; background: rgba(15,10,20,0.95); backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.07); display: flex; z-index: 10; }
        .tab { flex: 1; padding: 12px 0 16px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; font-family: inherit; color: rgba(240,234,248,0.35); font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.2s; }
        .tab.active { color: #a855f7; }
        .tab-icon { font-size: 20px; line-height: 1; }
        .insights { padding: 0 0 100px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(240,234,248,0.35); margin-bottom: 12px; }
        .insight-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 14px; }
        .insight-icon { font-size: 24px; flex-shrink: 0; width: 44px; height: 44px; background: rgba(168,85,247,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .insight-title { font-size: 14px; font-weight: 500; color: #f0eaf8; margin-bottom: 3px; }
        .insight-sub { font-size: 12px; color: rgba(240,234,248,0.45); line-height: 1.5; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; z-index: 100; }
        .modal { background: #1a1025; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px 24px 0 0; padding: 24px 20px 40px; width: 100%; max-width: 420px; }
        .modal-handle { width: 36px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; margin: 0 auto 20px; }
        .modal-date { font-family: 'DM Serif Display', serif; font-size: 20px; color: #e879f9; margin-bottom: 16px; }
        .modal-textarea { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 12px 14px; color: #f0eaf8; font-family: inherit; font-size: 14px; resize: none; outline: none; line-height: 1.6; margin-bottom: 12px; }
        .modal-textarea:focus { border-color: rgba(168,85,247,0.5); }
        .modal-textarea::placeholder { color: rgba(240,234,248,0.25); }
        .modal-actions { display: flex; gap: 10px; }
        .btn-primary { flex: 1; background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff; border: none; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; color: rgba(240,234,248,0.6); font-size: 14px; cursor: pointer; font-family: inherit; }
        .btn-danger { width: 100%; background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.2); border-radius: 12px; padding: 11px; color: #f9a8d4; font-size: 13px; cursor: pointer; font-family: inherit; margin-bottom: 10px; }
        .main-content { padding: 0 16px 100px; position: relative; z-index: 1; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-top">
            <span className="logo">Cyra</span>
            <button className={`log-btn ${markingMode ? "active" : ""}`} onClick={() => { setMarkingMode(true); setRangeStart(null); }}>
              <span>+</span>
              {markingMode && !rangeStart ? "Pick start…" : "Log period"}
            </button>
          </div>
        </div>

        <div className="main-content">
          {markingMode && (
            <div className="mode-banner">
              <span>{!rangeStart ? "Tap the day your period started" : "Now tap the day it ended"}</span>
              <button className="cancel-btn" onClick={() => { setMarkingMode(false); setRangeStart(null); }}>Cancel</button>
            </div>
          )}

          {activeTab === "calendar" && (
            <>
              <div className="hero">
                {prediction && daysUntil !== null ? (
                  <>
                    <div className="hero-label">Next period in</div>
                    <div className="hero-number">{daysUntil > 0 ? daysUntil : "Today"}</div>
                    <div className="hero-sub">{daysUntil > 0 ? `days · ${prediction.date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : "Your period may start today"}</div>
                  </>
                ) : (
                  <>
                    <div className="hero-label">Welcome to Cyra</div>
                    <div className="hero-empty">Log two or more cycles to see your predictions and insights.</div>
                  </>
                )}
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="stat-num">{data.periods.length}</div>
                  <div className="stat-label">Cycles</div>
                </div>
                <div className="stat">
                  <div className="stat-num">{prediction ? prediction.cycleLength : "—"}</div>
                  <div className="stat-label">Avg days</div>
                </div>
                <div className="stat">
                  <div className="stat-num">{periodDates.size}</div>
                  <div className="stat-label">Logged</div>
                </div>
              </div>

              <div className="cal-card">
                <div className="cal-nav">
                  <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
                  <span className="cal-month">{MONTHS[viewMonth]} {viewYear}</span>
                  <button className="cal-nav-btn" onClick={nextMonth}>›</button>
                </div>
                <div className="day-grid">
                  {DAYS.map(d => <div key={d} className="day-name">{d}</div>)}
                </div>
                <div className="day-grid">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const ds = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    let cls = "day-cell";
                    if (periodDates.has(ds)) cls += " is-period";
                    else if (predictedDates.has(ds)) cls += " is-predicted";
                    else if (ovulationDates.has(ds)) cls += " is-ovulation";
                    if (ds === todayStr) cls += " is-today";
                    if (rangeStart === ds) cls += " is-range-start";
                    return (
                      <button key={ds} className={cls} onClick={() => handleDateClick(ds)}>
                        {day}
                        {data.notes[ds] && <span className="note-dot" />}
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(236,72,153,0.5)" }} />Period</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(251,191,36,0.3)", border: "1px dashed rgba(251,191,36,0.5)" }} />Predicted</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(52,211,153,0.3)" }} />Fertile</div>
                </div>
              </div>
            </>
          )}

          {activeTab === "insights" && (
            <div className="insights">
              <div className="section-title" style={{ marginTop: 8 }}>Your cycle insights</div>
              {prediction ? (
                <>
                  <div className="insight-card">
                    <div className="insight-icon">🌙</div>
                    <div>
                      <div className="insight-title">Next period</div>
                      <div className="insight-sub">Expected around {prediction.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-icon">🌿</div>
                    <div>
                      <div className="insight-title">Fertile window</div>
                      <div className="insight-sub">
                        Around {(() => { const d = new Date(prediction.date); d.setDate(d.getDate() - 16); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); })()} — {(() => { const d = new Date(prediction.date); d.setDate(d.getDate() - 12); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); })()}
                      </div>
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-icon">📊</div>
                    <div>
                      <div className="insight-title">Average cycle length</div>
                      <div className="insight-sub">{prediction.cycleLength} days based on {data.periods.length} logged cycles</div>
                    </div>
                  </div>
                  <div className="insight-card">
                    <div className="insight-icon">💧</div>
                    <div>
                      <div className="insight-title">Total period days</div>
                      <div className="insight-sub">{periodDates.size} days logged across all cycles</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="insight-card">
                  <div className="insight-icon">✨</div>
                  <div>
                    <div className="insight-title">Log more cycles</div>
                    <div className="insight-sub">Add at least 2 periods to unlock predictions, fertile window, and personal insights.</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tab-bar">
          <button className={`tab ${activeTab === "calendar" ? "active" : ""}`} onClick={() => setActiveTab("calendar")}>
            <span className="tab-icon">🗓</span>Calendar
          </button>
          <button className={`tab ${activeTab === "insights" ? "active" : ""}`} onClick={() => setActiveTab("insights")}>
            <span className="tab-icon">✨</span>Insights
          </button>
        </div>

        {showModal && (
          <div className="overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-date">{selectedDate}</div>
              {periodDates.has(selectedDate) && (
                <button className="btn-danger" onClick={() => removePeriod(selectedDate)}>Remove period mark</button>
              )}
              <textarea className="modal-textarea" rows={4} placeholder="How are you feeling? Any symptoms or notes…" value={noteText} onChange={e => setNoteText(e.target.value)} />
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveNote}>Save note</button>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}