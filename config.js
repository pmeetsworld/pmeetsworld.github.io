// ─────────────────────────────────────────────────────────────────────────────
// config.js  —  Route 508 Pre-Plan App
// Constants, helpers, storage, state definitions, data logic.
// Updated: see changelog at bottom of file.
// ─────────────────────────────────────────────────────────────────────────────

// ── Schema version — bump when storage shape changes ─────────────────────────
const SCHEMA_VERSION = 3;

// ── Day identity colors ───────────────────────────────────────────────────────
const DAY_COLORS = {
  mon: '#B45309',
  tue: '#0F766E',
  wed: '#B91C1C',
  thu: '#166534',
  fri: '#6D28D9',
};

// ── Week detection ────────────────────────────────────────────────────────────
const FORCE_WEEK = null; // Set to 'YYYY-MM-DD' string for testing only

function getWeekMonday() {
  const base = FORCE_WEEK ? new Date(FORCE_WEEK + 'T12:00:00') : new Date();
  const day  = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(base);
  mon.setDate(base.getDate() + diff);
  return mon;
}

function isoWeekKey(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const year = d.getFullYear();
  const week = Math.ceil(((d - new Date(year, 0, 1)) / 86400000 + 1) / 7);
  return year + '-W' + String(week).padStart(2, '0');
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
const DAYS        = ['mon', 'tue', 'wed', 'thu', 'fri'];

function get90DayCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

// ── Brand colors ──────────────────────────────────────────────────────────────
const APP_HEADER_COLOR = '#2A2825';

const TC = {
  C: { color: '#C2410C', label: 'CHAIN'   },
  I: { color: '#0F766E', label: 'INDY'    },
  O: { color: '#DC2626', label: 'ON-PREM' },
};

// ── Segment → SKU mapping ─────────────────────────────────────────────────────
const SEG_SKUS = {
  Premium:          ['Modelo Especial', 'Corona Extra', 'Michelob Ultra', 'Corona Familiar', 'Pacifico'],
  Mainstream:       ['Bud Light', 'Budweiser', 'Busch Light'],
  'Hard Beverage':  ['Modelo Chelada', 'Bud Family Chelada', 'Carbliss', 'Smirnoff Ice', 'Cutwater'],
  'Non-Alcohol':    ['Ghost Energy', 'Bloom Energy', 'C4 Energy', 'Sparkling Ice Caffeine', 'Liquid Death'],
  'High End':       ['Kona', 'Kros Strain', 'Big Grove', 'Glacial Till Cider', 'Goose Island'],
};

// ── Void state definitions ────────────────────────────────────────────────────
const CV_STATES = [
  { label: 'Open',       bg: '#F7F7F7', fg: '#888',    border: '#DDD',    icon: '○' },
  { label: 'True Void',  bg: '#FFF0F0', fg: '#B71C1C', border: '#FFCDD2', icon: '✕' },
  { label: 'Not in Set', bg: '#FFF8E1', fg: '#E65100', border: '#FFE082', icon: '⊘' },
  { label: 'In Account', bg: '#E8F5E9', fg: '#2E7D32', border: '#A5D6A7', icon: '✓' },
  { label: 'Sold In',    bg: '#E3F2FD', fg: '#1565C0', border: '#90CAF9', icon: '★' },
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

// ── Motivational quotes ───────────────────────────────────────────────────────
const QUOTES = [
  "Success is the sum of small efforts, repeated day in and day out.",
  "Every call is a chance to make someone\'s business better.",
  "You don\'t build a business — you build people, and people build the business.",
  "The secret of getting ahead is getting started.",
  "A sale is not something you pursue — it\'s what happens when you\'re immersed in serving your customer.",
  "Small progress is still progress. Keep going.",
  "Your attitude determines your direction.",
  "Show up. Suit up. Do the work.",
  "The road to success is always under construction.",
  "Don\'t watch the clock. Do what it does — keep going.",
  "Opportunities don\'t happen. You create them.",
  "The best salespeople know their job isn\'t to sell — it\'s to help.",
  "Consistency is what transforms average into excellence.",
  "Every no gets you closer to a yes.",
  "You are your own brand. Make it a good one.",
  "Go the extra mile — it\'s never crowded.",
  "A goal without a plan is just a wish.",
  "Hustle beats talent when talent doesn\'t hustle.",
  "Make each account feel like your only account.",
  "Details differentiate good reps from great ones.",
  "Win the morning, win the day.",
  "The shelf doesn\'t fix itself. That\'s why you\'re here.",
  "Your presence on the shelf is your brand\'s voice.",
  "Be so good they can\'t ignore you.",
  "Every stop is a chance to leave things better than you found them.",
];
function getQuote() {
  return QUOTES[Math.floor(Date.now() / 1000 / 60 / 25) % QUOTES.length];
}

// ── Storage keys ──────────────────────────────────────────────────────────────
// NOTE: Never rename these keys without adding a migration.
// Changing a key name = all users silently lose that data bucket.
const STORAGE_KEYS = {
  META:     'r508_meta',      // schema version + reconciliation state
  ROSTER:   'r508_roster',    // account list + user customizations (nick, freq, days, order)
  PERSIST:  'r508_persist',   // cross-week: notes, compliance dates, survey, void states
  LASTWEEK: 'r508_lastweek',  // previous week scoreboard archive
  weekly:   () => 'r508_weekly_' + WEEK_KEY,
  // Legacy key — read-only during migration:
  LEGACY_BLOB: 'r508_v3',
};

const storage = {
  get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.warn('Storage write failed:', e); } },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
  keys()    { try { return Object.keys(localStorage).filter(k => k.startsWith('r508_')); } catch { return []; } },
};

