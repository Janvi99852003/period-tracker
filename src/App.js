import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabase";
import emailjs from "@emailjs/browser";

const THEME_KEY = "cyra_theme";

const EMAILJS_SERVICE_ID = "service_lav9x6f";
const EMAILJS_TEMPLATE_ID = "template_6h1yzki";
const EMAILJS_PUBLIC_KEY = "tGIwLpEP3JPSuHwbM";

function toDateStr(date) { return date.toISOString().split("T")[0]; }
function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MOODS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😔", label: "Sad" },
  { emoji: "😤", label: "Irritable" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😌", label: "Calm" },
];
const SYMPTOMS_LIST = ["Cramps","Bloating","Headache","Fatigue","Nausea","Back pain","Tender breasts","Acne"];
const FLOW_LEVELS = ["Light","Medium","Heavy"];
const EMPTY_DATA = { periods: [], notes: {}, moods: {}, flows: {}, symptoms: {} };

function calculateHealthScore(data) {
  // ✅ Return null for brand new users with absolutely no data yet
  const hasAnyData = data.periods.length > 0
    || Object.keys(data.moods || {}).length > 0
    || Object.keys(data.symptoms || {}).length > 0
    || Object.keys(data.notes || {}).length > 0;
  if (!hasAnyData) return null;

  let score = 0;
  const today = new Date();
  let loggedDays = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    if (data.moods?.[ds] || (data.symptoms?.[ds] || []).length > 0 || data.notes?.[ds]) loggedDays++;
  }
  score += Math.round((loggedDays / 14) * 30);
  if (data.periods.length >= 2) {
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++)
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, g) => sum + Math.abs(g - avg), 0) / gaps.length;
    score += Math.max(0, 25 - Math.round(variance * 3.5));
  }
  const recentMoods = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const mood = data.moods?.[toDateStr(d)];
    if (mood) recentMoods.push(mood);
  }
  if (recentMoods.length > 0) {
    const positive = recentMoods.filter(m => m === "Happy" || m === "Calm").length;
    score += Math.round((positive / recentMoods.length) * 25);
  } else { score += 12; }
  const recentSymptomDays = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    recentSymptomDays.push((data.symptoms?.[toDateStr(d)] || []).length);
  }
  const avgSymptoms = recentSymptomDays.reduce((a, b) => a + b, 0) / 14;
  score += Math.max(5, 20 - Math.round(avgSymptoms * 3));
  return Math.min(100, Math.max(0, score));
}
function getScoreColor(s) { return s === null ? "#ec4899" : s >= 75 ? "#34d399" : s >= 50 ? "#fbbf24" : "#f87171"; }
function getScoreLabel(s) { return s === null ? "New" : s >= 75 ? "Great" : s >= 50 ? "Good" : s >= 25 ? "Fair" : "Low"; }
function getScoreTip(score, data) {
  if (score === null) return "Start logging your cycle, mood, or symptoms to get your health score.";
  if (score >= 75) return "You're tracking consistently. Keep it up!";
  const today = new Date();
  let recentLogs = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (data.moods?.[toDateStr(d)]) recentLogs++;
  }
  if (recentLogs < 3) return "Log your mood daily to improve your score.";
  if (data.periods.length < 2) return "Log more cycles to improve regularity tracking.";
  return "Consistent logging improves your health score over time.";
}

function detectPatterns(data) {
  const patterns = [];
  if (data.periods.length < 2) return patterns;
  const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (sorted.length >= 3) {
    const gaps = [];
    for (let i = 1; i < sorted.length; i++)
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
    const firstHalf = gaps.slice(0, Math.floor(gaps.length / 2));
    const secondHalf = gaps.slice(Math.ceil(gaps.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    if (Math.abs(diff) >= 2)
      patterns.push({ icon: diff < 0 ? "📉" : "📈", title: `Your cycle is getting ${diff < 0 ? "shorter" : "longer"}`, detail: `Average shifted by ${Math.abs(diff).toFixed(1)} days over your last ${sorted.length} cycles.`, type: "trend" });
  }
  const symptomOnDay = {};
  sorted.forEach(period => {
    const start = new Date(period.start);
    const end = new Date(period.end || period.start);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(new Date(d));
      const dayN = Math.round((new Date(ds) - start) / 86400000) + 1;
      (data.symptoms?.[ds] || []).forEach(s => {
        if (!symptomOnDay[s]) symptomOnDay[s] = {};
        symptomOnDay[s][dayN] = (symptomOnDay[s][dayN] || 0) + 1;
      });
    }
  });
  Object.entries(symptomOnDay).forEach(([symptom, dayCounts]) => {
    const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
    if (topDay && topDay[1] >= 2 && topDay[1] / sorted.length >= 0.5)
      patterns.push({ icon: "🔁", title: `${symptom} often on Day ${topDay[0]}`, detail: `You logged ${symptom} on Day ${topDay[0]} in ${topDay[1]} out of ${sorted.length} cycles.`, type: "symptom" });
  });
  const prePeriodMoods = {};
  sorted.forEach(period => {
    const start = new Date(period.start);
    for (let i = 1; i <= 3; i++) {
      const d = new Date(start); d.setDate(d.getDate() - i);
      const mood = data.moods?.[toDateStr(d)];
      if (mood) prePeriodMoods[mood] = (prePeriodMoods[mood] || 0) + 1;
    }
  });
  const topPreMood = Object.entries(prePeriodMoods).sort((a, b) => b[1] - a[1])[0];
  if (topPreMood && topPreMood[1] >= 2) {
    const moodObj = MOODS.find(m => m.label === topPreMood[0]);
    patterns.push({ icon: moodObj?.emoji || "😶", title: `You tend to feel ${topPreMood[0]} before your period`, detail: `Logged ${topPreMood[0]} before your period ${topPreMood[1]} times.`, type: "mood" });
  }
  const durations = sorted.map(p => Math.round((new Date(p.end || p.start) - new Date(p.start)) / 86400000) + 1);
  if (durations.length >= 2) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (durations.every(d => Math.abs(d - avg) <= 1) && avg >= 3)
      patterns.push({ icon: "⏱️", title: "Very consistent period duration", detail: `Your periods consistently last around ${Math.round(avg)} days.`, type: "duration" });
  }
  return patterns;
}

