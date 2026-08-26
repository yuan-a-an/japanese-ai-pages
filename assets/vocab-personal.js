const { $, $$, escapeHtml: e, loadWords, playAudio, renderSegments, toast } = window.JAPages;
const state = {words: [], log: {}, filtered: [], page: 1, pageSize: 24, current: null, logDate: '', logMonth: null};
const pad = value => String(value).padStart(2, '0');
const parseDay = value => new Date(`${value}T12:00:00`);

async function loadStudyLog() {
  const response = await fetch('./data/study-log.json');
  if (!response.ok) throw new Error(`学习记录读取失败 (${response.status})`);
  return response.json();
}

function highlight(value, query) {
  if (!query) return e(value);
  const safe = e(value);
  const needle = e(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${needle})`, 'ig'), '<mark>$1</mark>');
}

function applyFilter() {
  const query = $('#search').value.trim().toLowerCase();
  const type = $('#type-filter').value;
  state.filtered = state.words.filter(word => (!type || word.type === type) && (!query || [word.word, word.kana, word.meaning, word.type, word.pair, word.memo].some(value => String(value || '').toLowerCase().includes(query))));
  state.page = 1;
  renderWords();
}

function renderWords() {
  const query = $('#search').value.trim();
  const pageCount = Math.ceil(state.filtered.length / state.pageSize);
  state.page = Math.min(state.page, Math.max(1, pageCount));
  const start = (state.page - 1) * state.pageSize;
  const rows = state.filtered.slice(start, start + state.pageSize);
  $('#word-summary').textContent = `${state.filtered.length} / ${state.words.length} 个单词`;
  $('#word-list').innerHTML = rows.length ? rows.map(word => `<article class="word-row pages-word-row" data-id="${word.id}" tabindex="0"><div class="word-cell-main"><button class="audio-button" data-word-audio="${word.id}" type="button" aria-label="播放 ${e(word.word)} 的发音">🔊</button><strong>${highlight(word.word, query)}</strong><span class="mobile-word-type">${highlight(word.type || '', query)}</span></div><div>${highlight(word.kana || '—', query)}</div><div>${highlight(word.meaning, query)}</div><div class="word-memo ${word.memo ? '' : 'muted'}">${word.memo ? highlight(word.memo, query) : '—'}</div></article>`).join('') : '<div class="empty">没有匹配的单词</div>';
  renderPager(pageCount);
  $$('.pages-word-row').forEach(row => {
    row.onclick = () => openDetail(Number(row.dataset.id));
    row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(Number(row.dataset.id)); } };
  });
  $$('[data-word-audio]').forEach(button => { button.onclick = event => { event.stopPropagation(); playAudio(button.dataset.wordAudio, 'words', button); }; });
}

function renderPager(pageCount) {
  const root = $('#pagination');
  if (pageCount <= 1) { root.innerHTML = ''; return; }
  const visible = new Set([1, pageCount, state.page - 1, state.page, state.page + 1].filter(page => page > 0 && page <= pageCount));
  let previous = 0;
  root.innerHTML = [...visible].sort((a, b) => a - b).map(page => { const gap = page - previous > 1 ? '<span>…</span>' : ''; previous = page; return `${gap}<button class="${page === state.page ? 'active' : ''}" data-page="${page}">${page}</button>`; }).join('');
  $$('[data-page]', root).forEach(button => { button.onclick = () => { state.page = Number(button.dataset.page); renderWords(); window.scrollTo({top: 0, behavior: 'smooth'}); }; });
}

function pairLabel(type = '') {
  if (type.includes('自动') || type.includes('自動')) return '对应他动词';
  if (type.includes('他动') || type.includes('他動')) return '对应自动词';
  return '对应词';
}

function openDetail(id) {
  const word = state.words.find(item => item.id === id);
  if (!word) return;
  state.current = word;
  $('#detail-title').textContent = word.word;
  $('#detail-kana').textContent = word.kana || '—';
  $('#detail-meaning').innerHTML = e(word.meaning).replace(/[,，、]/g, '<br>');
  $('#detail-type').textContent = word.type || '—';
  $('#detail-memo').textContent = word.memo || '—';
  const dates = Object.keys(state.log).filter(day => (state.log[day] || []).includes(word.id)).sort().reverse().slice(0, 8);
  $('#detail-history').textContent = dates.join('、') || '暂无';
  $('#pair-block').hidden = !word.pair;
  $('#pair-label').textContent = pairLabel(word.type);
  $('#detail-pair').textContent = word.pair || '';
  const example = word.example;
  $('#example-block').hidden = !example;
  $('#speak-example').hidden = !example;
  $('#detail-example').innerHTML = example ? renderSegments(example) : '';
  $('#detail-translation').textContent = example?.translation || '';
  $('#detail-grammar').innerHTML = (example?.grammar || []).map(item => `<span class="chip">${e(item)}</span>`).join('');
  $('#detail-overlay').hidden = false;
}

function selectLogDate(day) {
  state.logDate = day;
  const value = parseDay(day);
  state.logMonth = new Date(value.getFullYear(), value.getMonth(), 1);
  renderLog();
}

function renderCalendar() {
  const month = state.logMonth || new Date();
  const year = month.getFullYear(), monthIndex = month.getMonth();
  $('#calendar-title').textContent = `${year}年 ${monthIndex + 1}月`;
  const first = new Date(year, monthIndex, 1), days = new Date(year, monthIndex + 1, 0).getDate(), leading = (first.getDay() + 6) % 7;
  let html = '<span class="calendar-empty"></span>'.repeat(leading);
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`, count = (state.log[key] || []).length;
    html += `<button class="calendar-day ${count ? 'has-study' : ''} ${key === state.logDate ? 'selected' : ''}" data-calendar-date="${key}" title="${count ? `${count} 个单词` : '无学习记录'}"><span>${day}</span>${count ? `<small>${count}</small>` : ''}</button>`;
  }
  $('#log-calendar').innerHTML = html;
  $$('[data-calendar-date]').forEach(button => { button.onclick = () => selectLogDate(button.dataset.calendarDate); });
}

