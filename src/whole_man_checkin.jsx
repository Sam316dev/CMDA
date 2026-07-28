import { useState, useEffect, useMemo } from "react";
import {
  Heart, Brain, Activity, AlertCircle, Send, Users, Clock, CheckCircle2,
  ArrowLeft, MessageCircle, HandHeart, Handshake,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');";

const COLORS = {
  bg: "#0B1440",
  card: "#16205C",
  cardLight: "#1D2A73",
  cream: "#F6F1E7",
  creamDim: "#B9C0E8",
  spirit: "#C9A6E8",
  soul: "#E8804A",
  body: "#4FB0A5",
  danger: "#D9534F",
  success: "#4FA97A",
  prayer: "#F2C879",
  border: "rgba(246,241,231,0.12)",
};

const VERSES = {
  spirit: { text: "Be strong and courageous — I will never leave you nor forsake you.", ref: "Joshua 1:9" },
  soul: { text: "Cast all your anxiety on Him, because He cares for you.", ref: "1 Peter 5:7" },
  body: { text: "Come to me, all who are weary, and I will give you rest.", ref: "Matthew 11:28" },
  whole: { text: "May God sanctify you wholly — spirit, soul and body.", ref: "1 Thessalonians 5:23" },
  peace: { text: "Do not be anxious about anything; present your requests to God.", ref: "Philippians 4:6" },
};

function genAnonId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "WM-";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function WholenessRings({ spirit, soul, body, size = 200 }) {
  const c = size / 2;
  const rings = [
    { r: size * 0.4, val: spirit, color: COLORS.spirit },
    { r: size * 0.3, val: soul, color: COLORS.soul },
    { r: size * 0.2, val: body, color: COLORS.body },
  ];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {rings.map((ring, i) => {
        const circumference = 2 * Math.PI * ring.r;
        const filled = (ring.val / 5) * circumference;
        return (
          <g key={i} transform={`rotate(-90 ${c} ${c})`}>
            <circle cx={c} cy={c} r={ring.r} fill="none" stroke={COLORS.border} strokeWidth={10} />
            <circle
              cx={c} cy={c} r={ring.r} fill="none"
              stroke={ring.color} strokeWidth={10} strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function Slider({ label, icon, value, onChange, color }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ color: COLORS.cream, fontFamily: "Inter", fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ marginLeft: "auto", color, fontFamily: "IBM Plex Mono", fontSize: 13 }}>{value}/5</span>
      </div>
      <input
        type="range" min={1} max={5} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }}
      />
    </div>
  );
}

function computeResponse({ spirit, soul, body, urgent }) {
  const avg = (spirit + soul + body) / 3;
  const escalate = urgent || spirit <= 2 || soul <= 2 || body <= 2;
  let lowest = "whole";
  if (spirit <= soul && spirit <= body && spirit < 4) lowest = "spirit";
  else if (soul <= spirit && soul <= body && soul < 4) lowest = "soul";
  else if (body <= spirit && body <= soul && body < 4) lowest = "body";
  else if (avg >= 4) lowest = "peace";
  const verse = VERSES[lowest] || VERSES.whole;
  let message;
  if (escalate) {
    message = "That sounds like a heavy day. You don't have to carry it by yourself.";
  } else if (avg < 3.5) {
    message = "Some parts of today feel stretched thin. Naming it is already a step.";
  } else {
    message = "Good to hear things feel steady today. Keep tending to all three.";
  }
  return { escalate, message, verse };
}

async function safeGet(key, shared = false) {
  try {
    const res = await window.storage.get(key, shared);
    return res ? JSON.parse(res.value) : null;
  } catch {
    return null;
  }
}
async function safeSet(key, value, shared = false) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch {
    return false;
  }
}

