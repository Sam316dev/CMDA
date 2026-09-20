import { useState, useEffect, useMemo } from "react";
import {
  Heart, Brain, Activity, AlertCircle, Send, Users, Clock, CheckCircle2,
  ArrowLeft, MessageCircle, HandHeart, Handshake,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "./supabaseClient";

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
  amber: "#E8B84B",
  border: "rgba(246,241,231,0.12)",
};

const CLASS_OPTIONS = [
  { value: "200L MBBS", label: "200L Medical" },
  { value: "200L BDS", label: "200L Dental" },
  { value: "300L MBBS", label: "300L Medical" },
  { value: "300L BDS", label: "300L Dental" },
  { value: "400L MBBS", label: "400L Medical" },
  { value: "400L BDS", label: "400L Dental" },
  { value: "500L MBBS", label: "500L Medical" },
  { value: "500L BDS", label: "500L Dental" },
  { value: "600L MBBS", label: "600L Medical" },
  { value: "600L BDS", label: "600L Dental" }
];
const ALL_CLASSES_OPTION = { value: "all", label: "All classes" };

const EXAM_TYPE_OPTIONS = [
  { value: "in-course", label: "In-course" },
  { value: "professional", label: "Professional exams" },
  { value: "eop", label: "End-of-Posting" },
];

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

const createSectionState = (index) => ({
  name: `Section ${index + 1}`,
  rawScores: "",
  maxScore: "100",
});