// ── State initialization ──────────────────────────────────────────────────────
const INIT_WEEKLY  = {
  weekKey: WEEK_KEY,
  done:    {},
  sc:      { mon:{t:0,d:0,p:0}, tue:{t:0,d:0,p:0}, wed:{t:0,d:0,p:0}, thu:{t:0,d:0,p:0}, fri:{t:0,d:0,p:0} },
  active:  {},
};
const INIT_PERSIST = { notes:{}, ds:{}, survey:{}, vs:{} };
const INIT_META    = { schemaVersion: SCHEMA_VERSION, lastReconciled: null, dataVersion: null };

// ── Migration: upgrade saved data to current schema ───────────────────────────
// Each migration function is additive — it never removes fields.
function migrateData(savedRoster, savedPersist, savedWeekly) {
  const meta = storage.get(STORAGE_KEYS.META) || {};

  if (meta.schemaVersion >= SCHEMA_VERSION) {
    // Already current
    return { roster: savedRoster, persist: savedPersist, weekly: savedWeekly, migrated: false };
  }

  let roster  = savedRoster  ? JSON.parse(JSON.stringify(savedRoster))  : null;
  let persist = savedPersist ? JSON.parse(JSON.stringify(savedPersist)) : null;
  let weekly  = savedWeekly  ? JSON.parse(JSON.stringify(savedWeekly))  : null;

  // ── v1/v2 → v3: Handle legacy single-blob format (r508_v3 key) ───────────
  if (!roster && !persist) {
    const blob = storage.get(STORAGE_KEYS.LEGACY_BLOB);
    if (blob) {
      roster  = blob.roster  || null;
      persist = blob.persist || INIT_PERSIST;
      weekly  = blob.weekly  || null;
      // Don't delete the legacy key yet — keep as safety net for one version
      console.log('Migrated from legacy r508_v3 blob');
    }
  }

  // ── Ensure roster entries have status field ───────────────────────────────
  if (Array.isArray(roster)) {
    roster = roster.map(r => ({
      status: 'active',  // default all existing accounts to active
      ...r,
    }));
  }

  // ── Ensure persist has all required sub-keys ──────────────────────────────
  if (persist) {
    persist.notes  = persist.notes  || {};
    persist.ds     = persist.ds     || {};
    persist.survey = persist.survey || {};
    persist.vs     = persist.vs     || {};
  }

  return { roster, persist, weekly, migrated: true };
}

