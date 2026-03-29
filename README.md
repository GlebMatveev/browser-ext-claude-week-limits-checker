# Claude Daily Budget Tracker

Browser extension that adds a daily budget tracker to the [claude.ai](https://claude.ai) usage page.

Claude shows only a weekly usage bar. This extension splits it into per-day segments and calculates an **adaptive daily budget** — how much you can use each remaining day to spread your weekly limit evenly.

## Features

- **Segmented weekly bar** — the weekly "All models" progress bar is split into 7 day segments with day-of-week labels
- **Adaptive daily budget** — recalculates based on remaining usage and days left until reset
- **Color indicators** — green/yellow/red segments depending on whether you're within, approaching, or over your daily budget
- **In-page banner notifications** — warns at 70% and 100% of daily budget usage
- **System notifications** — browser notifications at the same thresholds (once per day)
- Works in Chrome, Edge, Firefox, and other Chromium-based browsers

## Screenshots

<!-- TODO: add screenshots -->

## Installation

### Chrome / Edge / Chromium-based browsers (developer mode)

1. Download or clone this repository
2. Open `chrome://extensions` (or `edge://extensions` for Edge)
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the folder containing this extension
6. Go to [claude.ai/settings/usage](https://claude.ai/settings/usage) — the daily budget bar will appear below the weekly "All models" bar

### Firefox (temporary add-on)

1. Download or clone this repository
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on...**
4. Select the `manifest.json` file from the extension folder
5. Go to [claude.ai/settings/usage](https://claude.ai/settings/usage)

> Note: Temporary add-ons in Firefox are removed when the browser is closed. For persistent installation, the extension needs to be signed through [addons.mozilla.org](https://addons.mozilla.org).

## How it works

The extension runs a content script on `claude.ai/settings/usage` that:

1. Finds the "Weekly limits" section and reads the "All models" progress bar value and reset time
2. Calculates the week boundaries and which day of the week it currently is
3. Computes an adaptive daily budget: `remaining_usage / remaining_days`
4. Renders a segmented progress bar with per-day breakdown
5. Watches for DOM changes (React re-renders) and updates automatically
6. Sends notifications when daily usage exceeds 70% or 100% of the adaptive budget

## Permissions

- `storage` — remembers which notifications have already been shown today
- `notifications` — system notifications for budget warnings
- Host permission `claude.ai` — content script runs only on the usage page

## License

MIT
