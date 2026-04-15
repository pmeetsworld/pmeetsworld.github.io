// ── Week Detection ────────────────────────────────────────────────────────────
// Calculates the Monday of the current week automatically.
// Update FORCE_WEEK only if you need to preview a specific week during testing.
const FORCE_WEEK = null; // e.g. '2026-04-20' to force a week, null for auto

function getWeekMonday() {
  const base = FORCE_WEEK ? new Date(FORCE_WEEK + 'T12:00:00') : new Date();
  const day = base.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(base);
  mon.setDate(base.getDate() + diff);
  return mon;
}

function isoWeekKey(date) {
  // Returns YYYY-WNN string to use as the weekly storage key
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const year = d.getFullYear();
  const week = Math.ceil(((d - new Date(year, 0, 1)) / 86400000 + 1) / 7);
  return year + '-W' + String(week).padStart(2, '0');
}

function fmt(date, opts) {
  return date.toLocaleDateString('en-US', opts);
}

// Build the day config for the current week
function buildDayConfig(monday) {
  const COLORS = ['#1E3A5F', '#1A4731', '#5C1A33', '#B84800', '#3A1070'];
  const KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const config = {};
  KEYS.forEach((key, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    config[key] = {
      key,
      color:   COLORS[i],
      dayName: fmt(d, { weekday: 'short' }),
      date:    fmt(d, { month: 'short', day: 'numeric' }),
      label:   fmt(d, { weekday: 'short' }) + ' · ' + fmt(d, { month: 'short', day: 'numeric' }),
    };
  });
  return config;
}

const WEEK_MONDAY = getWeekMonday();
const WEEK_KEY    = isoWeekKey(WEEK_MONDAY);
const DC          = buildDayConfig(WEEK_MONDAY);
const DAYS        = ['mon', 'tue', 'wed', 'thu', 'fri'];

// 90-day close-to-code cutoff — dynamic, always 90 days before today
function get90DayCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

// ── Account type colors ───────────────────────────────────────────────────────
const TC = {
  C: { color: '#1E3A5F', label: 'CHAIN'  },
  I: { color: '#1A4731', label: 'INDY'   },
  O: { color: '#5C1A33', label: 'ON-PREM' },
};

