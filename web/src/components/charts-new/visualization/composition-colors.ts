const BASE_SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const OTHER_SERIES_COLOR = 'var(--muted-foreground)';

export const resolveCompositionSeriesColor = (index: number) => {
  if (index < BASE_SERIES_COLORS.length) {
    return BASE_SERIES_COLORS[index];
  }
  const hue = (index * 137.508) % 360;
  const saturation = 62;
  const lightness = index % 2 === 0 ? 46 : 58;
  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
};

