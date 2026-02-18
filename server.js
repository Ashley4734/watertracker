const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DAILY_GOAL_ML = Number(process.env.DAILY_GOAL_ML || 2500);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'intake.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function parseUserId(input) {
  const candidate = String(input || '').trim().toLowerCase();

  if (!candidate) {
    return null;
  }

  if (!/^[a-z0-9_-]{3,40}$/.test(candidate)) {
    return null;
  }

  return candidate;
}

function sumForDate(entries, date) {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.amountMl, 0);
}

function getUserEntries(entries, userId) {
  return entries.filter((entry) => entry.userId === userId);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (req, res) => {
  res.json({
    dailyGoalMl: DAILY_GOAL_ML,
    dailyGoalOz: Number((DAILY_GOAL_ML / 29.5735).toFixed(1))
  });
});

app.get('/api/users', (req, res) => {
  const data = readData();
  const users = [...new Set(data.entries.map((entry) => entry.userId))].sort();

  res.json({ users });
});

app.get('/api/entries', (req, res) => {
  const { date = todayDateString(), user } = req.query;
  const userId = parseUserId(user);

  if (!userId) {
    return res.status(400).json({ error: 'Query param "user" is required (3-40 chars: a-z, 0-9, _, -).' });
  }

  const data = readData();
  const entries = getUserEntries(data.entries, userId)
    .filter((entry) => entry.date === date)
    .sort((a, b) => new Date(b.consumedAt) - new Date(a.consumedAt));

  res.json({
    userId,
    date,
    entries
  });
});

app.post('/api/entries', (req, res) => {
  const { amount, unit = 'ml', consumedAt, note = '', user } = req.body;
  const parsedAmount = Number(amount);
  const parsedUserId = parseUserId(user);

  if (!parsedUserId) {
    return res.status(400).json({ error: 'Body field "user" is required (3-40 chars: a-z, 0-9, _, -).' });
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  if (!['ml', 'oz'].includes(unit)) {
    return res.status(400).json({ error: 'Unit must be either "ml" or "oz".' });
  }

  const amountMl = unit === 'oz' ? Math.round(parsedAmount * 29.5735) : Math.round(parsedAmount);
  const entryDate = consumedAt ? new Date(consumedAt) : new Date();

  if (Number.isNaN(entryDate.getTime())) {
    return res.status(400).json({ error: 'Invalid consumedAt timestamp.' });
  }

  const data = readData();
  const entry = {
    id: crypto.randomUUID(),
    userId: parsedUserId,
    amountMl,
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
  const { user } = req.query;
  const userId = parseUserId(user);

  if (!userId) {
    return res.status(400).json({ error: 'Query param "user" is required (3-40 chars: a-z, 0-9, _, -).' });
  }

  const data = readData();
  const entry = data.entries.find((item) => item.id === id);

  if (!entry || entry.userId !== userId) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  data.entries = data.entries.filter((item) => item.id !== id);
  writeData(data);
  return res.status(204).send();
});

app.get('/api/stats/today', (req, res) => {
  const { user } = req.query;
  const userId = parseUserId(user);

  if (!userId) {
    return res.status(400).json({ error: 'Query param "user" is required (3-40 chars: a-z, 0-9, _, -).' });
  }

  const date = todayDateString();
  const data = readData();
  const consumedMl = sumForDate(getUserEntries(data.entries, userId), date);

  res.json({
    userId,
    date,
    consumedMl,
    consumedOz: Number((consumedMl / 29.5735).toFixed(1)),
    dailyGoalMl: DAILY_GOAL_ML,
    dailyGoalOz: Number((DAILY_GOAL_ML / 29.5735).toFixed(1)),
    remainingMl: Math.max(DAILY_GOAL_ML - consumedMl, 0),
    remainingOz: Number((Math.max(DAILY_GOAL_ML - consumedMl, 0) / 29.5735).toFixed(1)),
    progress: Math.min(consumedMl / DAILY_GOAL_ML, 1)
  });
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`💧 Water tracker running on http://localhost:${PORT}`);
});