// ── Route data reconciliation ─────────────────────────────────────────────────
// Runs on every app load. Compares current RDATA account numbers against
// the saved roster. Safe — never deletes user data, only flags changes.
//
// Returns: { roster: updatedRoster, report: { added, archived, renamed, voidCountChanged } }
function reconcileRoster(savedRoster) {
  if (!savedRoster) return { roster: null, report: null };

  // Build a map of all accounts in current RDATA by account number
  const rdataById = {};
  for (const day of DAYS) {
    for (const acct of (RDATA[day] || [])) {
      if (!rdataById[acct.num]) rdataById[acct.num] = acct;
    }
  }

  const rosterById = {};
  savedRoster.forEach(r => { rosterById[r.id] = r; });

  const report = { added: [], archived: [], renamed: [], voidCountChanged: [] };
  const updatedRoster = savedRoster.map(r => ({ ...r }));

  // Check each roster account against RDATA
  for (const r of updatedRoster) {
    const live = rdataById[r.id];
    if (!live) {
      // Account not in current RDATA — archive it
      if (r.status !== 'archived') {
        r.status = 'archived';
        report.archived.push({ id: r.id, name: r.name });
      }
    } else {
      // Account still active
      r.status = 'active';
      // Check for name change (same ID, different canonical name)
      if (live.n && live.n !== r.name) {
        report.renamed.push({ id: r.id, oldName: r.name, newName: live.n });
        r.name = live.n; // update canonical name, preserve nick
      }
      // Check for void count changes (indices may drift)
      const liveVoidCount = (live.ca || []).length + (live.cn || []).length;
      const suCount = (live.su || []).length;
      const plCount = (live.pl || []).length;
      if (r._lastVoidCount !== undefined && r._lastVoidCount !== liveVoidCount) {
        report.voidCountChanged.push({ id: r.id, name: r.name, was: r._lastVoidCount, now: liveVoidCount });
      }
      r._lastVoidCount = liveVoidCount;
    }
  }

  // Check for new accounts in RDATA not in roster
  for (const [id, acct] of Object.entries(rdataById)) {
    if (!rosterById[id]) {
      // New account — build a clean roster entry
      const newEntry = {
        id,
        name:      acct.n,
        nick:      '',
        type:      acct.t,
        freq:      'W',
        days:      [],
        order:     {},
        lastVisit: null,
        status:    'new',
      };
      // Assign to days it appears in
      for (const day of DAYS) {
        const dayAccts = RDATA[day] || [];
        const idx = dayAccts.findIndex(a => a.num === id);
        if (idx !== -1) {
          newEntry.days.push(day);
          newEntry.order[day] = 999; // append to end of each day
        }
      }
      updatedRoster.push(newEntry);
      report.added.push({ id, name: acct.n });
    }
  }

  const hasChanges = report.added.length || report.archived.length ||
                     report.renamed.length || report.voidCountChanged.length;

  return { roster: updatedRoster, report: hasChanges ? report : null };
}

// ── Archive last week's scoreboard ────────────────────────────────────────────
function archiveLastWeekIfNeeded() {
  try {
    const prevKey = storage.keys().find(k => k.startsWith('r508_weekly_') && k !== STORAGE_KEYS.weekly());
    if (!prevKey) return false;
    const prev = storage.get(prevKey);
    if (!prev || !prev.sc) return false;
    const totals = { t:0, d:0, p:0 };
    Object.values(prev.sc).forEach(day => {
      totals.t += day.t || 0;
      totals.d += day.d || 0;
      totals.p += day.p || 0;
    });
    storage.set(STORAGE_KEYS.LASTWEEK, {
      weekKey: prevKey.replace('r508_weekly_', ''),
      savedAt: todayStr(),
      sc:      prev.sc,
      totals,
    });
    storage.remove(prevKey);
    return true;
  } catch { return false; }
}

// ── Backup export ─────────────────────────────────────────────────────────────
function buildFullBackup(state) {
  return {
    exportType:    'full',
    schemaVersion: SCHEMA_VERSION,
    exportedAt:    new Date().toISOString(),
    weekKey:       WEEK_KEY,
    roster:        state.roster,
    persist:       state.persist,
    weekly:        state.weekly,
    lastweek:      storage.get(STORAGE_KEYS.LASTWEEK) || null,
  };
}

function buildWeeklyBackup(state) {
  return {
    exportType:    'weekly',
    schemaVersion: SCHEMA_VERSION,
    exportedAt:    new Date().toISOString(),
    weekKey:       WEEK_KEY,
    weekly:        state.weekly,
    persist:       state.persist,
  };
}

// ── Import validation ─────────────────────────────────────────────────────────
function validateBackupFile(obj) {
  if (!obj || typeof obj !== 'object') return 'Not a valid JSON object.';
  if (!obj.schemaVersion) return 'Missing schemaVersion — this may be an old format backup.';
  if (obj.schemaVersion > SCHEMA_VERSION) return 'This backup was made with a newer version of the app. Update the app first.';
  if (obj.roster !== undefined && !Array.isArray(obj.roster)) return 'roster must be an array.';
  if (obj.persist !== undefined) {
    const p = obj.persist;
    if (typeof p !== 'object') return 'persist must be an object.';
    for (const k of ['notes', 'ds', 'survey', 'vs']) {
      if (p[k] !== undefined && typeof p[k] !== 'object') return k + ' must be an object.';
    }
  }
  if (obj.weekly !== undefined) {
    const w = obj.weekly;
    if (typeof w !== 'object') return 'weekly must be an object.';
    if (w.sc !== undefined && typeof w.sc !== 'object') return 'weekly.sc must be an object.';
  }
  return null; // valid
}

