# q-desktop (OpenClaw Plugin)

Desktop automation tools for Q on Ubuntu GNOME/Wayland.

## Features

Tools exposed to OpenClaw:
- `desktop_screenshot` — screenshot via `ffmpeg -f kmsgrab` (works on GNOME 49 Wayland)
- `desktop_look` — screenshot + prompt hint (use OpenClaw `image` tool on the returned path)
- `desktop_ocr` — screenshot + Tesseract OCR
- `desktop_click` — absolute input on Wayland via **evdev virtual touchscreen** (UInput)
- `desktop_move` — (X11 only; Wayland click is absolute)
- `desktop_type` — type text (evdev virtual keyboard on Wayland)
- `desktop_key` — key combos (evdev virtual keyboard on Wayland)
- `desktop_windows` — list windows (limited on Wayland; uses xdotool for XWayland)
- `desktop_focus` — focus window by title (XWayland via xdotool)

## Requirements

- Ubuntu GNOME / Wayland
- `ffmpeg` (system package, includes kmsgrab)
- `tesseract-ocr`
- `xdotool` (optional; XWayland window listing/focus)
- `python3-evdev` (for Wayland input)

Scripts live in: `~/Schreibtisch/desktop-automation/scripts/`

## Install

```bash
cd ~/Schreibtisch/q-desktop
npm install
~/.npm-global/bin/openclaw plugins install --link ~/Schreibtisch/q-desktop
systemctl --user restart openclaw-gateway.service
```

## Notes

### Why sudo?
Wayland input uses `/dev/uinput` to create a virtual touchscreen/keyboard. This requires root (or uinput permissions). The plugin currently calls the control script via `sudo`.

### GNOME 49 screenshot restrictions
GNOME 49 blocks non-interactive D-Bus screenshot APIs. `kmsgrab` is the reliable workaround.

## Repo
https://github.com/q-lhzp/q-desktop
