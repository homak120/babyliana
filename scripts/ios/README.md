# Driving the iOS Simulator

This exists because three swipe fixes passed every desktop test and did nothing
on a real phone. Playwright cannot settle a touch gesture: Chromium's input
pipeline is more forgiving than iOS, and WebKit cannot be driven with touch at
all — it rejects `new Touch()` and dropped `initTouchEvent`. Synthetic events
skip gesture arbitration, which is the thing that breaks.

The Simulator turns a **mouse drag into a genuine iOS touch**, arbitration
included. That is the only faithful test available without a phone in hand.

## Setup

1. `xcrun simctl list devices available` — pick a device, boot it, `open -a Simulator`.
2. Grant **Accessibility** to the terminal app (System Settings → Privacy &
   Security → Accessibility). Without it `CGEvent.post` is silently ignored and
   `osascript` fails with `-1719`.
3. `swiftc -O scripts/ios/mouse.swift -o scripts/ios/mouse`

## Serving the app to the Simulator

- `npx vite preview --port 4189 --host 0.0.0.0`, then
  `xcrun simctl openurl <udid> http://127.0.0.1:4189/`.
- Use **127.0.0.1, not localhost**. A server bound to IPv6 only — which
  `python3 -m http.server` does by default — answers curl on the host and gives
  the Simulator a blank tab, with no error anywhere.
- If Safari starts opening `about:blank` for everything, it is wedged:
  `xcrun simctl shutdown`, `erase`, `boot`.

## Calibrating

The mapping from Simulator screenshot pixels to host screen points changes
whenever the window moves, so re-derive it per session. Serve a page that prints
`touch.clientX/clientY`, tap two known host points, and solve:

    host_x = ax + (px_x / 3) * sx
    host_y = ay + (px_y / 3) * sy

The `/ 3` is the device pixel ratio; `xcrun simctl io <udid> screenshot` is in
device pixels. Screenshot pixels are the convenient unit because that is what
you measure element positions in.

## Limits

- **Standalone PWA mode is not reachable in an EU region.** Launching an
  installed web app prompts "open in Safari" instead, so only browser Safari
  gets tested here.
- `screencapture -R` needs Screen Recording permission, which Accessibility does
  not cover. Use `xcrun simctl io ... screenshot` instead.
