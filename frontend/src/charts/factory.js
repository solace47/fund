import { alphaColor, resolveChartTheme } from './theme.js';

export function toNumberSeries(series) {
  return Array.isArray(series) ? series.map((item) => Number(item) || 0) : [];
}

export function formatSigned(value, digits = 2, suffix = '') {
  const numeric = Number(value) || 0;
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}${suffix}`;
}

export function formatPrice(value, digits = 2, prefix = '') {
  const numeric = Number(value) || 0;
  return `${prefix}${numeric.toFixed(digits)}`;
}

export function normalizeRangeValue(value, presets, fallback = 'all') {
  if (!Array.isArray(presets) || presets.length === 0) {
    return fallback;
  }
  const found = presets.find((item) => item.value === value);
  return found ? found.value : presets[0]?.value || fallback;
}

export function buildRangeButtonsHtml(chartKey, presets, selected) {
  if (!Array.isArray(presets) || presets.length === 0) {
    return '';
  }
  const normalized = normalizeRangeValue(selected, presets);
  const buttons = presets
    .map((preset) => {
      const active = preset.value === normalized ? ' active' : '';
      return `<button class="chart-range-btn${active}" type="button" data-chart-key="${chartKey}" data-range="${preset.value}">${preset.label}</button>`;
    })
    .join('');
  return `<div class="chart-range" data-chart-key="${chartKey}" role="group" aria-label="切换图表区间">${buttons}</div>`;
}

export function sliceByRange(labels, seriesMap, selectedRange, presets) {
  const normalized = normalizeRangeValue(selectedRange, presets);
  const preset = (presets || []).find((item) => item.value === normalized);
  const count = Number(preset?.count) || 0;
  const total = Array.isArray(labels) ? labels.length : 0;
  const start = count > 0 ? Math.max(0, total - count) : 0;

  const nextLabels = Array.isArray(labels) ? labels.slice(start) : [];
  const nextSeriesMap = {};
  Object.entries(seriesMap || {}).forEach(([key, values]) => {
    nextSeriesMap[key] = Array.isArray(values) ? values.slice(start) : [];
  });

  return {
    labels: nextLabels,
    seriesMap: nextSeriesMap,
    range: normalized
  };
}

function resolveTrendColor(value, palette, theme) {
  const numeric = Number(value) || 0;
  if (numeric > 0) {
    return palette?.up || theme.up;
  }
  if (numeric < 0) {
    return palette?.down || theme.down;
  }
  return palette?.neutral || theme.neutral;
}

function resolveTrendSignal(values, mode = 'delta') {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  const first = Number(values[0]);
  const last = Number(values[values.length - 1]);
  const start = Number.isFinite(first) ? first : 0;
  const end = Number.isFinite(last) ? last : 0;

  if (mode === 'value') {
    return end;
  }
  return end - start;
}

function resolveValueColor(value, baseline, palette, theme) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return palette?.neutral || theme.neutral;
  }
  if (numeric > baseline) {
    return palette?.up || theme.up;
  }
  if (numeric < baseline) {
    return palette?.down || theme.down;
  }
  return palette?.neutral || theme.neutral;
}

export function buildLineDataset(config = {}) {
  const theme = resolveChartTheme();
  const {
    label,
    data,
    palette,
    fixedColor,
    trendMode = 'delta',
    semanticTrend = false,
    semanticBaseline = 0,
    tension = 0.32,
    lineWidth = 2,
    fill = true,
    fillAlpha = 0.14,
    fillAboveAlpha = 0.14,
    fillBelowAlpha = 0.12,
    showLatestPoint = true,
    pointRadius = 0,
    pointHoverRadius = 4
  } = config;

  const values = toNumberSeries(data);
  const baseline = Number(semanticBaseline) || 0;
  const trendSignal = resolveTrendSignal(values, trendMode);
  const lineColor = fixedColor || resolveTrendColor(trendSignal, palette, theme);
  const latestIndex = values.length > 0 ? values.length - 1 : -1;

  if (semanticTrend) {
    const upColor = palette?.up || theme.up;
    const downColor = palette?.down || theme.down;
    const neutralColor = palette?.neutral || theme.neutral;

    return {
      label,
      data: values,
      borderColor: neutralColor,
      backgroundColor: alphaColor(neutralColor, fillAlpha),
      fill: fill
        ? {
          target: { value: baseline },
          above: alphaColor(upColor, fillAboveAlpha),
          below: alphaColor(downColor, fillBelowAlpha)
        }
        : false,
      segment: {
        borderColor(context) {
          const y0 = Number(context?.p0?.parsed?.y);
          const y1 = Number(context?.p1?.parsed?.y);
          if (!Number.isFinite(y0) && !Number.isFinite(y1)) {
            return neutralColor;
          }
          const value = Number.isFinite(y1) ? y1 : y0;
          return resolveValueColor(value, baseline, palette, theme);
        }
      },
      tension,
      borderWidth: lineWidth,
      pointRadius(context) {
        const base = Number(pointRadius) || 0;
        if (!showLatestPoint || context.dataIndex !== latestIndex) {
          return base;
        }
        return Math.max(base, 3.5);
      },
      pointHoverRadius,
      pointBackgroundColor(context) {
        return resolveValueColor(context?.parsed?.y, baseline, palette, theme);
      },
      pointBorderColor(context) {
        return resolveValueColor(context?.parsed?.y, baseline, palette, theme);
      },
      pointBorderWidth: showLatestPoint ? 2 : 1
    };
  }

  return {
    label,
    data: values,
    borderColor: lineColor,
    backgroundColor: fill ? alphaColor(lineColor, fillAlpha) : 'transparent',
    fill,
    tension,
    borderWidth: lineWidth,
    pointRadius(context) {
      const base = Number(pointRadius) || 0;
      if (!showLatestPoint || context.dataIndex !== latestIndex) {
        return base;
      }
      return Math.max(base, 3.5);
    },
    pointHoverRadius,
    pointBackgroundColor: lineColor,
    pointBorderColor: lineColor,
    pointBorderWidth: showLatestPoint ? 2 : 1
  };
}

export function buildLineChartOptions(config = {}) {
  const theme = resolveChartTheme();
  const {
    maxXTicks = 8,
    yTickFormatter,
    tooltipCallbacks,
    zeroAxis = false,
    extrema = false,
    extremaFormatter,
    decimationSamples = 80,
    enableDecimation = false,
    spanGaps = true,
    yTitle,
    legend = false
  } = config;

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: false,
    spanGaps,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: legend,
        labels: {
          color: theme.axisStrong,
          boxWidth: 12
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        titleColor: theme.tooltipText,
        bodyColor: theme.tooltipText,
        callbacks: tooltipCallbacks || {}
      },
      decimation: {
        enabled: Boolean(enableDecimation),
        algorithm: 'lttb',
        samples: decimationSamples
      },
      lanfundCrosshair: { enabled: false },
      lanfundZeroLine: { enabled: false },
      lanfundExtrema: { enabled: false }
    },
    scales: {
      x: {
        ticks: {
          color: theme.axis,
          maxTicksLimit: maxXTicks,
          autoSkip: true
        },
        grid: {
          color: theme.grid,
          drawBorder: false
        }
      },
      y: {
        title: yTitle
          ? {
            display: true,
            text: yTitle,
            color: theme.axis
          }
          : undefined,
        ticks: {
          color: theme.axis,
          callback(value) {
            return typeof yTickFormatter === 'function' ? yTickFormatter(value) : value;
          }
        },
        grid: {
          color(context) {
            const tickValue = Number(context?.tick?.value);
            if (zeroAxis && Number.isFinite(tickValue) && tickValue === 0) {
              return alphaColor(theme.axisStrong, 0.45);
            }
            return theme.grid;
          },
          lineWidth(context) {
            const tickValue = Number(context?.tick?.value);
            if (zeroAxis && Number.isFinite(tickValue) && tickValue === 0) {
              return 1.4;
            }
            return 1;
          },
          drawBorder: false
        }
      }
    }
  };
}

export function createOrUpdateLineChart(config = {}) {
  const {
    chartKey,
    chartInstances,
    canvas,
    labels,
    dataset,
    datasets,
    options,
    payload
  } = config;
  const datasetList = Array.isArray(datasets)
    ? datasets
    : (dataset ? [dataset] : []);

  if (!chartKey || !chartInstances || !canvas || !window.Chart) {
    return null;
  }

  const existing = chartInstances[chartKey];
  if (existing && existing.canvas === canvas) {
    existing.data.labels = labels;
    existing.data.datasets = datasetList;
    existing.options = options;
    if (payload !== undefined) {
      existing.$payload = payload;
    }
    existing.update('none');
    return existing;
  }

  if (existing) {
    existing.destroy();
  }

  const ctx = canvas.getContext('2d');
  const chart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasetList
    },
    options
  });
  if (payload !== undefined) {
    chart.$payload = payload;
  }
  chartInstances[chartKey] = chart;
  return chart;
}
