// Leonida Platinum Log: offline GTA VI trophy guide and tracker.
// Loads its own data files only, saves progress in localStorage, exports and imports it.
const STORE_KEY = 'leonida-platinum-log-v1';
const DEMO_STORE_KEY = 'leonida-platinum-log-demo-v1';
const DEMO_EARNED = ['Just Like Paradise', 'Paradise Lost', 'T**s Ass Drug Money', 'Vice City, Baby!', 'Top Of The World, Ma', 'Trust', 'Master of None', 'Baited My Tackle', 'Stick Fiddler', 'Whip It Good', 'Treat Yo Self'];
const DEMO_COUNTS = { 15: 120, 17: 20, 28: 6, 30: 1, 31: 40, 32: 25 };

const listCol = document.getElementById('listCol');
const detailCol = document.getElementById('detailCol');
const railCol = document.getElementById('railCol');
const auditStrip = document.getElementById('auditStrip');
const filtersEl = document.getElementById('filters');
const spoilerToggle = document.getElementById('spoilerToggle');

let guideData = null;
let metaData = null;
let activeStoreKey = STORE_KEY;
let state = loadProgress();
let selectedId = 28;
let currentFilter = 'all';
let currentView = 'tracker';
let searchQuery = '';

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(activeStoreKey) ?? 'null');
    if (saved && Array.isArray(saved.earned)) {
      return { earned: new Set(saved.earned), counts: saved.counts ?? {}, spoiler: saved.spoiler ?? true };
    }
  } catch { /* corrupted save: start fresh */ }
  return { earned: new Set(), counts: {}, spoiler: true };
}

function saveProgress() {
  localStorage.setItem(activeStoreKey, JSON.stringify({
    earned: [...state.earned], counts: state.counts, spoiler: state.spoiler,
  }));
}

function trophyById(id) {
  return guideData.trophies.find((t) => t.id === id);
}

function isMasked(trophy) {
  return state.spoiler && trophy.hidden && !state.earned.has(trophy.name);
}

function gradeCounts() {
  const out = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of guideData.trophies) if (state.earned.has(t.name)) out[t.grade] += 1;
  return out;
}

function renderProgressHeader() {
  const total = guideData.trophies.length;
  const earned = state.earned.size;
  document.getElementById('earnedCount').textContent = `${earned} / ${total} earned`;
  const g = gradeCounts();
  document.getElementById('gradeCounts').textContent = `P ${g.platinum}/1  G ${g.gold}/2  S ${g.silver}/6  B ${g.bronze}/46`;
  document.getElementById('progressBar').style.width = `${Math.round((earned / total) * 100)}%`;
  spoilerToggle.checked = state.spoiler;
}

function renderAuditStrip() {
  const steps = guideData.trophies.flatMap((t) => t.steps);
  const cited = steps.filter((s) => s.src && s.src.length > 0).length;
  const hidden = guideData.trophies.filter((t) => t.hidden).length;
  const unconfirmed = guideData.trophies.filter((t) => t.guide.includes('UNCONFIRMED')).length;
  const missable = guideData.trophies.filter((t) => t.missable).length;
  auditStrip.innerHTML = `AUDIT &nbsp;<b>55/55</b> official name, description, grade &nbsp;<span class="ok">&#10003;</span> 1P 2G 6S 46B &nbsp;<span class="ok">&#10003;</span> ${hidden} PSN-hidden &nbsp;<span class="ok">&#10003;</span> <b>${cited}/${steps.length}</b> steps cited &nbsp;<span class="ok">&#10003;</span> <span class="warn">${missable} possibly missable</span> &middot; <span class="warn">${unconfirmed} unconfirmed in this guide</span> &middot; 0 online &middot; ${metaData.sources.length} sources read 20&ndash;21 Nov 2026`;
}

