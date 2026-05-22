import type { ThemeColors } from "../types.js";
import { pluginState } from "../state.js";

const THEME_LIGHT: ThemeColors = {
  bg: "#ffffff", card: "#f6f8fa", border: "#d0d7de", divider: "#d8dee4",
  text: "#1f2328", textSub: "#656d76", textMuted: "#8b949e",
  codeBg: "#f6f8fa", codeHeader: "#eaeef2",
};

const THEME_DARK: ThemeColors = {
  bg: "#0d1117", card: "#161b22", border: "#30363d", divider: "#21262d",
  text: "#e6edf3", textSub: "#8b949e", textMuted: "#484f58",
  codeBg: "#0d1117", codeHeader: "#1c2128",
};

export function getTheme(): ThemeColors {
  const mode = pluginState.config.theme || "light";
  if (mode === "dark") return THEME_DARK;
  if (mode === "custom" && pluginState.config.customTheme) {
    return { ...THEME_LIGHT, ...pluginState.config.customTheme };
  }
  return THEME_LIGHT;
}

export const SVG = {
  commit: `<svg width="20" height="20" viewBox="0 0 16 16" fill="#3fb950"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.25a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`,
  issue: `<svg width="20" height="20" viewBox="0 0 16 16" fill="#8957e5"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>`,
  pr: `<svg width="20" height="20" viewBox="0 0 16 16" fill="#db6d28"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>`,
  comment: `<svg width="20" height="20" viewBox="0 0 16 16" fill="#58a6ff"><path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"/></svg>`,
  actions: `<svg width="20" height="20" viewBox="0 0 16 16" fill="#d29922"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"/></svg>`,
  sep: `<svg width="4" height="4" viewBox="0 0 4 4" style="display:inline-block;vertical-align:middle;margin:0 5px"><circle cx="2" cy="2" r="2" fill="currentColor" opacity="0.4"/></svg>`,
  user: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="display:inline-block;vertical-align:-1px;margin-right:1px;opacity:0.5"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`,
};
