import { branding, BrandingConfig } from "@/config/branding";

const HEX_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

const lighten = (hsl: HSL, amount: number): HSL => ({ ...hsl, l: clamp(hsl.l + amount) });
const darken = (hsl: HSL, amount: number): HSL => ({ ...hsl, l: clamp(hsl.l - amount) });

function hexToRgb(hex: string): RGB | null {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (normalized.length === 8) {
    normalized = normalized.slice(0, 6);
  }
  if (normalized.length !== 6) return null;

  const numeric = parseInt(normalized, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function cssColorToRgb(color: string): RGB | null {
  if (typeof window === "undefined") return null;

  if (HEX_REGEX.test(color)) {
    return hexToRgb(color);
  }

  const temp = document.createElement("span");
  temp.style.color = color;
  temp.style.display = "none";
  document.body.appendChild(temp);

  const computed = window.getComputedStyle(temp).color;
  document.body.removeChild(temp);

  const match = computed.match(/rgb[a]?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

function normalizeToHsl(color?: string): HSL | null {
  if (!color) return null;
  const rgb = cssColorToRgb(color.trim());
  return rgb ? rgbToHsl(rgb) : null;
}

const hslToString = ({ h, s, l }: HSL) => `${h} ${s}% ${l}%`;
const foregroundForLightness = (l: number) => (l > 60 ? "0 0% 10%" : "0 0% 100%");

export function applyBrandingTheme(config: BrandingConfig = branding) {
  if (typeof window === "undefined") return;
  if (!config.colors) return;

  const root = document.documentElement;
  const {
    primary,
    primaryForeground,
    primaryLight,
    primaryDark,
    secondary,
    secondaryForeground,
    success,
    warning,
    destructive,
    muted,
    mutedForeground,
    accent,
    accentForeground,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
    shadowPrimary,
  } = config.colors;

  const primaryHsl = normalizeToHsl(primary);
  const primaryLightHsl = normalizeToHsl(primaryLight);
  const primaryDarkHsl = normalizeToHsl(primaryDark);
  const primaryForegroundHsl = normalizeToHsl(primaryForeground ?? primary);
  const secondaryHsl = normalizeToHsl(secondary);
  const secondaryForegroundHsl = normalizeToHsl(secondaryForeground ?? secondary);
  const successHsl = normalizeToHsl(success);
  const warningHsl = normalizeToHsl(warning);
  const destructiveHsl = normalizeToHsl(destructive);
  const mutedHsl = normalizeToHsl(muted);
  const mutedForegroundHsl = normalizeToHsl(mutedForeground ?? muted);
  const accentHsl = normalizeToHsl(accent);
  const accentForegroundHsl = normalizeToHsl(accentForeground ?? accent);
  const chart1Hsl = normalizeToHsl(chart1 ?? primary);
  const chart2Hsl = normalizeToHsl(chart2 ?? secondary ?? primary);
  const chart3Hsl = normalizeToHsl(chart3 ?? warning ?? primary);
  const chart4Hsl = normalizeToHsl(chart4 ?? destructive ?? primary);
  const chart5Hsl = normalizeToHsl(chart5 ?? accent ?? primary);

  if (primaryHsl) {
    root.style.setProperty("--primary", hslToString(primaryHsl));
    const primaryLightResolved = primaryLightHsl ?? lighten(primaryHsl, 10);
    const primaryDarkResolved = primaryDarkHsl ?? darken(primaryHsl, 10);
    root.style.setProperty("--primary-light", hslToString(primaryLightResolved));
    root.style.setProperty("--primary-dark", hslToString(primaryDarkResolved));
    root.style.setProperty(
      "--primary-foreground",
      primaryForegroundHsl ? hslToString(primaryForegroundHsl) : foregroundForLightness(primaryHsl.l)
    );
    root.style.setProperty("--ring", hslToString(primaryHsl));
    root.style.setProperty("--shadow-primary", shadowPrimary ?? `0 10px 30px -10px hsl(${hslToString(primaryHsl)} / 0.3)`);
  }

  if (secondaryHsl) {
    root.style.setProperty("--secondary", hslToString(secondaryHsl));
    root.style.setProperty(
      "--secondary-foreground",
      secondaryForegroundHsl ? hslToString(secondaryForegroundHsl) : foregroundForLightness(secondaryHsl.l)
    );
  }

  if (accentHsl || primaryHsl) {
    const resolvedAccent = accentHsl ?? primaryHsl!;
    const resolvedAccentForeground = accentForegroundHsl ?? primaryForegroundHsl ?? null;
    root.style.setProperty("--accent", hslToString(resolvedAccent));
    root.style.setProperty(
      "--accent-foreground",
      resolvedAccentForeground ? hslToString(resolvedAccentForeground) : foregroundForLightness(resolvedAccent.l)
    );
  }

  if (mutedHsl) {
    root.style.setProperty("--muted", hslToString(mutedHsl));
    root.style.setProperty(
      "--muted-foreground",
      mutedForegroundHsl ? hslToString(mutedForegroundHsl) : foregroundForLightness(mutedHsl.l)
    );
  }

  if (successHsl) {
    root.style.setProperty("--success", hslToString(successHsl));
    root.style.setProperty("--success-foreground", foregroundForLightness(successHsl.l));
  }

  if (warningHsl) {
    root.style.setProperty("--warning", hslToString(warningHsl));
    root.style.setProperty("--warning-foreground", foregroundForLightness(warningHsl.l));
  }

  if (destructiveHsl) {
    root.style.setProperty("--destructive", hslToString(destructiveHsl));
    root.style.setProperty("--destructive-foreground", foregroundForLightness(destructiveHsl.l));
    root.style.setProperty("--danger", hslToString(destructiveHsl));
    root.style.setProperty("--danger-foreground", foregroundForLightness(destructiveHsl.l));
  }

  if (chart1Hsl) root.style.setProperty("--chart-1", hslToString(chart1Hsl));
  if (chart2Hsl) root.style.setProperty("--chart-2", hslToString(chart2Hsl));
  if (chart3Hsl) root.style.setProperty("--chart-3", hslToString(chart3Hsl));
  if (chart4Hsl) root.style.setProperty("--chart-4", hslToString(chart4Hsl));
  if (chart5Hsl) root.style.setProperty("--chart-5", hslToString(chart5Hsl));
}

export function initializeBranding() {
  applyBrandingTheme(branding);
}
