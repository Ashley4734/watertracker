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

const OZ_PER_ML = 1 / 29.5735;
const LB_PER_KG = 2.20462;

function mlToOz(amountMl) {
  return Math.round(amountMl * OZ_PER_ML * 10) / 10;
}

function kgToLb(weightKg) {
  return Math.round(weightKg * LB_PER_KG * 10) / 10;
}

function lbToKg(weightLb) {
  return Math.round((weightLb / LB_PER_KG) * 10) / 10;
}

let currentUserId = localStorage.getItem('hydra-user') || 'default';
let profileLimits = {
  minWeightLb: 44,
  maxWeightLb: 660,
  goalOzPerLb: 0.56
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
  return `${mlToOz(entry.amount)} oz`;
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

  if (parsed < profileLimits.minWeightLb || parsed > profileLimits.maxWeightLb) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

async function loadProfile() {
  const encodedUserId = encodeURIComponent(currentUserId);
  const profileRes = await fetch(`/api/profile?userId=${encodedUserId}`);
  const profile = await profileRes.json();
  weightInput.value = typeof profile.weightKg === 'number' ? String(kgToLb(profile.weightKg)) : '';

  if (typeof profile.weightKg === 'number') {
    goalHint.textContent = `Goal uses ${kgToLb(profile.weightKg)} lb × ${profileLimits.goalOzPerLb.toFixed(2)} oz/lb.`;
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

  const consumedOz = mlToOz(stats.consumedMl);
  const goalOz = mlToOz(stats.dailyGoalMl);
  const remainingOz = mlToOz(stats.remainingMl);

  consumedValue.textContent = `${consumedOz} oz`;
  goalValue.textContent = `of ${goalOz} oz`;
  remainingValue.textContent =
    stats.remainingMl > 0
      ? `${remainingOz} oz left today`
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
    minWeightLb: kgToLb(meta.minWeightKg),
    maxWeightLb: kgToLb(meta.maxWeightKg),
    goalOzPerLb: Math.round((meta.goalMlPerKg / LB_PER_KG) * OZ_PER_ML * 100) / 100
  };

  weightInput.min = profileLimits.minWeightLb;
  weightInput.max = profileLimits.maxWeightLb;

  await loadProfile();
  await refresh();
}

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  const unit = 'oz';
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
    const unit = 'oz';
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
  const weightLb = readWeightInput();

  if (weightLb === null) {
    goalHint.textContent = `Enter a valid weight between ${profileLimits.minWeightLb} and ${profileLimits.maxWeightLb} lb.`;
    weightInput.focus();
    return;
  }

  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId: currentUserId, weightKg: lbToKg(weightLb) })
  });

  if (!response.ok) {
    goalHint.textContent = 'Could not save profile. Try again.';
    return;
  }

  const profile = await response.json();
  goalHint.textContent = `Saved. Goal now uses ${kgToLb(profile.weightKg)} lb × ${profileLimits.goalOzPerLb.toFixed(2)} oz/lb.`;
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