function filterDefinitions() {
  const t = guideData.trophies;
  const count = (fn) => t.filter(fn).length;
  return [
    ['all', `All ${t.length}`, () => true],
    ['story', `Story ${count((x) => x.kind === 'story')}`, (x) => x.kind === 'story'],
    ['missable', `Missable ${count((x) => x.missable)}`, (x) => x.missable],
    ['collectible', `Collectibles ${count((x) => x.kind === 'collectible')}`, (x) => x.kind === 'collectible'],
    ['activity', `Activities ${count((x) => x.kind === 'activity')}`, (x) => x.kind === 'activity'],
    ['crime', `Crime ${count((x) => x.kind === 'crime')}`, (x) => x.kind === 'crime'],
    ['world', `World ${count((x) => x.kind === 'world')}`, (x) => x.kind === 'world'],
    ['stranger', `Strangers ${count((x) => x.kind === 'stranger')}`, (x) => x.kind === 'stranger'],
    ['online', 'Online 0', () => false],
    ['hidden', `PSN-hidden ${count((x) => x.hidden)}`, (x) => x.hidden],
    ['notearned', `Not earned ${count((x) => !state.earned.has(x.name))}`, (x) => !state.earned.has(x.name)],
  ];
}

function renderFilterChips() {
  filtersEl.replaceChildren();
  for (const [key, label] of filterDefinitions()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (key === currentFilter) b.classList.add('active');
    b.addEventListener('click', () => { currentFilter = key; renderAll(); });
    filtersEl.append(b);
  }
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search name, description\u2026';
  search.value = searchQuery;
  search.setAttribute('aria-label', 'Search trophies');
  search.addEventListener('input', () => { searchQuery = search.value; renderTrophyList(); });
  filtersEl.append(search);
}

function visibleTrophies() {
  const defs = Object.fromEntries(filterDefinitions().map(([k, , fn]) => [k, fn]));
  const fn = defs[currentFilter] ?? (() => true);
  const q = searchQuery.trim().toLowerCase();
  return guideData.trophies
    .filter((t) => fn(t) && (!q || (!isMasked(t) && `${t.name} ${t.description}`.toLowerCase().includes(q))))
    .sort((a, b) => a.stage - b.stage || a.id - b.id);
}

function stageName(stage) {
  const s = metaData.roadmap.find((r) => r.stage === stage);
  return s ? s.name : `Stage ${stage}`;
}

