const e = window.JAPages.escapeHtml;
const state = {words: [], log: {}, date: '', month: null, mode: localStorage.getItem('quiz_mode') || 'read'};
const pad = value => String(value).padStart(2, '0');
const parseDay = day => new Date(`${day}T12:00:00`);
const weekday = day => ['日', '一', '二', '三', '四', '五', '六'][parseDay(day).getDay()];

async function loadStudyLog() {
  const response = await fetch('../data/study-log.json');
  if (!response.ok) throw new Error(`学习记录读取失败 (${response.status})`);
  return response.json();
}

function dates() { return Object.keys(state.log).filter(day => state.log[day]?.length).sort().reverse(); }
function setMode(mode) { state.mode = mode === 'listen' ? 'listen' : 'read'; localStorage.setItem('quiz_mode', state.mode); $$('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode)); render(); }
function selectDate(day) { state.date = day; const value = parseDay(day); state.month = new Date(value.getFullYear(), value.getMonth(), 1); $$('[data-date]').forEach(button => button.classList.toggle('active', button.dataset.date === day)); renderCalendar(); render(); }

function renderTabs() {
  const all = dates(), recent = all.slice(0, 7);
  $('#date-tabs').innerHTML = recent.map(day => `<button class="tab" data-date="${day}">${day.slice(5)} 周${weekday(day)} · ${state.log[day].length}</button>`).join('');
  $$('[data-date]').forEach(button => { button.onclick = () => selectDate(button.dataset.date); });
  if (all.length) selectDate(state.date || all[0]); else { $('#quiz-list').innerHTML = '<div class="empty">还没有学习记录</div>'; state.month = new Date(); renderCalendar(); }
}

function renderCalendar() {
  const month = state.month || new Date(), year = month.getFullYear(), monthIndex = month.getMonth();
  $('#quiz-calendar-title').textContent = `${year}年 ${monthIndex + 1}月`;
  const first = new Date(year, monthIndex, 1), dayCount = new Date(year, monthIndex + 1, 0).getDate(), leading = (first.getDay() + 6) % 7;
  let html = '<span class="calendar-empty"></span>'.repeat(leading);
  for (let day = 1; day <= dayCount; day += 1) {
    const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`, count = (state.log[key] || []).length;
    html += `<button class="calendar-day ${count ? 'has-study' : ''} ${key === state.date ? 'selected' : ''}" data-calendar-date="${key}" title="${count ? `${count} 个单词` : '无学习记录'}"><span>${day}</span>${count ? `<small>${count}</small>` : ''}</button>`;
  }
  $('#quiz-calendar').innerHTML = html;
  $$('[data-calendar-date]').forEach(button => { button.onclick = () => selectDate(button.dataset.calendarDate); });
}

function wordBlock(word) {
  if (state.mode === 'listen') return '<div class="quiz-word quiz-word-listen"><button class="button audio-button speak">🔊 播放发音</button></div>';
  return `<div class="quiz-word"><span>${e(word.word)}</span><button class="button small audio-button speak" aria-label="播放发音">🔊</button></div>`;
}
function inputsBlock() { return state.mode === 'listen' ? '<div class="quiz-inputs"><input placeholder="汉字"><input placeholder="中文含义"></div>' : '<div class="quiz-inputs"><input placeholder="読み"><input placeholder="意味"></div>'; }
function answerBlock(word) { const kana = word.kana ? e(word.kana) : '<span class="muted">—</span>', head = state.mode === 'listen' ? `<b>${e(word.word)} <small class="muted">${kana}</small></b>` : `<b>${kana}</b>`; return `<div class="answer" hidden>${head}<p>${e(word.meaning)}</p>${word.memo ? `<div class="detail-block"><div class="detail-label">Memo</div>${e(word.memo)}</div>` : ''}</div>`; }

function render() {
  const ids = state.log[state.date] || [], map = new Map(state.words.map(word => [word.id, word])), rows = ids.map(id => map.get(id)).filter(Boolean);
  $('#quiz-list').innerHTML = rows.map(word => `<article class="card quiz-card" data-id="${word.id}">${wordBlock(word)}${inputsBlock()}<button class="button reveal">答えを見る</button>${answerBlock(word)}</article>`).join('') || '<div class="empty">这一天没有可显示的单词</div>';
  $$('.reveal').forEach(button => { button.onclick = () => { button.nextElementSibling.hidden = false; button.hidden = true; button.closest('.quiz-card').style.borderColor = 'var(--accent)'; }; });
  $$('.speak').forEach(button => { button.onclick = () => playAudio(button.closest('[data-id]').dataset.id, 'words', button); });
}

$$('[data-mode]').forEach(button => { button.onclick = () => setMode(button.dataset.mode); });
$('#quiz-calendar-prev').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); };
$('#quiz-calendar-next').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); };

Promise.all([loadWords(), loadStudyLog()]).then(([words, log]) => { state.words = words; state.log = log; renderTabs(); setMode(state.mode); }).catch(error => { $('#quiz-list').innerHTML = `<div class="empty">${e(error.message)}。请刷新页面重试。</div>`; toast(error.message, 'error'); });
