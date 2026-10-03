// Study schedule. Everything comes from data/study.json, which Claude updates after each block.
// Ticks and scores typed on this page are kept in this browser (localStorage) until they're reported.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const DAY = 864e5;
  const store = {
    get(k) { try { return localStorage.getItem('study:' + k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem('study:' + k) : localStorage.setItem('study:' + k, v); } catch {} },
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parse(s).toLocaleDateString('en-CA', opts);
  const fmtTime = hm => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`; };
  const mins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

  // Readable text on a course colour.
  const onColour = hex => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#17150f' : '#f6f0e4';
  };

  const theme = () => {
    const t = store.get('theme');
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  };
  theme();

  fetch('data/study.json', { cache: 'no-store' }).then(r => r.json()).then(init).catch(err => {
    $('[data-statement]').textContent = 'Couldn’t load the schedule.';
    console.error(err);
  });

  function init(D) {
    const today = iso(new Date());
    const courses = Object.fromEntries(D.courses.map(c => [c.id, c]));
    const kindOf = date => D.rhythm[(parse(date).getDay() + 6) % 7].kind;
    const dayData = date => D.days.find(d => d.date === date);
    let selected = today;
    let course = store.get('course') || D.courses[0].id;
    let filter = 'all';

    // ---------- review history: every finished block that covered topics, plus earlier practice ----------
    const events = [];
    for (const r of D.reviews) events.push({ ...r, kind: r.kind || 'practice' });
    for (const d of D.days) d.blocks.forEach(b => {
      if (b.status === 'done' && b.date !== 'skip') events.push({ date: d.date, course: b.course, kind: b.kind || (courses[b.course].topics.length ? d.kind : 'assignment'), title: b.title, covers: b.covers || [], score: b.score, missed: b.missed });
    });
    events.sort((a, b) => a.date < b.date ? 1 : -1);
    const weak = new Set((D.weak || []).map(w => `${w.course}:${w.topic}`));

    const topicState = (c, t) => {
      const taught = t.taught && t.taught <= today;
      const ev = events.filter(e => e.course === c.id && e.date <= today && (e.covers || []).includes(t.id));
      const last = ev[0]?.date;
      const since = last ? daysBetween(last, today) : (taught ? daysBetween(t.taught, today) : null);
      let s;
      if (!taught) s = 'upcoming';
      else if (weak.has(`${c.id}:${t.id}`)) s = 'weak';
      else if (!last) s = 'new';
      else if (since >= 7) s = 'due';
      else s = 'fresh';
      return { s, last, since, count: ev.length };
    };

    // ---------- hero ----------
    const statements = {
      'same-day': 'Today’s lectures, <em>while they’re fresh</em>.',
      cumulative: 'Everything so far, <em>weak topics first</em>.',
      forward: 'Next week’s syllabus, <em>before it’s taught</em>.',
    };
    $('[data-kicker]').innerHTML = `<b>${esc(fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' }))}</b> &nbsp;·&nbsp; ${esc(D.kinds[kindOf(today)].label)}`;
    $('[data-statement]').innerHTML = statements[kindOf(today)];
    $('[data-term]').textContent = D.term;

    const tick = () => {
      const now = new Date();
      $('[data-clock]').textContent = now.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?m\.?/i, ' $1m');
      const d = dayData(iso(now));
      const m = now.getHours() * 60 + now.getMinutes();
      const label = $('[data-now-label]'), bar = $('[data-now-bar]'), box = $('[data-now]');
      let html = 'Nothing scheduled today.', pct = 0, col = '';
      if (d) {
        const cur = d.blocks.find(b => mins(b.start) <= m && m < mins(b.end));
        const next = d.blocks.find(b => mins(b.start) > m);
        if (cur) {
          col = courses[cur.course].color;
          const left = mins(cur.end) - m;
          pct = 100 * (m - mins(cur.start)) / (mins(cur.end) - mins(cur.start));
          html = `<span class="dot"></span><b>${esc(courses[cur.course].code)}</b> · ${esc(cur.title)}<br><span class="muted">${left} min left, then ${next ? 'a break' : 'you’re done'}</span>`;
        } else if (next) {
          col = courses[next.course].color;
          const wait = mins(next.start) - m;
          html = `<span class="dot"></span>Break. Next: <b>${esc(courses[next.course].code)}</b> in ${wait} min<br><span class="muted">${esc(next.title)}</span>`;
          pct = 0;
        } else {
          html = 'Done for today. <em>Report your scores.</em>';
          pct = 100;
        }
      }
      box.style.setProperty('--c', col || 'var(--accent)');
      label.innerHTML = html;
      bar.style.width = pct + '%';
      document.querySelectorAll('.block').forEach(el => {
        const live = el.dataset.date === iso(now) && mins(el.dataset.start) <= m && m < mins(el.dataset.end);
        el.classList.toggle('now', live);
      });
    };

    // ---------- week ----------
    const renderWeek = () => {
      const t = parse(today), mon = new Date(t - ((t.getDay() + 6) % 7) * DAY);
      const html = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon.getTime() + i * DAY), s = iso(d), k = kindOf(s), dd = dayData(s);
        const dots = dd ? [...new Set(dd.blocks.map(b => b.course))].map(c => `<i style="--c:${courses[c].color}"></i>`).join('') : '';
        html.push(`<button class="day${s === today ? ' today' : ''}${s === selected ? ' selected' : ''}" data-kind="${k}" data-date="${s}" aria-pressed="${s === selected}">
          <span class="dname">${d.toLocaleDateString('en-CA', { weekday: 'short' })}</span>
          <span class="dots">${dots}</span>
          <span class="dnum">${d.getDate()}</span>
          <span class="dkind">${esc(D.kinds[k].label)}</span></button>`);
      }
      $('[data-week]').innerHTML = html.join('');
    };
    $('[data-week]').addEventListener('click', e => {
      const b = e.target.closest('.day'); if (!b) return;
      selected = b.dataset.date; renderWeek(); renderPlan();
    });

    // ---------- plan for the selected day ----------
    const renderPlan = () => {
      const d = dayData(selected), k = d?.kind || kindOf(selected);
      $('[data-plan-title]').innerHTML = `${esc(fmtDate(selected, { weekday: 'long', month: 'long', day: 'numeric' }))}${d?.tentative ? ' <em class="muted" style="font-size:.6em">draft</em>' : ''}`;
      $('[data-plan-blurb]').textContent = `${D.kinds[k].label}. ${D.kinds[k].blurb}`;
      if (!d) { $('[data-blocks]').innerHTML = '<div class="empty">No blocks planned yet. Ask Claude to plan this day.</div>'; return; }
      const out = [];
      d.blocks.forEach((b, i) => {
        const c = courses[b.course];
        const key = `${d.date}:${i}`;
        const local = store.get('done:' + key);
        const done = local != null ? local === '1' : b.status === 'done';
        const score = store.get('score:' + key) ?? (b.score ? `${b.score}${b.missed?.length ? ' ' + b.missed.join(' ') : ''}` : '');
        if (i > 0) {
          const gap = mins(b.start) - mins(d.blocks[i - 1].end);
          if (gap > 0) out.push(`<div class="break">${gap} min break</div>`);
        }
        out.push(`<div class="block${done ? ' done' : ''}" style="--c:${c.color}" data-date="${d.date}" data-start="${b.start}" data-end="${b.end}">
          <div class="time">${fmtTime(b.start)} – ${fmtTime(b.end)}</div>
          <span class="sw" aria-hidden="true"></span>
          <div class="what"><div class="course">${esc(c.code)}</div><div class="title">${esc(b.title)}</div>${b.doc ? `<div class="doc">${esc(b.doc)}</div>` : ''}${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ''}</div>
          <div class="side">
            <input class="score" data-key="${key}" value="${esc(score)}" placeholder="score" aria-label="Score for ${esc(c.code)} block">
            <button class="check" data-key="${key}" aria-pressed="${done}" aria-label="Mark ${esc(c.code)} block done">✓</button>
          </div></div>`);
      });
      $('[data-blocks]').innerHTML = out.join('');
      tick();
    };
    $('[data-blocks]').addEventListener('click', e => {
      const b = e.target.closest('.check'); if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      b.closest('.block').classList.toggle('done', on);
      store.set('done:' + b.dataset.key, on ? '1' : '0');
    });
    $('[data-blocks]').addEventListener('input', e => {
      if (e.target.matches('.score')) store.set('score:' + e.target.dataset.key, e.target.value.trim() || null);
    });
    $('[data-copy]').addEventListener('click', async () => {
      const d = dayData(selected); if (!d) return;
      const lines = [`Study report, ${fmtDate(selected)}:`];
      d.blocks.forEach((b, i) => {
        const key = `${d.date}:${i}`;
        const local = store.get('done:' + key);
        const done = local != null ? local === '1' : b.status === 'done';
        const score = store.get('score:' + key) || '';
        lines.push(`- ${courses[b.course].code}, ${b.title}: ${done ? 'done' : 'not done'}${score ? `, ${score}` : ''}`);
      });
      const text = lines.join('\n');
      try { await navigator.clipboard.writeText(text); } catch { prompt('Copy this:', text); }
      const t = $('[data-toast]'); t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1800);
    });

    // ---------- courses ----------
    const renderCourses = () => {
      $('[data-palette]').innerHTML = D.courses.map(c => {
        const taught = c.topics.filter(t => t.taught && t.taught <= today);
        const ok = taught.filter(t => ['fresh'].includes(topicState(c, t).s)).length;
        const pct = taught.length ? Math.round(100 * ok / taught.length) : 0;
        const meta = c.topics.length ? `${ok}/${taught.length} fresh` : 'Assignments';
        return `<button class="swatch${c.id === course ? ' on' : ''}" role="tab" aria-selected="${c.id === course}" data-course="${c.id}" style="--c:${c.color};--on:${onColour(c.color)}">
          <span class="code">${esc(c.code)}</span>
          <span><span class="meta">${esc(meta)}</span>${c.topics.length ? `<span class="meter" style="display:block"><i style="width:${pct}%"></i></span>` : ''}</span></button>`;
      }).join('');
      const c = courses[course];
      const states = c.topics.map(t => ({ t, ...topicState(c, t) }));
      const taught = states.filter(x => x.s !== 'upcoming');
      const fresh = states.filter(x => x.s === 'fresh').length;
      const due = states.filter(x => ['due', 'new', 'weak'].includes(x.s)).length;
      const dls = D.deadlines.filter(d => d.course === c.id);
      $('[data-panel]').style.setProperty('--c', c.color);
      $('[data-panel]').innerHTML = `<div>
          <h3>${esc(c.code)}<br><em>${esc(c.name)}</em></h3>
          <div class="cat">${c.topics.length ? `${taught.length} of ${c.topics.length} topics taught` : 'Deliverables'}</div>
          ${c.topics.length ? `<div class="stats"><div class="stat"><b>${taught.length}</b><span>Taught</span></div><div class="stat"><b>${fresh}</b><span>Fresh</span></div><div class="stat"><b>${due}</b><span>To review</span></div></div>` : ''}
          ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
        </div>
        <div class="topics">${states.length ? states.map(x => `<div class="topic" data-s="${x.s}">
            <div class="tt">${/^\d/.test(x.t.id) && c.id === 'm115' ? `<b>${esc(x.t.id)}</b>` : ''}${esc(x.t.title)}</div>
            <div class="ts"><span>${x.s === 'upcoming' ? `Expected ${esc(fmtDate(x.t.expected))}` : `Taught ${esc(fmtDate(x.t.taught, { month: 'short', day: 'numeric' }))}${x.t.unconfirmed ? '?' : ''}`}</span>
            <span>${x.s === 'upcoming' ? '' : x.last ? `Reviewed ${x.since === 0 ? 'today' : x.since + 'd ago'}` : 'Not reviewed'}</span></div></div>`).join('')
          : dls.map(d => `<div class="topic" data-s="${d.date && daysBetween(today, d.date) <= 3 ? 'due' : 'new'}"><div class="tt">${esc(d.title)}</div><div class="ts"><span>${d.date ? esc(fmtDate(d.date)) : 'Date unknown'}</span><span>${esc(d.weight || '')}</span></div></div>`).join('')}</div>`;
    };
    $('[data-palette]').addEventListener('click', e => {
      const b = e.target.closest('.swatch'); if (!b) return;
      course = b.dataset.course; store.set('course', course); renderCourses();
    });

    // ---------- due for review ----------
    const renderDue = () => {
      const rank = { weak: 0, due: 1, new: 2 };
      const list = [];
      for (const c of D.courses) for (const t of c.topics) {
        const st = topicState(c, t);
        if (st.s in rank) list.push({ c, t, ...st });
      }
      list.sort((a, b) => rank[a.s] - rank[b.s] || b.since - a.since);
      $('[data-due]').innerHTML = list.length ? list.slice(0, 15).map((x, i) => `<div class="due" style="--c:${x.c.color}">
          <span class="rank">${i + 1}</span>
          <div><div class="c">${esc(x.c.code)}</div><div class="t">${esc(x.t.title)}</div></div>
          <div class="why"><b>${x.since}d</b>${x.s === 'weak' ? 'weak' : x.last ? 'since review' : 'never reviewed'}</div></div>`).join('')
        : '<div class="empty">Everything taught has been reviewed in the last week.</div>';
    };

    // ---------- deadlines ----------
    const renderDeadlines = () => {
      const list = [...D.deadlines].sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
      $('[data-deadlines]').innerHTML = list.map(d => {
        const c = courses[d.course];
        let when = 'TBD', sub = 'date unknown', cls = '';
        if (d.date) {
          const n = daysBetween(today, d.date);
          when = fmtDate(d.date, { month: 'short', day: 'numeric' });
          sub = n < 0 ? `${-n}d ago` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
          if (n < 0) cls = 'past'; else if (n <= 3) cls = 'soon';
        }
        return `<div class="dl ${cls}" style="--c:${c.color}">
          <div class="when">${esc(when)}<small>${esc(sub)}</small></div>
          <span class="sw" aria-hidden="true"></span>
          <div><div class="t">${esc(d.title)}</div><div class="n">${esc(c.code)}${d.note ? ' · ' + esc(d.note) : ''}</div></div>
          <div class="w">${esc(d.weight || '')}</div></div>`;
      }).join('');
    };

    // ---------- log ----------
    const renderLog = () => {
      const used = [...new Set(events.map(e => e.course))];
      $('[data-filters]').innerHTML = [`<button class="chip" data-f="all" aria-pressed="${filter === 'all'}">All</button>`]
        .concat(used.map(id => `<button class="chip" data-f="${id}" aria-pressed="${filter === id}" style="--c:${courses[id].color}"><i></i>${esc(courses[id].code)}</button>`)).join('');
      const rows = events.filter(e => filter === 'all' || e.course === filter);
      $('[data-log]').innerHTML = `<thead><tr><th>Date</th><th>Type</th><th>Course</th><th>What</th><th>Score</th><th>Missed</th></tr></thead><tbody>${
        rows.map(e => `<tr><td class="d">${esc(fmtDate(e.date))}</td><td class="k" data-k="${e.kind}">${esc((D.kinds[e.kind] || { label: 'Practice' }).label)}</td>
          <td class="cc" style="--c:${courses[e.course].color}">${esc(courses[e.course].code)}</td><td>${esc(e.title)}</td>
          <td>${esc(e.score || '—')}</td><td>${esc((e.missed || []).join(', ') || '—')}</td></tr>`).join('')}</tbody>`;
    };
    $('[data-filters]').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      filter = b.dataset.f; renderLog();
    });

    // ---------- footer ----------
    const up = new Date(D.updated);
    $('[data-updated]').textContent = `Updated ${up.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}, ${up.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
    const tb = $('[data-theme-toggle]');
    const label = () => { tb.textContent = `Theme: ${store.get('theme') || 'auto'}`; };
    tb.addEventListener('click', () => {
      const order = [null, 'light', 'dark'], cur = store.get('theme');
      store.set('theme', order[(order.indexOf(cur) + 1) % 3]); theme(); label();
    });
    label();

    renderWeek(); renderPlan(); renderCourses(); renderDue(); renderDeadlines(); renderLog();
    tick(); setInterval(tick, 20e3);
  }
})();