function renderLog() {
  const dates = Object.keys(state.log).filter(day => state.log[day]?.length).sort().reverse();
  if (!state.logDate) state.logDate = dates[0] || new Date().toISOString().slice(0, 10);
  if (!state.logMonth) { const value = parseDay(state.logDate); state.logMonth = new Date(value.getFullYear(), value.getMonth(), 1); }
  $('#log-total').textContent = `${dates.length} 个学习日`;
  renderCalendar();
  const query = $('#log-search').value.trim().toLowerCase(), map = new Map(state.words.map(word => [word.id, word])), ids = state.log[state.logDate] || [];
  const words = ids.map(id => map.get(id)).filter(word => word && (!query || [word.word, word.kana, word.meaning, word.memo].some(value => String(value || '').toLowerCase().includes(query))));
  $('#log-selected-date').textContent = state.logDate;
  $('#log-selected-count').textContent = `${ids.length} 个单词`;
  $('#log-words').innerHTML = words.map(word => `<button class="log-word" data-log-word="${word.id}"><b>${e(word.word)}</b><span>${e(word.kana)}</span><span class="log-meaning">${e(word.meaning)}</span>${word.memo ? `<span class="log-memo">✎ ${e(word.memo)}</span>` : ''}</button>`).join('') || '<div class="empty">这一天没有学习记录</div>';
  $$('[data-log-word]').forEach(button => { button.onclick = () => openDetail(Number(button.dataset.logWord)); });
}

$('#search').oninput = applyFilter;
$('#type-filter').onchange = applyFilter;
$('#show-log').onclick = () => { $('#log-overlay').hidden = false; renderLog(); };
$('#log-search').oninput = renderLog;
$('#calendar-prev').onclick = () => { state.logMonth = new Date(state.logMonth.getFullYear(), state.logMonth.getMonth() - 1, 1); renderCalendar(); };
$('#calendar-next').onclick = () => { state.logMonth = new Date(state.logMonth.getFullYear(), state.logMonth.getMonth() + 1, 1); renderCalendar(); };
$('#detail-overlay .close').onclick = () => { $('#detail-overlay').hidden = true; };
$('#log-overlay .close').onclick = () => { $('#log-overlay').hidden = true; };
$$('.overlay, .drawer-overlay').forEach(overlay => { overlay.onclick = event => { if (event.target === overlay) overlay.hidden = true; }; });
$('#speak-word').onclick = event => playAudio(state.current?.id, 'words', event.currentTarget);
$('#speak-example').onclick = event => playAudio(state.current?.id, 'examples', event.currentTarget);
document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('#detail-overlay').hidden = true; $('#log-overlay').hidden = true; } if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); } });

Promise.all([loadWords(), loadStudyLog()]).then(([words, log]) => {
  state.words = words;
  state.log = log;
  state.filtered = words;
  const types = [...new Set(words.map(word => word.type).filter(Boolean))].sort();
  $('#type-filter').innerHTML += types.map(type => `<option>${e(type)}</option>`).join('');
  renderWords();
}).catch(error => { $('#word-summary').textContent = '数据读取失败'; $('#word-list').innerHTML = `<div class="empty">${e(error.message)}。请刷新页面重试。</div>`; toast(error.message, 'error'); });
