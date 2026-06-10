import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STORAGE_KEY = "cyra_data";
const PIN_KEY = "cyra_pin";
const THEME_KEY = "cyra_theme";

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

function calculateHealthScore(data, prediction) {
  let score = 0;

  const today = new Date();
  let loggedDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (data.moods?.[ds] || (data.symptoms?.[ds] || []).length > 0 || data.notes?.[ds]) {
      loggedDays++;
    }
  }
  score += Math.round((loggedDays / 14) * 30);

  if (data.periods.length >= 2) {
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
    }
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, g) => sum + Math.abs(g - avg), 0) / gaps.length;
    const regularityScore = Math.max(0, 25 - Math.round(variance * 3.5));
    score += regularityScore;
  }

  const recentMoods = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const mood = data.moods?.[toDateStr(d)];
    if (mood) recentMoods.push(mood);
  }
  if (recentMoods.length > 0) {
    const positive = recentMoods.filter(m => m === "Happy" || m === "Calm").length;
    const ratio = positive / recentMoods.length;
    score += Math.round(ratio * 25);
  } else {
    score += 12;
  }

  const recentSymptomDays = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const s = data.symptoms?.[toDateStr(d)] || [];
    recentSymptomDays.push(s.length);
  }
  const avgSymptoms = recentSymptomDays.reduce((a, b) => a + b, 0) / 14;
  score += Math.max(5, 20 - Math.round(avgSymptoms * 3));

  return Math.min(100, Math.max(0, score));
}

