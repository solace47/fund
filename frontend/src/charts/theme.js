const FALLBACK_THEME = {
  axis: '#64748b',
  axisStrong: '#415069',
  grid: 'rgba(99, 116, 145, 0.16)',
  zeroLine: 'rgba(71, 85, 105, 0.55)',
  tooltipBg: 'rgba(15, 23, 42, 0.92)',
  tooltipBorder: 'rgba(148, 163, 184, 0.32)',
  tooltipText: '#f8fafc',
  up: '#e0314d',
  down: '#0b8b74',
  neutral: '#7a879d'
};

function readCssVar(name, fallback) {
  if (typeof window === 'undefined' || !window.getComputedStyle) {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function resolveChartTheme() {
  return {
    axis: readCssVar('--chart-axis', FALLBACK_THEME.axis),
    axisStrong: readCssVar('--chart-axis-strong', FALLBACK_THEME.axisStrong),
    grid: readCssVar('--chart-grid', FALLBACK_THEME.grid),
    zeroLine: readCssVar('--chart-zero-line', FALLBACK_THEME.zeroLine),
    tooltipBg: readCssVar('--chart-tooltip-bg', FALLBACK_THEME.tooltipBg),
    tooltipBorder: readCssVar('--chart-tooltip-border', FALLBACK_THEME.tooltipBorder),
    tooltipText: readCssVar('--chart-tooltip-text', FALLBACK_THEME.tooltipText),
    up: readCssVar('--chart-up', FALLBACK_THEME.up),
    down: readCssVar('--chart-down', FALLBACK_THEME.down),
    neutral: readCssVar('--chart-neutral', FALLBACK_THEME.neutral)
  };
}

export function alphaColor(hexOrRgb, alpha, fallback = 'rgba(99, 116, 145, 1)') {
  const value = String(hexOrRgb || '').trim();
  if (!value) {
    return fallback;
  }

  if (value.startsWith('rgba(')) {
    const body = value.slice(5, -1).split(',').map((part) => part.trim());
    return `rgba(${body[0]}, ${body[1]}, ${body[2]}, ${alpha})`;
  }

  if (value.startsWith('rgb(')) {
    const body = value.slice(4, -1).split(',').map((part) => part.trim());
    return `rgba(${body[0]}, ${body[1]}, ${body[2]}, ${alpha})`;
  }

  if (value.startsWith('#')) {
    const normalized = value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
    if (normalized.length === 7) {
      const r = parseInt(normalized.slice(1, 3), 16);
      const g = parseInt(normalized.slice(3, 5), 16);
      const b = parseInt(normalized.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return fallback;
}