// ── Import preview — what will change ─────────────────────────────────────────
// Returns a human-readable summary of what a given import will do.
function previewImport(backupObj, currentState, mode) {
  const preview = {
    mode,
    rosterChanges:    [],
    notesPreserved:   0,
    notesOverwritten: 0,
    weeklyTouched:    false,
    warnings:         [],
  };

  if (mode === 'safe_merge' || mode === 'roster_only') {
    if (backupObj.roster && currentState.roster) {
      const currentIds = new Set(currentState.roster.map(r => r.id));
      const backupIds  = new Set((backupObj.roster || []).map(r => r.id));
      const added      = [...backupIds].filter(id => !currentIds.has(id));
      const removed    = [...currentIds].filter(id => !backupIds.has(id));
      added.forEach(id => {
        const a = backupObj.roster.find(r => r.id === id);
        preview.rosterChanges.push({ type: 'add', id, name: a ? a.name : id });
      });
      removed.forEach(id => {
        const r = currentState.roster.find(x => x.id === id);
        preview.rosterChanges.push({ type: 'remove', id, name: r ? r.name : id });
      });
    }
  }

  if (mode === 'safe_merge') {
    if (backupObj.persist && currentState.persist) {
      const bNotes = backupObj.persist.notes || {};
      const cNotes = currentState.persist.notes || {};
      Object.keys(bNotes).forEach(id => {
        if (cNotes[id] && cNotes[id] !== bNotes[id]) {
          preview.notesOverwritten++;
          preview.warnings.push('Note for account ' + id + ' will be overwritten by backup version.');
        } else {
          preview.notesPreserved++;
        }
      });
    }
    preview.weeklyTouched = false;
  }

  if (mode === 'full_restore') {
    preview.weeklyTouched = true;
    preview.warnings.push('Full restore will replace ALL data including this week\'s progress. Make sure you have a current backup first.');
    if (backupObj.weekKey && backupObj.weekKey !== WEEK_KEY) {
      preview.warnings.push('Backup is from week ' + backupObj.weekKey + ', but current week is ' + WEEK_KEY + '. Weekly progress will be from a different week.');
    }
  }

  return preview;
}

