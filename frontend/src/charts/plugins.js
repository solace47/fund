export const crosshairPlugin = {
  id: 'lanfundCrosshair',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) {
      return;
    }

    const activeElements = chart.tooltip?.getActiveElements?.() || [];
    if (activeElements.length === 0) {
      return;
    }

    const { ctx, chartArea } = chart;
    if (!chartArea) {
      return;
    }

    const x = activeElements[0]?.element?.x;
    if (!Number.isFinite(x)) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = pluginOptions.color || 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = Number(pluginOptions.lineWidth) || 1;
    ctx.setLineDash(pluginOptions.dash || [4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  }
};

export const zeroLinePlugin = {
  id: 'lanfundZeroLine',
  beforeDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) {
      return;
    }

    const yScale = chart.scales?.y;
    const { chartArea } = chart;
    if (!yScale || !chartArea) {
      return;
    }
    if (yScale.min > 0 || yScale.max < 0) {
      return;
    }

    const y = yScale.getPixelForValue(0);
    const { ctx } = chart;
    ctx.save();
    ctx.strokeStyle = pluginOptions.color || 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = Number(pluginOptions.lineWidth) || 1.2;
    ctx.setLineDash(pluginOptions.dash || []);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.restore();
  }
};

function drawExtremaLabel(ctx, x, y, text, opts = {}) {
  const bg = opts.bg || 'rgba(15, 23, 42, 0.9)';
  const textColor = opts.textColor || '#f8fafc';
  const paddingX = 6;
  const paddingY = 3;
  const radius = 6;

  ctx.save();
  ctx.font = opts.font || '11px IBM Plex Mono, ui-monospace, monospace';
  const width = ctx.measureText(text).width;
  const labelWidth = width + paddingX * 2;
  const labelHeight = 18;
  const left = x - labelWidth / 2;
  const top = y - labelHeight - 8;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.lineTo(left + labelWidth - radius, top);
  ctx.quadraticCurveTo(left + labelWidth, top, left + labelWidth, top + radius);
  ctx.lineTo(left + labelWidth, top + labelHeight - radius);
  ctx.quadraticCurveTo(left + labelWidth, top + labelHeight, left + labelWidth - radius, top + labelHeight);
  ctx.lineTo(left + radius, top + labelHeight);
  ctx.quadraticCurveTo(left, top + labelHeight, left, top + labelHeight - radius);
  ctx.lineTo(left, top + radius);
  ctx.quadraticCurveTo(left, top, left + radius, top);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, top + labelHeight / 2 + 0.5);
  ctx.restore();
}

export const extremaPlugin = {
  id: 'lanfundExtrema',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) {
      return;
    }

    const dataset = chart.data.datasets?.[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta?.data?.length) {
      return;
    }

    const data = dataset.data || [];
    let maxIndex = -1;
    let minIndex = -1;
    let maxValue = -Infinity;
    let minValue = Infinity;

    data.forEach((value, index) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      if (numeric > maxValue) {
        maxValue = numeric;
        maxIndex = index;
      }
      if (numeric < minValue) {
        minValue = numeric;
        minIndex = index;
      }
    });

    if (maxIndex < 0 || minIndex < 0) {
      return;
    }

    const formatter = typeof pluginOptions.formatter === 'function'
      ? pluginOptions.formatter
      : (value) => String(value);

    const maxPoint = meta.data[maxIndex];
    const minPoint = meta.data[minIndex];
    const { ctx } = chart;

    if (maxPoint && Number.isFinite(maxPoint.x) && Number.isFinite(maxPoint.y)) {
      ctx.save();
      ctx.fillStyle = pluginOptions.maxColor || '#e0314d';
      ctx.beginPath();
      ctx.arc(maxPoint.x, maxPoint.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawExtremaLabel(ctx, maxPoint.x, maxPoint.y, `高 ${formatter(maxValue)}`, {
        bg: pluginOptions.maxLabelBg,
        textColor: pluginOptions.maxLabelColor,
        font: pluginOptions.font
      });
    }

    if (minIndex !== maxIndex && minPoint && Number.isFinite(minPoint.x) && Number.isFinite(minPoint.y)) {
      ctx.save();
      ctx.fillStyle = pluginOptions.minColor || '#0b8b74';
      ctx.beginPath();
      ctx.arc(minPoint.x, minPoint.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawExtremaLabel(ctx, minPoint.x, minPoint.y, `低 ${formatter(minValue)}`, {
        bg: pluginOptions.minLabelBg,
        textColor: pluginOptions.minLabelColor,
        font: pluginOptions.font
      });
    }
  }
};

export function getLanfundChartPlugins() {
  return [crosshairPlugin, zeroLinePlugin, extremaPlugin];
}
