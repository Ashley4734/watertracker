const todayLabel = document.getElementById('todayLabel');
const consumedValue = document.getElementById('consumedValue');
const goalValue = document.getElementById('goalValue');
const remainingValue = document.getElementById('remainingValue');
const ringValue = document.getElementById('ringValue');
const entryForm = document.getElementById('entryForm');
const amountInput = document.getElementById('amountInput');
const unitInput = document.getElementById('unitInput');
const noteInput = document.getElementById('noteInput');
const entryList = document.getElementById('entryList');
const entryTemplate = document.getElementById('entryTemplate');
const entryCount = document.getElementById('entryCount');
const userInput = document.getElementById('userInput');
const saveUserBtn = document.getElementById('saveUserBtn');

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

const DEFAULT_USER = 'guest';
let activeUserId = localStorage.getItem('watertracker-user') || DEFAULT_USER;

function validateUserId(userId) {
  return /^[a-z0-9_-]{3,40}$/.test(userId);
}

function setProgress(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  ringValue.style.strokeDasharray = `${ringCircumference}`;
  ringValue.style.strokeDashoffset = `${ringCircumference * (1 - clamped)}`;
}

function mlToOz(ml) {
  return (ml / 29.5735).toFixed(1);
}

function renderEntries(entries) {
  entryList.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = `No entries for ${activeUserId} yet. Add your first glass of water 💧`;
    entryList.appendChild(empty);
    entryCount.textContent = '0 entries';
    return;
  }

  entries.forEach((entry) => {
    const node = entryTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.entry-amount').textContent = `${entry.amountMl} ml (${mlToOz(entry.amountMl)} oz)`;
    const notePart = entry.note ? ` · ${entry.note}` : '';
    node.querySelector('.entry-meta').textContent = `${localeTime.format(new Date(entry.consumedAt))}${notePart}`;

    const deleteBtn = node.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      await fetch(`/api/entries/${entry.id}?user=${encodeURIComponent(activeUserId)}`, { method: 'DELETE' });
      await refresh();
    });

    entryList.appendChild(node);
  });

  entryCount.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;
}

async function refresh() {
  const [statsRes, entriesRes] = await Promise.all([
    fetch(`/api/stats/today?user=${encodeURIComponent(activeUserId)}`),
    fetch(`/api/entries?user=${encodeURIComponent(activeUserId)}`)
  ]);

  if (!statsRes.ok || !entriesRes.ok) {
    remainingValue.textContent = 'Unable to load entries. Check your user ID.';
    return;
  }

  const stats = await statsRes.json();
  const { entries } = await entriesRes.json();

  consumedValue.textContent = `${stats.consumedMl} ml (${stats.consumedOz} oz)`;
  goalValue.textContent = `of ${stats.dailyGoalMl} ml (${stats.dailyGoalOz} oz)`;
  remainingValue.textContent =
    stats.remainingMl > 0
      ? `${stats.remainingMl} ml (${stats.remainingOz} oz) left today`
      : 'Goal reached! Great hydration today 🎉';

  setProgress(stats.progress);
  renderEntries(entries);
}

function persistUser() {
  localStorage.setItem('watertracker-user', activeUserId);
  userInput.value = activeUserId;
}

async function initialize() {
  todayLabel.textContent = localeDate.format(new Date());
  if (!validateUserId(activeUserId)) {
    activeUserId = DEFAULT_USER;
  }
  persistUser();
  await refresh();
}

saveUserBtn.addEventListener('click', async () => {
  const candidate = userInput.value.trim().toLowerCase();

  if (!validateUserId(candidate)) {
    userInput.focus();
    return;
  }

  activeUserId = candidate;
  persistUser();
  await refresh();
});

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const note = noteInput.value.trim();
  const unit = unitInput.value;

  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }

  const response = await fetch('/api/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount, unit, note, user: activeUserId })
  });

  if (!response.ok) {
    return;
  }

  entryForm.reset();
  unitInput.value = 'ml';
  amountInput.focus();
  await refresh();
});

document.querySelectorAll('.quick-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    const amountMl = button.dataset.ml;
    const amountOz = button.dataset.oz;

    const payload = amountMl
      ? { amount: Number(amountMl), unit: 'ml', user: activeUserId }
      : { amount: Number(amountOz), unit: 'oz', user: activeUserId };

    await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    await refresh();
  });
});

initialize();
