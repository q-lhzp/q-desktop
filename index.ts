import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { execFileSync, execSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

function run(cmd: string, args: string[], timeoutMs = 30_000) {
  const env = { ...process.env } as Record<string, string>;
  env.DISPLAY = env.DISPLAY || ":0";
  env.XDG_SESSION_TYPE = env.XDG_SESSION_TYPE || "wayland";
  env.XDG_CURRENT_DESKTOP = env.XDG_CURRENT_DESKTOP || "GNOME";
  env.WAYLAND_DISPLAY = env.WAYLAND_DISPLAY || "wayland-0";
  return execFileSync(cmd, args, { encoding: "utf-8", timeout: timeoutMs, env }).trim();
}

function runShell(cmd: string, timeoutMs = 30_000) {
  const env = { ...process.env } as Record<string, string>;
  env.DISPLAY = env.DISPLAY || ":0";
  env.XDG_SESSION_TYPE = env.XDG_SESSION_TYPE || "wayland";
  env.XDG_CURRENT_DESKTOP = env.XDG_CURRENT_DESKTOP || "GNOME";
  env.WAYLAND_DISPLAY = env.WAYLAND_DISPLAY || "wayland-0";
  return execSync(cmd, { encoding: "utf-8", timeout: timeoutMs, env }).trim();
}

/** MCP-style text result */
function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export default {
  id: "q-desktop",
  name: "Q Desktop Automation",
  description: "Desktop automation tools (screenshot, vision look, OCR, input, window listing)",

  register(api: OpenClawPluginApi) {
    const rawCfg = (api.pluginConfig ?? {}) as Record<string, unknown>;
    const ws = (rawCfg.workspacePath as string) || "/home/leo/Schreibtisch";
    const scripts = join(ws, "desktop-automation", "scripts");
    const ssDir = (rawCfg.screenshotDir as string) || join(ws, "screenshots");

    const captureScreen = join(scripts, "capture_screen.sh");
    const captureOcr = join(scripts, "capture_and_ocr.sh");
    const controlPy = join(scripts, "desktop_control.py");
    const listWindows = join(scripts, "list_windows.sh");

    if (!existsSync(ssDir)) mkdirSync(ssDir, { recursive: true });
    api.logger.info(`q-desktop: registered (workspace: ${ws})`);

    // ── desktop_screenshot ──────────────────────────────────────────
    api.registerTool({
      name: "desktop_screenshot",
      label: "Desktop Screenshot",
      description:
        "Take a screenshot of the desktop. Returns the file path. " +
        "Uses KMS grab on GNOME Wayland. Use `image` tool to analyze visually.",
      parameters: Type.Object({
        region: Type.Optional(Type.String({ description: "reserved for future use" })),
      }),
      async execute(_id: string, _params: any) {
        const out = run("bash", [captureScreen, ssDir], 30_000);
        const lines = out.split(/\r?\n/).filter(Boolean);
        return ok("Screenshot saved to: " + lines[lines.length - 1]);
      },
    });

    // ── desktop_look ────────────────────────────────────────────────
    api.registerTool({
      name: "desktop_look",
      label: "Desktop Look",
      description:
        "Take a screenshot for vision analysis. Returns the file path. " +
        "Use the `image` tool on the returned path to see the screen.",
      parameters: Type.Object({
        question: Type.Optional(Type.String({ description: "What to look for on screen" })),
      }),
      async execute(_id: string, params: any) {
        const q = (params as any)?.question ?? "Describe the current screen.";
        const out = run("bash", [captureScreen, ssDir], 30_000);
        const lines = out.split(/\r?\n/).filter(Boolean);
        const path = lines[lines.length - 1];
        return ok("Screenshot: " + path + " | Question: " + q + " | Use image tool to analyze.");
      },
    });

    // ── desktop_windows ─────────────────────────────────────────────
    api.registerTool({
      name: "desktop_windows",
      label: "Desktop Windows",
      description: "List all open windows (titles + IDs via xdotool).",
      parameters: Type.Object({}),
      async execute() {
        const out = run("bash", [listWindows], 15_000);
        return ok(out);
      },
    });

    // ── desktop_click ───────────────────────────────────────────────
    api.registerTool({
      name: "desktop_click",
      label: "Desktop Click",
      description: "Click at a position on screen.",
      parameters: Type.Object({
        x: Type.Number({ description: "X coordinate" }),
        y: Type.Number({ description: "Y coordinate" }),
        button: Type.Optional(
          Type.Union(
            [Type.Literal("left"), Type.Literal("right"), Type.Literal("middle")],
            { description: "Mouse button (default: left)" }
          )
        ),
      }),
      async execute(_id: string, params: any) {
        const p = params as { x: number; y: number; button?: string };
        const btn = p.button ?? "left";
        // Pass x,y to click directly (needed for evdev absolute positioning on Wayland)
        run("sudo", ["python3", controlPy, "click", btn, String(p.x), String(p.y)], 10_000);
        return ok("Clicked " + btn + " at (" + p.x + ", " + p.y + ")");
      },
    });

    // ── desktop_move ────────────────────────────────────────────────
    api.registerTool({
      name: "desktop_move",
      label: "Desktop Move",
      description: "Move mouse to position (no click).",
      parameters: Type.Object({
        x: Type.Number({ description: "X coordinate" }),
        y: Type.Number({ description: "Y coordinate" }),
      }),
      async execute(_id: string, params: any) {
        const p = params as { x: number; y: number };
        run("sudo", ["python3", controlPy, "move", String(p.x), String(p.y)], 10_000);
        return ok("Mouse moved to (" + p.x + ", " + p.y + ")");
      },
    });

    // ── desktop_type ────────────────────────────────────────────────
    api.registerTool({
      name: "desktop_type",
      label: "Desktop Type",
      description: "Type text via keyboard.",
      parameters: Type.Object({
        text: Type.String({ description: "Text to type" }),
      }),
      async execute(_id: string, params: any) {
        const t = (params as { text: string }).text;
        run("sudo", ["python3", controlPy, "type", t], 15_000);
        return ok("Typed: " + t);
      },
    });

    // ── desktop_key ─────────────────────────────────────────────────
    api.registerTool({
      name: "desktop_key",
      label: "Desktop Key",
      description: "Press a key combination (e.g. ctrl+c, alt+Tab, Return).",
      parameters: Type.Object({
        combo: Type.String({ description: "Key combo string" }),
      }),
      async execute(_id: string, params: any) {
        const c = (params as { combo: string }).combo;
        run("sudo", ["python3", controlPy, "key", c], 10_000);
        return ok("Pressed: " + c);
      },
    });

    // ── desktop_ocr ─────────────────────────────────────────────────
    api.registerTool({
      name: "desktop_ocr",
      label: "Desktop OCR",
      description: "Take a screenshot and run Tesseract OCR. Returns text on screen.",
      parameters: Type.Object({}),
      async execute() {
        const out = run("bash", [captureOcr, ssDir], 60_000);
        return ok(out);
      },
    });

    // ── desktop_focus ───────────────────────────────────────────────
    api.registerTool({
      name: "desktop_focus",
      label: "Desktop Focus",
      description: "Bring a window to focus by title (fuzzy match via xdotool).",
      parameters: Type.Object({
        window: Type.String({ description: "Window title search term" }),
      }),
      async execute(_id: string, params: any) {
        const search = (params as { window: string }).window;
        try {
          const wid = runShell(
            `xdotool search --name "${search.replace(/"/g, '\\"')}" 2>/dev/null | head -1`,
            5_000
          );
          if (wid) {
            runShell(`xdotool windowactivate ${wid}`, 5_000);
            const name = runShell(`xdotool getwindowname ${wid}`, 5_000);
            return ok("Focused: " + name + " (id: " + wid + ")");
          }
          return ok("No window matching '" + search + "' found");
        } catch (e: any) {
          return ok("Error: " + e.message);
        }
      },
    });
  },
};
