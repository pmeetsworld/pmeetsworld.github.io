'use strict';
const { useState, useEffect, useReducer, useRef } = React;
const h = React.createElement; // shorthand

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_ALL': return { ...state, ...action.value };

    // Weekly (resets each week automatically)
    case 'DONE': {
      const done = { ...state.weekly.done, [action.key]: !state.weekly.done[action.key] };
      return { ...state, weekly: { ...state.weekly, done } };
    }
    case 'SCR': {
      const sc = { ...state.weekly.sc };
      sc[action.day] = { ...sc[action.day], [action.metric]: Math.max(0, sc[action.day][action.metric] + action.delta) };
      return { ...state, weekly: { ...state.weekly, sc } };
    }
    case 'RST': {
      const sc = {};
      DAYS.forEach(d => sc[d] = { t: 0, d: 0, p: 0 });
      return { ...state, weekly: { ...state.weekly, sc } };
    }
    case 'SET_ACTIVE': {
      const active = { ...state.weekly.active, [action.key]: action.value };
      return { ...state, weekly: { ...state.weekly, active } };
    }

    // Persistent (never auto-wiped)
    case 'VS': {
      // Nested v4 structure: { id: { type: { sku: state } } }
      const vs = setVoidState(state.persist.vs, action.id, action.voidType, action.sku, action.value);
      return { ...state, persist: { ...state.persist, vs } };
    }
    case 'NOTE': {
      const notes = { ...state.persist.notes, [action.key]: action.value };
      return { ...state, persist: { ...state.persist, notes } };
    }
    case 'DS': {
      const ds = { ...state.persist.ds };
      if (action.value === null) { delete ds[action.key]; } else { ds[action.key] = action.value; }
      return { ...state, persist: { ...state.persist, ds } };
    }
    case 'SURVEY': {
      const survey = { ...state.persist.survey, [action.key]: todayStr() };
      return { ...state, persist: { ...state.persist, survey } };
    }
    case 'SURVEY_CLEAR': {
      const survey = { ...state.persist.survey };
      delete survey[action.key];
      return { ...state, persist: { ...state.persist, survey } };
    }

    // Roster
    case 'NICK':        return { ...state, roster: state.roster.map(r => r.id === action.id ? { ...r, nick: action.value } : r) };
    case 'FREQ':        return { ...state, roster: state.roster.map(r => r.id === action.id ? { ...r, freq: action.value } : r) };
    case 'LAST_VISIT':  return { ...state, roster: state.roster.map(r => r.id === action.id ? { ...r, lastVisit: todayStr() } : r) };
    case 'CHANGE_DAY': {
      const roster = state.roster.map(r => {
        if (r.id !== action.id) return r;
        let days = [...r.days];
        const order = { ...r.order };
        if (days.includes(action.day)) {
          if (days.length === 1) return r; // must keep at least one day
          days = days.filter(d => d !== action.day);
          delete order[action.day];
        } else {
          days.push(action.day);
          const maxOrd = Math.max(...state.roster.filter(x => x.days.includes(action.day)).map(x => x.order[action.day] || 0), -1);
          order[action.day] = maxOrd + 1;
        }
        return { ...r, days, order };
      });
      return { ...state, roster };
    }
    case 'REORDER': {
      const roster = [...state.roster];
      const dayAccts = roster.filter(r => r.days.includes(action.day)).sort((a, b) => (a.order[action.day] || 0) - (b.order[action.day] || 0));
      const [moved] = dayAccts.splice(action.src, 1);
      dayAccts.splice(action.dst, 0, moved);
      dayAccts.forEach((r, i) => {
        const idx = roster.findIndex(x => x.id === r.id);
        roster[idx] = { ...roster[idx], order: { ...roster[idx].order, [action.day]: i } };
      });
      return { ...state, roster };
    }

    default: return state;
  }
}

const INIT_STATE = { roster: null, weekly: INIT_WEEKLY, persist: INIT_PERSIST };

// ── Small reusable components ─────────────────────────────────────────────────

function NewWeekBanner({ onClose }) {
  return h('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: '#1A4731', color: '#fff',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
    }
  },
    h('div', null,
      h('div', { style: { fontWeight: 700, fontSize: 14 } }, '🗓 New week started'),
      h('div', { style: { fontSize: 12, opacity: 0.8, marginTop: 2 } },
        'Scoreboard reset. Last week\'s scores saved in Settings.')
    ),
    h('button', {
      style: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
      onClick: onClose
    }, 'Got it')
  );
}

function Toast({ msg, onUndo }) {
  return h('div', { className: 'toast' },
    h('span', null, msg),
    h('button', { className: 'toast__undo', onClick: onUndo }, 'Undo')
  );
}

function BackHeader({ onBack, title, subtitle, color }) {
  return h('div', { className: 'rm-header row', style: { background: color || APP_HEADER_COLOR, gap: 12 } },
    h('button', { className: 'btn btn--ghost-inv btn--sm', onClick: onBack }, '← Back'),
    h('div', null,
      h('div', { className: 't-title t-white' }, title),
      subtitle && h('div', { style: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 } }, subtitle)
    )
  );
}

// ── Compliance row with days-since logging ────────────────────────────────────
function ComplianceRow({ label, dsKey, val, dispatch, noBorder }) {
  const n = daysSince(val);
  const col = dsColor(val);
  const bg  = dsBg(val);
  return h('div', { className: 'compliance-row', style: noBorder ? { borderBottom: 'none' } : {} },
    h('div', null,
      h('div', { className: 't-label' }, label),
      h('div', { style: { fontSize: 12, marginTop: 3, color: col, fontWeight: 600 } }, dsLabel(val))
    ),
    h('div', { className: 'compliance-row__actions' },
      val && h('button', {
        className: 'btn btn--ghost btn--sm btn--pill',
        style: { minHeight: 36, color: '#AAA', borderColor: '#DDD' },
        onClick: () => dispatch({ type: 'DS', key: dsKey, value: null })
      }, '×'),
      h('button', {
        className: 'btn btn--sm btn--pill',
        style: { border: '1.5px solid ' + col, background: bg, color: col },
        onClick: () => dispatch({ type: 'DS', key: dsKey, value: todayStr() })
      }, n === 0 ? '✓ Logged' : 'Log Today')
    )
  );
}

// ── Survey row ────────────────────────────────────────────────────────────────
function SurveyRow({ acctId, val, dispatch }) {
  const st = surveyStatus(val);
  const doneThisMonth = val && new Date(val + 'T12:00:00').getMonth() === new Date(todayStr() + 'T12:00:00').getMonth();
  return h('div', { className: 'compliance-row', style: { borderBottom: 'none' } },
    h('div', null,
      h('div', { className: 't-label' }, 'Merch / Space Survey'),
      h('div', { style: { fontSize: 12, marginTop: 3, color: st.color, fontWeight: 700 } }, st.label)
    ),
    h('div', { className: 'compliance-row__actions' },
      doneThisMonth && h('button', {
        className: 'btn btn--ghost btn--sm btn--pill',
        style: { color: '#AAA', borderColor: '#DDD' },
        onClick: () => dispatch({ type: 'SURVEY_CLEAR', key: acctId })
      }, '×'),
      h('button', {
        className: 'btn btn--sm btn--pill',
        style: { border: '1.5px solid ' + st.color, background: st.bg, color: st.color },
        onClick: () => dispatch({ type: 'SURVEY', key: acctId })
      }, doneThisMonth ? '✓ Done' : 'Mark Done')
    )
  );
}

