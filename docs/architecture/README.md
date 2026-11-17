# Liftoff architecture

## Product direction

Liftoff is a mobile-first public launch tracker with a responsive web companion.

- Initial regional coverage: Florida, California, Virginia, and Texas.
- State-level filtering; launch pads remain useful mission details, not filter categories.
- Florida is the default selected state.
- Public launch browsing does not require an account.
- Accounts are optional and can later sync favorites, preferences, and notification settings.
- Monetization is optional: restrained advertising and a one-time remove-ads entitlement may be evaluated after the core product is reliable. No subscription is planned by default.

## Repository direction

The existing Vite + React website remains at the repository root and continues to deploy independently.

- `src/`: existing web application.
- `packages/core/`: shared, provider-independent coverage configuration and launch domain models.
- `apps/mobile/`: future Expo + React Native application.
- `backend/`: future server-side provider integration, scheduled refresh, persistence, and account services.
- `docs/architecture/`: product and technical decisions.

This is an incremental layout. Do not move the current website or change its Vercel root/build settings as part of the initial foundation work.

## Data flow target

1. A server-side provider adapter retrieves launch records from an approved launch-data source.
2. The adapter normalizes provider-specific fields into the shared launch model.
3. Coverage filtering uses the shared state configuration.
4. A cached API delivers the same normalized manifest to web and mobile clients.
5. Change detection records meaningful schedule/status transitions (including delays and scrubs) before notifying interested users.

Clients should not independently poll a rate-limited upstream provider. Provider credentials, if ever required, belong on the server and never in a mobile bundle.

## Reliability principles

- Treat launch times and statuses as provider-reported and subject to change.
- Keep the source update timestamp and the time Liftoff last synchronized distinct.
- Preserve status/schedule history rather than overwriting every prior value.
- Show stale-data and last-synchronized indicators honestly.
- A client refresh should refresh Liftoff's cache when safe; it should not fan out an upstream request from every device.
- Handle missing or tentative dates without presenting a false precision countdown.

## Mobile direction

The planned mobile client uses Expo, React Native, and TypeScript. The web app remains usable while mobile is developed. Shared domain logic belongs in `packages/core`; platform-specific screens and navigation stay in each app.

## Accounts and notifications

Browsing remains public. Sign-in is only needed for cross-device syncing and personalized push notifications. Favorites can begin as local device data. Notification delivery should be based on server-side change detection, user preferences, and platform permission.

## Monetization guardrails

- Do not block core launch information behind an account or payment.
- Keep ads away from countdowns, mission details, and live coverage.
- A remove-ads purchase should be a one-time entitlement with purchase restoration, subject to app-store rules.
- Do not implement ads or billing until the app experience and store requirements are validated.

## Delivery sequence

1. Preserve the current web app and document the architecture.
2. Add shared coverage and launch-domain foundations.
3. Move the web client onto shared coverage logic in a separately tested change.
4. Add a small server-side launch feed/cache and status-history design.
5. Build the Expo mobile shell against the shared model.
6. Add optional accounts, push notifications, and monetization only when the core experience is stable.
7. Prepare privacy, support, accessibility, and store-release requirements before public launch.
