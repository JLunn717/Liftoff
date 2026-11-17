# Liftoff mobile app

The Android and iOS app is being built with Expo and React Native.

## Local development

From this directory:

```bash
npm install
npx expo start
```

Use Expo's development build workflow for device testing and production builds. The app uses the shared coverage configuration in `packages/core`; the existing Vite website remains at the repository root and is not affected by this app.

## Current milestone

- Expo / React Native project foundation
- Liftoff Mission Control visual direction
- Shared FL, CA, VA, and TX coverage configuration
- Live launch data integration is the next implementation step