// ── Auth Screen ───────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot | otp
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function resetState() { setError(""); setMessage(""); setOtp(""); setOtpSent(false); setGeneratedOtp(""); setOtpExpiry(null); }

  async function handleLogin() {
    setError(""); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onAuth(data.user);
  }

  async function handleSignup() {
    setError(""); setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user && data.session) { onAuth(data.user); return; }
    setMessage("Account created! Check your email to confirm, then sign in.");
    setMode("login");
  }

  async function handleForgotPassword() {
    setError(""); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMessage("Password reset link sent! Check your inbox.");
    setMode("login");
  }

  async function handleSendOtp() {
    if (!email) { setError("Enter your email first."); return; }
    setError(""); setLoading(true);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = Date.now() + 10 * 60 * 1000;

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: email, email: email, otp_code: code, passcode: code },
        { publicKey: EMAILJS_PUBLIC_KEY }
      );
      setGeneratedOtp(code);
      setOtpExpiry(expiry);
      setOtpSent(true);
      setMessage(`A 6-digit code was sent to ${email}`);
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(""); setLoading(true);

    if (!otpExpiry || Date.now() > otpExpiry) {
      setLoading(false);
      setError("Code expired. Please request a new one.");
      return;
    }
    if (otp !== generatedOtp) {
      setLoading(false);
      setError("Incorrect code. Try again.");
      return;
    }

    const randomPassword = `Cyra-${generatedOtp}-${Date.now()}`;
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: randomPassword,
    });

    if (!signUpError && signUpData?.session) {
      setLoading(false);
      onAuth(signUpData.user);
      return;
    }

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setError("An account with this email already exists. Please sign in instead.");
    setMode("login");
    resetState();
  }

  const inputStyle = {
    width: "100%", background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.18)",
    borderRadius: 12, padding: "12px 14px", color: "#fdf0f5", fontFamily: "inherit",
    fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box",
  };
  const btnPrimary = {
    width: "100%", background: "linear-gradient(135deg,#ec4899,#be185d)", color: "#fff",
    border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 500,
    cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
    opacity: loading ? 0.7 : 1, marginBottom: 12,
  };
  const linkStyle = { color: "#fb7185", cursor: "pointer", fontWeight: 500 };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1a0a10; color: #fdf0f5; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        input::placeholder { color: rgba(253,240,245,0.3); }
        input:focus { border-color: #ec4899 !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .auth-card { animation: fadeUp 0.4s ease; }
      `}</style>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#1a0a10", padding:24 }}>
        <div style={{ fontFamily:"'DM Serif Display', serif", fontSize:40, background:"linear-gradient(135deg,#fb7185,#ec4899,#f43f5e)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:6 }}>🌸 Cyra</div>
        <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:36 }}>Your cycle, your way</div>
        <div className="auth-card" style={{ width:"100%", maxWidth:360, background:"rgba(236,72,153,0.05)", border:"1px solid rgba(236,72,153,0.15)", borderRadius:24, padding:28 }}>

          {mode === "login" && (
            <>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Welcome back</div>
              <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:20 }}>Sign in to your account</div>
              {message && <div style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#6ee7b7", marginBottom:14 }}>{message}</div>}
              {error && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:14 }}>{error}</div>}
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <div style={{ textAlign:"right", marginBottom:16, marginTop:-6 }}>
                <span onClick={() => { setMode("forgot"); resetState(); }} style={{ ...linkStyle, fontSize:12 }}>Forgot password?</span>
              </div>
              <button onClick={handleLogin} disabled={loading} style={btnPrimary}>{loading ? "Signing in…" : "Sign in"}</button>
              <button onClick={() => { setMode("otp"); resetState(); }} style={{ width:"100%", background:"transparent", border:"1px solid rgba(236,72,153,0.25)", borderRadius:14, padding:12, fontSize:14, color:"#fb7185", cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}>
                ✨ New here? Sign up with OTP
              </button>
              <div style={{ textAlign:"center", fontSize:13, color:"rgba(253,240,245,0.4)" }}>
                No account? <span onClick={() => { setMode("signup"); resetState(); }} style={linkStyle}>Sign up</span>
              </div>
            </>
          )}

          {mode === "signup" && (
            <>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Create account</div>
              <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:20 }}>Start tracking your cycle</div>
              {error && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:14 }}>{error}</div>}
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inputStyle} type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
              <button onClick={handleSignup} disabled={loading} style={btnPrimary}>{loading ? "Creating…" : "Create account"}</button>
              <button onClick={() => { setMode("otp"); resetState(); }} style={{ width:"100%", background:"transparent", border:"1px solid rgba(236,72,153,0.25)", borderRadius:14, padding:12, fontSize:14, color:"#fb7185", cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}>
                ✨ Sign up with OTP instead (no password)
              </button>
              <div style={{ textAlign:"center", fontSize:13, color:"rgba(253,240,245,0.4)" }}>
                Already have an account? <span onClick={() => { setMode("login"); resetState(); }} style={linkStyle}>Sign in</span>
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Reset password</div>
              <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:20 }}>We'll send a reset link to your email</div>
              {error && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:14 }}>{error}</div>}
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button onClick={handleForgotPassword} disabled={loading} style={btnPrimary}>{loading ? "Sending…" : "Send reset link"}</button>
              <div style={{ textAlign:"center", fontSize:13, color:"rgba(253,240,245,0.4)" }}>
                <span onClick={() => { setMode("login"); resetState(); }} style={linkStyle}>← Back to sign in</span>
              </div>
            </>
          )}

          {mode === "otp" && !otpSent && (
            <>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Sign up with OTP</div>
              <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:20 }}>No password needed — we'll email you a one-time code to create your account</div>
              {error && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:14 }}>{error}</div>}
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button onClick={handleSendOtp} disabled={loading} style={btnPrimary}>{loading ? "Sending…" : "Send OTP"}</button>
              <div style={{ fontSize:11, color:"rgba(253,240,245,0.3)", textAlign:"center", marginBottom:12, lineHeight:1.5 }}>
                Already have a Cyra account with this email? Use "Sign in" instead.
              </div>
              <div style={{ textAlign:"center", fontSize:13, color:"rgba(253,240,245,0.4)" }}>
                <span onClick={() => { setMode("login"); resetState(); }} style={linkStyle}>← Back to sign in</span>
              </div>
            </>
          )}

          {mode === "otp" && otpSent && (
            <>
              <div style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Enter code</div>
              <div style={{ fontSize:13, color:"rgba(253,240,245,0.4)", marginBottom:14 }}>Check your email for the 6-digit code to finish creating your account</div>
              {message && <div style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#6ee7b7", marginBottom:14 }}>{message}</div>}
              {error && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:14 }}>{error}</div>}
              <input
                style={{ ...inputStyle, textAlign:"center", fontSize:28, letterSpacing:10 }}
                type="text" inputMode="numeric" maxLength={6} placeholder="······"
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
              />
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} style={{ ...btnPrimary, opacity:(loading || otp.length < 6) ? 0.5 : 1 }}>
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
              <div style={{ textAlign:"center", fontSize:13, color:"rgba(253,240,245,0.4)" }}>
                Didn't get it?{" "}
                <span onClick={() => { setOtpSent(false); setOtp(""); setError(""); setMessage(""); setGeneratedOtp(""); setOtpExpiry(null); }} style={linkStyle}>Resend</span>
                {" · "}
                <span onClick={() => { setMode("login"); resetState(); }} style={linkStyle}>Cancel</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const today = new Date();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState(EMPTY_DATA);
  const [dataLoading, setDataLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(() => localStorage.getItem("cyra_alert") === "true");
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
  const [showSplash, setShowSplash] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem(THEME_KEY);
    return s === null ? true : s === "dark";
  });

  useEffect(() => { const t = setTimeout(() => setShowSplash(false), 1800); return () => clearTimeout(t); }, []);
  useEffect(() => { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); }, [isDark]);
  useEffect(() => { localStorage.setItem("cyra_alert", alertEnabled); }, [alertEnabled]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    // ✅ FIX: clear data immediately on sign-out so next user starts fresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const newUser = session?.user ?? null;
      if (!newUser) {
        setData(EMPTY_DATA);
      }
      setUser(newUser);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadFromSupabase = useCallback(async (userId) => {
    setDataLoading(true);
    try {
      const { data: rows, error } = await supabase.from("cyra_data").select("*").eq("user_id", userId).single();
      if (error && error.code !== "PGRST116") throw error;
      if (rows) setData({ periods: rows.periods || [], notes: rows.notes || {}, moods: rows.moods || {}, flows: rows.flows || {}, symptoms: rows.symptoms || {} });
      else setData(EMPTY_DATA);
    } catch (err) { console.error(err); }
    finally { setDataLoading(false); }
  }, []);

  useEffect(() => { if (user) loadFromSupabase(user.id); else setData(EMPTY_DATA); }, [user, loadFromSupabase]);

  const saveToSupabase = useCallback(async (newData, userId) => {
    if (!userId) return;
    setSaveStatus("saving");
    try {
      const { error } = await supabase.from("cyra_data").upsert({
        user_id: userId, ...newData, updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) { console.error(err); setSaveStatus(""); }
  }, []);

  // ✅ FIX: guard ensures we never save with a stale/wrong user id
  function updateData(newData) {
    setData(newData);
    if (user) saveToSupabase(newData, user.id);
  }

  useEffect(() => {
    if (!user || !alertEnabled) return;
    const lastCheck = localStorage.getItem("cyra_alert_check");
    const todayStr = toDateStr(new Date());
    if (lastCheck === todayStr) return;
    const prediction = getPrediction(data);
    if (!prediction) return;
    const daysUntil = Math.ceil((prediction.date - new Date()) / 86400000);
    if (daysUntil === 1 || daysUntil === 0) {
      supabase.functions.invoke("period-alert", {
        body: { email: user.email, daysUntil, predictedDate: prediction.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), cycleLength: prediction.cycleLength }
      }).then(() => localStorage.setItem("cyra_alert_check", todayStr))
        .catch(err => console.log("Alert email skipped:", err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data, alertEnabled]);

  function getPrediction(d = data) {
    if (!d || d.periods.length < 2) return null;
    const sorted = [...d.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++)
      gaps.push((new Date(sorted[i].start) - new Date(sorted[i - 1].start)) / 86400000);
    const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const last = new Date(sorted[sorted.length - 1].start);
    const next = new Date(last); next.setDate(next.getDate() + avg);
    return { date: next, cycleLength: avg };
  }

  const prediction = getPrediction();
  const periodDates = new Set();
  data.periods.forEach(({ start, end }) => {
    const s = new Date(start), e = new Date(end || start);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) periodDates.add(toDateStr(new Date(d)));
  });
  const predictedDates = new Set();
  if (prediction) for (let i = 0; i < 5; i++) { const d = new Date(prediction.date); d.setDate(d.getDate() + i); predictedDates.add(toDateStr(d)); }
  const ovulationDates = new Set();
  if (prediction) for (let i = -2; i <= 2; i++) { const d = new Date(prediction.date); d.setDate(d.getDate() - 14 + i); ovulationDates.add(toDateStr(d)); }

  const healthScore = calculateHealthScore(data);
  const scoreColor = getScoreColor(healthScore);
  const scoreLabel = getScoreLabel(healthScore);
  const scoreTip = getScoreTip(healthScore, data);
  const patterns = detectPatterns(data);

  function getReminders() {
    const reminders = [];
    if (prediction) {
      const daysUntil = Math.ceil((prediction.date - today) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 3)
        reminders.push({ icon: "🌸", text: daysUntil === 0 ? "Your period may start today" : `Period expected in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`, color: "#fb7185" });
      const fertileStart = new Date(prediction.date); fertileStart.setDate(fertileStart.getDate() - 16);
      const fertileEnd = new Date(prediction.date); fertileEnd.setDate(fertileEnd.getDate() - 12);
      if (today >= fertileStart && today <= fertileEnd)
        reminders.push({ icon: "🌿", text: "You're in your fertile window", color: "#34d399" });
    }
    let lastLog = null;
    for (let i = 0; i <= 10; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      if (data.moods?.[ds] || (data.symptoms?.[ds] || []).length > 0) { lastLog = i; break; }
    }
    if (lastLog === null || lastLog >= 3) reminders.push({ icon: "📝", text: "You haven't logged in 3+ days", color: "#fbbf24" });
    return reminders;
  }

  function getSymptomStats() {
    const counts = {};
    Object.values(data.symptoms || {}).forEach(arr => arr.forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }
  function getMoodStats() {
    const counts = {};
    Object.values(data.moods || {}).forEach(m => { counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }
  function getCycleLengthData() {
    if (data.periods.length < 2) return [];
    const sorted = [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start));
    return sorted.slice(1).map((p, i) => {
      const gap = Math.round((new Date(p.start) - new Date(sorted[i].start)) / 86400000);
      const d = new Date(p.start);
      return { name: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`, days: gap };
    });
  }
  function getPeriodDurationData() {
    return [...data.periods].sort((a, b) => new Date(a.start) - new Date(b.start)).map(p => {
      const s = new Date(p.start), e = new Date(p.end || p.start);
      return { name: MONTHS[s.getMonth()].slice(0, 3), days: Math.round((e - s) / 86400000) + 1 };
    });
  }
  function getFlowData() {
    const counts = { Light: 0, Medium: 0, Heavy: 0 };
    Object.values(data.flows || {}).forEach(f => { if (counts[f] !== undefined) counts[f]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }
  function exportCSV() {
    const rows = [["Date","Type","Flow","Mood","Symptoms","Notes"]];
    data.periods.forEach(p => {
      const s = new Date(p.start), e = new Date(p.end || p.start);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(new Date(d));
        rows.push([ds,"Period",data.flows?.[ds]||"",data.moods?.[ds]||"",(data.symptoms?.[ds]||[]).join("; "),data.notes?.[ds]||""]);
      }
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="cyra_data.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function prevMonth() { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); }
  function nextMonth() { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); }

  function handleDateClick(dateStr) {
    if (markingMode) {
      if (!rangeStart) { setRangeStart(dateStr); return; }
      const start = rangeStart < dateStr ? rangeStart : dateStr;
      const end = rangeStart < dateStr ? dateStr : rangeStart;
      updateData({ ...data, periods: [...data.periods, { start, end, id: Date.now() }] });
      setRangeStart(null); setMarkingMode(false); return;
    }
    setSelectedDate(dateStr);
    setNoteText(data.notes?.[dateStr] || "");
    setSelectedMood(data.moods?.[dateStr] || null);
    setSelectedFlow(data.flows?.[dateStr] || null);
    setSelectedSymptoms(data.symptoms?.[dateStr] || []);
    setShowModal(true);
  }

  function saveLog() {
    updateData({ ...data, notes:{...data.notes,[selectedDate]:noteText}, moods:{...data.moods,[selectedDate]:selectedMood}, flows:{...data.flows,[selectedDate]:selectedFlow}, symptoms:{...data.symptoms,[selectedDate]:selectedSymptoms} });
    setShowModal(false);
  }

  function removePeriod(dateStr) {
    updateData({ ...data, periods: data.periods.filter(p => { const s=new Date(p.start),e=new Date(p.end||p.start),d=new Date(dateStr); return !(d>=s&&d<=e); }) });
    setShowModal(false);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);
  const daysUntil = prediction ? Math.ceil((prediction.date - today) / 86400000) : null;
  const symptomStats = getSymptomStats();
  const moodStats = getMoodStats();
  const totalLogged = Object.keys(data.moods||{}).length + Object.keys(data.symptoms||{}).length;
  const cycleLengthData = getCycleLengthData();
  const periodDurationData = getPeriodDurationData();
  const flowData = getFlowData();
  const reminders = getReminders();
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - ((healthScore ?? 0) / 100) * circumference;

  const T = isDark ? {
    bg:"#1a0a10", surface:"rgba(236,72,153,0.05)", border:"rgba(236,72,153,0.12)",
    text:"#fdf0f5", textMuted:"rgba(253,240,245,0.45)", textFaint:"rgba(253,240,245,0.3)",
    modal:"#2a0e1a", tabBg:"rgba(26,10,16,0.96)", glow:"rgba(236,72,153,0.18)", tooltipBg:"#2a0e1a",
  } : {
    bg:"#fff0f5", surface:"rgba(236,72,153,0.06)", border:"rgba(236,72,153,0.18)",
    text:"#3b0a1f", textMuted:"rgba(59,10,31,0.55)", textFaint:"rgba(59,10,31,0.35)",
    modal:"#fff0f5", tabBg:"rgba(255,240,245,0.97)", glow:"rgba(236,72,153,0.10)", tooltipBg:"#fff0f5",
  };

  if (showSplash) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#1a0a10;margin:0;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
        .sl{animation:fadeIn .6s ease forwards}.ss{animation:fadeIn .6s ease .3s both}.sd{animation:fadeIn .6s ease .6s both;display:flex;gap:8px}
        .dot{width:6px;height:6px;border-radius:50%;background:#ec4899;animation:pulse 1.2s ease infinite}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
      `}</style>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#1a0a10",gap:16}}>
        <div className="sl" style={{fontFamily:"'DM Serif Display',serif",fontSize:48,background:"linear-gradient(135deg,#fb7185,#ec4899,#f43f5e)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>🌸 Cyra</div>
        <div className="ss" style={{fontSize:14,color:"rgba(253,240,245,0.4)",fontFamily:"'DM Sans',sans-serif"}}>Your cycle, your way</div>
        <div className="sd" style={{marginTop:24}}><div className="dot"/><div className="dot"/><div className="dot"/></div>
      </div>
    </>
  );

  if (authLoading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#1a0a10",color:"#ec4899",fontSize:14}}>Loading…</div>;
  if (!user) return <AuthScreen onAuth={setUser} />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:${T.bg};color:${T.text};font-family:'DM Sans',sans-serif;min-height:100vh;transition:background .3s,color .3s;}
        .app{max-width:420px;margin:0 auto;min-height:100vh;background:${T.bg};position:relative;overflow-x:hidden;}
        .app::before{content:'';position:fixed;top:-80px;left:50%;transform:translateX(-50%);width:500px;height:380px;background:radial-gradient(ellipse,${T.glow} 0%,transparent 70%);pointer-events:none;z-index:0;}
        .header{padding:20px 20px 0;position:relative;z-index:1;}
        .header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:8px;}
        .logo{font-family:'DM Serif Display',serif;font-size:28px;background:linear-gradient(135deg,#fb7185,#ec4899,#f43f5e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
        .header-actions{display:flex;align-items:center;gap:8px;}
        .save-badge{font-size:11px;color:${saveStatus==="saved"?"#34d399":"#fbbf24"};background:${saveStatus==="saved"?"rgba(52,211,153,0.1)":"rgba(251,191,36,0.1)"};border:1px solid ${saveStatus==="saved"?"rgba(52,211,153,0.2)":"rgba(251,191,36,0.2)"};border-radius:20px;padding:3px 10px;}
        .icon-btn{width:36px;height:36px;border-radius:50%;border:1px solid ${T.border};background:${T.surface};color:${T.text};font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .icon-btn:hover{background:rgba(236,72,153,0.15);}
        .log-btn{background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;border:none;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;}
        .log-btn.active{background:linear-gradient(135deg,#f43f5e,#ec4899);}
        .reminder-banner{margin-bottom:10px;background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:10px;}
        .hero{background:linear-gradient(135deg,rgba(236,72,153,0.18),rgba(244,63,94,0.1));border:1px solid rgba(236,72,153,0.25);border-radius:22px;padding:22px;margin-bottom:16px;position:relative;overflow:hidden;}
        .hero::after{content:'🌸';position:absolute;right:18px;top:50%;transform:translateY(-50%);font-size:52px;opacity:.18;}
        .hero-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#fb7185;margin-bottom:6px;}
        .hero-number{font-family:'DM Serif Display',serif;font-size:56px;line-height:1;background:linear-gradient(135deg,#fb7185,#f43f5e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;}
        .hero-sub{font-size:13px;color:${T.textMuted};}
        .hero-empty{font-size:14px;color:${T.textMuted};line-height:1.6;}
        .score-card{background:${T.surface};border:1px solid ${T.border};border-radius:22px;padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:20px;}
        .score-ring-wrap{position:relative;width:96px;height:96px;flex-shrink:0;}
        .score-number{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;}
        .score-num{font-family:'DM Serif Display',serif;font-size:26px;line-height:1;}
        .score-max{font-size:10px;color:${T.textFaint};}
        .score-right{flex:1;}
        .score-label{font-size:16px;font-weight:600;color:${T.text};margin-bottom:4px;}
        .score-tip{font-size:12px;color:${T.textMuted};line-height:1.5;}
        .score-breakdown{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
        .score-tag{background:rgba(236,72,153,0.08);border:1px solid rgba(236,72,153,0.12);border-radius:20px;padding:3px 10px;font-size:11px;color:${T.textMuted};}
        .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;}
        .stat{background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:14px 10px;text-align:center;}
        .stat-num{font-family:'DM Serif Display',serif;font-size:26px;color:#fb7185;line-height:1;margin-bottom:4px;}
        .stat-label{font-size:10px;color:${T.textFaint};text-transform:uppercase;letter-spacing:.06em;}
        .cal-card{background:${T.surface};border:1px solid ${T.border};border-radius:22px;padding:18px;margin-bottom:18px;}
        .cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
        .cal-nav-btn{width:34px;height:34px;border-radius:50%;border:1px solid ${T.border};background:${T.surface};color:#fb7185;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .cal-month{font-size:15px;font-weight:500;color:${T.text};}
        .day-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
        .day-name{text-align:center;font-size:10px;font-weight:600;color:${T.textFaint};padding:4px 0 8px;text-transform:uppercase;letter-spacing:.05em;}
        .day-cell{aspect-ratio:1;border-radius:10px;border:1px solid transparent;background:transparent;color:${T.textMuted};font-size:12px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;position:relative;min-height:36px;flex-direction:column;gap:1px;}
        .day-cell:hover{background:rgba(236,72,153,0.15);color:${T.text};}
        .day-cell.is-period{background:linear-gradient(135deg,rgba(236,72,153,0.4),rgba(244,63,94,0.25));color:#fda4af;border-color:rgba(236,72,153,0.35);}
        .day-cell.is-predicted{background:rgba(251,191,36,0.1);color:#fcd34d;border:1px dashed rgba(251,191,36,0.35);}
        .day-cell.is-ovulation{background:rgba(52,211,153,0.1);color:#6ee7b7;border-color:rgba(52,211,153,0.25);}
        .day-cell.is-today{border-color:#ec4899!important;color:#fb7185!important;font-weight:600;}
        .day-cell.is-range-start{background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;border-color:transparent;}
        .day-mood{font-size:8px;line-height:1;}
        .note-dot{position:absolute;bottom:3px;right:3px;width:4px;height:4px;border-radius:50%;background:#fb7185;}
        .legend{display:flex;gap:14px;flex-wrap:wrap;padding-top:14px;border-top:1px solid ${T.border};margin-top:10px;}
        .legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:${T.textFaint};}
        .legend-dot{width:10px;height:10px;border-radius:3px;}
        .mode-banner{background:linear-gradient(135deg,rgba(236,72,153,0.18),rgba(244,63,94,0.12));border:1px solid rgba(236,72,153,0.3);border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#fda4af;}
        .cancel-btn{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 12px;color:${T.textMuted};font-size:12px;cursor:pointer;font-family:inherit;}
        .tab-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;background:${T.tabBg};backdrop-filter:blur(20px);border-top:1px solid ${T.border};display:flex;z-index:10;}
        .tab{flex:1;padding:10px 0 14px;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;font-family:inherit;color:${T.textFaint};font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;transition:color .2s;}
        .tab.active{color:#ec4899;}
        .tab-icon{font-size:18px;line-height:1;}
        .tab-content{padding:0 0 100px;}
        .section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:${T.textFaint};margin-bottom:12px;margin-top:8px;}
        .pattern-card{background:${T.surface};border:1px solid ${T.border};border-radius:18px;padding:16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;position:relative;overflow:hidden;}
        .pattern-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#ec4899,#fb7185);}
        .pattern-icon{font-size:22px;flex-shrink:0;width:44px;height:44px;background:rgba(236,72,153,0.12);border-radius:12px;display:flex;align-items:center;justify-content:center;}
        .pattern-title{font-size:14px;font-weight:500;color:${T.text};margin-bottom:4px;}
        .pattern-detail{font-size:12px;color:${T.textMuted};line-height:1.5;}
        .insight-card{background:${T.surface};border:1px solid ${T.border};border-radius:18px;padding:16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px;}
        .insight-icon{font-size:22px;flex-shrink:0;width:44px;height:44px;background:rgba(236,72,153,0.12);border-radius:12px;display:flex;align-items:center;justify-content:center;}
        .insight-title{font-size:14px;font-weight:500;color:${T.text};margin-bottom:3px;}
        .insight-sub{font-size:12px;color:${T.textMuted};line-height:1.5;}
        .symptom-row{margin-bottom:10px;}
        .symptom-row-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
        .symptom-bar-bg{background:rgba(236,72,153,0.1);border-radius:4px;height:6px;width:100%;}
        .symptom-bar-fill{background:linear-gradient(90deg,#ec4899,#fb7185);border-radius:4px;height:6px;transition:width .5s ease;}
        .mood-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
        .mood-chip{background:${T.surface};border:1px solid ${T.border};border-radius:20px;padding:6px 12px;font-size:13px;color:${T.textMuted};display:flex;align-items:center;gap:6px;}
        .chart-card{background:${T.surface};border:1px solid ${T.border};border-radius:18px;padding:16px;margin-bottom:16px;}
        .chart-title{font-size:13px;font-weight:500;color:${T.text};margin-bottom:4px;}
        .chart-sub{font-size:11px;color:${T.textFaint};margin-bottom:14px;}
        .export-btn{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:14px;color:#fb7185;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;}
        .settings-card{background:${T.surface};border:1px solid ${T.border};border-radius:18px;padding:16px;margin-bottom:12px;}
        .settings-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid ${T.border};}
        .settings-row:last-child{border-bottom:none;padding-bottom:0;}
        .settings-label{font-size:14px;color:${T.text};}
        .settings-sub{font-size:12px;color:${T.textMuted};margin-top:2px;}
        .settings-btn{background:rgba(236,72,153,0.1);border:1px solid rgba(236,72,153,0.2);border-radius:10px;padding:6px 14px;color:#fb7185;font-size:13px;cursor:pointer;font-family:inherit;}
        .settings-btn.danger{background:rgba(244,63,94,0.08);border-color:rgba(244,63,94,0.2);color:#f87171;}
        .toggle{position:relative;width:44px;height:24px;}
        .toggle input{opacity:0;width:0;height:0;}
        .toggle-slider{position:absolute;inset:0;background:rgba(236,72,153,0.2);border-radius:24px;cursor:pointer;transition:.3s;}
        .toggle-slider::before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.3s;}
        input:checked+.toggle-slider{background:#ec4899;}
        input:checked+.toggle-slider::before{transform:translateX(20px);}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;z-index:100;}
        .modal{background:${T.modal};border:1px solid ${T.border};border-radius:26px 26px 0 0;padding:20px 20px 44px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;}
        .modal-handle{width:36px;height:4px;background:rgba(236,72,153,0.25);border-radius:2px;margin:0 auto 16px;}
        .modal-date{font-family:'DM Serif Display',serif;font-size:20px;color:#fb7185;margin-bottom:16px;}
        .modal-section-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:${T.textFaint};margin-bottom:8px;}
        .mood-picker{display:flex;gap:8px;margin-bottom:16px;}
        .mood-btn{flex:1;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-family:inherit;}
        .mood-btn.selected{background:rgba(236,72,153,0.2);border-color:#ec4899;}
        .mood-emoji{font-size:20px;}
        .mood-label{font-size:9px;color:${T.textFaint};text-transform:uppercase;letter-spacing:.05em;}
        .flow-picker{display:flex;gap:8px;margin-bottom:16px;}
        .flow-btn{flex:1;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:9px 4px;font-size:13px;color:${T.textMuted};cursor:pointer;font-family:inherit;text-align:center;}
        .flow-btn.selected{background:rgba(236,72,153,0.2);border-color:#ec4899;color:#fda4af;font-weight:500;}
        .symptom-picker{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px;}
        .symptom-btn{background:${T.surface};border:1px solid ${T.border};border-radius:20px;padding:6px 12px;font-size:12px;color:${T.textMuted};cursor:pointer;font-family:inherit;}
        .symptom-btn.selected{background:rgba(236,72,153,0.22);border-color:#ec4899;color:#fda4af;}
        .modal-textarea{width:100%;background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:12px 14px;color:${T.text};font-family:inherit;font-size:14px;resize:none;outline:none;line-height:1.6;margin-bottom:12px;}
        .modal-textarea::placeholder{color:${T.textFaint};}
        .modal-actions{display:flex;gap:10px;}
        .btn-primary{flex:1;background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;border:none;border-radius:14px;padding:13px;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;}
        .btn-secondary{background:${T.surface};border:1px solid ${T.border};border-radius:14px;padding:13px 18px;color:${T.textMuted};font-size:14px;cursor:pointer;font-family:inherit;}
        .btn-danger{width:100%;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.2);border-radius:12px;padding:11px;color:#fda4af;font-size:13px;cursor:pointer;font-family:inherit;margin-bottom:12px;}
        .divider{border:none;border-top:1px solid ${T.border};margin:12px 0;}
        .main-content{padding:0 16px 100px;position:relative;z-index:1;}
        .empty-state{text-align:center;padding:40px 20px;color:${T.textMuted};font-size:14px;line-height:1.8;}
        .empty-icon{font-size:36px;margin-bottom:12px;}
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-top">
            <span className="logo">Cyra</span>
            <div className="header-actions">
              {saveStatus && <span className="save-badge">{saveStatus==="saving"?"Saving…":"✓ Saved"}</span>}
              <button className="icon-btn" onClick={() => setIsDark(d=>!d)}>{isDark?"☀️":"🌙"}</button>
              <button className={`log-btn${markingMode?" active":""}`} onClick={() => { setMarkingMode(true); setRangeStart(null); }}>
                <span>+</span>{markingMode&&!rangeStart?"Pick start…":"Log period"}
              </button>
            </div>
          </div>
        </div>

        <div className="main-content">
          {markingMode && (
            <div className="mode-banner">
              <span>{!rangeStart?"Tap the day your period started":"Now tap the day it ended"}</span>
              <button className="cancel-btn" onClick={() => { setMarkingMode(false); setRangeStart(null); }}>Cancel</button>
            </div>
          )}
          {reminders.map((r,i) => (
            <div key={i} className="reminder-banner" style={{ borderColor:`${r.color}33` }}>
              <span style={{ fontSize:16 }}>{r.icon}</span>
              <span style={{ fontSize:13, color:r.color }}>{r.text}</span>
            </div>
          ))}
          {dataLoading && <div style={{ textAlign:"center", padding:"20px", color:"rgba(253,240,245,0.4)", fontSize:13 }}>Loading your data…</div>}

          {activeTab==="calendar" && (
            <>
              <div className="hero">
                {prediction&&daysUntil!==null ? (
                  <><div className="hero-label">Next period in</div><div className="hero-number">{daysUntil>0?daysUntil:"Today"}</div><div className="hero-sub">{daysUntil>0?`days · ${prediction.date.toLocaleDateString("en-US",{month:"long",day:"numeric"})}`:"Your period may start today"}</div></>
                ) : (
                  <><div className="hero-label">Welcome to Cyra</div><div className="hero-empty">Log two or more cycles to unlock predictions and insights.</div></>
                )}
              </div>
              <div className="score-card">
                <div className="score-ring-wrap">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(236,72,153,0.1)" strokeWidth="8"/>
                    <circle cx="48" cy="48" r="40" fill="none" stroke={scoreColor} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition:"stroke-dashoffset 1s ease" }}/>
                  </svg>
                  <div className="score-number"><div className="score-num" style={{ color:scoreColor }}>{healthScore ?? "—"}</div><div className="score-max">{healthScore !== null ? "/100" : ""}</div></div>
                </div>
                <div className="score-right">
                  <div className="score-label">Health Score: <span style={{ color:scoreColor }}>{healthScore !== null ? scoreLabel : "Start tracking"}</span></div>
                  <div className="score-tip">{scoreTip}</div>
                  <div className="score-breakdown">
                    {["Logging","Regularity","Mood","Symptoms"].map(t => <span key={t} className="score-tag">{t}</span>)}
                  </div>
                </div>
              </div>
              <div className="stats">
                <div className="stat"><div className="stat-num">{data.periods.length}</div><div className="stat-label">Cycles</div></div>
                <div className="stat"><div className="stat-num">{prediction?prediction.cycleLength:"—"}</div><div className="stat-label">Avg days</div></div>
                <div className="stat"><div className="stat-num">{totalLogged}</div><div className="stat-label">Logged</div></div>
              </div>
              <div className="cal-card">
                <div className="cal-nav">
                  <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
                  <span className="cal-month">{MONTHS[viewMonth]} {viewYear}</span>
                  <button className="cal-nav-btn" onClick={nextMonth}>›</button>
                </div>
                <div className="day-grid">{DAYS.map(d=><div key={d} className="day-name">{d}</div>)}</div>
                <div className="day-grid">
                  {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
                  {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                    const ds=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    let cls="day-cell";
                    if(periodDates.has(ds))cls+=" is-period";
                    else if(predictedDates.has(ds))cls+=" is-predicted";
                    else if(ovulationDates.has(ds))cls+=" is-ovulation";
                    if(ds===todayStr)cls+=" is-today";
                    if(rangeStart===ds)cls+=" is-range-start";
                    const mood=data.moods?.[ds];
                    return (
                      <button key={ds} className={cls} onClick={()=>handleDateClick(ds)}>
                        {day}
                        {mood&&<span className="day-mood">{MOODS.find(m=>m.label===mood)?.emoji}</span>}
                        {data.notes?.[ds]&&<span className="note-dot"/>}
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <div className="legend-item"><div className="legend-dot" style={{ background:"rgba(236,72,153,0.55)" }}/>Period</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background:"rgba(251,191,36,0.35)",border:"1px dashed rgba(251,191,36,0.5)" }}/>Predicted</div>
                  <div className="legend-item"><div className="legend-dot" style={{ background:"rgba(52,211,153,0.35)" }}/>Fertile</div>
                </div>
              </div>
            </>
          )}

          {activeTab==="symptoms" && (
            <div className="tab-content">
              <div className="section-title">Mood history</div>
              {moodStats.length>0?(
                <div className="mood-row">{moodStats.map(([mood,count])=>{const m=MOODS.find(x=>x.label===mood);return<div key={mood} className="mood-chip">{m?.emoji} {mood}<span style={{color:"#fb7185",fontWeight:600}}>×{count}</span></div>;})}</div>
              ):<div className="empty-state"><div className="empty-icon">😊</div>No moods logged yet.</div>}
              <div className="section-title" style={{marginTop:20}}>Most common symptoms</div>
              {symptomStats.length>0?(
                symptomStats.map(([symptom,count])=>(
                  <div key={symptom} className="symptom-row">
                    <div className="symptom-row-top"><span style={{fontSize:13,color:T.text}}>{symptom}</span><span style={{fontSize:12,color:T.textMuted}}>{count} {count===1?"time":"times"}</span></div>
                    <div className="symptom-bar-bg"><div className="symptom-bar-fill" style={{width:`${Math.min(100,(count/symptomStats[0][1])*100)}%`}}/></div>
                  </div>
                ))
              ):<div className="empty-state"><div className="empty-icon">💊</div>No symptoms logged yet.</div>}
            </div>
          )}

          {activeTab==="charts" && (
            <div className="tab-content">
              <button className="export-btn" onClick={exportCSV}>📤 Export my data as CSV</button>
              {cycleLengthData.length>0?(
                <div className="chart-card">
                  <div className="chart-title">Cycle length over time</div>
                  <div className="chart-sub">Days between each period</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cycleLengthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="name" tick={{fill:T.textFaint,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.textFaint,fontSize:10}} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
                      <Tooltip contentStyle={{background:T.tooltipBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12}} formatter={v=>[`${v} days`,"Cycle length"]}/>
                      <Line type="monotone" dataKey="days" stroke="#ec4899" strokeWidth={2.5} dot={{fill:"#ec4899",r:4}} activeDot={{r:6}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ):<div className="chart-card"><div className="chart-title">Cycle length</div><div className="empty-state" style={{padding:"20px 0"}}><div className="empty-icon">📊</div>Log 2+ periods to see chart.</div></div>}
              {periodDurationData.length>0&&(
                <div className="chart-card">
                  <div className="chart-title">Period duration</div>
                  <div className="chart-sub">How many days each period lasted</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={periodDurationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="name" tick={{fill:T.textFaint,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.textFaint,fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{background:T.tooltipBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12}} formatter={v=>[`${v} days`,"Duration"]}/>
                      <Bar dataKey="days" fill="#ec4899" radius={[6,6,0,0]} opacity={0.85}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {flowData.some(f=>f.value>0)&&(
                <div className="chart-card">
                  <div className="chart-title">Flow intensity</div>
                  <div className="chart-sub">Distribution of logged flow levels</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={flowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="name" tick={{fill:T.textFaint,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.textFaint,fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{background:T.tooltipBg,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12}} formatter={v=>[`${v} days`,"Days logged"]}/>
                      <Bar dataKey="value" fill="#ec4899" radius={[6,6,0,0]} opacity={0.85}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab==="insights" && (
            <div className="tab-content">
              {patterns.length>0&&(
                <><div className="section-title">🔍 Detected patterns</div>
                {patterns.map((p,i)=>(
                  <div key={i} className="pattern-card">
                    <div className="pattern-icon">{p.icon}</div>
                    <div><div className="pattern-title">{p.title}</div><div className="pattern-detail">{p.detail}</div></div>
                  </div>
                ))}</>
              )}
              <div className="section-title" style={{marginTop:patterns.length>0?20:8}}>Your cycle insights</div>
              {prediction?(
                <>
                  <div className="insight-card"><div className="insight-icon">🌸</div><div><div className="insight-title">Next period</div><div className="insight-sub">Expected around {prediction.date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div></div>
                  <div className="insight-card"><div className="insight-icon">💯</div><div><div className="insight-title">Health Score: <span style={{color:scoreColor}}>{healthScore !== null ? `${healthScore}/100 — ${scoreLabel}` : "Not yet calculated"}</span></div><div className="insight-sub">{scoreTip}</div></div></div>
                  <div className="insight-card"><div className="insight-icon">📊</div><div><div className="insight-title">Average cycle length</div><div className="insight-sub">{prediction.cycleLength} days across {data.periods.length} cycles</div></div></div>
                  {symptomStats.length>0&&<div className="insight-card"><div className="insight-icon">💊</div><div><div className="insight-title">Most common symptom</div><div className="insight-sub">{symptomStats[0][0]} — {symptomStats[0][1]} times</div></div></div>}
                </>
              ):<div className="empty-state"><div className="empty-icon">🌸</div>Log at least 2 periods to unlock insights.</div>}
            </div>
          )}

          {activeTab==="settings" && (
            <div className="tab-content">
              <div className="section-title">Account</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><div className="settings-label">Signed in as</div><div className="settings-sub">{user?.email}</div></div>
                  <button className="settings-btn danger" onClick={() => supabase.auth.signOut()}>Sign out</button>
                </div>
              </div>
              <div className="section-title">Notifications</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">📧 Period day email alert</div>
                    <div className="settings-sub">Get emailed 1 day before your predicted period</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={alertEnabled} onChange={() => setAlertEnabled(v=>!v)}/>
                    <span className="toggle-slider"/>
                  </label>
                </div>
                {alertEnabled && (
                  <div style={{ padding:"10px 0 4px", fontSize:12, color:"#34d399" }}>
                    ✅ Alerts active — email will be sent to {user?.email}
                  </div>
                )}
              </div>
              <div className="section-title">Appearance</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><div className="settings-label">{isDark?"Dark mode":"Light mode"}</div><div className="settings-sub">Switch app theme</div></div>
                  <label className="toggle"><input type="checkbox" checked={isDark} onChange={()=>setIsDark(d=>!d)}/><span className="toggle-slider"/></label>
                </div>
              </div>
              <div className="section-title">Data</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><div className="settings-label">Export data</div><div className="settings-sub">Download all data as CSV</div></div>
                  <button className="settings-btn" onClick={exportCSV}>Export</button>
                </div>
                <div className="settings-row">
                  <div><div className="settings-label">Clear all data</div><div className="settings-sub">Permanently delete everything</div></div>
                  <button className="settings-btn danger" onClick={async()=>{
                    if(window.confirm("Delete all Cyra data? This cannot be undone.")){
                      await supabase.from("cyra_data").delete().eq("user_id",user.id);
                      setData(EMPTY_DATA);
                    }
                  }}>Clear</button>
                </div>
              </div>
              <div className="section-title">About</div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><div className="settings-label">Cyra</div><div className="settings-sub">Your cycle, your way · v2.0</div></div>
                  <span style={{fontSize:20}}>🌸</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tab-bar">
          {[["calendar","🗓","Calendar"],["symptoms","🌡","Symptoms"],["charts","📊","Charts"],["insights","🌸","Insights"],["settings","⚙️","Settings"]].map(([id,icon,label])=>(
            <button key={id} className={`tab${activeTab===id?" active":""}`} onClick={()=>setActiveTab(id)}>
              <span className="tab-icon">{icon}</span>{label}
            </button>
          ))}
        </div>

        {showModal&&(
          <div className="modal-overlay" onClick={()=>setShowModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-date">{selectedDate}</div>
              {periodDates.has(selectedDate)&&<button className="btn-danger" onClick={()=>removePeriod(selectedDate)}>Remove period mark</button>}
              <div className="modal-section-label">How are you feeling?</div>
              <div className="mood-picker">
                {MOODS.map(m=>(
                  <button key={m.label} className={`mood-btn${selectedMood===m.label?" selected":""}`} onClick={()=>setSelectedMood(selectedMood===m.label?null:m.label)}>
                    <span className="mood-emoji">{m.emoji}</span><span className="mood-label">{m.label}</span>
                  </button>
                ))}
              </div>
              {periodDates.has(selectedDate)&&(
                <><div className="modal-section-label">Flow intensity</div>
                <div className="flow-picker">{FLOW_LEVELS.map(f=><button key={f} className={`flow-btn${selectedFlow===f?" selected":""}`} onClick={()=>setSelectedFlow(selectedFlow===f?null:f)}>{f}</button>)}</div></>
              )}
              <div className="modal-section-label">Symptoms</div>
              <div className="symptom-picker">
                {SYMPTOMS_LIST.map(s=><button key={s} className={`symptom-btn${selectedSymptoms.includes(s)?" selected":""}`} onClick={()=>setSelectedSymptoms(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s])}>{s}</button>)}
              </div>
              <hr className="divider"/>
              <div className="modal-section-label">Notes</div>
              <textarea className="modal-textarea" rows={3} placeholder="Anything else to note…" value={noteText} onChange={e=>setNoteText(e.target.value)}/>
              <div className="modal-actions">
                <button className="btn-primary" onClick={saveLog}>Save</button>
                <button className="btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}