// ── Void state definitions ────────────────────────────────────────────────────
const CV_STATES = [
  { label: 'Open',       bg: '#F7F7F7', fg: '#888',    border: '#DDD',     icon: '○' },
  { label: 'True Void',  bg: '#FFF0F0', fg: '#B71C1C', border: '#FFCDD2',  icon: '✕' },
  { label: 'Not in Set', bg: '#FFF8E1', fg: '#E65100', border: '#FFE082',  icon: '⊘' },
  { label: 'In Account', bg: '#E8F5E9', fg: '#2E7D32', border: '#A5D6A7',  icon: '✓' },
  { label: 'Sold In',    bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9',  icon: '★' },
];
const SU_STATES = [
  { label: 'Open',        bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'Not in Set',  bg: '#FFF8E1', fg: '#E65100', border: '#FFE082', icon: '⊘' },
  { label: 'Slow Mover',  bg: '#F3E5F5', fg: '#6A1B9A', border: '#CE93D8', icon: '~' },
  { label: 'Pitched',     bg: '#E8EAF6', fg: '#283593', border: '#9FA8DA', icon: '◎' },
  { label: 'Sold In',     bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9', icon: '★' },
];
const PL_STATES = [
  { label: 'Open',        bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'Not in Set',  bg: '#FFF8E1', fg: '#E65100', border: '#FFE082', icon: '⊘' },
  { label: 'Pitched',     bg: '#E8EAF6', fg: '#283593', border: '#9FA8DA', icon: '◎' },
  { label: 'POD Placed',  bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9', icon: '★' },
];

const FREQ_LABELS = { W: 'Weekly', EOW: 'Every Other Week', M: 'Monthly' };

// ── Motivational quotes — rotates every 25 minutes ───────────────────────────
const QUOTES = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "Every call is a chance to make someone's business better.",
  "You don't build a business — you build people, and people build the business.",
  "The secret of getting ahead is getting started.",
  "A sale is not something you pursue — it's what happens when you're immersed in serving your customer.",
  "Small progress is still progress. Keep going.",
  "Your attitude determines your direction.",
  "Show up. Suit up. Do the work.",
  "The road to success is always under construction.",
  "Don't watch the clock. Do what it does — keep going.",
  "Opportunities don't happen. You create them.",
  "The best salespeople know their job isn't to sell — it's to help.",
  "Consistency is what transforms average into excellence.",
  "Every no gets you closer to a yes.",
  "You are your own brand. Make it a good one.",
  "Go the extra mile — it's never crowded.",
  "A goal without a plan is just a wish.",
  "Hustle beats talent when talent doesn't hustle.",
  "Make each account feel like your only account.",
  "Details differentiate good reps from great ones.",
  "Win the morning, win the day.",
  "The shelf doesn't fix itself. That's why you're here.",
  "Your presence on the shelf is your brand's voice.",
  "Be so good they can't ignore you.",
  "Every stop is a chance to leave things better than you found them.",
];
function getQuote() {
  const slot = Math.floor(Date.now() / 1000 / 60 / 25);
  return QUOTES[slot % QUOTES.length];
}

// ── Storage — split keys so user data survives app updates ────────────────────
// r508_roster   : account roster (permanent, never auto-wiped)
// r508_persist  : notes, ds, survey, void states (permanent)
// r508_lastweek : previous week's scoreboard archive
// r508_weekly_{WEEK_KEY} : done, scoreboard, active toggles (auto-rotates by week)
const STORAGE_KEYS = {
  ROSTER:   'r508_roster',
  PERSIST:  'r508_persist',
  LASTWEEK: 'r508_lastweek',
  weekly:   () => 'r508_weekly_' + WEEK_KEY,
};

// Called on app load when a new week is detected.
// Scans localStorage for the previous week key and archives the scoreboard.

const storage = {
  get(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
};

function archiveLastWeekIfNeeded() {
  try {
    const prevKey = Object.keys(localStorage)
      .find(k => k.startsWith('r508_weekly_') && k !== STORAGE_KEYS.weekly());
    if (!prevKey) return false;
    const prev = JSON.parse(localStorage.getItem(prevKey));
    if (!prev || !prev.sc) return false;

    const wk = prevKey.replace('r508_weekly_', '');
    const totals = { t: 0, d: 0, p: 0 };
    Object.values(prev.sc).forEach(day => {
      totals.t += day.t || 0;
      totals.d += day.d || 0;
      totals.p += day.p || 0;
    });

    storage.set(STORAGE_KEYS.LASTWEEK, {
      weekKey: wk,
      savedAt: todayStr(),
      sc:      prev.sc,
      totals,
    });

    localStorage.removeItem(prevKey);
    return true; // signals new week was detected
  } catch (e) {
    return false;
  }
}
// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const a = new Date(dateStr + 'T12:00:00');
  const b = new Date(todayStr() + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

function dsLabel(dateStr) {
  const n = daysSince(dateStr);
  if (n === null) return 'Never logged';
  if (n === 0)    return 'Done today';
  if (n === 1)    return 'Yesterday';
  return n + ' days ago';
}

function dsColor(dateStr) {
  const n = daysSince(dateStr);
  if (n === null) return '#999';
  if (n <= 14)    return '#2E7D32';
  if (n < 45)     return '#E65100';
  return '#B71C1C';
}

function dsBg(dateStr) {
  const n = daysSince(dateStr);
  if (n === null) return '#F7F7F7';
  if (n <= 14)    return '#E8F5E9';
  if (n < 45)     return '#FFF3E0';
  return '#FFF0F0';
}

function surveyStatus(doneDate) {
  const now    = new Date(todayStr() + 'T12:00:00');
  const yr     = now.getFullYear();
  const mo     = now.getMonth();
  const dow    = new Date(yr, mo, 1).getDay();
  const firstMon = dow === 1 ? 1 : dow === 0 ? 2 : 9 - dow;
  const deadline = new Date(yr, mo, firstMon + 13);

  if (doneDate) {
    const d = new Date(doneDate + 'T12:00:00');
    if (d.getFullYear() === yr && d.getMonth() === mo)
      return { color: '#2E7D32', bg: '#E8F5E9', label: 'Done ✓' };
  }
  const dlStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (now <= deadline) return { color: '#E65100', bg: '#FFF3E0', label: 'Due by ' + dlStr };
  return { color: '#B71C1C', bg: '#FFF0F0', label: 'Overdue' };
}

// ── Number formatters ─────────────────────────────────────────────────────────
function fmtPct(v)  { return v == null ? '—' : (v >= 0 ? '+' : '') + Math.round(v * 100) + '%'; }
function fmtCE(v)   { return v == null ? '—' : v.toFixed(1); }

// ── State definitions ─────────────────────────────────────────────────────────
const INIT_WEEKLY = {
  weekKey: WEEK_KEY,
  done:    {},
  sc:      { mon:{t:0,d:0,p:0}, tue:{t:0,d:0,p:0}, wed:{t:0,d:0,p:0}, thu:{t:0,d:0,p:0}, fri:{t:0,d:0,p:0} },
  active:  {},
};
const INIT_PERSIST = { notes: {}, ds: {}, survey: {}, vs: {} };

// ── Data lookup ───────────────────────────────────────────────────────────────
function getAcctData(id) {
  for (const d of DAYS) {
    const found = (RDATA[d] || []).find(a => a.num === id);
    if (found) return found;
  }
  return null;
}

function displayName(acct) {
  return (acct.nick && acct.nick.trim()) ? acct.nick.trim() : acct.name;
}

// ── Pre-Call Helper ───────────────────────────────────────────────────────────
function genHelper(acct, data) {
  if (!data) return ['No performance data available. Focus on standard call objectives.'];
  const msgs = [];
  const { p, bv, t } = data;
  const cutoff = get90DayCutoff();

  if (p && p[1] != null) {
    const mp = p[2];
    if (mp != null && Math.abs(mp) > 0.05) {
      if      (mp < -0.3) msgs.push('⚠ MTD down ' + fmtPct(mp) + ' vs last year — significant drop. Understand what changed before pitching anything new.');
      else if (mp < -0.1) msgs.push('MTD down ' + fmtPct(mp) + '. Worth a quick conversation about what\'s driving the dip.');
      else if (mp >  0.3) msgs.push('MTD up ' + fmtPct(mp) + ' — strong month. Look for ways to press the advantage.');
      else if (mp >  0.1) msgs.push('MTD up ' + fmtPct(mp) + '. Things are trending the right direction.');
    }
  }

  if (bv) {
    const [diff, pctVal] = bv;
    if (diff < 0) {
      if      (pctVal < -25) msgs.push('⚠ YTD down ' + pctVal + '% (' + diff + ' CE) — significant annual loss. Priority account to diagnose and recover.');
      else if (pctVal < -10) msgs.push('YTD down ' + pctVal + '% (' + diff + ' CE). Has been trending wrong — understand why before pitching.');
      else                   msgs.push('YTD slightly down ' + pctVal + '% (' + diff + ' CE). Keep an eye on this one.');
    } else if (diff > 0) {
      if      (pctVal > 30) msgs.push('YTD up ' + pctVal + '% (+' + diff + ' CE) — one of your best-growing accounts. Protect what\'s working.');
      else if (pctVal > 10) msgs.push('YTD up ' + pctVal + '% (+' + diff + ' CE) — solid growth. Good account to invest time in.');
      else                  msgs.push('YTD up ' + pctVal + '% (+' + diff + ' CE). Positive trend.');
    }
  }

  const cv = [...(data.ca || []), ...(data.cn || [])];

  if (t === 'C') {
    if (cv.length) {
      const old = cv.filter(v => v.d && v.d < cutoff);
      msgs.push('📋 ' + cv.length + ' planogram item' + (cv.length > 1 ? 's' : '') + ' showing as void. Verify each is on shelf and correctly tagged.' +
        (old.length ? ' ' + old.length + ' haven\'t been purchased in 90+ days — check for close-to-code stock.' : ''));
    } else {
      msgs.push('No open chain mod voids. Verify shelf looks clean and tags match.');
    }
    if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' Scale Up item' + (data.su.length > 1 ? 's' : '') + ' — verify planogram eligibility before pitching.');
    if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch POD' + (data.pl.length > 1 ? 's' : '') + ' — confirm set eligibility first.');
  } else if (t === 'I') {
    if (cv.length) {
      const old = cv.filter(v => v.d && v.d < cutoff);
      msgs.push('📋 ' + cv.length + ' void' + (cv.length > 1 ? 's' : '') + ' to verify.' +
        (old.length ? ' ' + old.length + ' SKU' + (old.length > 1 ? 's' : '') + ' 90+ days out — inspect for close-to-code.' : ''));
    }
    if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' Scale Up opportunit' + (data.su.length > 1 ? 'ies' : 'y') + ' — good sell-in conversation starter.');
    if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch item' + (data.pl.length > 1 ? 's' : '') + ' — new products, each one is a POD counter opportunity.');
    if (!cv.length && !(data.su && data.su.length) && !(data.pl && data.pl.length))
      msgs.push('No open voids or scale-up items. Focus on relationship, pricing check, and look of the leader.');
  } else {
    if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' items to consider for the back bar or tap list.');
    if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' new product POD' + (data.pl.length > 1 ? 's' : '') + ' — good conversation starter.');
    if (!(data.su && data.su.length) && !(data.pl && data.pl.length))
      msgs.push('No open items. Focus on relationship and any pricing needs.');
  }

  if (!msgs.length) msgs.push('No significant data signals. Standard call objectives apply.');
  return msgs;
}

