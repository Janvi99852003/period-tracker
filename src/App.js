import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STORAGE_KEY = "cyra_data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { periods: [], notes: {}, moods: {}, flows: {}, symptoms: {} };
  } catch {
    return { periods: [], notes: {}, moods: {}, flows: {}, symptoms: {} };
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

const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😔", label: "Sad" },
  { emoji: "😤", label: "Irritable" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😌", label: "Calm" },
];

const SYMPTOMS_LIST = [
  "Cramps", "Bloating", "Headache", "Fatigue",
  "Nausea", "Back pain", "Tender breasts", "Acne"
];

const FLOW_LEVELS = ["Light", "Medium", "Heavy"];

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
  const [selectedMood, setSelectedMood] = useState(null);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
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

  function getSymptomStats() {
    const counts = {};
    Object.values(data.symptoms || {}).forEach(arr => {
      arr.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  function getMoodStats() {
    const counts = {};
    Object.values(data.moods || {}).forEach(m => {
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }

  // ── Chart data ────────────────────────────────────────────────────────────

  function getCycleLengthData() {
    if (data.periods.length < 2) return [];
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const result = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i].start) - new Date(sorted[i-1].start)) / 86400000);
      const d = new Date(sorted[i].start);
      result.push({
        name: `${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`,
        days: gap,
      });
    }
    return result;
  }

  function getPeriodDurationData() {
    if (data.periods.length === 0) return [];
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    return sorted.map((p, i) => {
      const s = new Date(p.start);
      const e = new Date(p.end || p.start);
      const dur = Math.round((e - s) / 86400000) + 1;
      return {
        name: `${MONTHS[s.getMonth()].slice(0,3)}`,
        days: dur,
      };
    });
  }

  function getFlowData() {
    const counts = { Light: 0, Medium: 0, Heavy: 0 };
    Object.values(data.flows || {}).forEach(f => {
      if (counts[f] !== undefined) counts[f]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  function exportCSV() {
    const rows = [["Date", "Type", "Flow", "Mood", "Symptoms", "Notes"]];

    data.periods.forEach(p => {
      const s = new Date(p.start);
      const e = new Date(p.end || p.start);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(new Date(d));
        rows.push([
          ds,
          "Period",
          data.flows?.[ds] || "",
          data.moods?.[ds] || "",
          (data.symptoms?.[ds] || []).join("; "),
          data.notes?.[ds] || "",
        ]);
      }
    });

    Object.keys(data.moods || {}).forEach(ds => {
      if (!periodDates.has(ds)) {
        rows.push([
          ds,
          "Log",
          "",
          data.moods[ds] || "",
          (data.symptoms?.[ds] || []).join("; "),
          data.notes?.[ds] || "",
        ]);
      }
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cyra_data.csv";
    a.click();
    URL.revokeObjectURL(url);
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
    setNoteText(data.notes?.[dateStr] || "");
    setSelectedMood(data.moods?.[dateStr] || null);
    setSelectedFlow(data.flows?.[dateStr] || null);
    setSelectedSymptoms(data.symptoms?.[dateStr] || []);
    setShowModal(true);
  }

  function toggleSymptom(s) {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function saveLog() {
    setData(prev => ({
      ...prev,
      notes:    { ...prev.notes,    [selectedDate]: noteText },
      moods:    { ...prev.moods,    [selectedDate]: selectedMood },
      flows:    { ...prev.flows,    [selectedDate]: selectedFlow },
      symptoms: { ...prev.symptoms, [selectedDate]: selectedSymptoms },
    }));
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
  const symptomStats = getSymptomStats();
  const moodStats = getMoodStats();
  const totalLogged = Object.keys(data.moods || {}).length + Object.keys(data.symptoms || {}).length;
  const cycleLengthData = getCycleLengthData();
  const periodDurationData = getPeriodDurationData();
  const flowData = getFlowData();

  const customTooltipStyle = {
    background: "#2a0e1a",
    border: "1px solid rgba(236,72,153,0.2)",
    borderRadius: 10,
    color: "#fdf0f5",
    fontSize: 12,
    padding: "6px 12px",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1a0a10; color: #fdf0f5; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 420px; margin: 0 auto; min-height: 100vh; background: #1a0a10; position: relative; overflow-x: hidden; }
        .app::before { content: ''; position: fixed; top: -80px; left: 50%; transform: translateX(-50%); width: 500px; height: 380px; background: radial-gradient(ellipse, rgba(236,72,153,0.18) 0%, transparent 70%); pointer-events: none; z-index: 0; }

        .header { padding: 20px 20px 0; position: relative; z-index: 1; }
        .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 28px; background: linear-gradient(135deg, #fb7185, #ec4899, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .log-btn { background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border: none; border-radius: 20px; padding: 8px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px; }
        .log-btn:hover { opacity: 0.85; }
        .log-btn.active { background: linear-gradient(135deg, #f43f5e, #ec4899); }

        .hero { background: linear-gradient(135deg, rgba(236,72,153,0.18), rgba(244,63,94,0.1)); border: 1px solid rgba(236,72,153,0.25); border-radius: 22px; padding: 22px; margin-bottom: 16px; position: relative; overflow: hidden; }
        .hero::after { content: '🌸'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-size: 52px; opacity: 0.18; }
        .hero-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #fb7185; margin-bottom: 6px; }
        .hero-number { font-family: 'DM Serif Display', serif; font-size: 56px; line-height: 1; background: linear-gradient(135deg, #fb7185, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
        .hero-sub { font-size: 13px; color: rgba(253,240,245,0.5); }
        .hero-empty { font-size: 14px; color: rgba(253,240,245,0.45); line-height: 1.6; }

        .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .stat { background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.12); border-radius: 16px; padding: 14px 10px; text-align: center; }
        .stat-num { font-family: 'DM Serif Display', serif; font-size: 26px; color: #fb7185; line-height: 1; margin-bottom: 4px; }
        .stat-label { font-size: 10px; color: rgba(253,240,245,0.4); text-transform: uppercase; letter-spacing: 0.06em; }

        .cal-card { background: rgba(236,72,153,0.05); border: 1px solid rgba(236,72,153,0.12); border-radius: 22px; padding: 18px; margin-bottom: 18px; }
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-nav-btn { width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(236,72,153,0.2); background: rgba(236,72,153,0.08); color: #fb7185; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cal-nav-btn:hover { background: rgba(236,72,153,0.2); border-color: rgba(236,72,153,0.4); }
        .cal-month { font-size: 15px; font-weight: 500; color: #fdf0f5; }
        .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .day-name { text-align: center; font-size: 10px; font-weight: 600; color: rgba(253,240,245,0.3); padding: 4px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .day-cell { aspect-ratio: 1; border-radius: 10px; border: 1px solid transparent; background: transparent; color: rgba(253,240,245,0.65); font-size: 12px; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; min-height: 36px; flex-direction: column; gap: 1px; }
        .day-cell:hover { background: rgba(236,72,153,0.15); color: #fdf0f5; }
        .day-cell.is-period { background: linear-gradient(135deg, rgba(236,72,153,0.4), rgba(244,63,94,0.25)); color: #fda4af; border-color: rgba(236,72,153,0.35); }
        .day-cell.is-predicted { background: rgba(251,191,36,0.1); color: #fcd34d; border: 1px dashed rgba(251,191,36,0.35); }
        .day-cell.is-ovulation { background: rgba(52,211,153,0.1); color: #6ee7b7; border-color: rgba(52,211,153,0.25); }
        .day-cell.is-today { border-color: #ec4899 !important; color: #fb7185 !important; font-weight: 600; }
        .day-cell.is-range-start { background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border-color: transparent; }
        .day-mood { font-size: 8px; line-height: 1; }
        .note-dot { position: absolute; bottom: 3px; right: 3px; width: 4px; height: 4px; border-radius: 50%; background: #fb7185; }
        .legend { display: flex; gap: 14px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(236,72,153,0.1); margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(253,240,245,0.4); }
        .legend-dot { width: 10px; height: 10px; border-radius: 3px; }

        .mode-banner { background: linear-gradient(135deg, rgba(236,72,153,0.18), rgba(244,63,94,0.12)); border: 1px solid rgba(236,72,153,0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fda4af; }
        .cancel-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px 12px; color: rgba(253,240,245,0.55); font-size: 12px; cursor: pointer; font-family: inherit; }

        .tab-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 420px; background: rgba(26,10,16,0.96); backdrop-filter: blur(20px); border-top: 1px solid rgba(236,72,153,0.12); display: flex; z-index: 10; }
        .tab { flex: 1; padding: 10px 0 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; font-family: inherit; color: rgba(253,240,245,0.3); font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.2s; }
        .tab.active { color: #ec4899; }
        .tab-icon { font-size: 18px; line-height: 1; }

        .tab-content { padding: 0 0 100px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(253,240,245,0.3); margin-bottom: 12px; margin-top: 8px; }
        .insight-card { background: rgba(236,72,153,0.05); border: 1px solid rgba(236,72,153,0.1); border-radius: 18px; padding: 16px; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 14px; }
        .insight-icon { font-size: 22px; flex-shrink: 0; width: 44px; height: 44px; background: rgba(236,72,153,0.12); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .insight-title { font-size: 14px; font-weight: 500; color: #fdf0f5; margin-bottom: 3px; }
        .insight-sub { font-size: 12px; color: rgba(253,240,245,0.45); line-height: 1.5; }

        .symptom-row { margin-bottom: 10px; }
        .symptom-row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .symptom-name { font-size: 13px; color: #fdf0f5; }
        .symptom-count { font-size: 12px; color: rgba(253,240,245,0.4); }
        .symptom-bar-bg { background: rgba(236,72,153,0.1); border-radius: 4px; height: 6px; width: 100%; }
        .symptom-bar-fill { background: linear-gradient(90deg, #ec4899, #fb7185); border-radius: 4px; height: 6px; transition: width 0.5s ease; }

        .mood-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .mood-chip { background: rgba(236,72,153,0.07); border: 1px solid rgba(236,72,153,0.12); border-radius: 20px; padding: 6px 12px; font-size: 13px; color: rgba(253,240,245,0.7); display: flex; align-items: center; gap: 6px; }

        /* Chart card */
        .chart-card { background: rgba(236,72,153,0.05); border: 1px solid rgba(236,72,153,0.12); border-radius: 18px; padding: 16px; margin-bottom: 16px; }
        .chart-title { font-size: 13px; font-weight: 500; color: #fdf0f5; margin-bottom: 4px; }
        .chart-sub { font-size: 11px; color: rgba(253,240,245,0.35); margin-bottom: 14px; }

        /* Export button */
        .export-btn { width: 100%; background: rgba(236,72,153,0.08); border: 1px solid rgba(236,72,153,0.2); border-radius: 14px; padding: 14px; color: #fb7185; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; transition: all 0.2s; }
        .export-btn:hover { background: rgba(236,72,153,0.15); }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; z-index: 100; }
        .modal { background: #2a0e1a; border: 1px solid rgba(236,72,153,0.15); border-radius: 26px 26px 0 0; padding: 20px 20px 44px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
        .modal-handle { width: 36px; height: 4px; background: rgba(236,72,153,0.25); border-radius: 2px; margin: 0 auto 16px; }
        .modal-date { font-family: 'DM Serif Display', serif; font-size: 20px; color: #fb7185; margin-bottom: 16px; }
        .modal-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(253,240,245,0.35); margin-bottom: 8px; }
        .mood-picker { display: flex; gap: 8px; margin-bottom: 16px; }
        .mood-btn { flex: 1; background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.12); border-radius: 12px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .mood-btn.selected { background: rgba(236,72,153,0.2); border-color: #ec4899; }
        .mood-emoji { font-size: 20px; }
        .mood-label { font-size: 9px; color: rgba(253,240,245,0.45); text-transform: uppercase; letter-spacing: 0.05em; }
        .flow-picker { display: flex; gap: 8px; margin-bottom: 16px; }
        .flow-btn { flex: 1; background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.12); border-radius: 12px; padding: 9px 4px; font-size: 13px; color: rgba(253,240,245,0.6); cursor: pointer; font-family: inherit; transition: all 0.15s; text-align: center; }
        .flow-btn.selected { background: rgba(236,72,153,0.2); border-color: #ec4899; color: #fda4af; font-weight: 500; }
        .symptom-picker { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }
        .symptom-btn { background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.12); border-radius: 20px; padding: 6px 12px; font-size: 12px; color: rgba(253,240,245,0.6); cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .symptom-btn.selected { background: rgba(236,72,153,0.22); border-color: #ec4899; color: #fda4af; }
        .modal-textarea { width: 100%; background: rgba(236,72,153,0.06); border: 1px solid rgba(236,72,153,0.15); border-radius: 14px; padding: 12px 14px; color: #fdf0f5; font-family: inherit; font-size: 14px; resize: none; outline: none; line-height: 1.6; margin-bottom: 12px; }
        .modal-textarea:focus { border-color: rgba(236,72,153,0.45); }
        .modal-textarea::placeholder { color: rgba(253,240,245,0.22); }
        .modal-actions { display: flex; gap: 10px; }
        .btn-primary { flex: 1; background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border: none; border-radius: 14px; padding: 13px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
        .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 14px; padding: 13px 18px; color: rgba(253,240,245,0.5); font-size: 14px; cursor: pointer; font-family: inherit; }
        .btn-danger { width: 100%; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2); border-radius: 12px; padding: 11px; color: #fda4af; font-size: 13px; cursor: pointer; font-family: inherit; margin-bottom: 12px; }
        .divider { border: none; border-top: 1px solid rgba(236,72,153,0.1); margin: 12px 0; }
        .main-content { padding: 0 16px 100px; position: relative; z-index: 1; }
        .empty-state { text-align: center; padding: 40px 20px; color: rgba(253,240,245,0.35); font-size: 14px; line-height: 1.8; }
        .empty-icon { font-size: 36px; margin-bottom: 12px; }
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

          {/* ── CALENDAR TAB ── */}
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
                    <div className="hero-empty">Log two or more cycles to unlock predictions and insights.</div>
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
                  <div className="stat-num">{totalLogged}</div>
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
                    const mood = data.moods?.[ds];
                    return (
                      <button key={ds} className={cls} onClick={() => handleDateClick(ds)}>
                        {day}
                        {mood && <span className="day-mood">{MOODS.find(m => m.label === mood)?.emoji}</span>}
                        {data.notes?.[ds] && <span className="note-dot" />}
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(236,72,153,0.55)" }} />Period</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(251,191,36,0.35)", border: "1px dashed rgba(251,191,36,0.5)" }} />Predicted</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: "rgba(52,211,153,0.35)" }} />Fertile</div>
                </div>
              </div>
            </>
          )}

          {/* ── SYMPTOMS TAB ── */}
          {activeTab === "symptoms" && (
            <div className="tab-content">
              <div className="section-title">Mood history</div>
              {moodStats.length > 0 ? (
                <div className="mood-row">
                  {moodStats.map(([mood, count]) => {
                    const m = MOODS.find(x => x.label === mood);
                    return (
                      <div key={mood} className="mood-chip">
                        {m?.emoji} {mood} <span style={{ color: "#fb7185", fontWeight: 600 }}>×{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">😊</div>
                  No moods logged yet.<br />Tap any date on the calendar to log how you feel.
                </div>
              )}
              <div className="section-title" style={{ marginTop: 20 }}>Most common symptoms</div>
              {symptomStats.length > 0 ? (
                symptomStats.map(([symptom, count]) => (
                  <div key={symptom} className="symptom-row">
                    <div className="symptom-row-top">
                      <span className="symptom-name">{symptom}</span>
                      <span className="symptom-count">{count} {count === 1 ? "time" : "times"}</span>
                    </div>
                    <div className="symptom-bar-bg">
                      <div className="symptom-bar-fill" style={{ width: `${Math.min(100, (count / symptomStats[0][1]) * 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💊</div>
                  No symptoms logged yet.<br />Tap any date on the calendar to track symptoms.
                </div>
              )}
            </div>
          )}

          {/* ── CHARTS TAB ── */}
          {activeTab === "charts" && (
            <div className="tab-content">

              <button className="export-btn" onClick={exportCSV}>
                📤 Export my data as CSV
              </button>

              {cycleLengthData.length > 0 ? (
                <div className="chart-card">
                  <div className="chart-title">Cycle length over time</div>
                  <div className="chart-sub">How many days between each period</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cycleLengthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(236,72,153,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`${v} days`, "Cycle length"]} />
                      <Line type="monotone" dataKey="days" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: "#ec4899", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="chart-card">
                  <div className="chart-title">Cycle length over time</div>
                  <div className="empty-state" style={{ padding: "20px 0" }}>
                    <div className="empty-icon">📊</div>
                    Log at least 2 periods to see your cycle chart.
                  </div>
                </div>
              )}

              {periodDurationData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-title">Period duration</div>
                  <div className="chart-sub">How many days each period lasted</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={periodDurationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(236,72,153,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`${v} days`, "Duration"]} />
                      <Bar dataKey="days" fill="#ec4899" radius={[6, 6, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {flowData.some(f => f.value > 0) && (
                <div className="chart-card">
                  <div className="chart-title">Flow intensity</div>
                  <div className="chart-sub">Distribution of your logged flow levels</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={flowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(236,72,153,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(253,240,245,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`${v} days`, "Days logged"]} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} opacity={0.85}>
                        {flowData.map((entry, index) => (
                          <rect key={index} fill={index === 0 ? "#fda4af" : index === 1 ? "#ec4899" : "#be185d"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {cycleLengthData.length === 0 && periodDurationData.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📈</div>
                  Start logging periods and symptoms to see your health charts here.
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS TAB ── */}
          {activeTab === "insights" && (
            <div className="tab-content">
              <div className="section-title">Your cycle insights</div>
              {prediction ? (
                <>
                  <div className="insight-card">
                    <div className="insight-icon">🌸</div>
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
                  {symptomStats.length > 0 && (
                    <div className="insight-card">
                      <div className="insight-icon">💊</div>
                      <div>
                        <div className="insight-title">Most common symptom</div>
                        <div className="insight-sub">{symptomStats[0][0]} — reported {symptomStats[0][1]} {symptomStats[0][1] === 1 ? "time" : "times"}</div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🌸</div>
                  Log at least 2 periods to unlock predictions, fertile window, and personal insights.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab bar - now 4 tabs */}
        <div className="tab-bar">
          <button className={`tab ${activeTab === "calendar" ? "active" : ""}`} onClick={() => setActiveTab("calendar")}>
            <span className="tab-icon">🗓</span>Calendar
          </button>
          <button className={`tab ${activeTab === "symptoms" ? "active" : ""}`} onClick={() => setActiveTab("symptoms")}>
            <span className="tab-icon">🌡</span>Symptoms
          </button>
          <button className={`tab ${activeTab === "charts" ? "active" : ""}`} onClick={() => setActiveTab("charts")}>
            <span className="tab-icon">📊</span>Charts
          </button>
          <button className={`tab ${activeTab === "insights" ? "active" : ""}`} onClick={() => setActiveTab("insights")}>
            <span className="tab-icon">🌸</span>Insights
          </button>
        </div>

        {/* DAILY LOG MODAL */}
        {showModal && (
          <div className="overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-date">{selectedDate}</div>
              {periodDates.has(selectedDate) && (
                <button className="btn-danger" onClick={() => removePeriod(selectedDate)}>Remove period mark</button>
              )}
              <div className="modal-section-label">How are you feeling?</div>
              <div className="mood-picker">
                {MOODS.map(m => (
                  <button key={m.label} className={`mood-btn ${selectedMood === m.label ? "selected" : ""}`} onClick={() => setSelectedMood(selectedMood === m.label ? null : m.label)}>
                    <span className="mood-emoji">{m.emoji}</span>
                    <span className="mood-label">{m.label}</span>
                  </button>
                ))}
              </div>
              {periodDates.has(selectedDate) && (
                <>
                  <div className="modal-section-label">Flow intensity</div>
                  <div className="flow-picker">
                    {FLOW_LEVELS.map(f => (
                      <button key={f} className={`flow-btn ${selectedFlow === f ? "selected" : ""}`} onClick={() => setSelectedFlow(selectedFlow === f ? null : f)}>{f}</button>
                    ))}
                  </div>
                </>
              )}
              <div className="modal-section-label">Symptoms</div>
              <div className="symptom-picker">
                {SYMPTOMS_LIST.map(s => (
                  <button key={s} className={`symptom-btn ${selectedSymptoms.includes(s) ? "selected" : ""}`} onClick={() => toggleSymptom(s)}>{s}</button>
                ))}
              </div>
              <hr className="divider" />
              <div className="modal-section-label">Notes</div>
              <textarea className="modal-textarea" rows={3} placeholder="Anything else to note…" value={noteText} onChange={e => setNoteText(e.target.value)} />
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveLog}>Save</button>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}