export default function WholeManApp() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 768 : false));
  const [tab, setTab] = useState("checkin");
  const [anonId, setAnonId] = useState(null);
  const [spirit, setSpirit] = useState(3);
  const [soul, setSoul] = useState(3);
  const [body, setBody] = useState(3);
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashView, setDashView] = useState("overview");

  // meet-up (financial/practical) state
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetCategory, setMeetCategory] = useState("Financial");
  const [meetDetails, setMeetDetails] = useState("");
  const [meetContact, setMeetContact] = useState("");
  const [meetSubmitted, setMeetSubmitted] = useState(false);
  const [meetRequests, setMeetRequests] = useState([]);

  // anonymous chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatIndex, setChatIndex] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatMessages, setActiveChatMessages] = useState([]);
  const [responderReply, setResponderReply] = useState("");

  // prayer request state
  const [prayerText, setPrayerText] = useState("");
  const [prayerSubmitted, setPrayerSubmitted] = useState(false);
  const [prayerRequests, setPrayerRequests] = useState([]);
  const [myPrayers, setMyPrayers] = useState([]);
  const [myPrayerLimit, setMyPrayerLimit] = useState(10);

  // pagination limits for admin lists
  const [chatListLimit, setChatListLimit] = useState(20);
  const [meetListLimit, setMeetListLimit] = useState(20);
  const [prayerListLimit, setPrayerListLimit] = useState(20);
  const [urgentListLimit, setUrgentListLimit] = useState(20);

  // forgot-PIN recovery
  const MASTER_RESET_KEY = "WHOLEMAN-RESET-9182"; // give this only to the chapter lead / dev — change before real use
  const [forgotOpen, setForgotOpen] = useState(false);
  const [masterKeyInput, setMasterKeyInput] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState(false);

  // unread badge + history limit
  const [lastSeen, setLastSeen] = useState(0);
  const [historyLimit, setHistoryLimit] = useState(30);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

 useEffect(() => {
  const prevBodyMargin = document.body.style.margin;
  const prevBodyBackground = document.body.style.background;
  document.body.style.margin = "0";
  document.body.style.background = COLORS.bg;
  return () => {
    document.body.style.margin = prevBodyMargin;
    document.body.style.background = prevBodyBackground;
  };
}, []);
  // hidden staff access (no visible login, no separate app) — separate roles, PINs editable in-app
  const [welfarePin, setWelfarePin] = useState("2468");
  const [prayerPin, setPrayerPin] = useState("1357");
  const [headerTaps, setHeaderTaps] = useState(0);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [adminRole, setAdminRole] = useState(null); // null | "welfare" | "prayer"
  const [pinError, setPinError] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  const handleHeaderTap = () => {
    const next = headerTaps + 1;
    setHeaderTaps(next);
    if (next >= 5) {
      setPinPromptOpen(true);
      setHeaderTaps(0);
    } else {
      setTimeout(() => setHeaderTaps((n) => (n === next ? 0 : n)), 1500);
    }
  };

  const submitPin = () => {
    if (pinInput === welfarePin) {
      setAdminRole("welfare");
      setPinPromptOpen(false);
      setPinInput("");
      setPinError(false);
    } else if (pinInput === prayerPin) {
      setAdminRole("prayer");
      setPinPromptOpen(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const savePin = async () => {
    if (!newPin.trim()) return;
    if (adminRole === "welfare") {
      setWelfarePin(newPin.trim());
      await safeSet("staff-pin-welfare", newPin.trim(), true);
    } else if (adminRole === "prayer") {
      setPrayerPin(newPin.trim());
      await safeSet("staff-pin-prayer", newPin.trim(), true);
    }
    setNewPin("");
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
  };

  const exitStaffView = () => setAdminRole(null);

  const resetPins = async () => {
    if (masterKeyInput.trim() === MASTER_RESET_KEY) {
      const w = "2468", p = "1357";
      setWelfarePin(w);
      setPrayerPin(p);
      await safeSet("staff-pin-welfare", w, true);
      await safeSet("staff-pin-prayer", p, true);
      setResetDone(true);
      setResetError(false);
      setMasterKeyInput("");
    } else {
      setResetError(true);
      setMasterKeyInput("");
    }
  };

  useEffect(() => {
    (async () => {
      let id = await safeGet("anon-id");
      if (!id) {
        id = genAnonId();
        await safeSet("anon-id", id);
      }
      setAnonId(id);
      const h = await safeGet(`checkins:${id}`);
      setHistory(h || []);
      const chat = await safeGet(`chat:${id}`, true);
      setChatMessages(chat || []);
      const seen = await safeGet(`chat-lastseen:${id}`);
      setLastSeen(seen || 0);
      const wp = await safeGet("staff-pin-welfare", true);
      if (wp) setWelfarePin(wp);
      const pp = await safeGet("staff-pin-prayer", true);
      if (pp) setPrayerPin(pp);
      const prayers = (await safeGet("prayer-requests", true)) || [];
      setMyPrayers(prayers.filter((p) => p.id === id));
      setLoading(false);
    })();
  }, []);

  const loadDashboard = async () => {
    setDashLoading(true);
    const list = (await safeGet("wholeman-shared-log", true)) || [];
    setShared(list);
    const mr = (await safeGet("meet-requests", true)) || [];
    setMeetRequests(mr);
    const ci = (await safeGet("chat-index", true)) || [];
    setChatIndex(ci);
    const pr = (await safeGet("prayer-requests", true)) || [];
    setPrayerRequests(pr);
    setDashLoading(false);
  };

  useEffect(() => {
    if (tab === "messages" && anonId) {
      const now = Date.now();
      setLastSeen(now);
      safeSet(`chat-lastseen:${anonId}`, now);
    }
  }, [tab]);

  useEffect(() => {
    if (adminRole) loadDashboard();
  }, [adminRole]);

  useEffect(() => {
    if (!anonId) return;
    const poll = setInterval(async () => {
      const chat = await safeGet(`chat:${anonId}`, true);
      if (chat) setChatMessages(chat);
    }, 15000);
    return () => clearInterval(poll);
  }, [anonId]);

  const hasUnread = useMemo(() => {
    const lastResponderMsg = [...chatMessages].reverse().find((m) => m.from === "responder");
    return lastResponderMsg ? lastResponderMsg.ts > lastSeen : false;
  }, [chatMessages, lastSeen]);

  const submit = async () => {
    const entry = { ts: Date.now(), spirit, soul, body, note, urgent };
    const newHistory = [...history, entry];
    setHistory(newHistory);
    await safeSet(`checkins:${anonId}`, newHistory);

    const sharedList = (await safeGet("wholeman-shared-log", true)) || [];
    const sharedEntry = { id: anonId, ts: entry.ts, spirit, soul, body, urgent, resolved: false };
    const trimmed = [...sharedList, sharedEntry].slice(-300);
    await safeSet("wholeman-shared-log", trimmed, true);

    setResponse(computeResponse(entry));
  };

  const markResolved = async (ts, id) => {
    const updated = shared.map((e) => (e.ts === ts && e.id === id ? { ...e, resolved: true } : e));
    setShared(updated);
    await safeSet("wholeman-shared-log", updated, true);
  };

  const resetCheckin = () => {
    setSpirit(3); setSoul(3); setBody(3); setNote(""); setUrgent(false);
    setResponse(null); setMeetOpen(false); setMeetSubmitted(false);
    setMeetCategory("Financial"); setMeetDetails(""); setMeetContact("");
  };

  // --- anonymous chat (student side) ---
  const sendStudentMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = { from: "student", text: chatInput.trim(), ts: Date.now() };
    const updated = [...chatMessages, msg];
    setChatMessages(updated);
    await safeSet(`chat:${anonId}`, updated, true);

    const idx = (await safeGet("chat-index", true)) || [];
    const existing = idx.find((t) => t.id === anonId);
    const preview = msg.text.slice(0, 60);
    let newIdx;
    if (existing) {
      newIdx = idx.map((t) => (t.id === anonId ? { ...t, lastTs: msg.ts, lastPreview: preview, needsResponse: true } : t));
    } else {
      newIdx = [...idx, { id: anonId, lastTs: msg.ts, lastPreview: preview, needsResponse: true }];
    }
    await safeSet("chat-index", newIdx, true);
    setChatInput("");
  };

  // --- anonymous chat (responder side) ---
  const openChatThread = async (id) => {
    setActiveChatId(id);
    const msgs = (await safeGet(`chat:${id}`, true)) || [];
    setActiveChatMessages(msgs);
  };

  const sendResponderMessage = async () => {
    if (!responderReply.trim() || !activeChatId) return;
    const msg = { from: "responder", text: responderReply.trim(), ts: Date.now() };
    const updated = [...activeChatMessages, msg];
    setActiveChatMessages(updated);
    await safeSet(`chat:${activeChatId}`, updated, true);

    const idx = (await safeGet("chat-index", true)) || [];
    const newIdx = idx.map((t) => (t.id === activeChatId ? { ...t, lastTs: msg.ts, lastPreview: msg.text.slice(0, 60), needsResponse: false } : t));
    await safeSet("chat-index", newIdx, true);
    setChatIndex(newIdx);
    setResponderReply("");
  };

  // --- meet-up request (financial/practical, contact given knowingly) ---
  const submitMeetRequest = async () => {
    const list = (await safeGet("meet-requests", true)) || [];
    const entry = { id: anonId, ts: Date.now(), category: meetCategory, details: meetDetails, contact: meetContact, resolved: false };
    await safeSet("meet-requests", [...list, entry], true);
    setMeetSubmitted(true);
  };

  const resolveMeetRequest = async (ts) => {
    const updated = meetRequests.map((m) => (m.ts === ts ? { ...m, resolved: true } : m));
    setMeetRequests(updated);
    await safeSet("meet-requests", updated, true);
  };

  // --- prayer requests (tagged with the same anon ID as chat — still no name, but lets a student check status) ---
  const submitPrayer = async () => {
    if (!prayerText.trim()) return;
    const list = (await safeGet("prayer-requests", true)) || [];
    const entry = { id: anonId, ts: Date.now(), text: prayerText.trim(), prayed: false };
    await safeSet("prayer-requests", [...list, entry], true);
    setPrayerSubmitted(true);
    setPrayerText("");
    loadMyPrayers();
  };

  const loadMyPrayers = async () => {
    const list = (await safeGet("prayer-requests", true)) || [];
    setMyPrayers(list.filter((p) => p.id === anonId));
  };

  const markPrayed = async (ts, id) => {
    const updated = prayerRequests.map((p) => (p.ts === ts && p.id === id ? { ...p, prayed: true } : p));
    setPrayerRequests(updated);
    await safeSet("prayer-requests", updated, true);
  };

  const dashStats = useMemo(() => {
    if (shared.length === 0) return null;
    const byDay = {};
    shared.forEach((e) => {
      const d = new Date(e.ts);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!byDay[key]) byDay[key] = { day: key, spirit: [], soul: [], body: [] };
      byDay[key].spirit.push(e.spirit);
      byDay[key].soul.push(e.soul);
      byDay[key].body.push(e.body);
    });
    const trend = Object.values(byDay).map((d) => ({
      day: d.day,
      spirit: +(d.spirit.reduce((a, b) => a + b, 0) / d.spirit.length).toFixed(1),
      soul: +(d.soul.reduce((a, b) => a + b, 0) / d.soul.length).toFixed(1),
      body: +(d.body.reduce((a, b) => a + b, 0) / d.body.length).toFixed(1),
    }));
    const urgentOpen = shared.filter((e) => e.urgent || e.spirit <= 2 || e.soul <= 2 || e.body <= 2).filter((e) => !e.resolved);
    return { trend, urgentOpen, total: shared.length };
  }, [shared]);

  const tabBtn = (key, label, Icon, showBadge) => (
    <button
      onClick={() => setTab(key)}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "9px 12px" : "10px 16px", borderRadius: 999,
        border: `1px solid ${tab === key ? COLORS.soul : COLORS.border}`,
        background: tab === key ? "rgba(232,128,74,0.15)" : "transparent",
        color: tab === key ? COLORS.soul : COLORS.creamDim,
        fontFamily: "Inter", fontWeight: 600, fontSize: isMobile ? 12 : 13, cursor: "pointer",
      }}
    >
      <Icon size={isMobile ? 14 : 15} /> {label}
      {showBadge && (
        <span style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: COLORS.danger, border: `2px solid ${COLORS.bg}` }} />
      )}
    </button>
  );

  const subTabBtn = (key, label) => (
    <button
      onClick={() => setDashView(key)}
      style={{
        padding: "7px 14px", borderRadius: 8, border: `1px solid ${dashView === key ? COLORS.soul : COLORS.border}`,
        background: dashView === key ? "rgba(232,128,74,0.12)" : "transparent",
        color: dashView === key ? COLORS.soul : COLORS.creamDim,
        fontFamily: "Inter", fontWeight: 600, fontSize: 12, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const pinChanger = (
    <div style={{ marginTop: 30, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
      <p style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 8 }}>Change this team's PIN</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="password"
          placeholder="New PIN"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          style={{ flex: 1, maxWidth: 160, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 8, fontSize: 13 }}
        />
        <button onClick={savePin} style={{ background: "transparent", border: `1px solid ${COLORS.success}`, color: COLORS.success, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
          Save
        </button>
      </div>
      {pinSaved && <p style={{ fontSize: 12, color: COLORS.success, marginTop: 8 }}>PIN updated.</p>}
    </div>
  );

  const adminHeader = (title) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 10, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: "IBM Plex Mono", fontSize: 11, letterSpacing: 1.5, color: COLORS.creamDim, textTransform: "uppercase" }}>Staff only</div>
        <h1 style={{ fontFamily: "Sora", fontWeight: 800, fontSize: isMobile ? 20 : 24, margin: "6px 0 0" }}>{title}</h1>
      </div>
      <button
        onClick={exitStaffView}
        style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", width: isMobile ? "100%" : "auto" }}
      >
        Exit staff view
      </button>
    </div>
  );

  const shellStyle = {
    background: COLORS.bg,
    minHeight: isMobile ? "80svh" : "100vh",
    height: isMobile ? "auto" : "100dvh",
    borderRadius: isMobile ? 0 : 16,
    padding: isMobile ? "20px 14px" : "28px 24px",
    fontFamily: "Inter",
    color: COLORS.cream,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    overflowX: "hidden",
    overflowY: "auto",
  };

  if (adminRole === "welfare") {
    return (
      <div style={shellStyle}>
        <style>{FONT_IMPORT}</style>
        {adminHeader("Welfare team")}

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {subTabBtn("overview", "Overview")}
          {subTabBtn("chats", "Anonymous chats")}
          {subTabBtn("meet", "Meet-up requests")}
        </div>

        {dashLoading && <div style={{ color: COLORS.creamDim }}>Loading…</div>}

        {!dashLoading && dashView === "overview" && (
          <>
            {!dashStats && <p style={{ color: COLORS.creamDim, fontSize: 14 }}>No check-ins recorded yet.</p>}
            {dashStats && (
              <>
                <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
                  <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{dashStats.total}</div>
                    <div style={{ fontSize: 12, color: COLORS.creamDim }}>total check-ins</div>
                  </div>
                  <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.danger}` }}>
                    <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22, color: COLORS.danger }}>{dashStats.urgentOpen.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.creamDim }}>need follow-up</div>
                  </div>
                </div>

                <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 22, height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashStats.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis dataKey="day" stroke={COLORS.creamDim} fontSize={11} />
                      <YAxis domain={[1, 5]} stroke={COLORS.creamDim} fontSize={11} />
                      <Tooltip contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }} />
                      <Line type="monotone" dataKey="spirit" stroke={COLORS.spirit} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="soul" stroke={COLORS.soul} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="body" stroke={COLORS.body} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Awaiting follow-up</div>
                {dashStats.urgentOpen.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>Nothing pending. Good.</p>}
                {dashStats.urgentOpen.slice(0, urgentListLimit).map((e) => (
                  <div key={`${e.id}-${e.ts}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.card, borderRadius: 10, padding: "10px 16px", marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
                    <div>
                      <div style={{ fontFamily: "IBM Plex Mono", fontSize: 13 }}>{e.id}</div>
                      <div style={{ fontSize: 11, color: COLORS.creamDim }}>{new Date(e.ts).toLocaleString()} · S{e.spirit} So{e.soul} B{e.body}</div>
                    </div>
                    <button
                      onClick={() => markResolved(e.ts, e.id)}
                      style={{ background: "transparent", border: `1px solid ${COLORS.success}`, color: COLORS.success, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                    >
                      Mark followed up
                    </button>
                  </div>
                ))}
                {urgentListLimit < dashStats.urgentOpen.length && (
                  <button onClick={() => setUrgentListLimit((n) => n + 20)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                    Load 20 more
                  </button>
                )}
              </>
            )}
          </>
        )}

        {!dashLoading && dashView === "chats" && (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ flex: isMobile ? "1 1 auto" : "0 0 220px", width: isMobile ? "100%" : "auto" }}>
              {chatIndex.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>No chat threads yet.</p>}
              {[...chatIndex].sort((a, b) => b.lastTs - a.lastTs).slice(0, chatListLimit).map((t) => (
                <div
                  key={t.id}
                  onClick={() => openChatThread(t.id)}
                  style={{
                    background: activeChatId === t.id ? COLORS.cardLight : COLORS.card,
                    border: `1px solid ${t.needsResponse ? COLORS.danger : COLORS.border}`,
                    borderRadius: 10, padding: 12, marginBottom: 8, cursor: "pointer",
                  }}
                >
                  <div style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{t.id}</div>
                  <div style={{ fontSize: 11, color: COLORS.creamDim, marginTop: 4 }}>{t.lastPreview}</div>
                  {t.needsResponse && <div style={{ fontSize: 10, color: COLORS.danger, marginTop: 4 }}>needs reply</div>}
                </div>
              ))}
              {chatListLimit < chatIndex.length && (
                <button onClick={() => setChatListLimit((n) => n + 20)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                  Load 20 more
                </button>
              )}
            </div>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              {!activeChatId && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>Select a thread to view and reply.</p>}
              {activeChatId && (
                <>
                  <div style={{ background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, minHeight: 160, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeChatMessages.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.from === "responder" ? "flex-end" : "flex-start",
                        background: m.from === "responder" ? COLORS.success : COLORS.cardLight,
                        color: m.from === "responder" ? COLORS.bg : COLORS.cream,
                        borderRadius: 10, padding: "8px 12px", maxWidth: "80%", fontSize: 13,
                      }}>
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="Reply anonymously…"
                      value={responderReply}
                      onChange={(e) => setResponderReply(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendResponderMessage()}
                      style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
                    />
                    <button onClick={sendResponderMessage} style={{ background: COLORS.success, border: "none", borderRadius: 8, padding: "0 16px", color: COLORS.bg, cursor: "pointer" }}>
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!dashLoading && dashView === "meet" && (
          <div style={{ width: "100%" }}>
            {meetRequests.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>No meet-up requests yet.</p>}
            {[...meetRequests].reverse().slice(0, meetListLimit).map((m) => (
              <div key={m.ts} style={{ background: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 10, border: `1px solid ${m.resolved ? COLORS.border : COLORS.danger}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13 }}>{m.category}</span>
                  <span style={{ fontSize: 11, color: COLORS.creamDim }}>{new Date(m.ts).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{m.details}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim, fontFamily: "IBM Plex Mono" }}>{m.id} · {m.contact}</div>
                {!m.resolved && (
                  <button onClick={() => resolveMeetRequest(m.ts)} style={{ marginTop: 10, background: "transparent", border: `1px solid ${COLORS.success}`, color: COLORS.success, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                    Mark handled
                  </button>
                )}
                {m.resolved && <div style={{ marginTop: 8, fontSize: 12, color: COLORS.success }}>Handled</div>}
              </div>
            ))}
            {meetListLimit < meetRequests.length && (
              <button onClick={() => setMeetListLimit((n) => n + 20)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                Load 20 more
              </button>
            )}
          </div>
        )}

        {pinChanger}
      </div>
    );
  }

  if (adminRole === "prayer") {
    return (
      <div style={shellStyle}>
        <style>{FONT_IMPORT}</style>
        {adminHeader("Prayer team")}

        {dashLoading && <div style={{ color: COLORS.creamDim }}>Loading…</div>}
        {!dashLoading && (
          <div style={{ width: "100%" }}>
            {prayerRequests.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>No prayer requests yet.</p>}
            {prayerRequests.length > 0 && (
              <p style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 10 }}>
                Showing {Math.min(prayerListLimit, prayerRequests.length)} of {prayerRequests.length}
              </p>
            )}
            {[...prayerRequests].reverse().slice(0, prayerListLimit).map((p) => (
              <div key={`${p.id}-${p.ts}`} style={{ background: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>{p.text}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.creamDim }}>{new Date(p.ts).toLocaleString()}</span>
                  {!p.prayed ? (
                    <button onClick={() => markPrayed(p.ts, p.id)} style={{ background: "transparent", border: `1px solid ${COLORS.prayer}`, color: COLORS.prayer, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                      Mark prayed
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: COLORS.prayer }}>Prayed 🙏</span>
                  )}
                </div>
              </div>
            ))}
            {prayerListLimit < prayerRequests.length && (
              <button onClick={() => setPrayerListLimit((n) => n + 20)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                Load 20 more
              </button>
            )}
          </div>
        )}

        {pinChanger}
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{FONT_IMPORT}</style>

      <div style={{ marginBottom: 22 }}>
        <div
          onClick={handleHeaderTap}
          style={{ fontFamily: "IBM Plex Mono", fontSize: 11, letterSpacing: 1.5, color: COLORS.creamDim, textTransform: "uppercase", cursor: "default", userSelect: "none", display: "inline-block" }}
        >
          CMDA LUTH · Whole Man Whole Community
        </div>
        <h1 style={{ fontFamily: "Sora", fontWeight: 800, fontSize: isMobile ? 22 : 26, margin: "6px 0 0" }}>
          {tab === "prayer" ? "Prayer request" : tab === "messages" ? "Anonymous messages" : "How are you, whole self, today?"}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabBtn("checkin", "Check in", Heart)}
        {tabBtn("messages", "Messages", MessageCircle, hasUnread)}
        {tabBtn("prayer", "Prayer request", HandHeart)}
        {tabBtn("history", "My journey", Clock)}
      </div>

      {pinPromptOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 24, width: 280, maxWidth: "85vw", border: `1px solid ${COLORS.border}` }}>
            {!forgotOpen ? (
              <>
                <p style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, marginBottom: 12, color: COLORS.cream }}>Staff access</p>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  placeholder="Enter PIN"
                  autoFocus
                  style={{ width: "100%", background: COLORS.bg, border: `1px solid ${pinError ? COLORS.danger : COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 14, marginBottom: 10 }}
                />
                {pinError && <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 10 }}>Incorrect PIN.</p>}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button onClick={submitPin} style={{ flex: 1, background: COLORS.soul, color: COLORS.bg, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Unlock</button>
                  <button onClick={() => { setPinPromptOpen(false); setPinInput(""); setPinError(false); }} style={{ background: "transparent", color: COLORS.creamDim, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
                <button onClick={() => setForgotOpen(true)} style={{ background: "none", border: "none", color: COLORS.creamDim, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                  Forgot PIN?
                </button>
              </>
            ) : (
              <>
                <p style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, marginBottom: 8, color: COLORS.cream }}>Reset both PINs</p>
                <p style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 12 }}>
                  Enter the master recovery key (only the chapter lead / dev has this) to reset welfare and prayer PINs back to their defaults.
                </p>
                <input
                  type="password"
                  value={masterKeyInput}
                  onChange={(e) => { setMasterKeyInput(e.target.value); setResetError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && resetPins()}
                  placeholder="Master recovery key"
                  style={{ width: "100%", background: COLORS.bg, border: `1px solid ${resetError ? COLORS.danger : COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13, marginBottom: 10 }}
                />
                {resetError && <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 10 }}>Incorrect key.</p>}
                {resetDone && (
                  <p style={{ color: COLORS.success, fontSize: 12, marginBottom: 10 }}>
                    Reset. Welfare PIN: 2468 · Prayer PIN: 1357 — change these again once you're in.
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={resetPins} style={{ flex: 1, background: COLORS.soul, color: COLORS.bg, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Reset</button>
                  <button
                    onClick={() => { setForgotOpen(false); setMasterKeyInput(""); setResetError(false); setResetDone(false); }}
                    style={{ background: "transparent", color: COLORS.creamDim, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading && <div style={{ color: COLORS.creamDim }}>Loading…</div>}

      {/* CHECK IN */}
      {!loading && tab === "checkin" && !response && (
        <div style={{ display: "flex", gap: isMobile ? 20 : 32, flexWrap: "wrap" }}>
          <div style={{ flex: isMobile ? "1 1 100%" : "0 0 220px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <WholenessRings spirit={spirit} soul={soul} body={body} size={isMobile ? 170 : 200} />
            <div style={{ display: "flex", gap: 14, fontSize: 12, fontFamily: "IBM Plex Mono", flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ color: COLORS.spirit }}>● Spirit</span>
              <span style={{ color: COLORS.soul }}>● Soul</span>
              <span style={{ color: COLORS.body }}>● Body</span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.creamDim, fontFamily: "IBM Plex Mono" }}>{anonId}</div>
          </div>

          <div style={{ flex: isMobile ? "1 1 100%" : "1 1 320px", minWidth: 0, background: COLORS.card, borderRadius: 14, padding: isMobile ? 16 : 22, border: `1px solid ${COLORS.border}` }}>
            <Slider label="Spirit — walk with God" icon={<Heart size={16} />} value={spirit} onChange={setSpirit} color={COLORS.spirit} />
            <Slider label="Soul — mind & emotions" icon={<Brain size={16} />} value={soul} onChange={setSoul} color={COLORS.soul} />
            <Slider label="Body — rest & health" icon={<Activity size={16} />} value={body} onChange={setBody} color={COLORS.body} />

            <textarea
              placeholder="Anything you want to name? (optional, stays private)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8,
                color: COLORS.cream, padding: 10, fontFamily: "Inter", fontSize: 13, marginTop: 4, marginBottom: 14, resize: "vertical",
              }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.creamDim, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              I need to talk to someone urgently
            </label>

            <button
              onClick={submit}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                background: COLORS.soul, color: COLORS.bg, border: "none", borderRadius: 10, padding: "12px 0",
                fontFamily: "Sora", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              <Send size={16} /> Submit check-in
            </button>
          </div>
        </div>
      )}

      {!loading && tab === "checkin" && response && (
        <div style={{ width: "100%", background: COLORS.card, borderRadius: 14, padding: isMobile ? 18 : 24, border: `1px solid ${COLORS.border}` }}>
          <p style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17, marginBottom: 12 }}>{response.message}</p>
          <p style={{ fontStyle: "italic", color: COLORS.creamDim, fontSize: 14, lineHeight: 1.5 }}>
            "{response.verse.text}" <span style={{ opacity: 0.7 }}>— {response.verse.ref}</span>
          </p>

          {response.escalate && !meetSubmitted && (
            <div style={{ marginTop: 18, background: "rgba(217,83,79,0.12)", border: `1px solid ${COLORS.danger}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.danger, fontFamily: "Sora", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                <AlertCircle size={16} /> You don't have to carry this alone
              </div>

              {!meetOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => setTab("messages")}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.danger, color: COLORS.cream, border: "none", borderRadius: 8, padding: "10px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left" }}
                  >
                    <MessageCircle size={15} /> Talk to the welfare team anonymously
                  </button>
                  <button
                    onClick={() => setMeetOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", color: COLORS.cream, border: `1px solid ${COLORS.danger}`, borderRadius: 8, padding: "10px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left" }}
                  >
                    <Handshake size={15} /> I need to meet someone (financial, practical, etc.)
                  </button>
                </div>
              )}

              {meetOpen && (
                <div style={{ marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 10 }}>
                    Meeting in person means sharing contact info, only for this request.
                  </p>
                  <select
                    value={meetCategory}
                    onChange={(e) => setMeetCategory(e.target.value)}
                    style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 9, fontSize: 13, marginBottom: 10 }}
                  >
                    <option>Financial</option>
                    <option>Academic</option>
                    <option>Family / personal</option>
                    <option>Other</option>
                  </select>
                  <textarea
                    placeholder="Briefly, what's going on?"
                    value={meetDetails}
                    onChange={(e) => setMeetDetails(e.target.value)}
                    rows={2}
                    style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 9, fontSize: 13, marginBottom: 10, resize: "vertical" }}
                  />
                  <input
                    placeholder="Phone or WhatsApp number to reach you"
                    value={meetContact}
                    onChange={(e) => setMeetContact(e.target.value)}
                    style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 9, fontSize: 13, marginBottom: 10 }}
                  />
                  <button
                    onClick={submitMeetRequest}
                    disabled={!meetContact.trim()}
                    style={{ width: "100%", background: meetContact.trim() ? COLORS.danger : COLORS.cardLight, color: COLORS.cream, border: "none", borderRadius: 8, padding: "10px 0", fontFamily: "Sora", fontWeight: 700, fontSize: 13, cursor: meetContact.trim() ? "pointer" : "not-allowed" }}
                  >
                    Send request
                  </button>
                </div>
              )}
            </div>
          )}

          {meetSubmitted && (
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: COLORS.success, fontSize: 13 }}>
              <CheckCircle2 size={16} /> Request sent. Someone will reach out via the contact you shared.
            </div>
          )}

          <p style={{ fontSize: 11, color: COLORS.creamDim, marginTop: 20, lineHeight: 1.5 }}>
            This is peer support, not emergency care. If you are in immediate danger, please contact emergency services or a trusted professional right away.
          </p>

          <button
            onClick={resetCheckin}
            style={{ marginTop: 16, background: "transparent", color: COLORS.creamDim, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={13} /> Back to check-in
          </button>
        </div>
      )}

      {/* MESSAGES (student side, anonymous chat) */}
      {!loading && tab === "messages" && (
        <div style={{ width: "100%" }}>
          <p style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 8 }}>
            Fully anonymous — tied only to <span style={{ fontFamily: "IBM Plex Mono", color: COLORS.cream }}>{anonId}</span>. No name, no number.
          </p>
          <div style={{ background: "rgba(232,128,74,0.1)", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: COLORS.creamDim, lineHeight: 1.5, margin: 0 }}>
              The welfare team will reply as quickly as they can, but it isn't instant. If you can't wait, or this feels like an emergency,
              please contact <strong style={{ color: COLORS.cream }}>[campus health service / chaplaincy / security — insert real contact]</strong> right away.
              Don't wait on a message here if you need help now.
            </p>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, minHeight: 180, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {chatMessages.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>No messages yet. Say whatever you need to.</p>}
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.from === "student" ? "flex-end" : "flex-start",
                background: m.from === "student" ? COLORS.soul : COLORS.cardLight,
                color: m.from === "student" ? COLORS.bg : COLORS.cream,
                borderRadius: 10, padding: "8px 12px", maxWidth: "80%", fontSize: 13,
              }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Type a message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendStudentMessage()}
              style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
            />
            <button onClick={sendStudentMessage} style={{ background: COLORS.soul, border: "none", borderRadius: 8, padding: "0 16px", color: COLORS.bg, cursor: "pointer" }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* PRAYER REQUEST */}
      {!loading && tab === "prayer" && (
        <div style={{ width: "100%" }}>
          <div style={{ background: COLORS.card, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 14 }}>
              Tied to your anonymous ID (never your name) so you can check its status. Goes straight to the prayer sub-unit.
            </p>
            {!prayerSubmitted ? (
              <>
                <textarea
                  placeholder="What would you like prayer for?"
                  value={prayerText}
                  onChange={(e) => setPrayerText(e.target.value)}
                  rows={4}
                  style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13, marginBottom: 14, resize: "vertical" }}
                />
                <button
                  onClick={submitPrayer}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: COLORS.prayer, color: COLORS.bg, border: "none", borderRadius: 10, padding: "12px 0", fontFamily: "Sora", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                >
                  <HandHeart size={16} /> Send prayer request
                </button>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.success, fontSize: 14 }}>
                <CheckCircle2 size={16} /> Received. The prayer team has it.
              </div>
            )}
          </div>

          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>My prayer requests</div>
          {myPrayers.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 13 }}>None yet.</p>}
          {[...myPrayers].reverse().slice(0, myPrayerLimit).map((p) => (
            <div key={p.ts} style={{ background: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{p.text}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: COLORS.creamDim }}>{new Date(p.ts).toLocaleString()}</span>
                <span style={{ fontSize: 12, color: p.prayed ? COLORS.prayer : COLORS.creamDim }}>{p.prayed ? "Prayed 🙏" : "Awaiting"}</span>
              </div>
            </div>
          ))}
          {myPrayerLimit < myPrayers.length && (
            <button onClick={() => setMyPrayerLimit((n) => n + 10)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
              Load 10 more
            </button>
          )}
        </div>
      )}

      {/* MY JOURNEY */}
      {!loading && tab === "history" && (
        <div style={{ width: "100%" }}>
          {history.length === 0 && <p style={{ color: COLORS.creamDim, fontSize: 14 }}>No check-ins yet. Your first one will show up here.</p>}
          {history.length > 0 && (
            <p style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 12 }}>
              Showing your most recent {Math.min(historyLimit, history.length)} of {history.length} check-ins.
            </p>
          )}
          {[...history].reverse().slice(0, historyLimit).map((h, i) => (
            <div key={i} style={{ background: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: COLORS.creamDim, marginBottom: 6 }}>
                {new Date(h.ts).toLocaleString()}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: COLORS.spirit }}>Spirit {h.spirit}</span>
                <span style={{ color: COLORS.soul }}>Soul {h.soul}</span>
                <span style={{ color: COLORS.body }}>Body {h.body}</span>
                {h.urgent && <span style={{ color: COLORS.danger }}>● flagged urgent</span>}
              </div>
              {h.note && <div style={{ fontSize: 13, color: COLORS.creamDim, marginTop: 8 }}>{h.note}</div>}
            </div>
          ))}
          {historyLimit < history.length && (
            <button
              onClick={() => setHistoryLimit((n) => n + 30)}
              style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}
            >
              Load 30 more
            </button>
          )}
        </div>
      )}

    </div>
  );
}
