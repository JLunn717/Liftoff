# Liftoff — Florida Launch Control

A responsive, mission-control-style rocket launch tracker focused on Florida's Space Coast: Kennedy Space Center and Cape Canaveral Space Force Station.

## Features
- Upcoming Florida launch manifest powered by The Space Devs Launch Library 2
- Kennedy / Cape launch-site filters
- Live countdowns, launch status, provider and vehicle information
- Mission briefing details and available webcast links
- Eastern Time display, loading/error states, manual refresh
- Ten-minute browser cache to reduce API requests
- Responsive desktop and mobile layout

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

## Data source
Launch Library 2: https://ll.thespacedevs.com/2.3.0/launches/upcoming/

Launch dates and times are subject to change. Liftoff is an unofficial community project; verify mission details and viewing information with the launch provider.
