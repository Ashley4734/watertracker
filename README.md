# HydraTrack (Water Tracker)

A clean, modern water tracking web app you can deploy on a Coolify VPS.

## Features
- Multi-user tracking with simple user IDs (each user has isolated entries).
- Track water intake in **ml** and **oz**.
- Quick-add buttons for common ml and oz amounts.
- Daily goal progress ring and dual-unit summaries.
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

## API notes
- All user-specific API calls require a `user` identifier.
- Allowed user format: `a-z`, `0-9`, `_`, `-` with length `3-40`.

## Deploying on Coolify
1. Create a new application from your Git repository.
2. Select **Dockerfile** build type.
3. Set the container port to `3000`.
4. Add a **persistent volume** mounted to `/app/data`.
5. Optionally set `DAILY_GOAL_ML` in Coolify environment variables.

Once deployed, the app will be available on your Coolify domain and retain water entries across redeploys through the mounted volume.
