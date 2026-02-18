# HydraTrack (Water Tracker)

A clean, modern water tracking web app you can deploy on a Coolify VPS.

## Features
- Track water intake entries in milliliters or ounces.
- Quick-add buttons for common ml/oz amounts.
- Daily goal progress ring.
- Per-user intake history and totals by selecting a user profile.
- Entry history with optional notes and delete action.
- Data persistence to `data/intake.json`.

## Local development
```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

### Environment variables
- `PORT` (default `3000`)
- `DAILY_GOAL_ML` (default `2500`)

## Deploying on Coolify
1. Create a new application from your Git repository.
2. Select **Dockerfile** build type.
3. Set the container port to `3000`.
4. Add a **persistent volume** mounted to `/app/data`.
5. Optionally set `DAILY_GOAL_ML` in Coolify environment variables.

Once deployed, the app will be available on your Coolify domain and retain water entries across redeploys through the mounted volume.
