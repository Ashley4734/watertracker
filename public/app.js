const todayLabel = document.getElementById('todayLabel');
const consumedValue = document.getElementById('consumedValue');
const goalValue = document.getElementById('goalValue');
const remainingValue = document.getElementById('remainingValue');
const ringValue = document.getElementById('ringValue');
const entryForm = document.getElementById('entryForm');
const amountInput = document.getElementById('amountInput');
const unitInput = document.getElementById('unitInput');
const noteInput = document.getElementById('noteInput');
const userInput = document.getElementById('userInput');
const weightInput = document.getElementById('weightInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const goalHint = document.getElementById('goalHint');
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

let currentUserId = localStorage.getItem('hydra-user') || 'default';
let profileLimits = {
  minWeightKg: 20,
  maxWeightKg: 300,
  goalMlPerKg: 35
};

function setProgress(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  ringValue.style.strokeDasharray = `${ringCircumference}`;
  ringValue.style.strokeDashoffset = `${ringCircumference * (1 - clamped)}`;
}

function normalizeUserId(value) {
  return String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30) || 'default';
}

function formatAmount(entry) {
  if (entry.unit === 'oz') {
    return `${Math.round((entry.amount / 29.5735) * 10) / 10} oz`;
  }

  return `${entry.amount} ml`;
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
    node.querySelector('.entry-amount').textContent = formatAmount(entry);
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

function readWeightInput() {
  const parsed = Number(weightInput.value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < profileLimits.minWeightKg || parsed > profileLimits.maxWeightKg) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

async function loadProfile() {
  const encodedUserId = encodeURIComponent(currentUserId);
  const profileRes = await fetch(`/api/profile?userId=${encodedUserId}`);
  const profile = await profileRes.json();
  weightInput.value = typeof profile.weightKg === 'number' ? String(profile.weightKg) : '';

  if (typeof profile.weightKg === 'number') {
    goalHint.textContent = `Goal uses ${profile.weightKg} kg × ${profileLimits.goalMlPerKg} ml/kg.`;
  } else {
    goalHint.textContent = 'Set weight to calculate a personalized daily goal.';
  }
}

async function refresh() {
  const encodedUserId = encodeURIComponent(currentUserId);
  const [statsRes, entriesRes] = await Promise.all([
    fetch(`/api/stats/today?userId=${encodedUserId}`),
    fetch(`/api/entries?userId=${encodedUserId}`)
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
  currentUserId = normalizeUserId(currentUserId);
  userInput.value = currentUserId;

  const metaRes = await fetch('/api/meta');
  const meta = await metaRes.json();
  profileLimits = {
    minWeightKg: meta.minWeightKg,
    maxWeightKg: meta.maxWeightKg,
    goalMlPerKg: meta.goalMlPerKg
  };

  weightInput.min = profileLimits.minWeightKg;
  weightInput.max = profileLimits.maxWeightKg;

  await loadProfile();
  await refresh();
}

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const unit = unitInput.value;
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
    body: JSON.stringify({ amount, unit, note, userId: currentUserId })
  });

  if (!response.ok) {
    return;
  }

  entryForm.reset();
  unitInput.value = unit;
  amountInput.focus();
  await refresh();
});

document.querySelectorAll('.quick-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    const amount = Number(button.dataset.amount);
    const unit = button.dataset.unit === 'oz' ? 'oz' : 'ml';
    await fetch('/api/entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, unit, userId: currentUserId })
    });
    await refresh();
  });
});

saveProfileBtn.addEventListener('click', async () => {
  const weightKg = readWeightInput();

  if (weightKg === null) {
    goalHint.textContent = `Enter a valid weight between ${profileLimits.minWeightKg} and ${profileLimits.maxWeightKg} kg.`;
    weightInput.focus();
    return;
  }

  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: currentUserId, weightKg })
  });

  if (!response.ok) {
    goalHint.textContent = 'Could not save profile. Try again.';
    return;
  }

  const profile = await response.json();
  goalHint.textContent = `Saved. Goal now uses ${profile.weightKg} kg × ${profileLimits.goalMlPerKg} ml/kg.`;
  await refresh();
});

userInput.addEventListener('change', async () => {
  currentUserId = normalizeUserId(userInput.value);
  userInput.value = currentUserId;
  localStorage.setItem('hydra-user', currentUserId);
  await loadProfile();
  await refresh();
});

initialize();
