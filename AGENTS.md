# AGENTS.md

## Repository Notes
- This repository contains a deployable Node.js water tracker web app for Coolify.
- Runtime entry point: `server.js`.
- Front-end assets live in `public/`.
- Persistent intake data is stored in `data/intake.json` (created automatically on first run).
- Intake entries now support `ml` and `oz` input units, normalized to milliliters for goal calculations.
- The app supports multiple users by `userId`; API reads/writes should include `userId` to isolate stats and entry lists.

## Development Workflow
- Install dependencies with `npm install`.
- Run locally with `npm run dev` (or `npm start`).
- Default app port is `3000` and can be changed with the `PORT` env variable.
- Daily goal can be configured with `DAILY_GOAL_ML`.

## Deployment
- Deploy with the included `Dockerfile`.
- In Coolify, mount a persistent volume at `/app/data` to preserve intake history across redeploys.
