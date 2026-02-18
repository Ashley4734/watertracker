const todayLabel = document.getElementById('todayLabel');
const consumedValue = document.getElementById('consumedValue');
const goalValue = document.getElementById('goalValue');
const remainingValue = document.getElementById('remainingValue');
const ringValue = document.getElementById('ringValue');
const entryForm = document.getElementById('entryForm');
const amountInput = document.getElementById('amountInput');
const noteInput = document.getElementById('noteInput');
const entryList = document.getElementById('entryList');
const entryTemplate = document.getElementById('entryTemplate');
const entryCount = document.getElementById('entryCount');

const ringCircumference = 2 * Math.PI * 52;
const localeDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
});
const localeTime = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
});

let dailyGoalMl = 2500;

function setProgress(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  ringValue.style.strokeDasharray = `${ringCircumference}`;
  ringValue.style.strokeDashoffset = `${ringCircumference * (1 - clamped)}`;
}

function renderEntries(entries) {
  entryList.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No entries yet. Add your first glass of water 💧';
    entryList.appendChild(empty);
    entryCount.textContent = '0 entries';
    return;
  }

  entries.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.entry-amount').textContent = `${entry.amount} ml`;
    const notePart = entry.note ? ` · ${entry.note}` : '';
    node.querySelector('.entry-meta').textContent = `${localeTime.format(new Date(entry.consumedAt))}${notePart}`;

    const deleteBtn = node.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      await refresh();
    });

    entryList.appendChild(node);
  });

  entryCount.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
}

async function refresh() {
  const [statsRes, entriesRes] = await Promise.all([
    fetch('/api/stats/today'),
    fetch('/api/entries')
  ]);

  const stats = await statsRes.json();
  const { entries } = await entriesRes.json();

  consumedValue.textContent = `${stats.consumedMl} ml`;
  goalValue.textContent = `of ${stats.dailyGoalMl} ml`;
  remainingValue.textContent =
    stats.remainingMl > 0
      ? `${stats.remainingMl} ml left today`
      : 'Goal reached! Great hydration today 🎉';

  setProgress(stats.progress);
  renderEntries(entries);
}

async function initialize() {
  todayLabel.textContent = localeDate.format(new Date());
  const metaRes = await fetch('/api/meta');
  const meta = await metaRes.json();
  dailyGoalMl = meta.dailyGoalMl;
  goalValue.textContent = `of ${dailyGoalMl} ml`;
  await refresh();
}

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }

  const response = await fetch('/api/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, note })
  });

  if (!response.ok) {
    return;
  }

  entryForm.reset();
  amountInput.focus();
  await refresh();
});

document.querySelectorAll('.quick-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    const amount = Number(button.dataset.ml);
    await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });
    await refresh();
  });
});

initialize();