// ── Individual void item ──────────────────────────────────────────────────────
function VoidRow({ sku, stateIndex, stateDef, onTap, warn }) {
  const def = stateDef[stateIndex];
  return h('div', {
    className: 'void-row',
    style: stateIndex > 0 ? { background: def.bg } : {}
  },
    h('button', {
      className: 'btn--state',
      style: { background: def.bg, color: def.fg, border: '1.5px solid ' + def.border },
      onClick: onTap
    }, def.icon + ' ' + def.label.toUpperCase()),
    h('span', {
      className: 'void-row__sku' + (warn ? ' void-row__sku--warn' : '')
    }, warn ? '⚠ ' + sku : sku)
  );
}

// ── Void section (collapsible) ────────────────────────────────────────────────
function VoidSection({ title, subtitle, items, states, onTap, accentColor, stateDef, isObj }) {
  const [open, setOpen]       = useState(false);
  const [showAll, setShowAll] = useState(false);

  const openCount = items.filter((_, i) => !states[i]).length;
  const voidCount = items.filter((_, i) => states[i] === 1).length;
  const cutoff    = get90DayCutoff();
  const activeVis = items.map((_, i) => i).filter(i => (states[i] || 0) < stateDef.length - 1);
  const displayed = showAll ? items.map((_, i) => i) : activeVis;

  return h('div', { className: 'card', style: { marginBottom: 8 } },
    h('button', { className: 'collapse-btn', onClick: () => setOpen(!open) },
      h('div', { className: 'row' },
        h('span', { className: 't-label' }, title),
        h('span', { className: 't-muted', style: { fontSize: 12, marginLeft: 6 } }, subtitle)
      ),
      h('div', { className: 'row' },
        openCount > 0 && h('span', {
          style: { background: accentColor, color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }
        }, openCount),
        voidCount > 0 && h('span', {
          style: { background: '#B71C1C', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }
        }, voidCount + ' void'),
        h('span', { className: 'collapse-btn__chevron' }, open ? '▲' : '▼')
      )
    ),
    open && h('div', { className: 'collapse-body' },
      items.length > 6 && h('div', { className: 'void-toggle-bar' },
        h('button', {
          className: 'btn btn--sm btn--pill',
          style: { border: '2px solid ' + accentColor, background: showAll ? accentColor : '#fff', color: showAll ? '#fff' : accentColor },
          onClick: () => setShowAll(!showAll)
        }, showAll ? '▲ Open Only' : '▼ Show All (' + items.length + ')')
      ),
      displayed.length === 0
        ? h('div', { className: 'empty' }, 'All items actioned ✓')
        : displayed.map(i => {
          const item = items[i];
          const sku  = isObj ? item.s : SKUS[item];
          const warn = isObj && item.d && item.d < get90DayCutoff();
          return h(VoidRow, {
            key: i, sku, stateIndex: states[i] || 0, stateDef,
            onTap: () => onTap(i), warn
          });
        })
    )
  );
}


// ── Distro Drive Section ──────────────────────────────────────────────────────
// Shows Yellow (Needs Re-Buy) and Blue (Re-Buy) SKUs from the Constellation
// distro drive. Each SKU cycles: Open → Sold In. Red (Non-Buy) excluded.
function DistroDriveSection({ items, vsGet, onTap, tc }) {
  const [open, setOpen] = useState(true); // open by default — high priority this week

  const yellow = items.filter(i => i.type === 'Y');
  const blue   = items.filter(i => i.type === 'B');
  const openCount = items.filter(i => vsGet(i.sku) === 0).length;
  const soldIn    = items.filter(i => vsGet(i.sku) === 1).length;

  return h('div', { className: 'card', style: { marginBottom: 8, border: '2px solid #B45309' } },
    h('button', { className: 'collapse-btn', style: { background: '#FFFBEB' }, onClick: () => setOpen(!open) },
      h('div', { className: 'row' },
        h('span', { className: 't-label', style: { color: '#B45309' } }, '⭐ Constellation Distro Drive'),
        h('span', { className: 't-muted', style: { fontSize: 12, marginLeft: 6 } }, items.length + ' SKUs')
      ),
      h('div', { className: 'row' },
        openCount > 0 && h('span', {
          style: { background: '#B45309', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }
        }, openCount + ' open'),
        soldIn > 0 && h('span', {
          style: { background: '#1565C0', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, marginLeft: 4 }
        }, soldIn + ' ✓'),
        h('span', { className: 'collapse-btn__chevron' }, open ? '▲' : '▼')
      )
    ),
    open && h('div', null,
      // Yellow section
      yellow.length > 0 && h('div', null,
        h('div', { style: { padding: '6px 12px 4px', background: '#FFFBEB', borderBottom: '0.5px solid #FDE68A' } },
          h('span', { style: { fontSize: 11, fontWeight: 700, color: '#B45309' } }, '🟡 NEEDS RE-BUY')
        ),
        yellow.map((item, i) => h(DistroRow, { key: 'y'+i, item, state: vsGet(item.sku), onTap: () => onTap(item.sku) }))
      ),
      // Blue section
      blue.length > 0 && h('div', null,
        h('div', { style: { padding: '6px 12px 4px', background: '#EFF6FF', borderBottom: '0.5px solid #BFDBFE', borderTop: yellow.length > 0 ? '1px solid #F0F0F0' : 'none' } },
          h('span', { style: { fontSize: 11, fontWeight: 700, color: '#1D4ED8' } }, '🔵 RE-BUY')
        ),
        blue.map((item, i) => h(DistroRow, { key: 'b'+i, item, state: vsGet(item.sku), onTap: () => onTap(item.sku) }))
      )
    )
  );
}

