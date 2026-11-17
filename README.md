# Liftoff — Flight Operations

A responsive, mission-control-style launch tracker with an initial regional focus on four US states: Florida, California, Virginia, and Texas.

## Current website

- Upcoming launch manifest powered by The Space Devs Launch Library 2
- State-level filters for FL, CA, VA, and TX; Florida is selected by default
- Launch counts by tracked state
- Live countdowns, launch status, provider, vehicle, and mission information
- Mission dossier with available webcast and information links
- Eastern Time display, loading/error states, and manual refresh
- Browser caching to reduce repeat API requests
- Responsive desktop and mobile layout

Launch data is provider-reported and can change. Refresh frequency and availability depend on the upstream data service; Liftoff does not guarantee instant scrub or delay detection.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Repository layout

- `src/` — current Vite + React website (kept at the repository root for the existing Vercel deployment)
- `packages/core/` — shared coverage configuration and provider-independent launch model
- `apps/mobile/` — planned Expo + React Native application
- `backend/` — planned server-side launch feed, caching, and status history
- `docs/architecture/` — product and technical direction

The mobile and backend directories will be introduced incrementally. The current website remains the working baseline.

## Data source

Launch Library 2: https://ll.thespacedevs.com/2.3.0/launches/upcoming/

Liftoff is an unofficial community project. Verify launch dates, status, and viewing information with the launch provider.
