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

function sumForDate(entries, date) {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.amount, 0);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/meta', (req, res) => {
  res.json({
    dailyGoalMl: DAILY_GOAL_ML
  });
});

app.get('/api/entries', (req, res) => {
  const { date = todayDateString() } = req.query;
  const data = readData();
  const entries = data.entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => new Date(b.consumedAt) - new Date(a.consumedAt));

  res.json({
    date,
    entries
  });
});

app.post('/api/entries', (req, res) => {
  const { amount, consumedAt, note = '' } = req.body;
  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number (in ml).' });
  }

  const entryDate = consumedAt ? new Date(consumedAt) : new Date();

  if (Number.isNaN(entryDate.getTime())) {
    return res.status(400).json({ error: 'Invalid consumedAt timestamp.' });
  }

  const data = readData();
  const entry = {
    id: crypto.randomUUID(),
    amount: Math.round(parsedAmount),
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
  const data = readData();
  const consumedMl = sumForDate(data.entries, date);

  res.json({
    date,
    consumedMl,
    dailyGoalMl: DAILY_GOAL_ML,
    remainingMl: Math.max(DAILY_GOAL_ML - consumedMl, 0),
    progress: Math.min(consumedMl / DAILY_GOAL_ML, 1)
  });
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`💧 Water tracker running on http://localhost:${PORT}`);
});