const parseScoreTokens = (raw) => raw
  .split(/[\n,]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const analyzeScoreInput = (raw, maxScore) => {
  const tokens = parseScoreTokens(raw);
  const validScores = [];
  let invalidCount = 0;
  tokens.forEach((token) => {
    const value = Number(token);
    if (!Number.isFinite(value) || value < 0 || value > maxScore) {
      invalidCount += 1;
      return;
    }
    validScores.push(value);
  });
  return { validScores, tokenCount: tokens.length, invalidCount };
};

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

// Supabase-backed storage. The `shared` parameter is kept (unused) so every existing
// call site (safeGet(key), safeGet(key, true), etc.) still works without changes —
// there's no real per-user "personal" scope on Supabase, since that isolation was a
// Claude-environment-specific feature. Anything genuinely personal (the anonymous ID
// itself) now lives in the browser's own localStorage instead — see getOrCreateAnonId().
async function safeGet(key) {
  try {
    const { data, error } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  } catch {
    return null;
  }
}
async function safeSet(key, value) {
  try {
    const { error } = await supabase.from("kv_store").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}
async function safeDelete(key) {
  try {
    const { error } = await supabase.from("kv_store").delete().eq("key", key);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

// The anonymous ID is generated once per browser and stored in localStorage directly —
// synchronous, no network round-trip, and genuinely isolated per device (unlike a
// key-value row in a shared database, which every visitor would otherwise collide on).
function getOrCreateAnonId() {
  try {
    let id = window.localStorage.getItem("wholeman-anon-id");
    if (!id) {
      id = genAnonId();
      window.localStorage.setItem("wholeman-anon-id", id);
    }
    return id;
  } catch {
    // localStorage unavailable (e.g. private browsing edge cases) — fall back to a
    // session-only ID rather than crashing; it just won't persist across reloads.
    return genAnonId();
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
  const [chatThreadsMap, setChatThreadsMap] = useState({});
  const [responderReply, setResponderReply] = useState("");
  const [clearChatConfirm, setClearChatConfirm] = useState(false);

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

  // forgot-PIN recovery — the actual key now lives hashed in Supabase, checked
  // by reset_staff_pins(). Nothing secret is stored in this file anymore.
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

  // hidden staff access (no visible login, no separate app) — separate roles.
  // PINs are no longer stored or checked in this file at all — that check now
  // happens inside Supabase itself (see verify_staff_pin in security_hardening.sql).
  // unlockedPin holds the PIN just used to get in, kept only in memory for this
  // session, so change_staff_pin can prove "yes, I already know the old one."
  const [unlockedPin, setUnlockedPin] = useState("");
  const [headerTaps, setHeaderTaps] = useState(0);
  const [pinPromptOpen, setPinPromptOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [adminRole, setAdminRole] = useState(null); // null | "welfare" | "prayer" | "classrep" | "academicsec"
  const [pinError, setPinError] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [academicScores, setAcademicScores] = useState([]);
  const [classRepClassId, setClassRepClassId] = useState(CLASS_OPTIONS[0].value);
  const [classRepExamType, setClassRepExamType] = useState(EXAM_TYPE_OPTIONS[0].value);
  const [classRepLabel, setClassRepLabel] = useState("");
  const [classRepHasMultipleSections, setClassRepHasMultipleSections] = useState(false);
  const [classRepSectionCount, setClassRepSectionCount] = useState(1);
  const [classRepUseSharedMax, setClassRepUseSharedMax] = useState(true);
  const [classRepSharedMaxScore, setClassRepSharedMaxScore] = useState("100");
  const [classRepThresholdPercent, setClassRepThresholdPercent] = useState("50");
  const [classRepSections, setClassRepSections] = useState([createSectionState(0)]);
  const [classRepSubmitting, setClassRepSubmitting] = useState(false);
  const [classRepMessage, setClassRepMessage] = useState({ type: null, text: "" });
  const [academicFilterClassId, setAcademicFilterClassId] = useState(ALL_CLASSES_OPTION.value);
  const [academicDeleteBusyId, setAcademicDeleteBusyId] = useState(null);
  const [academicError, setAcademicError] = useState("");

  const handleHeaderTap = () => {
    const next = headerTaps + 1;
    setHeaderTaps(next);
    if (next >= 5) {
      // check for an existing lockout before showing the prompt
      const savedLock = Number(window.localStorage.getItem("wm-pin-lock-until") || 0);
      if (savedLock > Date.now()) setLockedUntil(savedLock);
      setPinPromptOpen(true);
      setHeaderTaps(0);
    } else {
      setTimeout(() => setHeaderTaps((n) => (n === next ? 0 : n)), 1500);
    }
  };

  // tick the lockout countdown once a second while it's active
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining === 0) setLockedUntil(0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const submitPin = async () => {
    if (lockedUntil > Date.now()) return;
    setPinChecking(true);
    const { data, error } = await supabase.rpc("verify_staff_pin", { check_pin: pinInput });
    setPinChecking(false);
    if (!error && ["welfare", "prayer", "classrep", "academicsec"].includes(data)) {
      window.localStorage.removeItem("wm-pin-fail-count");
      window.localStorage.removeItem("wm-pin-lock-until");
      setAdminRole(data);
      setUnlockedPin(pinInput);
      setPinPromptOpen(false);
      setPinInput("");
      setPinError(false);
    } else {
      const fails = Number(window.localStorage.getItem("wm-pin-fail-count") || 0) + 1;
      window.localStorage.setItem("wm-pin-fail-count", String(fails));
      // 1st and 2nd wrong tries: no lockout. 3rd+: escalating cooldown.
      if (fails >= 3) {
        const lockSeconds = Math.min(15 * Math.pow(2, fails - 3), 600); // 15s, 30s, 60s ... capped at 10 min
        const until = Date.now() + lockSeconds * 1000;
        window.localStorage.setItem("wm-pin-lock-until", String(until));
        setLockedUntil(until);
      }
      setPinError(true);
      setPinInput("");
    }
  };

  const savePin = async () => {
    if (!newPin.trim() || !adminRole) return;
    const { data, error } = await supabase.rpc("change_staff_pin", {
      role_name: adminRole,
      old_pin: unlockedPin,
      new_pin: newPin.trim(),
    });
    if (!error && data === true) {
      setUnlockedPin(newPin.trim());
      setNewPin("");
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  };

  const exitStaffView = () => {
    setAdminRole(null);
    setUnlockedPin("");
  };

  const resetPins = async () => {
    const { data, error } = await supabase.rpc("reset_staff_pins", { supplied_key: masterKeyInput.trim() });
    if (!error && data === true) {
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
      const id = getOrCreateAnonId();
      setAnonId(id);
      const h = await safeGet(`checkins:${id}`);
      setHistory(h || []);
      const chat = await safeGet(`chat:${id}`, true);
      setChatMessages(chat || []);
      const seen = await safeGet(`chat-lastseen:${id}`);
      setLastSeen(seen || 0);
      const prayers = (await safeGet("prayer-requests", true)) || [];
      setMyPrayers(prayers.filter((p) => p.id === id));
      setLoading(false);
    })();
  }, []);

  const ARCHIVE_DAYS = 60;
  const isOld = (ts) => Date.now() - ts > ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
  const loadDashboard = async () => {
    setDashLoading(true);

    if (adminRole === "welfare") {
      const { data, error } = await supabase.rpc("get_welfare_data", { check_pin: unlockedPin });
      const rows = !error && data ? data : [];
      const byKey = {};
      rows.forEach((r) => { byKey[r.key] = r.value; });

      const list = byKey["wholeman-shared-log"] || [];
      setShared(list);

      // meet-up requests: auto-archive only if already resolved AND old — never touch open ones
      const mrRaw = byKey["meet-requests"] || [];
      const mrPruned = mrRaw.filter((m) => !(m.resolved && isOld(m.ts)));
      if (mrPruned.length !== mrRaw.length) await safeSet("meet-requests", mrPruned, true);
      setMeetRequests(mrPruned);

      // chats: auto-archive only threads that have been answered (no reply needed) AND old — never touch ones awaiting reply
      const ciRaw = byKey["chat-index"] || [];
      const ciPruned = ciRaw.filter((t) => !(!t.needsResponse && isOld(t.lastTs)));
      const archivedChatIds = ciRaw.filter((t) => !t.needsResponse && isOld(t.lastTs)).map((t) => t.id);
      if (ciPruned.length !== ciRaw.length) {
        await safeSet("chat-index", ciPruned, true);
        for (const id of archivedChatIds) await safeDelete(`chat:${id}`, true);
      }
      setChatIndex(ciPruned);

      // every chat thread came back in the same gated call — keep them in a lookup
      // so opening a thread is instant and doesn't need a second request
      const threadsMap = {};
      Object.keys(byKey).forEach((k) => {
        if (k.startsWith("chat:")) threadsMap[k.slice(5)] = byKey[k] || [];
      });
      setChatThreadsMap(threadsMap);
    }

    if (adminRole === "prayer") {
      const { data, error } = await supabase.rpc("get_prayer_data", { check_pin: unlockedPin });
      const rows = !error && data ? data : [];
      const byKey = {};
      rows.forEach((r) => { byKey[r.key] = r.value; });

      // prayer requests: auto-archive only if already prayed over AND old — never touch unprayed ones
      const prRaw = byKey["prayer-requests"] || [];
      const prPruned = prRaw.filter((p) => !(p.prayed && isOld(p.ts)));
      if (prPruned.length !== prRaw.length) await safeSet("prayer-requests", prPruned, true);
      setPrayerRequests(prPruned);
    }

    if (adminRole === "classrep") {
      setClassRepMessage({ type: null, text: "" });
    }

    if (adminRole === "academicsec") {
      const { data, error } = await supabase.rpc("get_academic_data", { check_pin: unlockedPin });
      if (error) {
        setAcademicError(error.message || "Failed to load academic data.");
        console.error("get_academic_data failed", error);
      } else {
        setAcademicError("");
      }
      const rows = !error && data ? data : [];
      const normalized = rows.map((row) => ({
        ...row,
        average: Number(row.average),
        count_below_50: Number(row.count_below_50),
        max_score: Number.isFinite(Number(row.max_score)) && Number(row.max_score) > 0 ? Number(row.max_score) : 100,
        threshold_percent: Number.isFinite(Number(row.threshold_percent)) ? Number(row.threshold_percent) : 50,
        count_below_threshold: Number.isFinite(Number(row.count_below_threshold))
          ? Number(row.count_below_threshold)
          : Number(row.count_below_50),
        section_name: row.section_name || "Section",
        section_order: Number.isFinite(Number(row.section_order)) ? Number(row.section_order) : 1,
        section_count: Number.isFinite(Number(row.section_count)) ? Number(row.section_count) : 1,
        submission_group_id: row.submission_group_id || `legacy-${row.id}`,
      }));
      setAcademicScores(normalized);
    }

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
    const desiredCount = classRepHasMultipleSections ? classRepSectionCount : 1;
    setClassRepSections((prev) => {
      const next = [...prev];
      while (next.length < desiredCount) next.push(createSectionState(next.length));
      return next.slice(0, desiredCount).map((section, index) => ({
        ...section,
        name: section.name || `Section ${index + 1}`,
      }));
    });
  }, [classRepHasMultipleSections, classRepSectionCount]);

  useEffect(() => {
    if (adminRole !== "academicsec") return;
    const pollId = setInterval(() => {
      loadDashboard();
    }, 20000);
    return () => clearInterval(pollId);
  }, [adminRole, unlockedPin]);

  const classRepSectionStats = useMemo(() => classRepSections.map((section) => {
    const maxScore = classRepUseSharedMax ? Number(classRepSharedMaxScore) : Number(section.maxScore);
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      return { validScores: [], tokenCount: 0, invalidCount: 0, maxScore: null };
    }
    const parsed = analyzeScoreInput(section.rawScores, maxScore);
    return { ...parsed, maxScore };
  }), [classRepSections, classRepUseSharedMax, classRepSharedMaxScore]);

  const submitClassScores = async () => {
    if (!classRepLabel.trim()) {
      setClassRepMessage({ type: "error", text: "Enter a course or posting label." });
      return;
    }
    const thresholdPercent = Number(classRepThresholdPercent);
    if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
      setClassRepMessage({ type: "error", text: "Threshold must be between 0 and 100%." });
      return;
    }
    const sectionErrors = classRepSections.map((section, index) => {
      if (!section.name.trim()) return `Give section ${index + 1} a name.`;
      if (!classRepSectionStats[index].maxScore) return `Enter a valid maximum score for section ${index + 1}.`;
      if (classRepSectionStats[index].validScores.length === 0) return `Enter at least one valid score for section ${index + 1}.`;
      return null;
    }).filter(Boolean);
    if (sectionErrors.length > 0) {
      setClassRepMessage({ type: "error", text: sectionErrors[0] });
      return;
    }
    const submissionGroupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setClassRepSubmitting(true);
    let failed = false;
    const sectionSummaries = [];
    for (let i = 0; i < classRepSections.length; i++) {
      const section = classRepSections[i];
      const stats = classRepSectionStats[i];
      const average = stats.validScores.reduce((sum, n) => sum + n, 0) / stats.validScores.length;
      const thresholdScore = (thresholdPercent / 100) * stats.maxScore;
      const countBelowThreshold = stats.validScores.filter((n) => n < thresholdScore).length;
      sectionSummaries.push(
        `${section.name.trim()}: ${average.toFixed(2)} / ${stats.maxScore} (${((average / stats.maxScore) * 100).toFixed(1)}%), below ${thresholdPercent.toFixed(1)}%: ${countBelowThreshold}`
      );
      const { data, error } = await supabase.rpc("submit_class_scores", {
        check_pin: unlockedPin,
        class_id: classRepClassId,
        exam_type: classRepExamType,
        label: classRepLabel.trim(),
        average,
        count_below_50: countBelowThreshold,
        submission_group_id: submissionGroupId,
        section_name: section.name.trim(),
        section_order: i + 1,
        section_count: classRepSections.length,
        max_score: stats.maxScore,
        threshold_percent: thresholdPercent,
        threshold_score: thresholdScore,
        count_below_threshold: countBelowThreshold,
      });
      if (error || data !== true) {
        failed = true;
        console.error("submit_class_scores failed", { error, data, section: i + 1 });
        break;
      }
    }
    setClassRepSubmitting(false);
    if (!failed) {
      setClassRepMessage({
        type: "success",
        text: `Saved ${classRepSections.length} section${classRepSections.length > 1 ? "s" : ""}. ${sectionSummaries.join(" | ")}`,
      });
      return;
    }
    setClassRepMessage({ type: "error", text: "Submission failed. Check your PIN access and try again." });
  };

  const deleteAcademicScore = async (scoreId) => {
    setAcademicDeleteBusyId(scoreId);
    const { data, error } = await supabase.rpc("delete_academic_score", {
      check_pin: unlockedPin,
      score_id: scoreId,
    });
    setAcademicDeleteBusyId(null);
    if (!error && data === true) {
      setAcademicScores((prev) => prev.filter((row) => row.id !== scoreId));
      return;
    }
    if (error) {
      setAcademicError(error.message || "Failed to delete entry.");
      console.error("delete_academic_score failed", error);
    }
  };

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

  // --- daily check-in limit ---
  const todayKey = new Date().toDateString();
  const alreadyCheckedInToday = useMemo(
    () => history.some((h) => new Date(h.ts).toDateString() === todayKey),
    [history, todayKey]
  );
  const todaysEntry = useMemo(
    () => [...history].reverse().find((h) => new Date(h.ts).toDateString() === todayKey),
    [history, todayKey]
  );

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
  const openChatThread = (id) => {
    setActiveChatId(id);
    setActiveChatMessages(chatThreadsMap[id] || []);
  };

  const sendResponderMessage = async () => {
    if (!responderReply.trim() || !activeChatId) return;
    const msg = { from: "responder", text: responderReply.trim(), ts: Date.now() };
    const updated = [...activeChatMessages, msg];
    setActiveChatMessages(updated);
    await safeSet(`chat:${activeChatId}`, updated, true);
    setChatThreadsMap((prev) => ({ ...prev, [activeChatId]: updated }));

    const idx = (await safeGet("chat-index", true)) || [];
    const newIdx = idx.map((t) => (t.id === activeChatId ? { ...t, lastTs: msg.ts, lastPreview: msg.text.slice(0, 60), needsResponse: false } : t));
    await safeSet("chat-index", newIdx, true);
    setChatIndex(newIdx);
    setResponderReply("");
  };

  // welfare team: delete a thread entirely
  const deleteChatThread = async (id) => {
    const idx = (await safeGet("chat-index", true)) || [];
    const newIdx = idx.filter((t) => t.id !== id);
    await safeSet("chat-index", newIdx, true);
    await safeDelete(`chat:${id}`, true);
    setChatIndex(newIdx);
    if (activeChatId === id) {
      setActiveChatId(null);
      setActiveChatMessages([]);
    }
  };

  // student: clear my own chat history
  const deleteMyChat = async () => {
    await safeDelete(`chat:${anonId}`, true);
    setChatMessages([]);
    const idx = (await safeGet("chat-index", true)) || [];
    const newIdx = idx.filter((t) => t.id !== anonId);
    await safeSet("chat-index", newIdx, true);
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

  const deleteMeetRequest = async (ts) => {
    const updated = meetRequests.filter((m) => m.ts !== ts);
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

  const deletePrayerRequest = async (ts, id) => {
    const updated = prayerRequests.filter((p) => !(p.ts === ts && p.id === id));
    setPrayerRequests(updated);
    await safeSet("prayer-requests", updated, true);
    if (id === anonId) setMyPrayers((prev) => prev.filter((p) => p.ts !== ts));
  };

  // student: delete one of my own prayer requests
  const deleteMyPrayer = async (ts) => {
    const list = (await safeGet("prayer-requests", true)) || [];
    const updated = list.filter((p) => !(p.ts === ts && p.id === anonId));
    await safeSet("prayer-requests", updated, true);
    setMyPrayers((prev) => prev.filter((p) => p.ts !== ts));
  };

  const dashStats = useMemo(() => {
    if (shared.length === 0) return null;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentShared = shared.filter((e) => e.ts >= sevenDaysAgo);
    const byDay = {};
    recentShared.forEach((e) => {
      const d = new Date(e.ts);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!byDay[dayStart]) byDay[dayStart] = { day: label, sortKey: dayStart, thriving: 0, gettingBy: 0, struggling: 0 };
      const avg = (e.spirit + e.soul + e.body) / 3;
      if (avg >= 4) byDay[dayStart].thriving += 1;
      else if (avg >= 2.5) byDay[dayStart].gettingBy += 1;
      else byDay[dayStart].struggling += 1;
    });
    const wellbeingBands = Object.values(byDay).sort((a, b) => a.sortKey - b.sortKey);
    const urgentOpen = shared.filter((e) => e.urgent || e.spirit <= 2 || e.soul <= 2 || e.body <= 2).filter((e) => !e.resolved);
    const uniqueStudents = new Set(shared.map((e) => e.id)).size;
    return { wellbeingBands, urgentOpen, total: shared.length, uniqueStudents };
  }, [shared]);

  // --- weekly review (welfare side): rolling 7-day window, compared to the 7 days before that ---
  const weeklyReview = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekStart = now - 7 * oneDay;
    const lastWeekStart = now - 14 * oneDay;

    const thisWeekCheckins = shared.filter((e) => e.ts >= thisWeekStart);
    const lastWeekCheckins = shared.filter((e) => e.ts >= lastWeekStart && e.ts < thisWeekStart);

    const bandCounts = (list) => {
      const bands = { thriving: 0, gettingBy: 0, struggling: 0 };
      list.forEach((e) => {
        const avg = (e.spirit + e.soul + e.body) / 3;
        if (avg >= 4) bands.thriving += 1;
        else if (avg >= 2.5) bands.gettingBy += 1;
        else bands.struggling += 1;
      });
      return bands;
    };

    const thisBands = bandCounts(thisWeekCheckins);
    const lastBands = bandCounts(lastWeekCheckins);

    const thisUnique = new Set(thisWeekCheckins.map((e) => e.id)).size;
    const lastUnique = new Set(lastWeekCheckins.map((e) => e.id)).size;

    const thisUrgent = thisWeekCheckins.filter((e) => e.urgent || e.spirit <= 2 || e.soul <= 2 || e.body <= 2);
    const thisUrgentResolved = thisUrgent.filter((e) => e.resolved).length;
    const thisUrgentOpen = thisUrgent.length - thisUrgentResolved;

    const thisChats = chatIndex.filter((t) => t.lastTs >= thisWeekStart);
    const thisChatsAnswered = thisChats.filter((t) => !t.needsResponse).length;
    const thisChatsOpen = thisChats.length - thisChatsAnswered;

    // one plain sentence at the top, built from the numbers above
    let summary;
    if (thisWeekCheckins.length === 0) {
      summary = "No check-ins recorded this week yet.";
    } else if (thisUrgentOpen > 0) {
      summary = `${thisUrgentOpen} ${thisUrgentOpen === 1 ? "student is" : "students are"} still waiting on follow-up from this week.`;
    } else if (thisBands.struggling > lastBands.struggling) {
      summary = "More students marked struggling this week than last week.";
    } else {
      summary = "A steady week. Everyone flagged so far has been followed up on.";
    }

    return {
      checkinsThisWeek: thisWeekCheckins.length,
      checkinsLastWeek: lastWeekCheckins.length,
      uniqueThisWeek: thisUnique,
      uniqueLastWeek: lastUnique,
      thisBands,
      lastBands,
      urgentThisWeek: thisUrgent.length,
      urgentResolved: thisUrgentResolved,
      urgentOpen: thisUrgentOpen,
      chatsThisWeek: thisChats.length,
      chatsAnswered: thisChatsAnswered,
      chatsOpen: thisChatsOpen,
      summary,
    };
  }, [shared, chatIndex]);

  // --- weekly review (prayer team's own page): separate, prayer-only data ---
  const prayerWeeklyReview = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const thisWeekStart = now - 7 * oneDay;
    const lastWeekStart = now - 14 * oneDay;

    const thisWeek = prayerRequests.filter((p) => p.ts >= thisWeekStart);
    const lastWeek = prayerRequests.filter((p) => p.ts >= lastWeekStart && p.ts < thisWeekStart);
    const thisAnswered = thisWeek.filter((p) => p.prayed).length;
    const thisOpen = thisWeek.length - thisAnswered;

    let summary;
    if (thisWeek.length === 0) {
      summary = "No prayer requests recorded this week yet.";
    } else if (thisOpen > 0) {
      summary = `${thisOpen} prayer ${thisOpen === 1 ? "request is" : "requests are"} still awaiting prayer from this week.`;
    } else {
      summary = "Every prayer request this week has been prayed over.";
    }

    return {
      requestsThisWeek: thisWeek.length,
      requestsLastWeek: lastWeek.length,
      answered: thisAnswered,
      open: thisOpen,
      summary,
    };
  }, [prayerRequests]);

  const academicFilterOptions = useMemo(() => {
    const known = new Set(CLASS_OPTIONS.map((option) => option.value));
    const legacy = [...new Set(academicScores.map((row) => row.class_id).filter((value) => value && !known.has(value)))];
    return [
      ALL_CLASSES_OPTION,
      ...CLASS_OPTIONS,
      ...legacy.map((value) => ({ value, label: `${value} (legacy)` })),
    ];
  }, [academicScores]);

  const academicScoresForClass = useMemo(() => academicScores
    .filter((row) => academicFilterClassId === ALL_CLASSES_OPTION.value || row.class_id === academicFilterClassId)
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()), [academicScores, academicFilterClassId]);


  const academicGroups = useMemo(() => {
    const grouped = {};
    academicScoresForClass.forEach((row) => {
      const key = row.submission_group_id || `legacy-${row.id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });
    return Object.values(grouped).map((rows) => [...rows].sort((a, b) => a.section_order - b.section_order));
  }, [academicScoresForClass]);

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

  if (adminRole === "classrep") {
    return (
      <div style={shellStyle}>
        <style>{FONT_IMPORT}</style>
        {adminHeader("Class representative")}

        <div style={{ width: "100%", maxWidth: 760 }}>
          <div style={{ background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 18 }}>
            <p style={{ fontSize: 13, color: COLORS.creamDim, marginTop: 0, marginBottom: 14 }}>
              Enter scores, then submit. Raw scores stay in this browser; only section aggregates are sent.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <select
                value={classRepClassId}
                onChange={(e) => setClassRepClassId(e.target.value)}
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
              >
                {CLASS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={classRepExamType}
                onChange={(e) => setClassRepExamType(e.target.value)}
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
              >
                {EXAM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: COLORS.creamDim }}>
                <input
                  type="radio"
                  checked={!classRepHasMultipleSections}
                  onChange={() => {
                    setClassRepHasMultipleSections(false);
                    setClassRepSectionCount(1);
                  }}
                />
                One section
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: COLORS.creamDim }}>
                <input
                  type="radio"
                  checked={classRepHasMultipleSections}
                  onChange={() => setClassRepHasMultipleSections(true)}
                />
                Multiple sections
              </label>
              {classRepHasMultipleSections && (
                <select
                  value={classRepSectionCount}
                  onChange={(e) => setClassRepSectionCount(Number(e.target.value))}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: "6px 8px", fontSize: 12 }}
                >
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} sections</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: COLORS.creamDim }}>
                <input
                  type="checkbox"
                  checked={classRepUseSharedMax}
                  onChange={(e) => setClassRepUseSharedMax(e.target.checked)}
                />
                Use one maximum score for all sections
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={classRepThresholdPercent}
                onChange={(e) => setClassRepThresholdPercent(e.target.value)}
                placeholder="Threshold (%)"
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
              />
            </div>
            {classRepUseSharedMax && (
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={classRepSharedMaxScore}
                onChange={(e) => setClassRepSharedMaxScore(e.target.value)}
                placeholder="Maximum obtainable score"
                style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13, marginBottom: 10 }}
              />
            )}
            <input
              value={classRepLabel}
              onChange={(e) => setClassRepLabel(e.target.value)}
              placeholder="Course or posting label"
              style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13, marginBottom: 10 }}
            />
            {classRepSections.map((section, index) => {
              const stats = classRepSectionStats[index] || { validScores: [], invalidCount: 0 };
              const computedMax = classRepUseSharedMax ? Number(classRepSharedMaxScore) : Number(section.maxScore);
              const thresholdPercent = Number(classRepThresholdPercent);
              const thresholdScore = Number.isFinite(computedMax) && Number.isFinite(thresholdPercent)
                ? (thresholdPercent / 100) * computedMax
                : null;
              return (
                <div key={`section-${index}`} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 8 }}>
                    <input
                      value={section.name}
                      onChange={(e) => setClassRepSections((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                      placeholder={`Section ${index + 1} name`}
                      style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
                    />
                    {!classRepUseSharedMax && (
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={section.maxScore}
                        onChange={(e) => setClassRepSections((prev) => prev.map((item, i) => i === index ? { ...item, maxScore: e.target.value } : item))}
                        placeholder="Maximum obtainable score"
                        style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13 }}
                      />
                    )}
                  </div>
                  <textarea
                    value={section.rawScores}
                    onChange={(e) => setClassRepSections((prev) => prev.map((item, i) => i === index ? { ...item, rawScores: e.target.value } : item))}
                    placeholder="Paste scores separated by commas or new lines"
                    rows={6}
                    style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 10, fontSize: 13, marginBottom: 8, resize: "vertical" }}
                  />
                  <div style={{ fontSize: 12, color: COLORS.creamDim }}>
                    Valid scores: {stats.validScores.length}
                    {stats.invalidCount > 0 ? ` · Ignored invalid/out-of-range entries: ${stats.invalidCount}` : ""}
                    {thresholdScore !== null && Number.isFinite(thresholdScore) ? ` · Below ${Number(classRepThresholdPercent || 0).toFixed(1)}% means below ${thresholdScore.toFixed(2)} / ${Number(computedMax || 0).toFixed(2)}` : ""}
                  </div>
                </div>
              );
            })}
            {classRepMessage.type && (
              <p style={{ color: classRepMessage.type === "success" ? COLORS.success : COLORS.danger, fontSize: 12, margin: "0 0 10px" }}>
                {classRepMessage.text}
              </p>
            )}
            <button
              onClick={submitClassScores}
              disabled={classRepSubmitting}
              style={{ width: "100%", background: COLORS.soul, color: COLORS.bg, border: "none", borderRadius: 8, padding: "10px 0", fontFamily: "Sora", fontWeight: 700, fontSize: 13, cursor: classRepSubmitting ? "default" : "pointer", opacity: classRepSubmitting ? 0.7 : 1 }}
            >
              {classRepSubmitting ? "Submitting…" : "Submit class scores"}
            </button>
          </div>
        </div>

        {pinChanger}
      </div>
    );
  }

  if (adminRole === "academicsec") {
    return (
      <div style={shellStyle}>
        <style>{FONT_IMPORT}</style>
        {adminHeader("Academic secretary")}

        {dashLoading && <div style={{ color: COLORS.creamDim }}>Loading…</div>}
        {!dashLoading && (
          <div style={{ width: "100%" }}>
            <div style={{ background: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <select
                  value={academicFilterClassId}
                  onChange={(e) => setAcademicFilterClassId(e.target.value)}
                  style={{ width: isMobile ? "100%" : 260, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.cream, padding: 9, fontSize: 13 }}
                >
                  {academicFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={loadDashboard}
                  style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.cream, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}
                >
                  Refresh
                </button>
              </div>

              {academicError && <p style={{ color: COLORS.danger, fontSize: 12, marginTop: 0 }}>{academicError}</p>}

            {[...academicGroups].reverse().map((groupRows) => {
              const groupHead = groupRows[0];
              return (
                <div key={groupHead.submission_group_id || groupHead.id} style={{ background: COLORS.card, borderRadius: 10, padding: 12, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13 }}>{groupHead.label}</div>
                  <div style={{ fontSize: 12, color: COLORS.creamDim, marginBottom: 8 }}>
                    {groupHead.class_id} · {groupHead.exam_type} · {new Date(groupHead.submitted_at).toLocaleString()} · {groupRows.length} section{groupRows.length > 1 ? "s" : ""}
                  </div>
                  {groupRows.map((row) => {
                    const averagePercent = row.max_score > 0 ? (row.average / row.max_score) * 100 : 0;
                    return (
                      <div key={row.id} style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 12, color: COLORS.cream }}>{row.section_name}</div>
                          <div style={{ fontSize: 12, color: COLORS.creamDim }}>
                            Avg {Number(row.average).toFixed(2)} / {Number(row.max_score).toFixed(2)} ({averagePercent.toFixed(1)}%) · Below {Number(row.threshold_percent).toFixed(1)}%: {row.count_below_threshold}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteAcademicScore(row.id)}
                          disabled={academicDeleteBusyId === row.id}
                          style={{ background: "transparent", border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: academicDeleteBusyId === row.id ? "default" : "pointer", opacity: academicDeleteBusyId === row.id ? 0.7 : 1 }}
                        >
                          {academicDeleteBusyId === row.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {pinChanger}
      </div>
    );
  }

  if (adminRole === "welfare") {
    return (
      <div style={shellStyle}>
        <style>{FONT_IMPORT}</style>
        {adminHeader("Welfare team")}

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {subTabBtn("overview", "Overview")}
          {subTabBtn("thisweek", "This week")}
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
                  <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{dashStats.uniqueStudents}</div>
                    <div style={{ fontSize: 12, color: COLORS.creamDim }}>unique students reached</div>
                  </div>
                  <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.danger}` }}>
                    <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22, color: COLORS.danger }}>{dashStats.urgentOpen.length}</div>
                    <div style={{ fontSize: 12, color: COLORS.creamDim }}>need follow-up</div>
                  </div>
                </div>

                <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 14, marginBottom: 4, color: COLORS.creamDim }}>Community wellbeing, at a glance</div>
                <p style={{ fontSize: 11, color: COLORS.creamDim, marginBottom: 8 }}>
                  Each check-in counted once, by day — <span style={{ color: COLORS.success }}>green = thriving</span>, <span style={{ color: COLORS.amber }}>amber = getting by</span>, <span style={{ color: COLORS.danger }}>red = struggling</span>.
                </p>
                <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 22, height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashStats.wellbeingBands}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis dataKey="day" stroke={COLORS.creamDim} fontSize={11} />
                      <YAxis allowDecimals={false} stroke={COLORS.creamDim} fontSize={11} />
                      <Tooltip contentStyle={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "thriving" ? "Thriving" : v === "gettingBy" ? "Getting by" : "Struggling")} />
                      <Bar dataKey="thriving" stackId="wb" fill={COLORS.success} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="gettingBy" stackId="wb" fill={COLORS.amber} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="struggling" stackId="wb" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                    </BarChart>
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

        {!dashLoading && dashView === "thisweek" && (
          <div style={{ width: "100%" }}>
            <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
              <p style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, margin: 0 }}>{weeklyReview.summary}</p>
              <p style={{ fontSize: 11, color: COLORS.creamDim, marginTop: 6 }}>Last 7 days, compared with the 7 days before that.</p>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
              <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{weeklyReview.checkinsThisWeek}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim }}>check-ins this week ({weeklyReview.checkinsLastWeek} last week)</div>
              </div>
              <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{weeklyReview.uniqueThisWeek}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim }}>students reached ({weeklyReview.uniqueLastWeek} last week)</div>
              </div>
            </div>

            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Wellbeing this week</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
              <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.success}` }}>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 20, color: COLORS.success }}>{weeklyReview.thisBands.thriving}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim }}>thriving</div>
              </div>
              <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.amber}` }}>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 20, color: COLORS.amber }}>{weeklyReview.thisBands.gettingBy}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim }}>getting by</div>
              </div>
              <div style={{ background: COLORS.card, borderRadius: 10, padding: "14px 20px", border: `1px solid ${COLORS.danger}` }}>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 20, color: COLORS.danger }}>{weeklyReview.thisBands.struggling}</div>
                <div style={{ fontSize: 12, color: COLORS.creamDim }}>struggling ({weeklyReview.lastBands.struggling} last week)</div>
              </div>
            </div>

            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Response record this week</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 10, padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13 }}>Urgent check-ins</span>
                <span style={{ fontSize: 13, color: COLORS.creamDim }}>{weeklyReview.urgentResolved} followed up, {weeklyReview.urgentOpen} still open</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: COLORS.card, borderRadius: 10, padding: "10px 16px", border: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13 }}>Anonymous chats</span>
                <span style={{ fontSize: 13, color: COLORS.creamDim }}>{weeklyReview.chatsAnswered} answered, {weeklyReview.chatsOpen} still open</span>
              </div>
            </div>
          </div>
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
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <button
                      onClick={() => deleteChatThread(activeChatId)}
                      style={{ background: "transparent", border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}
                    >
                      Delete thread
                    </button>
                  </div>
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
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {!m.resolved && (
                    <button onClick={() => resolveMeetRequest(m.ts)} style={{ background: "transparent", border: `1px solid ${COLORS.success}`, color: COLORS.success, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                      Mark handled
                    </button>
                  )}
                  <button onClick={() => deleteMeetRequest(m.ts)} style={{ background: "transparent", border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
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
            <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
              <p style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, margin: 0 }}>{prayerWeeklyReview.summary}</p>
              <p style={{ fontSize: 11, color: COLORS.creamDim, marginTop: 6 }}>
                {prayerWeeklyReview.requestsThisWeek} requests this week ({prayerWeeklyReview.requestsLastWeek} last week) · {prayerWeeklyReview.answered} prayed over, {prayerWeeklyReview.open} still awaiting
              </p>
            </div>

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
                  <div style={{ display: "flex", gap: 6 }}>
                    {!p.prayed ? (
                      <button onClick={() => markPrayed(p.ts, p.id)} style={{ background: "transparent", border: `1px solid ${COLORS.prayer}`, color: COLORS.prayer, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                        Mark prayed
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: COLORS.prayer, alignSelf: "center" }}>Prayed 🙏</span>
                    )}
                    <button onClick={() => deletePrayerRequest(p.ts, p.id)} style={{ background: "transparent", border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                      Delete
                    </button>
                  </div>
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
                {pinError && lockCountdown === 0 && <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 10 }}>Incorrect PIN.</p>}
                {lockCountdown > 0 && (
                  <p style={{ color: COLORS.danger, fontSize: 12, marginBottom: 10 }}>
                    Too many wrong tries. Try again in {lockCountdown}s.
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={submitPin}
                    disabled={pinChecking || lockCountdown > 0}
                    style={{ flex: 1, background: COLORS.soul, color: COLORS.bg, border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: pinChecking || lockCountdown > 0 ? "default" : "pointer", opacity: pinChecking || lockCountdown > 0 ? 0.5 : 1 }}
                  >
                    {pinChecking ? "Checking…" : lockCountdown > 0 ? `Wait ${lockCountdown}s` : "Unlock"}
                  </button>
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
      {!loading && tab === "checkin" && !response && alreadyCheckedInToday && (
        <div style={{ width: "100%", background: COLORS.card, borderRadius: 14, padding: isMobile ? 18 : 24, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.success, fontFamily: "Sora", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
            <CheckCircle2 size={17} /> You've already checked in today
          </div>
          <p style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 14 }}>
            One check-in a day keeps this meaningful. Come back tomorrow — here's what you logged today:
          </p>
          {todaysEntry && (
            <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 14 }}>
              <span style={{ color: COLORS.spirit }}>Spirit {todaysEntry.spirit}</span>
              <span style={{ color: COLORS.soul }}>Soul {todaysEntry.soul}</span>
              <span style={{ color: COLORS.body }}>Body {todaysEntry.body}</span>
            </div>
          )}
          <p style={{ fontSize: 12, color: COLORS.creamDim }}>
            Need to talk before then? Use the <strong style={{ color: COLORS.cream }}>Messages</strong> or <strong style={{ color: COLORS.cream }}>Prayer request</strong> tab any time.
          </p>
        </div>
      )}

      {!loading && tab === "checkin" && !response && !alreadyCheckedInToday && (
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            {chatMessages.length > 0 && !clearChatConfirm && (
              <button onClick={() => setClearChatConfirm(true)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                Clear my chat
              </button>
            )}
            {clearChatConfirm && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: COLORS.creamDim }}>Delete this whole conversation?</span>
                <button onClick={() => { deleteMyChat(); setClearChatConfirm(false); }} style={{ background: COLORS.danger, border: "none", color: COLORS.cream, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                  Yes, delete
                </button>
                <button onClick={() => setClearChatConfirm(false)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.creamDim, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
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
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: p.prayed ? COLORS.prayer : COLORS.creamDim }}>{p.prayed ? "Prayed 🙏" : "Awaiting"}</span>
                  <button onClick={() => deleteMyPrayer(p.ts)} style={{ background: "none", border: "none", color: COLORS.creamDim, fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                    delete
                  </button>
                </div>
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