function DistroRow({ item, state, onTap }) {
  const st = DD_STATES[state] || DD_STATES[0];
  return h('div', { className: 'void-row' },
    h('div', { className: 'void-row__sku', style: { fontSize: 12 } },
      item.sku,
      item.qty && item.qty !== '0'
        ? h('span', { style: { color: '#B45309', fontWeight: 700, marginLeft: 6 } }, '×' + item.qty)
        : null
    ),
    h('button', {
      className: 'btn--state',
      style: { background: st.bg, color: st.fg, borderColor: st.border, fontSize: 11, minHeight: 32, padding: '0 10px' },
      onClick: onTap
    }, st.icon + ' ' + st.label)
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ acct, data, weeklyDone, persist, day, dispatch, onBack }) {
  const [helperOpen, setHelperOpen] = useState(false);
  const notesRef = useRef(null);
  const tc    = TC[data ? data.t : acct.type] || TC['I'];
  const id    = acct.id;
  const done  = weeklyDone[id + '_' + day] || false;
  const notes = persist.notes[id] || '';
  const p     = data ? data.p : null;
  const bv    = data ? data.bv : null;
  const cvAll = data ? [...(data.ca || []), ...(data.cn || [])] : [];
  const suItems = data ? (data.su || []) : [];
  const plItems = data ? (data.pl || []) : [];
  const dname = displayName(acct);

  // Look up void state by SKU name (v4 format)
  const vs = (type, sku) => getVoidState(persist.vs, id, type, sku);

  const openVoids =
    cvAll.filter(v => vs('cv', v.s) === 0).length +
    suItems.filter(skuIdx => vs('su', SKUS[skuIdx]) === 0).length +
    plItems.filter(skuIdx => vs('pl', SKUS[skuIdx]) === 0).length;

  const ddItems   = data ? (data.dd || null) : null;
  const helperMsgs = data ? genHelper(acct, data) : ['No data loaded for this account yet.'];
  const pcol = v => v != null && v >= 0 ? '#2E7D32' : '#B71C1C';
  return h('div', { className: 'page' },
    // Sticky header
    h('div', { className: 'card-header', style: { background: tc.color } },
      h('div', { className: 'row', style: { marginBottom: 10 } },
        h('button', {
          className: 'btn btn--ghost-inv btn--sm',
          onClick: onBack
        }, '← Back'),
        h('div', { className: 'flex1 t-truncate', style: { marginLeft: 4 } },
          h('div', { className: 't-title t-white t-truncate' }, dname),
          h('div', { style: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 } }, tc.label + ' · ' + acct.id)
        ),
        h('button', {
          className: 'btn btn--sm',
          style: {
            background: done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1.5px solid rgba(255,255,255,' + (done ? '0.6' : '0.3') + ')',
          },
          onClick: () => {
            dispatch({ type: 'DONE', key: id + '_' + day });
            if (!done) dispatch({ type: 'LAST_VISIT', id });
          }
        }, done ? '✓ Done' : 'Mark Done')
      ),
      // Quick stats strip
      bv && h('div', { className: 'card-header__stats' },
        h('div', { className: 'card-header__stat' },
          h('div', { className: 'card-header__stat-label' }, 'YTD'),
          h('div', { className: 'card-header__stat-val', style: { color: bv[0] > 0 ? '#A5D6A7' : '#EF9A9A' } },
            (bv[0] > 0 ? '▲ ' : '▼ ') + Math.abs(bv[1]) + '%')
        ),
        p && p[1] != null && h('div', { className: 'card-header__stat' },
          h('div', { className: 'card-header__stat-label' }, 'MTD Δ'),
          h('div', { className: 'card-header__stat-val', style: { color: p[2] >= 0 ? '#A5D6A7' : '#EF9A9A' } }, fmtPct(p[2]))
        ),
        h('div', { className: 'card-header__stat' },
          h('div', { className: 'card-header__stat-label' }, 'Open'),
          h('div', { className: 'card-header__stat-val', style: { color: openVoids > 0 ? '#FFD54F' : '#A5D6A7' } }, openVoids || '✓')
        )
      )
    ),

    // Body
    h('div', { className: 'pad stack', style: { paddingTop: 12 } },
      // Performance detail
      p && p[1] != null && h('div', { className: 'card card-pad' },
        h('div', { className: 't-cap', style: { marginBottom: 10 } }, 'Performance'),
        h('div', { className: 'perf-grid' },
          ['MTD 25', 'MTD 26', 'MTD Δ', 'YTD 25', 'YTD 26', 'YTD Δ'].map((lbl, i) =>
            h('div', { key: i, className: 'perf-cell' },
              h('div', { className: 'perf-cell__lbl' }, lbl),
              h('div', { className: 'perf-cell__val', style: { color: (i === 2 || i === 5) ? pcol(p[i]) : '#1a1a1a' } },
                (i === 2 || i === 5) ? fmtPct(p[i]) : fmtCE(p[i])),
              (i === 2 && p[0] != null && p[1] != null) && h('div', { className: 'perf-cell__sub' },
                Math.abs(Math.round(p[1] - p[0])) + ' CE ' + (p[1] >= p[0] ? 'gained' : 'lost')),
              (i === 5 && p[3] != null && p[4] != null) && h('div', { className: 'perf-cell__sub' },
                Math.abs(Math.round(p[4] - p[3])) + ' CE ' + (p[4] >= p[3] ? 'gained' : 'lost'))
            )
          )
        ),
        data && data.sg && Object.keys(data.sg).length > 0 && h('div', {
          style: { marginTop: 10, borderTop: '1px solid #F0F0F0', paddingTop: 10 }
        },
          h('div', { className: 't-cap', style: { marginBottom: 6 } }, 'By Segment'),
          Object.entries(data.sg)
            .filter(([,v]) => v[1] != null)
            .sort((a,b) => (a[1][2]||0) - (b[1][2]||0))
            .map(([seg, v]) =>
              h('div', { key: seg, style: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'0.5px solid #F5F5F5' } },
                h('span', { style: { fontSize:12, color:'#555' } }, seg),
                h('div', { style: { textAlign:'right' } },
                  h('div', { style: { fontSize:12, fontWeight:700, color: (v[2]||0)>=0?'#15803D':'#DC2626' } }, fmtPct(v[2])),
                  h('div', { style: { fontSize:10, color:'#9CA3AF' } }, fmtCE(v[1]) + ' CE')
                )
              )
            )
        )
      ),

      // Pre-call helper
      h('div', { className: 'card' },
        h('button', { className: 'collapse-btn', onClick: () => setHelperOpen(!helperOpen) },
          h('span', { className: 't-label' }, 'Pre-Call Helper'),
          h('div', { className: 'row' },
            h('span', { className: 't-muted', style: { fontSize: 12 } }, helperMsgs.length + ' insight' + (helperMsgs.length > 1 ? 's' : '')),
            h('span', { className: 'collapse-btn__chevron' }, helperOpen ? '▲' : '▼')
          )
        ),
        helperOpen && h('div', { style: { padding: '4px 14px 12px', borderTop: '1px solid #F0F0F0' } },
          helperMsgs.map((m, i) =>
            h('div', { key: i, className: 'helper-bullet' },
              h('div', { className: 'helper-bullet__dot' }),
              h('div', { className: 'helper-bullet__text' }, m)
            )
          )
        )
      ),

      // Store compliance
      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Store Compliance')),
        h(ComplianceRow, { label: 'Price Tag Check',       dsKey: id + '_tags', val: persist.ds[id + '_tags'] || null, dispatch }),
        h(ComplianceRow, { label: 'Out-of-Code Walk',      dsKey: id + '_ooc',  val: persist.ds[id + '_ooc']  || null, dispatch }),
        h(ComplianceRow, { label: 'Rebates Up In Account', dsKey: id + '_reb',  val: persist.ds[id + '_reb']  || null, dispatch }),
        h(ComplianceRow, { label: 'POCM Up In Account',    dsKey: id + '_pocm', val: persist.ds[id + '_pocm'] || null, dispatch, noBorder: true }),
        h(SurveyRow, { acctId: id, val: persist.survey[id] || null, dispatch })
      ),

      // Void sections
      cvAll.length > 0 && h(VoidSection, {
        title: 'Chain Mod Voids', subtitle: '(' + cvAll.length + ')',
        items: cvAll, states: cvAll.map(v => vs('cv', v.s)),
        onTap: i => {
          const sku = cvAll[i].s;
          dispatch({ type: 'VS', id, voidType: 'cv', sku, value: (vs('cv', sku) + 1) % CV_STATES.length });
        },
        accentColor: '#B71C1C', stateDef: CV_STATES, isObj: true
      }),
      suItems.length > 0 && h(VoidSection, {
        title: 'Scale Up', subtitle: '(' + suItems.length + ')',
        items: suItems, states: suItems.map(skuIdx => vs('su', SKUS[skuIdx])),
        onTap: i => {
          const sku = SKUS[suItems[i]];
          dispatch({ type: 'VS', id, voidType: 'su', sku, value: (vs('su', sku) + 1) % SU_STATES.length });
        },
        accentColor: '#1A4731', stateDef: SU_STATES, isObj: false
      }),
      plItems.length > 0 && h(VoidSection, {
        title: 'Perfect Launch', subtitle: 'PODs · (' + plItems.length + ')',
        items: plItems, states: plItems.map(skuIdx => vs('pl', SKUS[skuIdx])),
        onTap: i => {
          const sku = SKUS[plItems[i]];
          dispatch({ type: 'VS', id, voidType: 'pl', sku, value: (vs('pl', sku) + 1) % PL_STATES.length });
        },
        accentColor: '#1565C0', stateDef: PL_STATES, isObj: false
      }),

      // Distro Drive (Constellation) — Yellow & Blue items only
      ddItems && ddItems.length > 0 && h(DistroDriveSection, {
        items: ddItems,
        vsGet: sku => getVoidState(persist.vs, id, 'dd', sku),
        onTap: sku => dispatch({ type: 'VS', id, voidType: 'dd', sku, value: (getVoidState(persist.vs, id, 'dd', sku) + 1) % DD_STATES.length }),
        tc,
      }),

      // Notes
      h('div', { className: 'card', id: 'notes-section-' + id },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Notes')),
        h('textarea', {
          ref: notesRef,
          className: 'notes-textarea',
          id: 'notes-textarea-' + id,
          value: notes,
          placeholder: 'Add notes for this account...',
          onChange: ev => dispatch({ type: 'NOTE', key: id, value: ev.target.value })
        })
      ),
      h('div', { style: { height: 80 } })
    ),
    // Floating notes button — always visible, scrolls to notes
    h('button', {
      className: 'fab-notes',
      title: 'Add note',
      onClick: () => {
        const el = document.getElementById('notes-section-' + id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            const ta = document.getElementById('notes-textarea-' + id);
            if (ta) ta.focus();
          }, 400);
        }
      }
    }, '📝')
  );
}

