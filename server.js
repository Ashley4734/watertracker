const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DAILY_GOAL_ML = Number(process.env.DAILY_GOAL_ML || 2500);
const OZ_TO_ML = 29.5735;
const GOAL_ML_PER_KG = Number(process.env.GOAL_ML_PER_KG || 35);
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 300;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'intake.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [], profiles: {} }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.entries)) {
    parsed.entries = [];
  }

  if (!parsed.profiles || typeof parsed.profiles !== 'object' || Array.isArray(parsed.profiles)) {
    parsed.profiles = {};
  }

  return parsed;
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function sumForDate(entries, date) {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.amount, 0);
}

function normalizeUserId(value) {
  return String(value || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30) || 'default';
}

function amountToMl(amount, unit = 'oz') {
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return null;
  }

  if (unit !== 'oz') {
    return null;
  }

  return Math.round(parsedAmount * OZ_TO_ML);
}

function normalizeWeightKg(weightKg) {
  const parsedWeight = Number(weightKg);

  if (!Number.isFinite(parsedWeight)) {
    return null;
  }

  const roundedWeight = Math.round(parsedWeight * 10) / 10;

  if (roundedWeight < MIN_WEIGHT_KG || roundedWeight > MAX_WEIGHT_KG) {
    return null;
  }

  return roundedWeight;
}

function goalFromWeight(weightKg) {
  return Math.round(weightKg * GOAL_ML_PER_KG);
}

function resolveDailyGoalMl(profileWeightKg) {
  if (typeof profileWeightKg === 'number') {
    return goalFromWeight(profileWeightKg);
  }

  return DAILY_GOAL_ML;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (req, res) => {
  res.json({
    dailyGoalMl: DAILY_GOAL_ML,
    goalMlPerKg: GOAL_ML_PER_KG,
    minWeightKg: MIN_WEIGHT_KG,
    maxWeightKg: MAX_WEIGHT_KG
  });
});

app.get('/api/profile', (req, res) => {
  const userId = normalizeUserId(req.query.userId);
  const data = readData();
  const profile = data.profiles[userId] || {};

  res.json({
    userId,
    weightKg: typeof profile.weightKg === 'number' ? profile.weightKg : null,
    dailyGoalMl: resolveDailyGoalMl(profile.weightKg)
  });
});

app.put('/api/profile', (req, res) => {
  const userId = normalizeUserId(req.body.userId);
  const weightKg = normalizeWeightKg(req.body.weightKg);

  if (weightKg === null) {
    return res
      .status(400)
      .json({ error: `Weight must be a number between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.` });
  }

  const data = readData();
  data.profiles[userId] = {
    ...data.profiles[userId],
    weightKg,
    updatedAt: new Date().toISOString()
  };
  writeData(data);

  return res.json({
    userId,
    weightKg,
    dailyGoalMl: resolveDailyGoalMl(weightKg)
  });
});

app.get('/api/entries', (req, res) => {
  const { date = todayDateString() } = req.query;
  const userId = normalizeUserId(req.query.userId);
  const data = readData();
  const entries = data.entries
    .filter((entry) => entry.date === date && normalizeUserId(entry.userId) === userId)
    .sort((a, b) => new Date(b.consumedAt) - new Date(a.consumedAt));

  res.json({
    date,
    userId,
    entries
  });
});

app.post('/api/entries', (req, res) => {
  const { amount, unit = 'oz', consumedAt, note = '', userId: rawUserId } = req.body;
  const normalizedUnit = unit === 'oz' ? 'oz' : null;

  if (!normalizedUnit) {
    return res.status(400).json({ error: 'Amount unit must be ounces (oz).' });
  }

  const amountMl = amountToMl(amount, normalizedUnit);

  if (!amountMl) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  const entryDate = consumedAt ? new Date(consumedAt) : new Date();

  if (Number.isNaN(entryDate.getTime())) {
    return res.status(400).json({ error: 'Invalid consumedAt timestamp.' });
  }

  const data = readData();
  const entry = {
    id: crypto.randomUUID(),
    userId: normalizeUserId(rawUserId),
    amount: amountMl,
    unit: normalizedUnit,
    consumedAt: entryDate.toISOString(),
    date: entryDate.toISOString().slice(0, 10),
    note: String(note).trim().slice(0, 120)
  };

  data.entries.push(entry);
  writeData(data);

  return res.status(201).json(entry);
});

app.delete('/api/entries/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const initialLength = data.entries.length;
  data.entries = data.entries.filter((entry) => entry.id !== id);

  if (data.entries.length === initialLength) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  writeData(data);
  return res.status(204).send();
});

app.get('/api/stats/today', (req, res) => {
  const date = todayDateString();
  const userId = normalizeUserId(req.query.userId);
  const data = readData();
  const profile = data.profiles[userId] || {};
  const dailyGoalMl = resolveDailyGoalMl(profile.weightKg);
  const consumedMl = sumForDate(
    data.entries.filter((entry) => normalizeUserId(entry.userId) === userId),
    date
  );

  res.json({
    date,
    userId,
    consumedMl,
    dailyGoalMl,
    weightKg: typeof profile.weightKg === 'number' ? profile.weightKg : null,
    remainingMl: Math.max(dailyGoalMl - consumedMl, 0),
    progress: dailyGoalMl > 0 ? Math.min(consumedMl / dailyGoalMl, 1) : 0
  });
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`💧 Water tracker running on http://localhost:${PORT}`);
});
