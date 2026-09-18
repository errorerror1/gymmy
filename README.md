# gymmy
Basic 531 GymTracker app thats running in the browser

## Development

```
npm install
npm run typecheck   # tsc
npm test            # vitest over src/lib (pure 5/3/1 math, plates, e1RM/PRs, cycle)
npm run build       # expo export → dist/
node e2e/smoke.mjs  # Playwright smoke against dist/ (see header for browser setup)
```

Optional Train-screen features (AMRAP + PRs, warm-ups, cycle helper)
live behind toggles in Settings → Features.