function renderTrophyList() {
  listCol.replaceChildren();
  const shown = visibleTrophies();
  const head = document.createElement('div');
  head.className = 'col-head';
  head.innerHTML = `<span>${shown.length} shown</span><span>Roadmap order</span>`;
  listCol.append(head);
  if (shown.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No trophies match this filter.';
    listCol.append(empty);
    return;
  }
  let lastStage = null;
  for (const t of shown) {
    if (t.stage !== lastStage) {
      lastStage = t.stage;
      const h = document.createElement('div');
      h.className = 'stage-head';
      const inStage = shown.filter((x) => x.stage === t.stage).length;
      h.innerHTML = `Stage ${t.stage} — ${stageName(t.stage)} <span>${inStage} shown</span>`;
      listCol.append(h);
    }
    const row = document.createElement('div');
    row.className = 'trow' + (state.earned.has(t.name) ? ' earned' : '') + (t.id === selectedId ? ' selected' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.earned.has(t.name);
    box.setAttribute('aria-label', `Mark ${t.name} earned`);
    box.addEventListener('click', (e) => { e.stopPropagation(); toggleEarned(t); });
    const dot = document.createElement('span');
    dot.className = `gdot ${t.grade}`;
    const body = document.createElement('div');
    const masked = isMasked(t);
    const name = document.createElement('div');
    name.className = 'tname';
    name.textContent = masked ? 'Hidden story trophy — spoiler shield' : t.name;
    const desc = document.createElement('div');
    desc.className = 'tdesc';
    desc.textContent = masked ? 'Hidden by the spoiler shield until you earn it.' : t.description;
    const tags = document.createElement('div');
    tags.className = 'tags';
    if (t.hidden) tags.append(tagEl('PSN-HIDDEN', 'hidden'));
    if (t.missable) tags.append(tagEl('POSSIBLY MISSABLE', 'miss'));
    if (t.guide.includes('UNCONFIRMED')) tags.append(tagEl('UNCONFIRMED', 'unc'));
    if (t.count) tags.append(tagEl(`${state.counts[t.id] ?? 0}/${t.count} ${t.countLabel}`, 'count'));
    tags.append(tagEl(t.kind, 'kind'));
    body.append(name, desc, tags);
    row.append(box, dot, body);
    row.addEventListener('click', () => { selectedId = t.id; renderAll(); });
    listCol.append(row);
  }
}

function tagEl(text, kind) {
  const s = document.createElement('span');
  s.className = `tag ${kind}`;
  s.textContent = text;
  return s;
}

function sourceLink(n) {
  const s = metaData.sources.find((x) => x.n === n);
  return s ? `[${s.n}]` : '';
}

function renderGuideDetail() {
  const t = trophyById(selectedId) ?? guideData.trophies[0];
  detailCol.replaceChildren();
  const masked = isMasked(t);
  const head = document.createElement('div');
  head.className = 'detail-head';
  const badge = document.createElement('span');
  badge.className = `grade-badge ${t.grade}`;
  badge.textContent = t.grade;
  const title = document.createElement('h2');
  title.textContent = masked ? 'Hidden story trophy' : t.name;
  head.append(badge, title);
  detailCol.append(head);
  const official = document.createElement('p');
  official.className = 'official';
  official.textContent = masked ? '"Hidden by the spoiler shield until you earn it." — official description hidden' : `"${t.description}" — official description`;
  detailCol.append(official);
  const meta = document.createElement('p');
  meta.className = 'meta-line';
  meta.textContent = masked ? `Bronze or better · hidden on PSN · ${t.kind}` : `${t.grade} · #${t.id} of 55 · ${t.kind} · Stage ${t.stage} · ${t.hidden ? 'PSN-hidden' : 'visible on PSN'}`;
  detailCol.append(meta);
  if (t.missable) {
    const banner = document.createElement('div');
    banner.className = 'banner miss';
    banner.innerHTML = '<b>POSSIBLY MISSABLE — LAST CHANCE.</b> PowerPyx [3] reports the Chapter 1 balcony meditation may be the only chance for this trophy, and no page has tested the trophy without it. Do it first, keep a Chapter 1 save, and do not rely on a second playthrough.';
    detailCol.append(banner);
  }
  if (!masked && t.guide.includes('UNCONFIRMED')) {
    const banner = document.createElement('div');
    banner.className = 'banner unc';
    banner.innerHTML = '<b>METHOD UNCONFIRMED.</b> No published guide had a verified step-by-step for this trophy as of 20 Nov 2026. This guide says so instead of inventing a location or a step.';
    detailCol.append(banner);
  }
  const guide = document.createElement('p');
  guide.className = 'guide-text';
  guide.textContent = masked ? 'Earn this trophy to reveal its guide.' : t.guide;
  detailCol.append(guide);
  if (!masked && t.count) {
    detailCol.append(renderCountTracker(t));
  }
  if (!masked) {
    const h = document.createElement('h3');
    h.textContent = `How to earn it — ${t.steps.length} steps, each cited`;
    detailCol.append(h);
    const ol = document.createElement('ol');
    ol.className = 'steps';
    for (const s of t.steps) {
      const li = document.createElement('li');
      li.textContent = s.t + ' ';
      for (const n of s.src) {
        const tag = document.createElement('span');
        tag.className = 'src';
        tag.textContent = sourceLink(n);
        li.append(tag, document.createTextNode(' '));
      }
      ol.append(li);
    }
    detailCol.append(ol);
    const sh = document.createElement('h3');
    sh.textContent = 'Sources for this guide';
    detailCol.append(sh);
    const used = [...new Set(t.steps.flatMap((s) => s.src))].sort((a, b) => a - b);
    const ul = document.createElement('ul');
    ul.className = 'src-list';
    for (const n of used) {
      const src = metaData.sources.find((x) => x.n === n);
      if (!src) continue;
      const li = document.createElement('li');
      li.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = `[${src.n}] ${src.name}`;
      li.append(b, document.createTextNode(` — ${src.detail}`));
      if (src.url) {
        li.append(document.createTextNode(' '));
        const a = document.createElement('a');
        a.href = src.url;
        a.textContent = src.url.replace(/^https:\/\//, '');
        a.target = '_blank';
        a.rel = 'noopener';
        li.append(a);
      }
      ul.append(li);
    }
    detailCol.append(ul);
  }
}

function renderCountTracker(t) {
  const wrap = document.createElement('div');
  wrap.className = 'counter';
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Decrease count');
  const value = document.createElement('strong');
  const label = document.createElement('span');
  label.className = 'lab';
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Increase count');
  const refresh = () => {
    const v = state.counts[t.id] ?? 0;
    value.textContent = `${v} / ${t.count} ${t.countLabel}`;
    if (v >= t.count && !state.earned.has(t.name)) { state.earned.add(t.name); saveProgress(); renderAll(); }
  };
  minus.addEventListener('click', () => { state.counts[t.id] = Math.max(0, (state.counts[t.id] ?? 0) - 1); saveProgress(); refresh(); renderProgressHeader(); renderTrophyList(); });
  plus.addEventListener('click', () => { state.counts[t.id] = Math.min(t.count, (state.counts[t.id] ?? 0) + 1); saveProgress(); refresh(); renderProgressHeader(); renderTrophyList(); });
  refresh();
  const mark = document.createElement('button');
  mark.type = 'button';
  mark.className = 'mark-earned' + (state.earned.has(t.name) ? ' earned' : '');
  mark.textContent = state.earned.has(t.name) ? '✓ Earned' : 'Mark earned';
  mark.addEventListener('click', () => toggleEarned(t));
  wrap.append(minus, value, label, plus, mark);
  return wrap;
}

function toggleEarned(t) {
  if (state.earned.has(t.name)) state.earned.delete(t.name);
  else state.earned.add(t.name);
  saveProgress();
  renderAll();
}

function nextUpTrophies() {
  return guideData.trophies
    .filter((t) => !state.earned.has(t.name) && t.id !== 1)
    .sort((a, b) => a.stage - b.stage || a.id - b.id)
    .slice(0, 4);
}

function renderRail() {
  railCol.replaceChildren();
  const head = document.createElement('div');
  head.className = 'col-head';
  head.innerHTML = '<span>Next up in roadmap order</span>';
  railCol.append(head);
  for (const t of nextUpTrophies()) {
    const d = document.createElement('div');
    d.className = 'nextup';
    const masked = isMasked(t);
    d.innerHTML = '';
    const n = document.createElement('div');
    n.className = 'n';
    n.textContent = masked ? 'Hidden story trophy' : t.name;
    const sub = document.createElement('div');
    sub.className = 'd';
    sub.textContent = `Stage ${t.stage} · ${t.kind}${t.missable ? ' · POSSIBLY MISSABLE — do first' : ''}${t.count ? ` · ${state.counts[t.id] ?? 0}/${t.count}` : ''}`;
    d.append(n, sub);
    d.style.cursor = 'pointer';
    d.addEventListener('click', () => { selectedId = t.id; currentView = 'tracker'; renderAll(); });
    railCol.append(d);
  }
  const miss = document.createElement('div');
  miss.className = 'rail-card miss';
  miss.innerHTML = '<h4>Missables — 1 possibly missable</h4><p><b>Positive Mental Attitude.</b> The Chapter 1 balcony meditation may be gone after Chapter 1. Do it first and keep a Chapter 1 save. Everything else is earnable in free roam after the story.</p>';
  railCol.append(miss);
  const watch = document.createElement('div');
  watch.className = 'rail-card';
  watch.innerHTML = '<h4>Watch — stranger windows</h4><p>TechWiser (via eGamers / games.gg) reports the five stranger chains have windows tied to story progress. Do each strand as it appears.</p>';
  railCol.append(watch);
  const src = document.createElement('div');
  src.className = 'rail-card';
  const h = document.createElement('h4');
  h.textContent = `Sources for this guide — ${metaData.sources.length}`;
  src.append(h);
  const ul = document.createElement('ul');
  ul.className = 'src-list';
  for (const s of metaData.sources) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `[${s.n}] ${s.name}`;
    li.append(b);
    ul.append(li);
  }
  src.append(ul);
  railCol.append(src);
}

function renderRoadmapView() {
  detailCol.replaceChildren();
  const h = document.createElement('div');
  h.className = 'col-head';
  h.innerHTML = '<span>Roadmap to the platinum — 7 stages</span><span>~200–300 hours</span>';
  detailCol.append(h);
  for (const stage of metaData.roadmap) {
    const card = document.createElement('div');
    card.className = 'stage-card';
    const title = document.createElement('h3');
    title.textContent = `Stage ${stage.stage} — ${stage.name}`;
    const text = document.createElement('p');
    text.textContent = stage.text;
    const list = document.createElement('p');
    list.className = 'trophies';
    const names = guideData.trophies.filter((t) => t.stage === stage.stage).map((t) => (isMasked(t) ? 'Hidden story trophy' : t.name));
    list.textContent = names.join(' · ');
    card.append(title, text, list);
    detailCol.append(card);
  }
}

function renderMissablesView() {
  const h = document.createElement('div');
  h.className = 'col-head';
  h.innerHTML = '<span>Missables — built from the official descriptions</span>';
  const missable = guideData.trophies.filter((t) => t.missable);
  if (missable.length > 0) {
    selectedId = missable[0].id;
    renderGuideDetail();
  }
  detailCol.prepend(h);
  const watch = document.createElement('div');
  watch.className = 'rail-card';
  watch.innerHTML = '<h4>Watch, not missable — stranger chains</h4><p>TechWiser (via eGamers / games.gg) reports the five stranger chains have windows tied to story progress. Not confirmed as missable by any other source, so this guide lists it as a watch item, not a missable.</p><h4>Everything else</h4><p>All 54 other trophies are earnable in free roam after the story (GTABase [10]). No online trophies exist, so nothing needs multiplayer.</p>';
  detailCol.append(watch);
}

function renderSourcesView() {
  detailCol.replaceChildren();
  const h = document.createElement('div');
  h.className = 'col-head';
  h.innerHTML = `<span>Sources — ${metaData.sources.length} read 20–21 Nov 2026</span>`;
  detailCol.append(h);
  const ul = document.createElement('ul');
  ul.className = 'src-list src-table';
  for (const s of metaData.sources) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = `[${s.n}] ${s.name}`;
    li.append(b, document.createTextNode(` — ${s.detail}`));
    if (s.url) {
      li.append(document.createTextNode(' '));
      const a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.url.replace(/^https:\/\//, '');
      a.target = '_blank';
      a.rel = 'noopener';
      li.append(a);
    }
    ul.append(li);
  }
  detailCol.append(ul);
  const note = document.createElement('p');
  note.className = 'meta-line';
  note.textContent = 'Every guide step in this entry cites its sources by number. Official trophy names and descriptions are shown as PlayStation publishes them; the guide text is written for this entry, in its own words, and never copied from a source.';
  detailCol.append(note);
}

function renderAll() {
  renderProgressHeader();
  renderAuditStrip();
  renderFilterChips();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === currentView));
  filtersEl.style.display = currentView === 'tracker' ? '' : 'none';
  if (currentView === 'tracker') {
    renderTrophyList();
    renderGuideDetail();
  } else if (currentView === 'roadmap') {
    renderTrophyList();
    renderRoadmapView();
  } else if (currentView === 'missables') {
    renderTrophyList();
    renderMissablesView();
  } else if (currentView === 'sources') {
    renderTrophyList();
    renderSourcesView();
  }
  renderRail();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ version: 1, earned: [...state.earned], counts: state.counts }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leonida-platinum-log-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgressFile(file) {
  file.text().then((text) => {
    const data = JSON.parse(text);
    if (!Array.isArray(data.earned)) throw new Error('no earned list');
    state.earned = new Set(data.earned.filter((n) => guideData.trophies.some((t) => t.name === n)));
    state.counts = data.counts ?? {};
    saveProgress();
    renderAll();
  }).catch(() => {
    alert('That file is not a Leonida Platinum Log progress export.');
  });
}