// ── Route Manager row ─────────────────────────────────────────────────────────
function RMRow({ acct, dayKey, isDragging, isTarget, dispatch, weeklyActive, editing, onEdit, onDone }) {
  const [nick, setNick] = useState(acct.nick || '');
  const override  = weeklyActive[acct.id + '_' + dayKey];
  const isActive  = override === undefined ? true : override;
  const suggest   = acct.freq === 'EOW' && acct.lastVisit ? (daysSince(acct.lastVisit) >= 10 ? 'On' : 'Off') : null;

  if (editing) {
    return h('div', { className: 'rm-edit-form' },
      h('div', { className: 't-cap', style: { marginBottom: 8 } }, acct.name),
      h('input', {
        value: nick,
        onChange: ev => setNick(ev.target.value),
        placeholder: 'Nickname (display name)...',
        style: { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }
      }),
      h('div', { className: 't-cap', style: { marginBottom: 6 } }, 'Frequency'),
      h('div', { className: 'toggle-group', style: { marginBottom: 14 } },
        Object.entries(FREQ_LABELS).map(([f, label]) =>
          h('button', {
            key: f,
            className: 'btn',
            style: {
              flex: 1, minHeight: 40,
              border: '1.5px solid ' + (acct.freq === f ? '#1E3A5F' : '#DDD'),
              background: acct.freq === f ? '#1E3A5F' : '#fff',
              color: acct.freq === f ? '#fff' : '#555',
              fontSize: 12
            },
            onClick: () => dispatch({ type: 'FREQ', id: acct.id, value: f })
          }, label)
        )
      ),
      h('div', { className: 't-cap', style: { marginBottom: 6 } }, 'Days on Route'),
      h('div', { className: 'toggle-group', style: { marginBottom: 14 } },
        DAYS.map(d => {
          const on = acct.days.includes(d);
          const dc2 = DC[d];
          return h('button', {
            key: d,
            className: 'btn',
            style: {
              flex: 1, minHeight: 40,
              border: '1.5px solid ' + (on ? dc2.color : '#DDD'),
              background: on ? dc2.color : '#fff',
              color: on ? '#fff' : '#999',
              fontSize: 12
            },
            onClick: () => dispatch({ type: 'CHANGE_DAY', id: acct.id, day: d })
          }, dc2.dayName);
        })
      ),
      h('div', { className: 'row' },
        h('button', {
          className: 'btn btn--primary flex1',
          onClick: () => { dispatch({ type: 'NICK', id: acct.id, value: nick }); onDone(); }
        }, 'Save'),
        h('button', { className: 'btn btn--ghost', style: { marginLeft: 8 }, onClick: onDone }, 'Cancel')
      )
    );
  }

  return h('div', {
    className: 'rm-row' + (isDragging ? ' dragging' : '') + (isTarget ? ' drag-target' : '')
  },
    h('div', { 'data-handle': true, className: 'rm-handle' }, '⠿'),
    h('div', { className: 'flex1', style: { minWidth: 0 } },
      h('div', {
        className: 't-label t-truncate',
        style: { color: isActive ? '#1a1a1a' : '#AAA', textDecoration: isActive ? 'none' : 'line-through' }
      }, displayName(acct)),
      h('div', { className: 'row', style: { marginTop: 4, gap: 6, flexWrap: 'wrap' } },
        h('span', { className: 't-tiny' }, acct.id),
        h('span', {
          style: {
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: acct.freq === 'W' ? '#E8F5E9' : acct.freq === 'EOW' ? '#FFF3E0' : '#F3E5F5',
            color:      acct.freq === 'W' ? '#2E7D32' : acct.freq === 'EOW' ? '#E65100' : '#6A1B9A',
          }
        }, acct.freq),
        suggest && h('span', {
          style: { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#E0F2FE', color: '#0369A1' }
        }, suggest + ' suggested'),
        acct.lastVisit && h('span', { className: 't-tiny' }, 'Last: ' + acct.lastVisit)
      )
    ),
    h('button', {
      className: 'btn btn--ghost btn--sm',
      style: { fontSize: 12 },
      onClick: onEdit
    }, 'Edit'),
    h('button', {
      className: 'btn btn--sm',
      style: {
        border: '1.5px solid ' + (isActive ? '#2E7D32' : '#DDD'),
        background: isActive ? '#E8F5E9' : '#F9F9F9',
        color:      isActive ? '#2E7D32' : '#AAA',
        fontSize: 12,
      },
      onClick: () => dispatch({ type: 'SET_ACTIVE', key: acct.id + '_' + dayKey, value: !isActive })
    }, isActive ? 'On' : 'Off')
  );
}

// ── Route Manager day section ─────────────────────────────────────────────────
function RMDay({ dayKey, roster, dispatch, weeklyActive }) {
  const [dragSrc,  setDragSrc]  = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [editId,   setEditId]   = useState(null);
  const listRef     = useRef(null);
  const dispatchRef = useRef(dispatch);
  const dayKeyRef   = useRef(dayKey);
  useEffect(() => { dispatchRef.current = dispatch; dayKeyRef.current = dayKey; });

  const dc    = DC[dayKey];
  const accts = roster.filter(r => r.days.includes(dayKey)).sort((a, b) => (a.order[dayKey] || 0) - (b.order[dayKey] || 0));

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let src = null, over = null;

    function getRowAt(y) {
      const rows = el.querySelectorAll('[data-row]');
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) return i;
      }
      return null;
    }
    function startDrag(handleEl) {
      const row = handleEl.closest('[data-row]');
      if (!row) return false;
      src = parseInt(row.dataset.idx);
      over = src;
      setDragSrc(src);
      setDragOver(src);
      return true;
    }
    function moveDrag(y) {
      if (src === null) return;
      const i = getRowAt(y);
      if (i !== null && over !== i) { over = i; setDragOver(i); }
    }
    function endDrag() {
      if (src !== null && over !== null && src !== over) {
        dispatchRef.current({ type: 'REORDER', day: dayKeyRef.current, src, dst: over });
      }
      src = null; over = null;
      setDragSrc(null); setDragOver(null);
    }

    const onTouchStart = e => {
      const dragHandle = e.target.closest('[data-handle]');
      if (!dragHandle) return;
      e.preventDefault();
      startDrag(dragHandle);
    };
    const onTouchMove = e => {
      if (src === null) return;
      e.preventDefault();
      moveDrag(e.touches[0].clientY);
    };
    const onMouseMove = e => moveDrag(e.clientY);
    const onMouseUp   = () => { endDrag(); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    const onMouseDown = e => {
      const dragHandle = e.target.closest('[data-handle]');
      if (!dragHandle) return;
      e.preventDefault();
      if (startDrag(dragHandle)) { document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); }
    };

    el.addEventListener('touchstart',  onTouchStart, { passive: false });
    el.addEventListener('touchmove',   onTouchMove,  { passive: false });
    el.addEventListener('touchend',    endDrag);
    el.addEventListener('mousedown',   onMouseDown);
    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    endDrag);
      el.removeEventListener('mousedown',   onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  return h('div', { style: { marginBottom: 16 } },
    h('div', { className: 'rm-day-header', style: { background: dc.color } },
      dc.dayName + ' · ' + dc.date
    ),
    h('div', { ref: listRef, className: 'card', style: { borderRadius: '0 0 10px 10px', borderTop: 'none' } },
      accts.length === 0
        ? h('div', { className: 'empty' }, 'No accounts assigned')
        : accts.map((acct, idx) =>
          h('div', { 'data-row': true, 'data-idx': idx, key: acct.id },
            h(RMRow, {
              acct, dayKey,
              isDragging: dragSrc === idx,
              isTarget:   dragOver === idx && dragSrc !== null && dragSrc !== idx,
              dispatch, weeklyActive,
              editing:  editId === acct.id,
              onEdit:   () => setEditId(acct.id),
              onDone:   () => setEditId(null),
            })
          )
        )
    )
  );
}

