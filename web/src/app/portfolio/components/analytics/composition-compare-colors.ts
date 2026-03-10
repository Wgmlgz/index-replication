import chroma from 'chroma-js';
import type { CSSProperties } from 'react';
type LinearScale<TColor> = { from: TColor; to: TColor };
type SignedScale<TColor> = {
  negative: TColor;
  neutral: TColor;
  positive: TColor;
};
type DivergingScale<TColor> = {
  low: TColor;
  mid: TColor;
  high: TColor;
};

export type CompositionCompareColorScale = {
  baseMetric: LinearScale<string>;
  activeWeight: SignedScale<string>;
  contributionPct: SignedScale<string>;
  summaryHigherIsWorse: LinearScale<string>;
  summaryOverlap: DivergingScale<string>;
};

const DEFAULT_SIGNED_PERCENT_BOUND = 100;
const COLOR_RESPONSE = {
  // < 1 boosts small values; blend keeps high-end spread readable.
  gamma: 0.68,
  linearBlend: 0.35,
} as const;

const COLOR_TOKENS = {
  baseMetric: {
    from: '--muted-foreground',
    to: '--foreground',
  },
  activeWeight: {
    negative: '--destructive',
    neutral: '--muted-foreground',
    positive: '--chart-2',
  },
  contributionPct: {
    negative: '--chart-2',
    neutral: '--muted-foreground',
    positive: '--destructive',
  },
  summaryHigherIsWorse: {
    from: '--muted-foreground',
    to: '--destructive',
  },
  summaryOverlap: {
    low: '--destructive',
    mid: '--muted-foreground',
    high: '--chart-2',
  },
} as const;

type CompositionCompareColorToken =
  | typeof COLOR_TOKENS.baseMetric.from
  | typeof COLOR_TOKENS.baseMetric.to
  | typeof COLOR_TOKENS.activeWeight.negative
  | typeof COLOR_TOKENS.activeWeight.neutral
  | typeof COLOR_TOKENS.activeWeight.positive
  | typeof COLOR_TOKENS.contributionPct.negative
  | typeof COLOR_TOKENS.contributionPct.neutral
  | typeof COLOR_TOKENS.contributionPct.positive
  | typeof COLOR_TOKENS.summaryHigherIsWorse.from
  | typeof COLOR_TOKENS.summaryHigherIsWorse.to
  | typeof COLOR_TOKENS.summaryOverlap.low
  | typeof COLOR_TOKENS.summaryOverlap.mid
  | typeof COLOR_TOKENS.summaryOverlap.high;

const FALLBACK_THEME_COLOR_VALUES: Record<CompositionCompareColorToken, string> = {
  '--muted-foreground': 'oklch(0.556 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--chart-2': 'oklch(0.6 0.118 184.704)',
};

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

const shapeRatio = (ratio: number): number => {
  const linear = clamp(ratio);
  const boosted = Math.pow(linear, COLOR_RESPONSE.gamma);
  return clamp(
    boosted * (1 - COLOR_RESPONSE.linearBlend) + linear * COLOR_RESPONSE.linearBlend,
  );
};

const resolveThemeColor = (token: CompositionCompareColorToken): string => {
  const fallback = FALLBACK_THEME_COLOR_VALUES[token];

  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();

  return value || fallback;
};

const mixHsvColor = (ratio: number, fromColor: string, toColor: string): string =>
  chroma.scale([fromColor, toColor]).mode('hsv').domain([0, 1])(clamp(ratio)).css();

export const resolveCompositionCompareColorScale = (): CompositionCompareColorScale => ({
  baseMetric: {
    from: resolveThemeColor(COLOR_TOKENS.baseMetric.from),
    to: resolveThemeColor(COLOR_TOKENS.baseMetric.to),
  },
  activeWeight: {
    negative: resolveThemeColor(COLOR_TOKENS.activeWeight.negative),
    neutral: resolveThemeColor(COLOR_TOKENS.activeWeight.neutral),
    positive: resolveThemeColor(COLOR_TOKENS.activeWeight.positive),
  },
  contributionPct: {
    negative: resolveThemeColor(COLOR_TOKENS.contributionPct.negative),
    neutral: resolveThemeColor(COLOR_TOKENS.contributionPct.neutral),
    positive: resolveThemeColor(COLOR_TOKENS.contributionPct.positive),
  },
  summaryHigherIsWorse: {
    from: resolveThemeColor(COLOR_TOKENS.summaryHigherIsWorse.from),
    to: resolveThemeColor(COLOR_TOKENS.summaryHigherIsWorse.to),
  },
  summaryOverlap: {
    low: resolveThemeColor(COLOR_TOKENS.summaryOverlap.low),
    mid: resolveThemeColor(COLOR_TOKENS.summaryOverlap.mid),
    high: resolveThemeColor(COLOR_TOKENS.summaryOverlap.high),
  },
});

export const gradientColorStyle = (
  ratio: number,
  scale: LinearScale<string>,
): CSSProperties => ({
  color: mixHsvColor(shapeRatio(ratio), scale.from, scale.to),
  opacity: 1,
});

export const signedPercentGradientColorStyle = (
  valuePct: number,
  scale: SignedScale<string>,
  bound = DEFAULT_SIGNED_PERCENT_BOUND,
): CSSProperties => {
  const safeBound = Math.max(bound, 1);
  const signedRatio = clamp(valuePct / safeBound, -1, 1);
  const shapedValue =
    Math.sign(signedRatio) * shapeRatio(Math.abs(signedRatio)) * safeBound;
  const color = chroma
    .scale([scale.negative, scale.neutral, scale.positive])
    .mode('hsv')
    .domain([-safeBound, 0, safeBound])(shapedValue)
    .css();

  return { color, opacity: 1 };
};

export const boundedPercentColorStyle = (
  valuePct: number,
  scale: LinearScale<string>,
  bound = DEFAULT_SIGNED_PERCENT_BOUND,
): CSSProperties => {
  const safeBound = Math.max(bound, 1);
  return gradientColorStyle(clamp(valuePct / safeBound, 0, 1), scale);
};

export const boundedPercentDivergingColorStyle = (
  valuePct: number,
  scale: DivergingScale<string>,
  min = 0,
  mid = 50,
  max = 100,
): CSSProperties => {
  const safeMid = Math.max(mid, min);
  const safeMax = Math.max(max, safeMid + 1e-6);
  const clampedValue = clamp(valuePct, min, safeMax);
  const color = chroma
    .scale([scale.low, scale.mid, scale.high])
    .mode('hsv')
    .domain([min, safeMid, safeMax])(clampedValue)
    .css();

  return { color, opacity: 1 };
};