// ── Export/Import validation ──────────────────────────────────────────────────
function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return 'Not a valid JSON object.';
  if (obj.roster !== undefined && !Array.isArray(obj.roster)) return 'roster must be an array.';
  if (obj.persist !== undefined) {
    const p = obj.persist;
    if (typeof p !== 'object') return 'persist must be an object.';
    for (const k of ['notes', 'ds', 'survey', 'vs']) {
      if (p[k] !== undefined && typeof p[k] !== 'object') return k + ' must be an object.';
    }
  }
  return null; // valid
}

// ── Toast action labels ───────────────────────────────────────────────────────
function actionLabel(action) {
  switch (action.type) {
    case 'VS':           return 'Void state updated';
    case 'DONE':         return 'Account marked done';
    case 'DS':           return action.value === null ? 'Check cleared' : 'Logged';
    case 'SURVEY':       return 'Survey marked done';
    case 'SURVEY_CLEAR': return 'Survey cleared';
    case 'SCR':          return 'Scoreboard updated';
    case 'RST':          return 'Scoreboard reset';
    case 'REORDER':      return 'Order saved';
    case 'NICK':         return 'Nickname saved';
    case 'FREQ':         return 'Frequency updated';
    case 'SET_ACTIVE':   return 'Account toggled';
    case 'CHANGE_DAY':   return 'Day updated';
    case 'LAST_VISIT':   return null;
    default:             return null;
  }
}
