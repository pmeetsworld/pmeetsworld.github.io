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
      const vs = { ...state.persist.vs, [action.key]: action.value };
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
  return h('div', { className: 'rm-header row', style: { background: color || '#1a1a2e', gap: 12 } },
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

// ── Account Card ──────────────────────────────────────────────────────────────
function AccountCard({ acct, data, weeklyDone, persist, day, dispatch, onBack }) {
  const [helperOpen, setHelperOpen] = useState(false);
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

  const vs = (type, i) => persist.vs[id + '_' + type + '_' + i] || 0;

  const openVoids =
    cvAll.filter((_, i) => vs('cv', i) === 0).length +
    suItems.filter((_, i) => vs('su', i) === 0).length +
    plItems.filter((_, i) => vs('pl', i) === 0).length;

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
        h('div', { className: 't-cap', style: { marginBottom: 10 } }, 'Performance Detail'),
        h('div', { className: 'perf-grid' },
          ['MTD 25', 'MTD 26', 'MTD Δ', 'YTD 25', 'YTD 26', 'YTD Δ'].map((lbl, i) =>
            h('div', { key: i, className: 'perf-cell' },
              h('div', { className: 'perf-cell__lbl' }, lbl),
              h('div', { className: 'perf-cell__val', style: { color: (i === 2 || i === 5) ? pcol(p[i]) : '#1a1a1a' } },
                (i === 2 || i === 5) ? fmtPct(p[i]) : fmtCE(p[i]))
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
        items: cvAll, states: cvAll.map((_, i) => vs('cv', i)),
        onTap: i => dispatch({ type: 'VS', key: id + '_cv_' + i, value: (vs('cv', i) + 1) % CV_STATES.length }),
        accentColor: '#B71C1C', stateDef: CV_STATES, isObj: true
      }),
      suItems.length > 0 && h(VoidSection, {
        title: 'Scale Up', subtitle: '(' + suItems.length + ')',
        items: suItems, states: suItems.map((_, i) => vs('su', i)),
        onTap: i => dispatch({ type: 'VS', key: id + '_su_' + i, value: (vs('su', i) + 1) % SU_STATES.length }),
        accentColor: '#1A4731', stateDef: SU_STATES, isObj: false
      }),
      plItems.length > 0 && h(VoidSection, {
        title: 'Perfect Launch', subtitle: 'PODs · (' + plItems.length + ')',
        items: plItems, states: plItems.map((_, i) => vs('pl', i)),
        onTap: i => dispatch({ type: 'VS', key: id + '_pl_' + i, value: (vs('pl', i) + 1) % PL_STATES.length }),
        accentColor: '#1565C0', stateDef: PL_STATES, isObj: false
      }),

      // Notes
      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Notes')),
        h('textarea', {
          className: 'notes-textarea',
          value: notes,
          placeholder: 'Add notes for this account...',
          onChange: ev => dispatch({ type: 'NOTE', key: id, value: ev.target.value })
        })
      ),
      h('div', { style: { height: 40 } })
    )
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
function RouteManager({ roster, dispatch, weeklyActive, onClose }) {
  return h('div', { className: 'page' },
    h(BackHeader, { onBack: onClose, title: 'Manage Route', subtitle: 'Drag ⠿ to reorder · tap Edit to rename / reassign' }),
    h('div', { className: 'pad stack' },
      DAYS.map(d => h(RMDay, { key: d, dayKey: d, roster, dispatch, weeklyActive }))
    )
  );
}

// ── Settings / Backup screen ──────────────────────────────────────────────────
function SettingsScreen({ state, dispatch, onClose }) {
  const [importError, setImportError] = useState(null);
  const [importOk,    setImportOk]    = useState(false);
  const fileRef = useRef(null);

  function doExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      roster:     state.roster,
      persist:    state.persist,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'route508-backup-' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport(file) {
    setImportError(null);
    setImportOk(false);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const obj = JSON.parse(ev.target.result);
        const err = validateImport(obj);
        if (err) { setImportError(err); return; }
        // Merge — only overwrite roster and persist, leave weekly intact
        const next = { ...state };
        if (obj.roster)  next.roster  = obj.roster;
        if (obj.persist) next.persist  = obj.persist;
        dispatch({ type: 'LOAD_ALL', value: next });
        setImportOk(true);
      } catch (e) {
        setImportError('File is not valid JSON: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  return h('div', { className: 'page' },
    h(BackHeader, { onBack: onClose, title: 'Settings & Backup' }),
    h('div', { className: 'pad stack' },
      h('div', { className: 'card' },
        h('div', { className: 'section-header' }, h('div', { className: 't-cap' }, 'Data Backup')),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Export Backup'),
            h('div', { className: 't-sub' }, 'Download all notes, compliance dates, and roster as JSON')
          ),
          h('button', { className: 'btn btn--ghost btn--sm', onClick: doExport }, 'Export')
        ),
        h('div', { className: 'settings-row' },
          h('div', null,
            h('div', { className: 't-label' }, 'Import Backup'),
            h('div', { className: 't-sub' }, 'Restore from a previously exported JSON file')
          ),
          h('button', { className: 'btn btn--ghost btn--sm', onClick: () => fileRef.current && fileRef.current.click() }, 'Import')
        ),
        h('input', { ref: fileRef, type: 'file', accept: '.json', style: { display: 'none' }, onChange: ev => ev.target.files[0] && doImport(ev.target.files[0]) }),
        importError && h('div', { style: { padding: '10px 14px', color: '#B71C1C', fontSize: 13 } }, '⚠ ' + importError),
        importOk    && h('div', { style: { padding: '10px 14px', color: '#2E7D32', fontSize: 13 } }, '✓ Data imported successfully.')
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
    const cv = [...(data.ca || []), ...(data.cn || [])];
    cv.forEach((v, i) => {
      const st = state.persist.vs[id + '_cv_' + i] || 0;
      if (st === 1) tv.push('  ' + displayName(acct) + ': ' + v.s);
      if (st === 4) sold.push('  ' + displayName(acct) + ': ' + v.s);
    });
    (data.su || []).forEach((idx, i) => {
      const st = state.persist.vs[id + '_su_' + i] || 0;
      if (st === 3) pitched.push('  ' + displayName(acct) + ': ' + SKUS[idx]);
      if (st === 4) sold.push('  '    + displayName(acct) + ': ' + SKUS[idx]);
    });
    (data.pl || []).forEach((idx, i) => {
      const st = state.persist.vs[id + '_pl_' + i] || 0;
      if (st === 2) pitched.push('  '   + displayName(acct) + ': ' + SKUS[idx]);
      if (st === 3) sold.push('  '      + displayName(acct) + ' (POD): ' + SKUS[idx]);
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

  // New-week toast state (separate from undo toast)
  const [newWeekToast, setNewWeekToast] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    try {
      // Check for new week BEFORE loading weekly state
      const isNewWeek = !storage.get(STORAGE_KEYS.weekly()) && archiveLastWeekIfNeeded();
      if (isNewWeek) setNewWeekToast(true);

      const saved = {
        roster:  storage.get(STORAGE_KEYS.ROSTER)  || SEED_ROSTER,
        persist: storage.get(STORAGE_KEYS.PERSIST) || INIT_PERSIST,
        weekly:  storage.get(STORAGE_KEYS.weekly()) || INIT_WEEKLY,
      };
      if (saved.weekly.weekKey && saved.weekly.weekKey !== WEEK_KEY) {
        saved.weekly = { ...INIT_WEEKLY };
      }
      rawDispatch({ type: 'LOAD_ALL', value: saved });
    } catch (e) {
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
    h(RouteManager, { roster, dispatch, weeklyActive: state.weekly.active, onClose: () => setScreen('home') }),
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
    h('div', { className: 'app-header' },
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
          const dc2     = DC[d];
          const total   = roster.filter(r => r.days.includes(d)).length;
          const done    = roster.filter(r => r.days.includes(d) && state.weekly.done[r.id + '_' + d]).length;
          const isActive = d === day;
          return h('button', {
            key: d,
            className: 'day-tab' + (isActive ? ' active' : ''),
            style: {
              background: isActive ? '#F7F8FA' : dc2.color + 'CC',
              color:      isActive ? dc2.color : 'rgba(255,255,255,0.85)',
            },
            onClick: () => setDay(d)
          },
            h('div', { className: 'day-tab__name' }, dc2.dayName),
            h('div', { className: 'day-tab__date' }, dc2.date),
            h('div', { className: 'day-tab__prog', style: isActive ? { color: dc2.color } : {} }, done + '/' + total)
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
            const total  = cv.length + (data ? data.su.length : 0) + (data ? data.pl.length : 0);
            const open   = total - [
              ...cv.map((_, ii) => state.persist.vs[r.id + '_cv_' + ii] || 0),
              ...(data ? data.su : []).map((_, ii) => state.persist.vs[r.id + '_su_' + ii] || 0),
              ...(data ? data.pl : []).map((_, ii) => state.persist.vs[r.id + '_pl_' + ii] || 0),
            ].filter(x => x > 0).length;
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
            style: { padding: '10px 20px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
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