// ── Apply import ──────────────────────────────────────────────────────────────
// Returns the new state to dispatch. Does NOT write to storage — caller does that.
function applyImport(backupObj, currentState, mode) {
  // Upgrade old backup format if needed
  let backup = backupObj;
  if (!backup.schemaVersion) {
    // Pre-v3 backup: had roster/persist at top level
    backup = {
      schemaVersion: 2,
      roster:  backup.roster,
      persist: backup.persist,
      weekly:  backup.weekly,
    };
  }

  const next = {
    roster:  currentState.roster,
    persist: currentState.persist,
    weekly:  currentState.weekly,
  };

  if (mode === 'safe_merge') {
    // Roster: use backup roster but re-apply any user customizations from current
    if (backup.roster) {
      const currentById = {};
      currentState.roster.forEach(r => { currentById[r.id] = r; });
      next.roster = backup.roster.map(r => {
        const cur = currentById[r.id];
        if (cur) {
          // Preserve current user customizations over backup values
          return {
            ...r,
            nick:      cur.nick,
            freq:      cur.freq,
            days:      cur.days,
            order:     cur.order,
            lastVisit: cur.lastVisit,
            status:    cur.status || 'active',
          };
        }
        return { ...r, status: r.status || 'active' };
      });
      // Add any accounts in current but not in backup (don't lose them)
      const backupIds = new Set(backup.roster.map(r => r.id));
      currentState.roster.forEach(r => {
        if (!backupIds.has(r.id)) next.roster.push({ ...r });
      });
    }
    // Persist: merge — backup values win for notes/ds/survey/vs, but don't delete keys not in backup
    if (backup.persist) {
      next.persist = {
        notes:  { ...currentState.persist.notes,  ...(backup.persist.notes  || {}) },
        ds:     { ...currentState.persist.ds,     ...(backup.persist.ds     || {}) },
        survey: { ...currentState.persist.survey, ...(backup.persist.survey || {}) },
        vs:     { ...currentState.persist.vs,     ...(backup.persist.vs     || {}) },
      };
    }
    // Weekly: untouched
  }

  if (mode === 'roster_only') {
    if (backup.roster) {
      const currentById = {};
      currentState.roster.forEach(r => { currentById[r.id] = r; });
      next.roster = backup.roster.map(r => {
        const cur = currentById[r.id];
        return cur ? { ...r, nick: cur.nick, lastVisit: cur.lastVisit, status: cur.status || 'active' } : { ...r, status: 'active' };
      });
    }
    // persist and weekly: untouched
  }

  if (mode === 'full_restore') {
    if (backup.roster)  next.roster  = backup.roster.map(r => ({ status: 'active', ...r }));
    if (backup.persist) next.persist = {
      notes:  backup.persist.notes  || {},
      ds:     backup.persist.ds     || {},
      survey: backup.persist.survey || {},
      vs:     backup.persist.vs     || {},
    };
    if (backup.weekly) next.weekly = backup.weekly;
  }

  return next;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysSince(ds) {
  if (!ds) return null;
  return Math.round((new Date(todayStr() + 'T12:00:00') - new Date(ds + 'T12:00:00')) / 86400000);
}
function dsLabel(ds) {
  const n = daysSince(ds);
  if (n === null) return 'Never logged';
  if (n === 0)    return 'Done today';
  if (n === 1)    return 'Yesterday';
  return n + ' days ago';
}
function dsColor(ds) {
  const n = daysSince(ds);
  if (n === null) return '#9CA3AF';
  if (n <= 14)    return '#15803D';
  if (n < 45)     return '#C2410C';
  return '#DC2626';
}
function dsBg(ds) {
  const n = daysSince(ds);
  if (n === null) return '#F9FAFB';
  if (n <= 14)    return '#F0FDF4';
  if (n < 45)     return '#FFF7ED';
  return '#FFF0F0';
}
function surveyStatus(doneDate) {
  const now = new Date(todayStr() + 'T12:00:00');
  const yr = now.getFullYear(), mo = now.getMonth();
  const dow = new Date(yr, mo, 1).getDay();
  const firstMon = dow === 1 ? 1 : dow === 0 ? 2 : 9 - dow;
  const deadline = new Date(yr, mo, firstMon + 13);
  if (doneDate) {
    const d = new Date(doneDate + 'T12:00:00');
    if (d.getFullYear() === yr && d.getMonth() === mo)
      return { color: '#15803D', bg: '#F0FDF4', label: 'Done ✓' };
  }
  const dlStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (now <= deadline) return { color: '#C2410C', bg: '#FFF7ED', label: 'Due by ' + dlStr };
  return { color: '#DC2626', bg: '#FFF0F0', label: 'Overdue' };
}

// ── Number formatters ─────────────────────────────────────────────────────────
function fmtPct(v)  { return v == null ? '—' : (v >= 0 ? '+' : '') + Math.round(v * 100) + '%'; }
function fmtCE(v)   { return v == null ? '—' : v.toFixed(1); }

// ── Segment insights ──────────────────────────────────────────────────────────
function segmentInsights(segs, acctType) {
  if (!segs || !Object.keys(segs).length) return [];
  const ranked = Object.entries(segs)
    .filter(([, v]) => v[2] != null && v[1] != null && v[1] > 0)
    .sort((a, b) => a[1][2] - b[1][2]);
  if (!ranked.length) return [];

  const msgs    = [];
  const skus    = name => (SEG_SKUS[name] || []).slice(0, 2).join(' and ');
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

// ── Pre-call helper ───────────────────────────────────────────────────────────
function genHelper(acct, data) {
  if (!data) return ['No performance data available. Focus on standard call objectives.'];
  const msgs = [];
  const { p, bv, t, sg } = data;

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

  const segMsgs = segmentInsights(sg, t);
  segMsgs.forEach(m => msgs.push(m));

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
      if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch POD' + (data.pl.length > 1 ? 's' : '') + '.');
      if (!(data.su && data.su.length) && !(data.pl && data.pl.length)) msgs.push('No open items. Focus on relationship and look of the leader.');
    } else {
      if (data.su && data.su.length) msgs.push('📦 ' + data.su.length + ' items to consider for back bar or tap list.');
      if (data.pl && data.pl.length) msgs.push('🆕 ' + data.pl.length + ' Perfect Launch POD' + (data.pl.length > 1 ? 's' : '') + '.');
    }
  }

  if (!msgs.length) msgs.push('No significant signals this week. Standard call objectives apply.');
  return msgs;
}

// ── Action labels (undo toast) ────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Changelog:
// v3 — Added SCHEMA_VERSION, INIT_META, migrateData(), reconcileRoster(),
//       validateBackupFile(), previewImport(), applyImport(), buildFullBackup(),
//       buildWeeklyBackup(), storage.keys(). Added 'status' field to roster
//       accounts. Removed duplicate APP_CHARCOAL. Storage keys documented.
// v2 — Split storage into roster/persist/weekly/lastweek keys.
// v1 — Initial single-blob r508_v3 storage.
// ─────────────────────────────────────────────────────────────────────────────