// ── Route Manager screen ──────────────────────────────────────────────────────
function RouteManager({ roster, dispatch, weeklyActive, reconcReport, onClose }) {
  return h('div', { className: 'page' },
    h(BackHeader, { onBack: onClose, title: 'Manage Route', subtitle: 'Drag ⠿ to reorder · tap Edit to rename / reassign' }),
    reconcReport && h('div', { style: { margin: '12px 12px 0', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px' } },
      h('div', { style: { fontSize: 13, fontWeight: 700, color: '#C2410C', marginBottom: 8 } }, '⚡ Route changes detected'),
      reconcReport.added.length > 0 && h('div', { style: { fontSize: 12, color: '#166534', marginBottom: 4 } },
        '+ ' + reconcReport.added.length + ' new account' + (reconcReport.added.length > 1 ? 's' : '') + ' added: ' +
        reconcReport.added.map(a => a.name).join(', ')
      ),
      reconcReport.archived.length > 0 && h('div', { style: { fontSize: 12, color: '#B45309', marginBottom: 4 } },
        '— ' + reconcReport.archived.length + ' account' + (reconcReport.archived.length > 1 ? 's' : '') + ' no longer in route data (archived): ' +
        reconcReport.archived.map(a => a.name).join(', ')
      ),
      reconcReport.renamed.length > 0 && h('div', { style: { fontSize: 12, color: '#6D28D9', marginBottom: 4 } },
        '~ ' + reconcReport.renamed.length + ' account name' + (reconcReport.renamed.length > 1 ? 's' : '') + ' updated.'
      ),
      reconcReport.voidCountChanged.length > 0 && h('div', { style: { fontSize: 12, color: '#B45309' } },
        '⚠ Void count changed on: ' + reconcReport.voidCountChanged.map(a => a.name).join(', ') + '. Check void states for these accounts.'
      )
    ),
    h('div', { className: 'pad stack' },
      DAYS.map(d => h(RMDay, { key: d, dayKey: d, roster, dispatch, weeklyActive }))
    )
  );
}

// ── Settings / Backup screen ──────────────────────────────────────────────────
function SettingsScreen({ state, dispatch, onClose }) {
  const [importError,   setImportError]   = useState(null);
  const [importOk,      setImportOk]      = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);  // parsed JSON awaiting confirmation
  const [pendingMode,   setPendingMode]   = useState('safe_merge');
  const [preview,       setPreview]       = useState(null);
  const [confirmFull,   setConfirmFull]   = useState(false);
  const fileRef = useRef(null);

  function triggerDownload(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doFullExport() {
    triggerDownload('route508-backup-' + todayStr() + '.json', buildFullBackup(state));
  }

  function doWeeklyExport() {
    triggerDownload('route508-weekly-' + WEEK_KEY + '.json', buildWeeklyBackup(state));
  }

  function onFileSelected(file) {
    setImportError(null);
    setImportOk(false);
    setPendingBackup(null);
    setPreview(null);
    setConfirmFull(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const obj = JSON.parse(ev.target.result);
        const err = validateBackupFile(obj);
        if (err) { setImportError(err); return; }
        const pv = previewImport(obj, state, pendingMode);
        setPendingBackup(obj);
        setPreview(pv);
      } catch (e) {
        setImportError('File is not valid JSON: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function applyPending() {
    if (!pendingBackup) return;
    if (pendingMode === 'full_restore' && !confirmFull) {
      setConfirmFull(true);
      return;
    }
    const next = applyImport(pendingBackup, state, pendingMode);
    dispatch({ type: 'LOAD_ALL', value: next });
    // Persist all three layers
    storage.set(STORAGE_KEYS.ROSTER,   next.roster);
    storage.set(STORAGE_KEYS.PERSIST,  next.persist);
    storage.set(STORAGE_KEYS.weekly(),  next.weekly);
    setPendingBackup(null);
    setPreview(null);
    setConfirmFull(false);
    setImportOk(true);
  }

  function cancelImport() {
    setPendingBackup(null);
    setPreview(null);
    setConfirmFull(false);
    setImportError(null);
  }

  function onModeChange(mode) {
    setPendingMode(mode);
    if (pendingBackup) {
      setPreview(previewImport(pendingBackup, state, mode));
      setConfirmFull(false);
    }
  }

  const modeLabels = {
    safe_merge:   'Safe Merge (recommended)',
    roster_only:  'Roster Only',
    full_restore: 'Full Restore',
  };
  const modeDesc = {
    safe_merge:   "Updates your account list and data. Preserves this week\'s progress. Safe to use anytime.",
    roster_only:  "Only updates the route order, nicknames, and frequencies. Notes and progress untouched.",
    full_restore: "Replaces everything — roster, notes, progress. Use only for disaster recovery.",
  };

  return h('div', { className: 'page' },
    h(BackHeader, { onBack: onClose, title: 'Settings & Backup' }),
    h('div', { className: 'pad stack' },

      // ── Export ─────────────────────────────────────────────────────────────
      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Export Backup')),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Full Backup'),
            h('div', { className: 't-sub' }, 'All notes, compliance dates, roster, and this week\'s progress')
          ),
          h('button', { className: 'btn btn--ghost btn--sm', onClick: doFullExport }, 'Export')
        ),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Weekly Snapshot'),
            h('div', { className: 't-sub' }, 'This week\'s progress + notes only (lighter file)')
          ),
          h('button', { className: 'btn btn--ghost btn--sm', onClick: doWeeklyExport }, 'Export')
        )
      ),

      // ── Import ─────────────────────────────────────────────────────────────
      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Import / Restore')),

        // Mode selector
        h('div', { style: { padding: '12px 14px', borderBottom: '1px solid #EBEBEB' } },
          h('div', { className: 't-cap', style: { marginBottom: 8 } }, 'Import Mode'),
          ['safe_merge', 'roster_only', 'full_restore'].map(m =>
            h('div', { key: m, style: { marginBottom: 8 } },
              h('label', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' } },
                h('input', {
                  type: 'radio', name: 'importMode', value: m,
                  checked: pendingMode === m,
                  onChange: () => onModeChange(m),
                  style: { marginTop: 3, flexShrink: 0 }
                }),
                h('div', null,
                  h('div', { style: { fontSize: 13, fontWeight: 600, color: m === 'full_restore' ? '#B71C1C' : '#1a1a1a' } }, modeLabels[m]),
                  h('div', { style: { fontSize: 12, color: '#666', marginTop: 2 } }, modeDesc[m])
                )
              )
            )
          )
        ),

        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Choose backup file'),
            h('div', { className: 't-sub' }, 'Accepts .json files exported from this app')
          ),
          h('button', {
            className: 'btn btn--ghost btn--sm',
            onClick: () => { fileRef.current && fileRef.current.click(); }
          }, 'Choose File')
        ),
        h('input', {
          ref: fileRef, type: 'file', accept: '.json',
          style: { display: 'none' },
          onChange: ev => { if (ev.target.files[0]) onFileSelected(ev.target.files[0]); ev.target.value = ''; }
        }),
        importError && h('div', { style: { padding: '10px 14px', color: '#B71C1C', fontSize: 13, borderTop: '1px solid #EBEBEB' } },
          '⚠ ' + importError
        ),

        // Preview panel
        preview && h('div', { style: { padding: '12px 14px', borderTop: '1px solid #EBEBEB', background: '#FAFAFA' } },
          h('div', { className: 't-cap', style: { marginBottom: 8 } }, 'What will change'),

          preview.rosterChanges.length > 0 && h('div', { style: { marginBottom: 8 } },
            preview.rosterChanges.map((rc, i) =>
              h('div', { key: i, style: { fontSize: 12, color: rc.type === 'add' ? '#166534' : '#B45309', marginBottom: 3 } },
                (rc.type === 'add' ? '+ ' : '± ') + rc.name + ' (' + rc.id + ')'
              )
            )
          ),
          h('div', { style: { fontSize: 12, color: '#555', marginBottom: 4 } },
            preview.weeklyTouched
              ? '⚠ This week\'s progress will be replaced.'
              : '✓ This week\'s progress is untouched.'
          ),
          preview.notesOverwritten > 0 && h('div', { style: { fontSize: 12, color: '#B45309', marginBottom: 4 } },
            '⚠ ' + preview.notesOverwritten + ' note(s) will be overwritten by backup version.'
          ),
          preview.warnings.map((w, i) =>
            h('div', { key: i, style: { fontSize: 12, color: '#B71C1C', marginBottom: 4 } }, '⚠ ' + w)
          ),

          // Confirm full restore double-tap
          confirmFull && h('div', { style: { marginTop: 8, padding: 10, background: '#FFF0F0', borderRadius: 8, border: '1px solid #FFCDD2' } },
            h('div', { style: { fontSize: 13, fontWeight: 700, color: '#B71C1C', marginBottom: 8 } },
              'Are you sure? This will replace ALL data.'
            ),
            h('div', { className: 'row', style: { gap: 8 } },
              h('button', {
                className: 'btn btn--danger flex1',
                onClick: applyPending
              }, 'Yes, Replace Everything'),
              h('button', {
                className: 'btn btn--ghost flex1',
                onClick: () => setConfirmFull(false)
              }, 'Cancel')
            )
          ),

          !confirmFull && h('div', { className: 'row', style: { gap: 8, marginTop: 8 } },
            h('button', {
              className: 'btn btn--primary flex1',
              style: { background: pendingMode === 'full_restore' ? '#B71C1C' : undefined },
              onClick: applyPending
            }, pendingMode === 'full_restore' ? 'Replace All Data' : 'Apply Import'),
            h('button', {
              className: 'btn btn--ghost flex1',
              onClick: cancelImport
            }, 'Cancel')
          )
        ),

        importOk && !preview && h('div', { style: { padding: '10px 14px', color: '#166534', fontSize: 13, borderTop: '1px solid #EBEBEB' } },
          '✓ Import applied successfully.'
        )
      ),

      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Storage Info')),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Storage type'),
            h('div', { className: 't-sub' }, 'localStorage (device only)')
          )
        ),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Week key'),
            h('div', { className: 't-sub' }, WEEK_KEY + ' · ' + DC.mon.date + ' – ' + DC.fri.date)
          )
        )
      ),

      // Last week scoreboard
      (function() {
        const lw = storage.get(STORAGE_KEYS.LASTWEEK);
        if (!lw) return h('div', { className: 'card card-pad' },
          h('div', { className: 't-cap', style: { marginBottom: 8 } }, 'Last Week'),
          h('div', { className: 't-sub' }, 'No previous week data saved yet.')
        );
        const days = ['mon','tue','wed','thu','fri'];
        const dayNames = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri' };
        return h('div', { className: 'card' },
          h('div', { className: 'section-header row-spread' },
            h('div', { className: 't-cap' }, 'Last Week'),
            h('div', { className: 't-sub' }, lw.weekKey)
          ),
          // Totals row
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 14px', borderBottom: '1px solid #EBEBEB' } },
            [['t','Taps'],['d','Displays'],['p','PODs']].map(([k, label]) =>
              h('div', { key: k, style: { background: '#F7F8FA', borderRadius: 8, padding: '10px 8px', textAlign: 'center', border: '1px solid #EBEBEB' } },
                h('div', { className: 't-cap', style: { marginBottom: 4 } }, label),
                h('div', { style: { fontSize: 22, fontWeight: 700, color: '#1a1a1a' } }, lw.totals[k] || 0)
              )
            )
          ),
          // Per-day breakdown
          h('div', { style: { padding: '8px 0' } },
            days.filter(d => lw.sc && lw.sc[d]).map(d =>
              h('div', { key: d, style: { display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '0.5px solid #F5F5F5', gap: 8 } },
                h('span', { style: { fontSize: 12, fontWeight: 700, color: '#888', width: 30 } }, dayNames[d]),
                h('span', { style: { fontSize: 12, color: '#555', flex: 1 } },
                  (lw.sc[d].t || 0) + ' Taps · ' + (lw.sc[d].d || 0) + ' Displays · ' + (lw.sc[d].p || 0) + ' PODs'
                )
              )
            )
          ),
          h('div', { style: { padding: '8px 14px', borderTop: '0.5px solid #F0F0F0' } },
            h('div', { className: 't-tiny' }, 'Archived on ' + lw.savedAt)
          )
        );
      })()
    )
  );
}
// ── End-of-day summary ────────────────────────────────────────────────────────
function buildSummary(day, roster, state) {
  const dc = DC[day];
  const lines = ['Route 508 · ' + dc.label + ' End-of-Day Summary', ''];
  const tv = [], pitched = [], sold = [], nl = [];
  let vis = 0;

  const dayAccts = roster.filter(r => r.days.includes(day));
  dayAccts.forEach(acct => {
    const id = acct.id;
    if (!state.weekly.done[id + '_' + day]) return;
    vis++;
    const data = getAcctData(id);
    if (!data) return;
    const acctVs = state.persist.vs[id] || {};
    const cvVs   = acctVs.cv || {};
    const suVs   = acctVs.su || {};
    const plVs   = acctVs.pl || {};
    const cv = [...(data.ca || []), ...(data.cn || [])];
    cv.forEach(v => {
      const st = cvVs[v.s] || 0;
      if (st === 1) tv.push('  ' + displayName(acct) + ': ' + v.s);
      if (st === 4) sold.push('  ' + displayName(acct) + ': ' + v.s);
    });
    (data.su || []).forEach(idx => {
      const sku = SKUS[idx];
      const st  = suVs[sku] || 0;
      if (st === 3) pitched.push('  ' + displayName(acct) + ': ' + sku);
      if (st === 4) sold.push('  '    + displayName(acct) + ': ' + sku);
    });
    (data.pl || []).forEach(idx => {
      const sku = SKUS[idx];
      const st  = plVs[sku] || 0;
      if (st === 2) pitched.push('  ' + displayName(acct) + ': ' + sku);
      if (st === 3) sold.push('  '    + displayName(acct) + ' (POD): ' + sku);
    });
    const ddVs2 = (acctVs.dd || {});
    (data.dd || []).forEach(item => {
      if ((ddVs2[item.sku] || 0) === 1) sold.push('  ' + displayName(acct) + ' (Distro): ' + item.sku);
    });
    const n = state.persist.notes[id];
    if (n && n.trim()) nl.push('  ' + displayName(acct) + ': ' + n.trim());
  });

  lines.push('Accounts visited: ' + vis + '/' + dayAccts.length);
  if (tv.length)      { lines.push(''); lines.push('True Voids Found (' + tv.length + '):');  tv.forEach(l => lines.push(l)); }
  if (pitched.length) { lines.push(''); lines.push('Ideas Pitched (' + pitched.length + '):'); pitched.forEach(l => lines.push(l)); }
  if (sold.length)    { lines.push(''); lines.push('Sold In Today (' + sold.length + '):');    sold.forEach(l => lines.push(l)); }
  if (nl.length)      { lines.push(''); lines.push('Notes:');                                  nl.forEach(l => lines.push(l)); }
  const sc = state.weekly.sc[day];
  lines.push('');
  lines.push('Scoreboard: ' + sc.t + ' Taps · ' + sc.d + ' Displays · ' + sc.p + ' PODs');
  return lines.join('\n');
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [state, rawDispatch] = useReducer(reducer, INIT_STATE);
  const [day,   setDay]      = useState('mon');
  const [acct,  setAcct]     = useState(null);   // { acct, data }
  const [screen, setScreen]  = useState('home'); // home | summary | manage | settings
  const [loaded, setLoaded]  = useState(false);

  // Undo system
  const prevStateRef = useRef(null);
  const [toast,    setToast]    = useState(null);
  const toastTimer = useRef(null);

  function dispatch(action) {
    const label = actionLabel(action);
    prevStateRef.current = state;
    rawDispatch(action);
    if (!label) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(label);
    toastTimer.current = setTimeout(() => { setToast(null); prevStateRef.current = null; }, 2500);
  }
  function undoLast() {
    if (prevStateRef.current) rawDispatch({ type: 'LOAD_ALL', value: prevStateRef.current });
    prevStateRef.current = null;
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }

  // New-week banner + reconciliation report
  const [newWeekToast,  setNewWeekToast]  = useState(false);
  const [reconcReport,  setReconcReport]  = useState(null); // shown in Route Manager

  // Load from storage on mount — runs migration and reconciliation
  useEffect(() => {
    try {
      // 1. Archive last week's scoreboard if week rolled over
      const isNewWeek = !storage.get(STORAGE_KEYS.weekly()) && archiveLastWeekIfNeeded();
      if (isNewWeek) setNewWeekToast(true);

      // 2. Read raw stored data
      let savedRoster  = storage.get(STORAGE_KEYS.ROSTER);
      let savedPersist = storage.get(STORAGE_KEYS.PERSIST);
      let savedWeekly  = storage.get(STORAGE_KEYS.weekly());

      // 3. Migrate from older schema if needed
      const migrated = migrateData(savedRoster, savedPersist, savedWeekly);
      savedRoster  = migrated.roster  || SEED_ROSTER;
      savedPersist = migrated.persist || INIT_PERSIST;
      savedWeekly  = migrated.weekly  || INIT_WEEKLY;

      // Write migrated data back if it changed
      if (migrated.migrated) {
        storage.set(STORAGE_KEYS.ROSTER,  savedRoster);
        storage.set(STORAGE_KEYS.PERSIST, savedPersist);
        storage.set(STORAGE_KEYS.weekly(), savedWeekly);
        storage.set(STORAGE_KEYS.META, { schemaVersion: SCHEMA_VERSION, lastReconciled: null });
      }

      // 4. Reconcile roster against current RDATA
      const { roster: reconciledRoster, report } = reconcileRoster(savedRoster);
      if (reconciledRoster) savedRoster = reconciledRoster;
      if (report) {
        setReconcReport(report);
        storage.set(STORAGE_KEYS.ROSTER, savedRoster);
      }

      // 4b. Clean up void states — drop SKUs no longer in this week's data.
      //    User rule: SKU absent from current data = resolved, stop tracking.
      //    SKUs still in data keep their state (True Void, Not in Set, etc).
      const cleanedVs = cleanupVoidStates(savedPersist.vs);
      if (cleanedVs._droppedCount > 0) {
        savedPersist = { ...savedPersist, vs: cleanedVs };
        storage.set(STORAGE_KEYS.PERSIST, savedPersist);
        console.log('Dropped ' + cleanedVs._droppedCount + ' stale void state(s) for SKUs no longer in weekly data.');
      } else {
        savedPersist = { ...savedPersist, vs: cleanedVs };
      }

      // 5. Ensure weekly state matches current week
      if (savedWeekly.weekKey && savedWeekly.weekKey !== WEEK_KEY) {
        savedWeekly = { ...INIT_WEEKLY };
      }

      // 6. Update meta
      storage.set(STORAGE_KEYS.META, {
        schemaVersion:   SCHEMA_VERSION,
        lastReconciled:  todayStr(),
      });

      rawDispatch({ type: 'LOAD_ALL', value: {
        roster:  savedRoster,
        persist: savedPersist,
        weekly:  savedWeekly,
      }});
    } catch (e) {
      console.error('App load error:', e);
      rawDispatch({ type: 'LOAD_ALL', value: { roster: SEED_ROSTER, persist: INIT_PERSIST, weekly: INIT_WEEKLY } });
    }
    setLoaded(true);
  }, []);

  // Persist to storage whenever state changes
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (state.roster)  storage.set(STORAGE_KEYS.ROSTER,  state.roster);
      if (state.persist) storage.set(STORAGE_KEYS.PERSIST, state.persist);
      if (state.weekly)  storage.set(STORAGE_KEYS.weekly(), state.weekly);
    }, 600);
  }, [state, loaded]);

  if (!loaded) return h('div', { className: 'loading' }, 'Loading Route 508...');

  const roster   = state.roster || SEED_ROSTER;
  const toastEl  = toast && h(Toast, { msg: toast, onUndo: undoLast });

  // ── Sub-screens ─────────────────────────────────────────────────────────────
  if (screen === 'manage') return h('div', null,
    h(RouteManager, { roster, dispatch, weeklyActive: state.weekly.active, reconcReport, onClose: () => setScreen('home') }),
    toastEl
  );

  if (screen === 'settings') return h('div', null,
    h(SettingsScreen, { state, dispatch: rawDispatch, onClose: () => setScreen('home') }),
    toastEl
  );

  if (acct) return h('div', null,
    h(AccountCard, {
      acct: acct.acct, data: acct.data,
      weeklyDone: state.weekly.done,
      persist:    state.persist,
      day, dispatch,
      onBack: () => setAcct(null),
    }),
    toastEl
  );

  if (screen === 'summary') {
    const txt = buildSummary(day, roster, state);
    const dc  = DC[day];
    return h('div', { className: 'page pad' },
      h('button', { className: 'btn btn--ghost btn--sm', style: { marginBottom: 14 }, onClick: () => setScreen('home') }, '← Back'),
      h('div', { className: 't-title', style: { marginBottom: 12 } }, dc.label + ' Summary'),
      h('textarea', { className: 'summary-text', readOnly: true, value: txt }),
      h('button', {
        className: 'btn btn--primary btn--full',
        style: { marginTop: 10, background: dc.color },
        onClick: () => { try { navigator.clipboard.writeText(txt); } catch (e) {} }
      }, 'Copy to Clipboard'),
      toastEl
    );
  }

  // ── Home screen ──────────────────────────────────────────────────────────────
  const dc       = DC[day];
  const sc       = state.weekly.sc[day];
  const dayAccts = roster.filter(r => {
    if (!r.days.includes(day)) return false;
    const override = state.weekly.active[r.id + '_' + day];
    return override === undefined ? true : override;
  }).sort((a, b) => (a.order[day] || 0) - (b.order[day] || 0));
  const doneCount = dayAccts.filter(r => state.weekly.done[r.id + '_' + day]).length;

  return h('div', { className: 'page' },
    // New week banner (shown once on first load of new week)
    newWeekToast && h(NewWeekBanner, { onClose: () => setNewWeekToast(false) }),
    // App header
    h('div', { className: 'app-header', style: { background: dc.color, transition: 'background 0.3s ease' } },
      h('div', { className: 'app-header__title row-spread' },
        h('div', null,
          h('div', { className: 't-hero t-white' }, 'Route 508'),
          h('div', { style: { color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 1 } }, 'Payton Stone')
        ),
        h('div', { className: 'row' },
          h('button', {
            className: 'btn btn--ghost-inv btn--sm',
            style: { fontSize: 11 },
            onClick: () => setScreen('manage')
          }, '⚙ Route'),
          h('button', {
            className: 'btn btn--ghost-inv btn--sm',
            style: { fontSize: 11, marginLeft: 6 },
            onClick: () => setScreen('settings')
          }, '⚙ Settings'),
          h('button', {
            className: 'btn btn--ghost-inv btn--sm',
            style: { fontSize: 11, marginLeft: 6 },
            onClick: () => dispatch({ type: 'RST' })
          }, 'Reset')
        )
      ),
      h('div', { className: 'app-header__quote t-italic' }, '"' + getQuote() + '"'),
      // Folder tabs
      h('div', { className: 'day-tabs' },
        DAYS.map(d => {
          const dc2      = DC[d];
          const total    = roster.filter(r => r.days.includes(d)).length;
          const done     = roster.filter(r => r.days.includes(d) && state.weekly.done[r.id + '_' + d]).length;
          const isActive = d === day;
          return h('button', {
            key: d,
            className: 'day-tab' + (isActive ? ' active' : ''),
            style: {
              background: isActive ? '#FFFFFF' : 'rgba(0,0,0,0.18)',
              borderTop:  isActive ? '3px solid rgba(255,255,255,0.7)' : '3px solid transparent',
            },
            onClick: () => setDay(d)
          },
            h('div', { className: 'day-tab__name', style: { color: isActive ? dc2.color : '#fff', opacity: isActive ? 1 : 0.7, fontWeight: isActive ? 700 : 500 } }, dc2.dayName),
            h('div', { className: 'day-tab__date', style: { color: isActive ? dc2.color : '#fff', opacity: isActive ? 0.8 : 0.5 } }, dc2.date),
            h('div', { className: 'day-tab__prog', style: { color: isActive ? dc2.color : 'rgba(255,255,255,0.5)', fontWeight: isActive ? 700 : 400 } }, done + '/' + total)
          );
        })
      )
    ),

    h('div', { className: 'pad stack' },
      // Day card + scoreboard
      h('div', { className: 'card card-pad' },
        h('div', { className: 'row-spread', style: { marginBottom: 12 } },
          h('div', null,
            h('div', { className: 't-title' }, dc.label),
            h('div', { className: 't-sub', style: { marginTop: 2 } }, doneCount + '/' + dayAccts.length + ' done')
          ),
          h('button', {
            className: 'btn btn--sm',
            style: { background: dc.color, color: '#fff', border: 'none' },
            onClick: () => setScreen('summary')
          }, 'Summary')
        ),
        h('div', { className: 'scoreboard' },
          [['t', 'Taps', '#1E3A5F'], ['d', 'Displays', '#1A4731'], ['p', 'PODs', '#5C1A33']].map(([k, lbl, col]) =>
            h('div', { key: k, className: 'score-cell' },
              h('div', { className: 't-cap' }, lbl),
              h('div', { className: 'score-controls' },
                h('button', { className: 'btn--counter', onClick: () => dispatch({ type: 'SCR', day, metric: k, delta: -1 }) }, '−'),
                h('span', { className: 'score-value' }, sc[k]),
                h('button', {
                  className: 'btn--counter btn--counter-up',
                  style: { borderColor: col, color: col, background: col + '18' },
                  onClick: () => dispatch({ type: 'SCR', day, metric: k, delta: 1 })
                }, '+')
              )
            )
          )
        )
      ),

      // Account list
      toastEl,
      h('div', { className: 'card' },
        dayAccts.length === 0
          ? h('div', { className: 'empty' }, 'No accounts active. Use ⚙ Route to activate accounts.')
          : dayAccts.map((r, i) => {
            const data   = getAcctData(r.id);
            const done   = state.weekly.done[r.id + '_' + day] || false;
            const tc     = TC[r.type] || TC['I'];
            const cv     = data ? [...(data.ca || []), ...(data.cn || [])] : [];
            const dd     = data ? (data.dd || []) : [];
            const total  = cv.length + (data ? data.su.length : 0) + (data ? data.pl.length : 0) + dd.length;
            const acctVs = state.persist.vs[r.id] || {};
            const cvVs   = acctVs.cv || {};
            const suVs   = acctVs.su || {};
            const plVs   = acctVs.pl || {};
            const ddVs   = acctVs.dd || {};
            const open   = total - (
              cv.filter(v => (cvVs[v.s] || 0) > 0).length +
              (data ? data.su : []).filter(skuIdx => (suVs[SKUS[skuIdx]] || 0) > 0).length +
              (data ? data.pl : []).filter(skuIdx => (plVs[SKUS[skuIdx]] || 0) > 0).length +
              dd.filter(item => (ddVs[item.sku] || 0) > 0).length
            );
            const bl     = data ? data.bl : 0;
            const survey = state.persist.survey[r.id];
            const ss     = surveyStatus(survey);

            return h('div', {
              key: r.id,
              className: 'acct-row' + (done ? ' done' : ''),
              onClick:   () => setAcct({ acct: r, data })
            },
              h('div', { className: 'acct-row__stripe', style: { background: done ? '#DDD' : tc.color } }),
              h('div', { className: 'flex1', style: { minWidth: 0 } },
                h('div', { className: 'row', style: { marginBottom: 3 } },
                  h('span', {
                    className: 't-label t-truncate flex1',
                    style: { color: done ? '#BBB' : '#1a1a1a', textDecoration: done ? 'line-through' : 'none' }
                  }, displayName(r)),
                  bl !== 0 && !done && h('span', {
                    className: 'acct-row__badge ' + (bl > 0 ? 'acct-row__badge--up' : 'acct-row__badge--dn')
                  }, bl > 0 ? '▲' : '▼')
                ),
                h('div', { className: 'row', style: { gap: 6 } },
                  h('span', { className: 't-tiny' }, tc.label + ' · ' + r.id),
                  survey && ss.label === 'Done ✓' && h('span', { style: { fontSize: 10, fontWeight: 700, color: '#2E7D32' } }, 'Survey ✓')
                )
              ),
              total > 0 && h('div', {
                className: 'acct-row__void-pill',
                style: {
                  background: done || open === 0 ? '#E8F5E9' : tc.color,
                  color:      done || open === 0 ? '#2E7D32' : '#fff',
                }
              }, done || open === 0 ? '✓' : open),
              h('span', { className: 'acct-row__chevron' }, '›')
            );
          })
      ),
      h('div', { style: { height: 20 } })
    )
  );
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(function boot() {
  const root = document.getElementById('root');
  if (!root) return;

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Error boundary wrapper
  class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(e) { return { error: e }; }
    render() {
      if (this.state.error) {
        return React.createElement('div', { style: { padding: 20, fontFamily: 'system-ui' } },
          React.createElement('h2', { style: { color: '#B71C1C', marginBottom: 12 } }, 'Something went wrong'),
          React.createElement('p', { style: { fontSize: 14, color: '#555', marginBottom: 16 } }, this.state.error.message),
          React.createElement('button', {
            style: { padding: '10px 20px', background: APP_HEADER_COLOR, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
            onClick: () => this.setState({ error: null })
          }, 'Try Again')
        );
      }
      return this.props.children;
    }
  }

  ReactDOM.render(
    React.createElement(ErrorBoundary, null, React.createElement(App)),
    root
  );
})();