function applyShotParams() {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const demo = params.get('demo') === '1';
  if (demo) {
    activeStoreKey = DEMO_STORE_KEY;
    state = loadProgress();
    state.earned = new Set(DEMO_EARNED);
    state.counts = { ...DEMO_COUNTS };
    saveProgress();
  }
  if (params.get('spoiler') === '0') state.spoiler = false;
  if (params.get('spoiler') === '1') state.spoiler = true;
  if (demo) saveProgress();
  const select = Number(params.get('select'));
  if (Number.isInteger(select) && trophyById(select)) selectedId = select;
  if (shot === 'roadmap') currentView = 'roadmap';
  else if (shot === 'missables') currentView = 'missables';
  else if (shot === 'sources') currentView = 'sources';
  else currentView = 'tracker';
}

async function loadGuideData() {
  const [trophies, meta] = await Promise.all([
    (await fetch('data/trophies.json')).json(),
    (await fetch('data/meta.json')).json(),
  ]);
  guideData = trophies;
  metaData = meta;
}

document.getElementById('exportBtn').addEventListener('click', exportProgress);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => { if (e.target.files[0]) importProgressFile(e.target.files[0]); });
spoilerToggle.addEventListener('change', () => { state.spoiler = spoilerToggle.checked; saveProgress(); renderAll(); });
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { currentView = b.dataset.view; renderAll(); }));

await loadGuideData();
applyShotParams();
renderAll();
window.__shotReady = true;
