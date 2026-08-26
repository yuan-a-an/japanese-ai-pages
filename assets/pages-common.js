const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const pagesBase = document.body.dataset.pagesBase || '.';

$('#theme-toggle')?.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
});

function escapeHtml(value = '') {
  const node = document.createElement('div');
  node.textContent = String(value);
  return node.innerHTML;
}

function toast(message, kind = 'ok') {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
  node.hidden = false;
  clearTimeout(window.__pagesToastTimer);
  window.__pagesToastTimer = setTimeout(() => { node.hidden = true; }, 2800);
}

async function loadWords() {
  const response = await fetch(`${pagesBase}/data/words.json`);
  if (!response.ok) throw new Error(`词库读取失败 (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.words;
}

let activeAudio = null;
function playAudio(id, kind = 'words', button = null) {
  const category = kind === 'examples' ? 'examples' : 'words';
  const audio = new Audio(`${pagesBase}/audio/${category}/${encodeURIComponent(id)}.mp3`);
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }
  activeAudio = audio;
  let failed = false;
  const restore = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  };
  const fail = () => {
    if (failed) return;
    failed = true;
    restore();
    toast('该发音暂时无法播放', 'error');
  };
  if (button) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
  }
  audio.addEventListener('canplay', restore, {once: true});
  audio.addEventListener('error', fail, {once: true});
  audio.addEventListener('ended', () => {
    restore();
    if (activeAudio === audio) activeAudio = null;
  }, {once: true});
  audio.play().catch(fail);
}

function renderSegments(example) {
  return (example?.segments || []).map(segment => {
    const text = escapeHtml(segment.text || '');
    return segment.reading ? `<ruby>${text}<rt>${escapeHtml(segment.reading)}</rt></ruby>` : text;
  }).join('');
}

window.JAPages = { $, $$, escapeHtml, loadWords, playAudio, renderSegments, toast };
