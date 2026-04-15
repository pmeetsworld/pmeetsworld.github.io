// Day identity colors — each day has its own feel, all white-text readable
const DAY_COLORS = {
  mon: '#B45309', // deep amber
  tue: '#0F766E', // rich teal
  wed: '#B91C1C', // deep crimson
  thu: '#166534', // forest green
  fri: '#6D28D9', // deep violet
};

// ── Week Detection ────────────────────────────────────────────────────────────
const FORCE_WEEK = null;

function getWeekMonday() {
  const base = FORCE_WEEK ? new Date(FORCE_WEEK + 'T12:00:00') : new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(base);
  mon.setDate(base.getDate() + diff);
  return mon;
}

function isoWeekKey(date) {
  const d = new Date(date);
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const year = d.getFullYear();
  const week = Math.ceil(((d - new Date(year,0,1)) / 86400000 + 1) / 7);
  return year + '-W' + String(week).padStart(2,'0');
}

function fmt(date, opts) { return date.toLocaleDateString('en-US', opts); }

function buildDayConfig(monday) {
  const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const config = {};
  KEYS.forEach((key, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    config[key] = {
      key,
      color:   DAY_COLORS[key],
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
const DAYS        = ['mon','tue','wed','thu','fri'];

function get90DayCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0,10);
}

// ── Brand colors ──────────────────────────────────────────────────────────────
// Warm charcoal app shell
const APP_CHARCOAL = '#2D2926';

// App shell color
const APP_HEADER_COLOR = '#2A2825'; // warm charcoal

// Account type — bold, distinct, high contrast
const TC = {
  C: { color: '#C2410C', label: 'CHAIN'   }, // burnt orange
  I: { color: '#0F766E', label: 'INDY'    }, // rich teal
  O: { color: '#DC2626', label: 'ON-PREM' }, // bright crimson
};


// ── Segment → SKU mapping ─────────────────────────────────────────────────────
const SEG_SKUS = {
  Premium:       ['Modelo Especial','Corona Extra','Michelob Ultra','Corona Familiar','Pacifico'],
  Mainstream:    ['Bud Light','Budweiser','Busch Light'],
  'Hard Beverage': ['Modelo Chelada','Bud Family Chelada','Carbliss','Smirnoff Ice','Cutwater'],
  'Non-Alcohol': ['Ghost Energy','Bloom Energy','C4 Energy','Sparkling Ice Caffeine','Liquid Death'],
  'High End':    ['Kona','Kros Strain','Big Grove','Glacial Till Cider','Goose Island'],
};

// ── Void state definitions ────────────────────────────────────────────────────
const CV_STATES = [
  { label: 'Open',       bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'True Void',  bg: '#FFF0F0', fg: '#B91C1C', border: '#FECACA', icon: '✕' },
  { label: 'Not in Set', bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', icon: '⊘' },
  { label: 'In Account', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0', icon: '✓' },
  { label: 'Sold In',    bg: '#F0FDFA', fg: '#0F766E', border: '#99F6E4', icon: '★' },
];
const SU_STATES = [
  { label: 'Open',        bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'Not in Set',  bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', icon: '⊘' },
  { label: 'Slow Mover',  bg: '#FAF5FF', fg: '#6D28D9', border: '#DDD6FE', icon: '~' },
  { label: 'Pitched',     bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', icon: '◎' },
  { label: 'Sold In',     bg: '#F0FDFA', fg: '#0F766E', border: '#99F6E4', icon: '★' },
];
const PL_STATES = [
  { label: 'Open',        bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'Not in Set',  bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA', icon: '⊘' },
  { label: 'Pitched',     bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE', icon: '◎' },
  { label: 'POD Placed',  bg: '#F0FDFA', fg: '#0F766E', border: '#99F6E4', icon: '★' },
];

const FREQ_LABELS = { W: 'Weekly', EOW: 'Every Other Week', M: 'Monthly' };

// ── Quotes ────────────────────────────────────────────────────────────────────
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
  return QUOTES[Math.floor(Date.now() / 1000 / 60 / 25) % QUOTES.length];
}

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  ROSTER:   'r508_roster',
  PERSIST:  'r508_persist',
  LASTWEEK: 'r508_lastweek',
  weekly:   () => 'r508_weekly_' + WEEK_KEY,
};

const storage = {
  get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.warn('Storage write failed:', e); } },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
};

function archiveLastWeekIfNeeded() {
  try {
    const prevKey = Object.keys(localStorage)
      .find(k => k.startsWith('r508_weekly_') && k !== STORAGE_KEYS.weekly());
    if (!prevKey) return false;
    const prev = JSON.parse(localStorage.getItem(prevKey));
    if (!prev || !prev.sc) return false;
    const totals = { t:0, d:0, p:0 };
    Object.values(prev.sc).forEach(day => { totals.t += day.t||0; totals.d += day.d||0; totals.p += day.p||0; });
    storage.set(STORAGE_KEYS.LASTWEEK, {
      weekKey: prevKey.replace('r508_weekly_',''),
      savedAt: todayStr(),
      sc:      prev.sc,
      totals,
    });
    localStorage.removeItem(prevKey);
    return true;
  } catch { return false; }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function daysSince(ds) {
  if (!ds) return null;
  return Math.round((new Date(todayStr()+'T12:00:00') - new Date(ds+'T12:00:00')) / 86400000);
}
function dsLabel(ds) {
  const n = daysSince(ds);
  if (n === null) return 'Never logged';
  if (n === 0) return 'Done today';
  if (n === 1) return 'Yesterday';
  return n + ' days ago';
}
function dsColor(ds) {
  const n = daysSince(ds);
  if (n === null) return '#9CA3AF';
  if (n <= 14) return '#15803D';
  if (n < 45)  return '#C2410C';
  return '#DC2626';
}
function dsBg(ds) {
  const n = daysSince(ds);
  if (n === null) return '#F9FAFB';
  if (n <= 14) return '#F0FDF4';
  if (n < 45)  return '#FFF7ED';
  return '#FFF0F0';
}
function surveyStatus(doneDate) {
  const now = new Date(todayStr()+'T12:00:00');
  const yr = now.getFullYear(), mo = now.getMonth();
  const dow = new Date(yr,mo,1).getDay();
  const firstMon = dow===1?1:dow===0?2:9-dow;
  const deadline = new Date(yr,mo,firstMon+13);
  if (doneDate) {
    const d = new Date(doneDate+'T12:00:00');
    if (d.getFullYear()===yr && d.getMonth()===mo)
      return { color:'#15803D', bg:'#F0FDF4', label:'Done ✓' };
  }
  const dlStr = deadline.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if (now <= deadline) return { color:'#C2410C', bg:'#FFF7ED', label:'Due by '+dlStr };
  return { color:'#DC2626', bg:'#FFF0F0', label:'Overdue' };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPct(v) { return v==null?'—':(v>=0?'+':'')+Math.round(v*100)+'%'; }
function fmtCE(v)  { return v==null?'—':v.toFixed(1); }

// Render a delta with CE context:  "−18%  (~110 CE less)"
function fmtDeltaLine(pctVal, ce25, ce26) {
  if (pctVal == null) return null;
  const diff = (ce26||0) - (ce25||0);
  const absDiff = Math.abs(Math.round(diff * 10) / 10);
  if (absDiff < 0.5) return fmtPct(pctVal);
  const dir = diff >= 0 ? '+' : '−';
  return fmtPct(pctVal) + ' (' + dir + absDiff + ' CE)';
}

// ── Segment helper — the smart one ────────────────────────────────────────────
function genSegmentInsights(segs, acctType) {
  if (!segs || Object.keys(segs).length === 0) return [];
  const msgs = [];
  const entries = Object.entries(segs)
    .filter(([,v]) => v[1] != null)
    .map(([seg,v]) => ({ seg, mtdPct: v[2], ytdPct: v[5], mtd25: v[0], mtd26: v[1] }));
  if (!entries.length) return [];

  // Sort by MTD % change
  const sorted = [...entries].sort((a,b) => (a.mtdPct||0) - (b.mtdPct||0));
  const worst  = sorted[0];
  const best   = sorted[sorted.length-1];

  // Worst segment
  if (worst && worst.mtdPct != null && worst.mtdPct < -0.08) {
    const skus = (SEG_SKUS[worst.seg] || []).slice(0,3).join(', ');
    const pctStr = Math.round(Math.abs(worst.mtdPct*100)) + '%';
    if (acctType === 'C') {
      msgs.push('⚠ ' + worst.seg + ' is down ' + pctStr + ' MTD — check shelf presence and pricing on ' + skus + '. Verify planogram compliance before pitching anything new.');
    } else {
      msgs.push('⚠ ' + worst.seg + ' is down ' + pctStr + ' MTD. Primary suspects: ' + skus + '. Ask what\'s changed and whether they\'re running low or had an out-of-stock.');
    }
  }

  // Best segment (only if meaningfully positive)
  if (best && best.mtdPct != null && best.mtdPct > 0.10 && best !== worst) {
    const skus = (SEG_SKUS[best.seg] || []).slice(0,2).join(' and ');
    const pctStr = Math.round(best.mtdPct*100) + '%';
    if (acctType === 'C') {
      msgs.push(best.seg + ' is up ' + pctStr + ' MTD — ' + skus + ' are clearly moving. Check facings and confirm pricing is clean.');
    } else {
      msgs.push(best.seg + ' is up ' + pctStr + ' MTD — ' + skus + ' are moving well. This is your best opportunity to pitch additional SKUs in this segment today.');
    }
  }

  // If Premium and Mainstream both down — headline it
  const premium    = entries.find(e => e.seg === 'Premium');
  const mainstream = entries.find(e => e.seg === 'Mainstream');
  if (premium && mainstream && (premium.mtdPct||0) < -0.10 && (mainstream.mtdPct||0) < -0.10) {
    msgs.push('Both core segments are down. This account needs a focused conversation — lead with understanding before pitching.');
  }

  return msgs;
}

// ── Segment → SKU insight generator ─────────────────────────────────────────
function segmentInsights(segs, acctType) {
  if (!segs || !Object.keys(segs).length) return [];
  const ranked = Object.entries(segs)
    .filter(([, v]) => v[2] != null && v[1] != null && v[1] > 0)
    .sort((a, b) => a[1][2] - b[1][2]);
  if (!ranked.length) return [];

  const msgs   = [];
  const skus   = name => (SEG_SKUS[name] || []).slice(0, 2).join(' and ');
  const isChain = acctType === 'C';

  const [wName, wVals] = ranked[0];
  const wPct = Math.round(wVals[2] * 100);
  const wCE  = wVals[0] != null && wVals[1] != null ? Math.abs(Math.round(wVals[1] - wVals[0])) : null;

  if (wPct < -10) {
    const ceStr = wCE ? ' (' + wCE + ' CE lost vs last year)' : '';
    if (wName === 'Premium') {
      msgs.push('⚠ Premium down ' + Math.abs(wPct) + '% MTD' + ceStr + ' — your biggest segment is bleeding. ' +
        (isChain ? 'Check Modelo Especial and Michelob Ultra shelf compliance and planogram position.'
                 : 'Walk the Modelo Especial and Michelob Ultra section — facings, pricing, freshness.'));
    } else if (wName === 'Mainstream') {
      msgs.push('⚠ Mainstream down ' + Math.abs(wPct) + '% MTD' + ceStr + ' — Bud Light, Budweiser, and Busch Light are slipping. ' +
        (isChain ? 'Verify in-set compliance.' : 'Ask the buyer what changed — pricing shift, competitor, or shelf issue.'));
    } else if (wName === 'Hard Beverage') {
      msgs.push('Hard Beverage down ' + Math.abs(wPct) + '% MTD' + ceStr + '. Cheladas and FMBs are likely the cause. Confirm ' + skus(wName) + ' are stocked and priced right.');
    } else if (wName === 'Non-Alcohol') {
      msgs.push('Non-Alcohol down ' + Math.abs(wPct) + '% MTD' + ceStr + '. Check ' + skus(wName) + ' shelf presence — energy sets turn over fast.');
    } else {
      msgs.push(wName + ' down ' + Math.abs(wPct) + '% MTD' + ceStr + '. Walk the ' + skus(wName) + ' section.');
    }
  }

  const best = ranked[ranked.length - 1];
  if (best !== ranked[0]) {
    const [bName, bVals] = best;
    const bPct = Math.round(bVals[2] * 100);
    const bCE  = bVals[0] != null && bVals[1] != null ? Math.round(bVals[1] - bVals[0]) : null;
    if (bPct > 15) {
      const ceStr = bCE && bCE > 0 ? ' (+' + bCE + ' CE)' : '';
      if (bName === 'Premium') {
        msgs.push('Premium up ' + bPct + '%' + ceStr + ' — Constellation is moving here. Good account to push Modelo Especial facings or a Corona display.');
      } else if (bName === 'Mainstream') {
        msgs.push('Mainstream up ' + bPct + '%' + ceStr + '. Bud Light and Busch Light are driving this — protect shelf space and pricing.');
      } else if (bName === 'Hard Beverage') {
        msgs.push('Hard Beverage up ' + bPct + '%' + ceStr + ' — RTDs and Cheladas are moving. ' +
          (isChain ? 'Make sure in-set items are fully stocked.' : 'Good time to pitch a new Carbliss or Cutwater flavor.'));
      } else {
        msgs.push(bName + ' up ' + bPct + '%' + ceStr + ' — this is working. Lean in.');
      }
    }
  }
  return msgs;
}

// ── Pre-Call Helper ───────────────────────────────────────────────────────────
function genHelper(acct, data) {
  if (!data) return ['No performance data available. Focus on standard call objectives.'];
  const msgs = [];
  const { p, bv, t, sg } = data;

  // Overall trend
  if (p && p[1] != null) {
    const mp = p[2];
    if (mp != null && Math.abs(mp) > 0.05) {
      if      (mp < -0.3) msgs.push('⚠ Overall volume down ' + fmtPct(mp) + ' MTD — significant drop. Understand the story before pitching anything new.');
      else if (mp < -0.1) msgs.push('Down ' + fmtPct(mp) + ' MTD. Worth a conversation about what\'s driving it.');
      else if (mp >  0.3) msgs.push('Up ' + fmtPct(mp) + ' MTD — strong momentum. Look for ways to press the advantage.');
      else if (mp >  0.1) msgs.push('Up ' + fmtPct(mp) + ' MTD. Things are trending the right direction.');
    }
  }
  if (bv) {
    const [diff, pctVal] = bv;
    if      (pctVal < -25) msgs.push('⚠ YTD down ' + pctVal + '% (' + diff + ' CE) — significant annual loss. Priority recovery account.');
    else if (pctVal < -10) msgs.push('YTD down ' + pctVal + '% (' + diff + ' CE). Has been trending wrong — understand why before pitching.');
    else if (pctVal >  30) msgs.push('YTD up ' + pctVal + '% (+' + diff + ' CE) — one of your best-growing accounts. Protect what\'s working.');
    else if (pctVal >  10) msgs.push('YTD up ' + pctVal + '% (+' + diff + ' CE). Solid growth — good account to invest time in.');
  }

  // Segment insights (main value)
  const segMsgs = segmentInsights(sg, t);
  segMsgs.forEach(m => msgs.push(m));

  // Fallback when no segment data
  if (!segMsgs.length) {
    const cv = [...(data.ca || []), ...(data.cn || [])];
    const cutoff = get90DayCutoff();
    if (t === 'C') {
      if (cv.length) {
        const old = cv.filter(v => v.d && v.d < cutoff);
        msgs.push('📋 ' + cv.length + ' planogram void' + (cv.length > 1 ? 's' : '') + ' — verify each is on shelf.' +
          (old.length ? ' ' + old.length + ' items 90+ days out — check for close-to-code.' : ''));
      } else {
        msgs.push('No open chain mod voids. Shelf should be clean and tagged.');
      }
    } else if (t === 'I') {
      if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' Scale Up item' + (data.su.length > 1 ? 's' : '') + ' flagged for this account.');
      if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch POD' + (data.pl.length > 1 ? 's' : '') + ' — new product opportunity.');
      if (!(data.su && data.su.length) && !(data.pl && data.pl.length)) msgs.push('No open items. Focus on relationship and look of the leader.');
    } else {
      if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' items to consider for the back bar or tap list.');
      if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch POD' + (data.pl.length > 1 ? 's' : '') + ' — new product opportunity.');
    }
  }

  if (!msgs.length) msgs.push('No significant signals this week. Standard call objectives apply.');
  return msgs;
}


// ── Export/Import validation ──────────────────────────────────────────────────
function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return 'Not a valid JSON object.';
  if (obj.roster !== undefined && !Array.isArray(obj.roster)) return 'roster must be an array.';
  if (obj.persist !== undefined) {
    const p = obj.persist;
    if (typeof p !== 'object') return 'persist must be an object.';
    for (const k of ['notes','ds','survey','vs']) {
      if (p[k] !== undefined && typeof p[k] !== 'object') return k + ' must be an object.';
    }
  }
  return null;
}

// ── Action labels (for undo toast) ────────────────────────────────────────────
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

// ── State init ────────────────────────────────────────────────────────────────
const INIT_WEEKLY  = { weekKey: WEEK_KEY, done:{}, sc:{mon:{t:0,d:0,p:0},tue:{t:0,d:0,p:0},wed:{t:0,d:0,p:0},thu:{t:0,d:0,p:0},fri:{t:0,d:0,p:0}}, active:{} };
const INIT_PERSIST = { notes:{}, ds:{}, survey:{}, vs:{} };

// ── Data lookup ───────────────────────────────────────────────────────────────
function getAcctData(id) {
  for (const d of DAYS) {
    const found = (RDATA[d]||[]).find(a => a.num === id);
    if (found) return found;
  }
  return null;
}
function displayName(acct) {
  return (acct.nick && acct.nick.trim()) ? acct.nick.trim() : acct.name;
}
