const arena = document.getElementById('arena');
const prompt = document.getElementById('prompt');
const note = document.getElementById('note');
const bars = Object.fromEntries([...arena.querySelectorAll('.bar')].map((el) => [el.dataset.choice, el]));
const NAMES = { penguin: 'Penguin', timtam: 'TimTam' };
const MIN_PCT = 0.12; // keep a stub of wrapper visible even with no votes
const POLL_MS = 15000;

let busy = false;

for (const [choice, el] of Object.entries(bars)) {
  el.addEventListener('click', () => vote(choice));
}

async function vote(choice) {
  if (busy || arena.dataset.state === 'results') return;
  busy = true;
  note.textContent = '';
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Vote failed');
    window.umami?.track('vote', { choice });
    showResults(data);
  } catch (err) {
    note.textContent = `${err.message}. Please try again.`;
  } finally {
    busy = false;
  }
}

function showResults(data) {
  const total = data.penguin + data.timtam;
  const max = Math.max(data.penguin, data.timtam, 1);

  for (const [choice, el] of Object.entries(bars)) {
    const n = data[choice];
    const other = total - n;
    el.style.setProperty('--pct', Math.max(n / max, MIN_PCT));
    el.classList.toggle('leading', n > other);
    el.classList.toggle('mine', data.yourVote === choice);
    el.setAttribute('aria-label', `${NAMES[choice]}: ${n} ${n === 1 ? 'vote' : 'votes'}`);
    el.setAttribute('aria-disabled', 'true');
    el.querySelector('.count-pct').textContent = `${total ? Math.round((n / total) * 100) : 0}%`;
    countUp(el.querySelector('.count-n'), n);
  }

  const headline =
    data.penguin === data.timtam
      ? "It's a dead heat!"
      : `${data.penguin > data.timtam ? NAMES.penguin : NAMES.timtam} is winning!`;
  setPrompt(headline);
  if (data.yourVote) note.textContent = `You voted for ${NAMES[data.yourVote]}.`;

  arena.dataset.state = 'results';
}

function setPrompt(text) {
  if (prompt.textContent === text) return;
  prompt.classList.add('swap');
  setTimeout(() => {
    prompt.textContent = text;
    prompt.classList.remove('swap');
  }, 300);
}

function countUp(el, target) {
  const start = Number(el.textContent) || 0;
  if (start === target) return;
  const duration = 1000;
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function fetchResults() {
  const res = await fetch('/api/results');
  if (!res.ok) throw new Error('Could not load results');
  return res.json();
}

// Returning voters see the bars hover for a moment, then morph into the chart.
fetchResults()
  .then((data) => {
    if (data.yourVote) setTimeout(() => showResults(data), 900);
  })
  .catch(() => {});

setInterval(async () => {
  if (arena.dataset.state !== 'results' || document.hidden) return;
  try {
    showResults(await fetchResults());
  } catch {}
}, POLL_MS);