function getScoreColor(score) {
  if (score >= 75) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

function getScoreLabel(score) {
  if (score >= 75) return "Great";
  if (score >= 50) return "Good";
  if (score >= 25) return "Fair";
  return "Low";
}

function getScoreTip(score, data) {
  if (score >= 75) return "You're tracking consistently. Keep it up!";
  const today = new Date();
  const recentLogs = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (data.moods?.[toDateStr(d)]) recentLogs.push(true);
  }
  if (recentLogs.length < 3) return "Log your mood daily to improve your score.";
  if (data.periods.length < 2) return "Log more cycles to improve regularity tracking.";
  return "Consistent logging improves your health score over time.";
}

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

  const [pinLocked, setPinLocked] = useState(() => !!localStorage.getItem(PIN_KEY));
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showSetPin, setShowSetPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState(1);

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === null ? true : saved === "dark";
  });

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); }, [isDark]);

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
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
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

  const healthScore = calculateHealthScore(data, prediction);
  const scoreColor = getScoreColor(healthScore);
  const scoreLabel = getScoreLabel(healthScore);
  const scoreTip = getScoreTip(healthScore, data);

  function getReminders() {
    const reminders = [];

    if (prediction) {
      const daysUntil = Math.ceil((prediction.date - today) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 3) {
        reminders.push({
          icon: "🌸",
          text: daysUntil === 0 ? "Your period may start today" : `Period expected in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
          color: "#fb7185",
        });
      }
      const fertileStart = new Date(prediction.date);
      fertileStart.setDate(fertileStart.getDate() - 16);
      const fertileEnd = new Date(prediction.date);
      fertileEnd.setDate(fertileEnd.getDate() - 12);
      if (today >= fertileStart && today <= fertileEnd) {
        reminders.push({
          icon: "🌿",
          text: "You're in your fertile window",
          color: "#34d399",
        });
      }
    }

    let lastLogDaysAgo = null;
    for (let i = 0; i <= 10; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      if (data.moods?.[ds] || (data.symptoms?.[ds] || []).length > 0) {
        lastLogDaysAgo = i;
        break;
      }
    }
    if (lastLogDaysAgo === null || lastLogDaysAgo >= 3) {
      reminders.push({
        icon: "📝",
        text: "You haven't logged in 3+ days",
        color: "#fbbf24",
      });
    }

    return reminders;
  }

  const reminders = getReminders();

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

  function getCycleLengthData() {
    if (data.periods.length < 2) return [];
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const result = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
      const d = new Date(sorted[i].start);
      result.push({ name: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`, days: gap });
    }
    return result;
  }

  function getPeriodDurationData() {
    if (data.periods.length === 0) return [];
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    return sorted.map(p => {
      const s = new Date(p.start);
      const e = new Date(p.end || p.start);
      const dur = Math.round((e - s) / 86400000) + 1;
      return { name: `${MONTHS[s.getMonth()].slice(0, 3)}`, days: dur };
    });
  }

  function getFlowData() {
    const counts = { Light: 0, Medium: 0, Heavy: 0 };
    Object.values(data.flows || {}).forEach(f => {
      if (counts[f] !== undefined) counts[f]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }

  function exportCSV() {
    const rows = [["Date", "Type", "Flow", "Mood", "Symptoms", "Notes"]];
    data.periods.forEach(p => {
      const s = new Date(p.start);
      const e = new Date(p.end || p.start);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(new Date(d));
        rows.push([ds, "Period", data.flows?.[ds] || "", data.moods?.[ds] || "",
          (data.symptoms?.[ds] || []).join("; "), data.notes?.[ds] || ""]);
      }
    });
    Object.keys(data.moods || {}).forEach(ds => {
      if (!periodDates.has(ds)) {
        rows.push([ds, "Log", "", data.moods[ds] || "",
          (data.symptoms?.[ds] || []).join("; "), data.notes?.[ds] || ""]);
      }
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cyra_data.csv"; a.click();
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
      const end = rangeStart < dateStr ? dateStr : rangeStart;
      setData(prev => ({ ...prev, periods: [...prev.periods, { start, end, id: Date.now() }] }));
      setRangeStart(null); setMarkingMode(false);
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
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function saveLog() {
    setData(prev => ({
      ...prev,
      notes: { ...prev.notes, [selectedDate]: noteText },
      moods: { ...prev.moods, [selectedDate]: selectedMood },
      flows: { ...prev.flows, [selectedDate]: selectedFlow },
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

  function handlePinInput(digit) {
    if (pinInput.length >= 4) return;
    const val = pinInput + digit;
    setPinInput(val);
    if (val.length === 4) {
      const stored = localStorage.getItem(PIN_KEY);
      if (val === stored) {
        setPinLocked(false);
        setPinInput("");
        setPinError("");
      } else {
        setPinError("Incorrect PIN. Try again.");
        setTimeout(() => { setPinInput(""); setPinError(""); }, 1000);
      }
    }
  }

  function handleSetPin() {
    if (pinStep === 1) {
      if (newPin.length !== 4) { setPinError("PIN must be 4 digits"); return; }
      setPinStep(2);
      setPinError("");
    } else {
      if (confirmPin !== newPin) {
        setPinError("PINs don't match. Try again.");
        setConfirmPin(""); setPinStep(1); setNewPin("");
        return;
      }
      localStorage.setItem(PIN_KEY, newPin);
      setShowSetPin(false); setNewPin(""); setConfirmPin("");
      setPinStep(1); setPinError("");
    }
  }

  function removePin() {
    localStorage.removeItem(PIN_KEY);
    setPinLocked(false);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  // ── FIX: single todayStr declaration (was duplicated, causing no-unused-vars error) ──
  const todayStr = toDateStr(today);
  const daysUntil = prediction ? Math.ceil((prediction.date - today) / 86400000) : null;
  const symptomStats = getSymptomStats();
  const moodStats = getMoodStats();
  const totalLogged = Object.keys(data.moods || {}).length + Object.keys(data.symptoms || {}).length;
  const cycleLengthData = getCycleLengthData();
  const periodDurationData = getPeriodDurationData();
  const flowData = getFlowData();

  const T = isDark ? {
    bg: "#1a0a10", surface: "rgba(236,72,153,0.05)", border: "rgba(236,72,153,0.12)",
    text: "#fdf0f5", textMuted: "rgba(253,240,245,0.45)", textFaint: "rgba(253,240,245,0.3)",
    accent: "#ec4899", accentLight: "#fb7185", modal: "#2a0e1a",
    tabBg: "rgba(26,10,16,0.96)", glow: "rgba(236,72,153,0.18)",
    tooltipBg: "#2a0e1a",
  } : {
    bg: "#fff0f5", surface: "rgba(236,72,153,0.06)", border: "rgba(236,72,153,0.18)",
    text: "#3b0a1f", textMuted: "rgba(59,10,31,0.55)", textFaint: "rgba(59,10,31,0.35)",
    accent: "#ec4899", accentLight: "#be185d", modal: "#fff0f5",
    tabBg: "rgba(255,240,245,0.97)", glow: "rgba(236,72,153,0.10)",
    tooltipBg: "#fff0f5",
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  if (pinLocked) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #1a0a10; color: #fdf0f5; font-family: 'DM Sans', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1a0a10", padding: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, background: "linear-gradient(135deg,#fb7185,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>Cyra</div>
          <div style={{ fontSize: 13, color: "rgba(253,240,245,0.4)", marginBottom: 40 }}>Enter your PIN to continue</div>
          <div style={{ display: "flex", gap: 14, marginBottom: 32 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: i < pinInput.length ? "#ec4899" : "rgba(236,72,153,0.2)", border: "2px solid rgba(236,72,153,0.35)", transition: "background 0.2s" }} />
            ))}
          </div>
          {pinError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{pinError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12 }}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
              <button key={i} onClick={() => {
                if (d === "⌫") setPinInput(p => p.slice(0, -1));
                else if (d !== "") handlePinInput(String(d));
              }} style={{ width: 72, height: 72, borderRadius: 18, background: d === "" ? "transparent" : "rgba(236,72,153,0.08)", border: d === "" ? "none" : "1px solid rgba(236,72,153,0.15)", color: "#fdf0f5", fontSize: d === "⌫" ? 20 : 22, fontFamily: "'DM Sans', sans-serif", cursor: d === "" ? "default" : "pointer", fontWeight: 500, transition: "all 0.15s" }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.bg}; color: ${T.text}; font-family: 'DM Sans', sans-serif; min-height: 100vh; transition: background 0.3s, color 0.3s; }
        .app { max-width: 420px; margin: 0 auto; min-height: 100vh; background: ${T.bg}; position: relative; overflow-x: hidden; }
        .app::before { content: ''; position: fixed; top: -80px; left: 50%; transform: translateX(-50%); width: 500px; height: 380px; background: radial-gradient(ellipse, ${T.glow} 0%, transparent 70%); pointer-events: none; z-index: 0; }

        .header { padding: 20px 20px 0; position: relative; z-index: 1; }
        .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 8px; }
        .logo { font-family: 'DM Serif Display', serif; font-size: 28px; background: linear-gradient(135deg, #fb7185, #ec4899, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .header-actions { display: flex; align-items: center; gap: 8px; }
        .icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid ${T.border}; background: ${T.surface}; color: ${T.text}; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .icon-btn:hover { background: rgba(236,72,153,0.15); }
        .log-btn { background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border: none; border-radius: 20px; padding: 8px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity 0.2s; display: flex; align-items: center; gap: 6px; }
        .log-btn:hover { opacity: 0.85; }
        .log-btn.active { background: linear-gradient(135deg, #f43f5e, #ec4899); }

        .reminder-banner { margin-bottom: 10px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 11px 14px; display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .reminder-icon { font-size: 16px; flex-shrink: 0; }

        .hero { background: linear-gradient(135deg, rgba(236,72,153,0.18), rgba(244,63,94,0.1)); border: 1px solid rgba(236,72,153,0.25); border-radius: 22px; padding: 22px; margin-bottom: 16px; position: relative; overflow: hidden; }
        .hero::after { content: '🌸'; position: absolute; right: 18px; top: 50%; transform: translateY(-50%); font-size: 52px; opacity: 0.18; }
        .hero-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #fb7185; margin-bottom: 6px; }
        .hero-number { font-family: 'DM Serif Display', serif; font-size: 56px; line-height: 1; background: linear-gradient(135deg, #fb7185, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
        .hero-sub { font-size: 13px; color: ${T.textMuted}; }
        .hero-empty { font-size: 14px; color: ${T.textMuted}; line-height: 1.6; }

        .score-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 22px; padding: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 20px; }
        .score-ring-wrap { position: relative; width: 96px; height: 96px; flex-shrink: 0; }
        .score-number { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
        .score-num { font-family: 'DM Serif Display', serif; font-size: 26px; line-height: 1; }
        .score-max { font-size: 10px; color: ${T.textFaint}; }
        .score-right { flex: 1; }
        .score-label { font-size: 18px; font-weight: 600; color: ${T.text}; margin-bottom: 4px; }
        .score-tip { font-size: 12px; color: ${T.textMuted}; line-height: 1.5; }
        .score-breakdown { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
        .score-tag { background: rgba(236,72,153,0.08); border: 1px solid rgba(236,72,153,0.12); border-radius: 20px; padding: 3px 10px; font-size: 11px; color: ${T.textMuted}; }

        .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 16px; padding: 14px 10px; text-align: center; }
        .stat-num { font-family: 'DM Serif Display', serif; font-size: 26px; color: #fb7185; line-height: 1; margin-bottom: 4px; }
        .stat-label { font-size: 10px; color: ${T.textFaint}; text-transform: uppercase; letter-spacing: 0.06em; }

        .cal-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 22px; padding: 18px; margin-bottom: 18px; }
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .cal-nav-btn { width: 34px; height: 34px; border-radius: 50%; border: 1px solid ${T.border}; background: ${T.surface}; color: #fb7185; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cal-nav-btn:hover { background: rgba(236,72,153,0.2); }
        .cal-month { font-size: 15px; font-weight: 500; color: ${T.text}; }
        .day-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .day-name { text-align: center; font-size: 10px; font-weight: 600; color: ${T.textFaint}; padding: 4px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .day-cell { aspect-ratio: 1; border-radius: 10px; border: 1px solid transparent; background: transparent; color: ${T.textMuted}; font-size: 12px; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; position: relative; min-height: 36px; flex-direction: column; gap: 1px; }
        .day-cell:hover { background: rgba(236,72,153,0.15); color: ${T.text}; }
        .day-cell.is-period { background: linear-gradient(135deg, rgba(236,72,153,0.4), rgba(244,63,94,0.25)); color: #fda4af; border-color: rgba(236,72,153,0.35); }
        .day-cell.is-predicted { background: rgba(251,191,36,0.1); color: #fcd34d; border: 1px dashed rgba(251,191,36,0.35); }
        .day-cell.is-ovulation { background: rgba(52,211,153,0.1); color: #6ee7b7; border-color: rgba(52,211,153,0.25); }
        .day-cell.is-today { border-color: #ec4899 !important; color: #fb7185 !important; font-weight: 600; }
        .day-cell.is-range-start { background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border-color: transparent; }
        .day-mood { font-size: 8px; line-height: 1; }
        .note-dot { position: absolute; bottom: 3px; right: 3px; width: 4px; height: 4px; border-radius: 50%; background: #fb7185; }
        .legend { display: flex; gap: 14px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid ${T.border}; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: ${T.textFaint}; }
        .legend-dot { width: 10px; height: 10px; border-radius: 3px; }

        .mode-banner { background: linear-gradient(135deg, rgba(236,72,153,0.18), rgba(244,63,94,0.12)); border: 1px solid rgba(236,72,153,0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #fda4af; }
        .cancel-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px 12px; color: ${T.textMuted}; font-size: 12px; cursor: pointer; font-family: inherit; }

        .tab-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 420px; background: ${T.tabBg}; backdrop-filter: blur(20px); border-top: 1px solid ${T.border}; display: flex; z-index: 10; }
        .tab { flex: 1; padding: 10px 0 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; font-family: inherit; color: ${T.textFaint}; font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; transition: color 0.2s; }
        .tab.active { color: #ec4899; }
        .tab-icon { font-size: 18px; line-height: 1; }

        .tab-content { padding: 0 0 100px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: ${T.textFaint}; margin-bottom: 12px; margin-top: 8px; }
        .insight-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 18px; padding: 16px; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 14px; }
        .insight-icon { font-size: 22px; flex-shrink: 0; width: 44px; height: 44px; background: rgba(236,72,153,0.12); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .insight-title { font-size: 14px; font-weight: 500; color: ${T.text}; margin-bottom: 3px; }
        .insight-sub { font-size: 12px; color: ${T.textMuted}; line-height: 1.5; }

        .symptom-row { margin-bottom: 10px; }
        .symptom-row-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
        .symptom-name { font-size: 13px; color: ${T.text}; }
        .symptom-count { font-size: 12px; color: ${T.textMuted}; }
        .symptom-bar-bg { background: rgba(236,72,153,0.1); border-radius: 4px; height: 6px; width: 100%; }
        .symptom-bar-fill { background: linear-gradient(90deg, #ec4899, #fb7185); border-radius: 4px; height: 6px; transition: width 0.5s ease; }

        .mood-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .mood-chip { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 20px; padding: 6px 12px; font-size: 13px; color: ${T.textMuted}; display: flex; align-items: center; gap: 6px; }

        .chart-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 18px; padding: 16px; margin-bottom: 16px; }
        .chart-title { font-size: 13px; font-weight: 500; color: ${T.text}; margin-bottom: 4px; }
        .chart-sub { font-size: 11px; color: ${T.textFaint}; margin-bottom: 14px; }

        .export-btn { width: 100%; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 14px; color: #fb7185; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; transition: all 0.2s; }
        .export-btn:hover { background: rgba(236,72,153,0.15); }

        .settings-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 18px; padding: 16px; margin-bottom: 12px; }
        .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid ${T.border}; }
        .settings-row:last-child { border-bottom: none; padding-bottom: 0; }
        .settings-label { font-size: 14px; color: ${T.text}; }
        .settings-sub { font-size: 12px; color: ${T.textMuted}; margin-top: 2px; }
        .settings-btn { background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.2); border-radius: 10px; padding: 6px 14px; color: #fb7185; font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .settings-btn:hover { background: rgba(236,72,153,0.2); }
        .settings-btn.danger { background: rgba(244,63,94,0.08); border-color: rgba(244,63,94,0.2); color: #f87171; }
        .toggle { position: relative; width: 44px; height: 24px; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; inset: 0; background: rgba(236,72,153,0.2); border-radius: 24px; cursor: pointer; transition: 0.3s; }
        .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
        input:checked + .toggle-slider { background: #ec4899; }
        input:checked + .toggle-slider::before { transform: translateX(20px); }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .pin-modal { background: ${T.modal}; border: 1px solid ${T.border}; border-radius: 26px; padding: 28px 24px; width: 100%; max-width: 340px; text-align: center; }
        .pin-modal-title { font-family: 'DM Serif Display', serif; font-size: 22px; color: ${T.text}; margin-bottom: 6px; }
        .pin-modal-sub { font-size: 13px; color: ${T.textMuted}; margin-bottom: 24px; }
        .pin-input { width: 100%; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 13px 16px; color: ${T.text}; font-family: inherit; font-size: 18px; text-align: center; letter-spacing: 8px; outline: none; margin-bottom: 12px; }
        .pin-input:focus { border-color: #ec4899; }
        .pin-error { color: #f87171; font-size: 13px; margin-bottom: 12px; min-height: 20px; }
        .pin-actions { display: flex; gap: 10px; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); display: flex; align-items: flex-end; justify-content: center; z-index: 100; }
        .modal { background: ${T.modal}; border: 1px solid ${T.border}; border-radius: 26px 26px 0 0; padding: 20px 20px 44px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
        .modal-handle { width: 36px; height: 4px; background: rgba(236,72,153,0.25); border-radius: 2px; margin: 0 auto 16px; }
        .modal-date { font-family: 'DM Serif Display', serif; font-size: 20px; color: #fb7185; margin-bottom: 16px; }
        .modal-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${T.textFaint}; margin-bottom: 8px; }
        .mood-picker { display: flex; gap: 8px; margin-bottom: 16px; }
        .mood-btn { flex: 1; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .mood-btn.selected { background: rgba(236,72,153,0.2); border-color: #ec4899; }
        .mood-emoji { font-size: 20px; }
        .mood-label { font-size: 9px; color: ${T.textFaint}; text-transform: uppercase; letter-spacing: 0.05em; }
        .flow-picker { display: flex; gap: 8px; margin-bottom: 16px; }
        .flow-btn { flex: 1; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 9px 4px; font-size: 13px; color: ${T.textMuted}; cursor: pointer; font-family: inherit; transition: all 0.15s; text-align: center; }
        .flow-btn.selected { background: rgba(236,72,153,0.2); border-color: #ec4899; color: #fda4af; font-weight: 500; }
        .symptom-picker { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }
        .symptom-btn { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 20px; padding: 6px 12px; font-size: 12px; color: ${T.textMuted}; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .symptom-btn.selected { background: rgba(236,72,153,0.22); border-color: #ec4899; color: #fda4af; }
        .modal-textarea { width: 100%; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 12px 14px; color: ${T.text}; font-family: inherit; font-size: 14px; resize: none; outline: none; line-height: 1.6; margin-bottom: 12px; }
        .modal-textarea:focus { border-color: rgba(236,72,153,0.45); }
        .modal-textarea::placeholder { color: ${T.textFaint}; }
        .modal-actions { display: flex; gap: 10px; }
        .btn-primary { flex: 1; background: linear-gradient(135deg, #ec4899, #be185d); color: #fff; border: none; border-radius: 14px; padding: 13px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
        .btn-secondary { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px; padding: 13px 18px; color: ${T.textMuted}; font-size: 14px; cursor: pointer; font-family: inherit; }
        .btn-danger { width: 100%; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.2); border-radius: 12px; padding: 11px; color: #fda4af; font-size: 13px; cursor: pointer; font-family: inherit; margin-bottom: 12px; }
        .divider { border: none; border-top: 1px solid ${T.border}; margin: 12px 0; }
        .main-content { padding: 0 16px 100px; position: relative; z-index: 1; }
        .empty-state { text-align: center; padding: 40px 20px; color: ${T.textMuted}; font-size: 14px; line-height: 1.8; }
        .empty-icon { font-size: 36px; margin-bottom: 12px; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-top">
            <span className="logo">Cyra</span>
            <div className="header-actions">
              <button className="icon-btn" onClick={() => setIsDark(d => !d)} title="Toggle theme">
                {isDark ? "☀️" : "🌙"}
              </button>
              <button className="icon-btn" onClick={() => {
                if (localStorage.getItem(PIN_KEY)) setPinLocked(true);
                else setShowSetPin(true);
              }} title="PIN lock">
                🔒
              </button>
              <button className={`log-btn ${markingMode ? "active" : ""}`} onClick={() => { setMarkingMode(true); setRangeStart(null); }}>
                <span>+</span>
                {markingMode && !rangeStart ? "Pick start…" : "Log period"}
              </button>
            </div>
          </div>
        </div>

        <div className="main-content">
          {markingMode && (
            <div className="mode-banner">
              <span>{!rangeStart ? "Tap the day your period started" : "Now tap the day it ended"}</span>
              <button className="cancel-btn" onClick={() => { setMarkingMode(false); setRangeStart(null); }}>Cancel</button>
            </div>
          )}

          {reminders.map((r, i) => (
            <div key={i} className="reminder-banner" style={{ borderColor: `${r.color}33` }}>
              <span className="reminder-icon">{r.icon}</span>
              <span style={{ fontSize: 13, color: r.color }}>{r.text}</span>
            </div>
          ))}

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

              <div className="score-card">
                <div className="score-ring-wrap">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(236,72,153,0.1)" strokeWidth="8" />
                    <circle cx="48" cy="48" r="40" fill="none" stroke={scoreColor} strokeWidth="8"
                      strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round" transform="rotate(-90 48 48)"
                      style={{ transition: "stroke-dashoffset 1s ease" }} />
                  </svg>
                  <div className="score-number">
                    <div className="score-num" style={{ color: scoreColor }}>{healthScore}</div>
                    <div className="score-max">/100</div>
                  </div>
                </div>
                <div className="score-right">
                  <div className="score-label">Health Score: <span style={{ color: scoreColor }}>{scoreLabel}</span></div>
                  <div className="score-tip">{scoreTip}</div>
                  <div className="score-breakdown">
                    <span className="score-tag">Logging</span>
                    <span className="score-tag">Regularity</span>
                    <span className="score-tag">Mood</span>
                    <span className="score-tag">Symptoms</span>
                  </div>
                </div>
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
                    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

          {activeTab === "charts" && (
            <div className="tab-content">
              <button className="export-btn" onClick={exportCSV}>📤 Export my data as CSV</button>
              {cycleLengthData.length > 0 ? (
                <div className="chart-card">
                  <div className="chart-title">Cycle length over time</div>
                  <div className="chart-sub">How many days between each period</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cycleLengthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}`} />
                      <XAxis dataKey="name" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: T.tooltipBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12, padding: "6px 12px" }} formatter={(v) => [`${v} days`, "Cycle length"]} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}`} />
                      <XAxis dataKey="name" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: T.tooltipBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12, padding: "6px 12px" }} formatter={(v) => [`${v} days`, "Duration"]} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}`} />
                      <XAxis dataKey="name" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: T.tooltipBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12, padding: "6px 12px" }} formatter={(v) => [`${v} days`, "Days logged"]} />
                      <Bar dataKey="value" fill="#ec4899" radius={[6, 6, 0, 0]} opacity={0.85} />
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
                    <div className="insight-icon">💯</div>
                    <div>
                      <div className="insight-title">Health Score: <span style={{ color: scoreColor }}>{healthScore}/100 — {scoreLabel}</span></div>
                      <div className="insight-sub">{scoreTip}</div>
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

          {activeTab === "settings" && (
            <div className="tab-content">
              <div className="section-title">Appearance</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">{isDark ? "Dark mode" : "Light mode"}</div>
                    <div className="settings-sub">Switch app theme</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={isDark} onChange={() => setIsDark(d => !d)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="section-title">Privacy</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">PIN Lock</div>
                    <div className="settings-sub">{localStorage.getItem(PIN_KEY) ? "PIN is set — app is protected" : "No PIN set — tap to add one"}</div>
                  </div>
                  <button className="settings-btn" onClick={() => setShowSetPin(true)}>
                    {localStorage.getItem(PIN_KEY) ? "Change PIN" : "Set PIN"}
                  </button>
                </div>
                {localStorage.getItem(PIN_KEY) && (
                  <div className="settings-row">
                    <div>
                      <div className="settings-label">Remove PIN</div>
                      <div className="settings-sub">Disable lock screen</div>
                    </div>
                    <button className="settings-btn danger" onClick={removePin}>Remove</button>
                  </div>
                )}
              </div>

              <div className="section-title">Data</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Export data</div>
                    <div className="settings-sub">Download all your cycle data as CSV</div>
                  </div>
                  <button className="settings-btn" onClick={exportCSV}>Export</button>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Clear all data</div>
                    <div className="settings-sub">Permanently delete all logged data</div>
                  </div>
                  <button className="settings-btn danger" onClick={() => {
                    if (window.confirm("Delete all Cyra data? This cannot be undone.")) {
                      localStorage.removeItem(STORAGE_KEY);
                      setData({ periods: [], notes: {}, moods: {}, flows: {}, symptoms: {} });
                    }
                  }}>Clear</button>
                </div>
              </div>

              <div className="section-title">About</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Cyra</div>
                    <div className="settings-sub">Your cycle, your way · v1.0</div>
                  </div>
                  <span style={{ fontSize: 20 }}>🌸</span>
                </div>
              </div>
            </div>
          )}
        </div>

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
          <button className={`tab ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
            <span className="tab-icon">⚙️</span>Settings
          </button>
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
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

        {showSetPin && (
          <div className="overlay" onClick={() => { setShowSetPin(false); setNewPin(""); setConfirmPin(""); setPinStep(1); setPinError(""); }}>
            <div className="pin-modal" onClick={e => e.stopPropagation()}>
              <div className="pin-modal-title">{pinStep === 1 ? "Set a PIN" : "Confirm PIN"}</div>
              <div className="pin-modal-sub">{pinStep === 1 ? "Choose a 4-digit PIN to protect Cyra" : "Enter the same PIN again to confirm"}</div>
              <input
                className="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pinStep === 1 ? newPin : confirmPin}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                  pinStep === 1 ? setNewPin(val) : setConfirmPin(val);
                }}
              />
              <div className="pin-error">{pinError}</div>
              <div className="pin-actions">
                <button className="btn-primary" onClick={handleSetPin}>
                  {pinStep === 1 ? "Next" : "Save PIN"}
                </button>
                <button className="btn-secondary" onClick={() => { setShowSetPin(false); setNewPin(""); setConfirmPin(""); setPinStep(1); setPinError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}