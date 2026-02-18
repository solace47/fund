const SECTION_META = {
  news: { tabId: 'kx', title: '7*24快讯', showSummary: false },
  indices: { tabId: 'marker', title: '全球指数', showSummary: false },
  'gold-realtime': { tabId: 'real_time_gold', title: '实时贵金属', showSummary: false },
  'gold-history': { tabId: 'gold', title: '历史金价', showSummary: false },
  volume: { tabId: 'seven_A', title: '成交量趋势', showSummary: false },
  timing: { tabId: 'A', title: '上证分时', showSummary: false },
  funds: { tabId: 'fund', title: '自选基金', showSummary: true },
  sectors: { tabId: 'bk', title: '行业板块', showSummary: false },
  query: { tabId: 'select_fund', title: '板块基金查询', showSummary: false }
};

const CUSTOM_SECTION_KEYS = {
  funds: 'custom:funds',
  timing: 'custom:timing',
  'gold-realtime': 'custom:gold-realtime',
  'gold-history': 'custom:gold-history'
};

const DEFAULT_SECTION = 'funds';
const SECTION_QUERY_KEY = 'section';
const SECTION_NAV_ACCENTS = {
  news: ['#6d90ff', '#4f66e8'],
  indices: ['#4b8fff', '#3468f1'],
  'gold-realtime': ['#1dc8aa', '#0fa281'],
  'gold-history': ['#aa7dff', '#835ee4'],
  volume: ['#ffad4f', '#ff842d'],
  timing: ['#23bcff', '#0f8ed0'],
  funds: ['#2a86f2', '#1b6fdb'],
  sectors: ['#2fcd6a', '#14a273'],
  query: ['#ffbd4d', '#ff9231']
};
const loadedTabs = new Set();
const pendingLoads = new Map();
const chartInstances = {
  timing: null,
  goldOneDay: null,
  goldHistory: null,
  fund: null
};
let currentSection = DEFAULT_SECTION;

function getInitialSectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get(SECTION_QUERY_KEY);
  if (section && SECTION_META[section]) {
    return section;
  }
  return DEFAULT_SECTION;
}

function syncSectionToUrl(sectionKey) {
  const normalized = SECTION_META[sectionKey] ? sectionKey : DEFAULT_SECTION;
  const url = new URL(window.location.href);
  url.searchParams.set(SECTION_QUERY_KEY, normalized);
  history.replaceState({ section: normalized }, '', `${url.pathname}?${url.searchParams.toString()}`);
}

function getTopNavScrollElement() {
  return document.getElementById('topNavScroll');
}

function getTopNavIndicatorElement() {
  return document.getElementById('topNavActiveIndicator');
}

function updateTopNavAccent(sectionKey) {
  const navScroll = getTopNavScrollElement();
  if (!navScroll) {
    return;
  }

  const [accentStart, accentEnd] = SECTION_NAV_ACCENTS[sectionKey] || SECTION_NAV_ACCENTS[DEFAULT_SECTION];
  navScroll.style.setProperty('--nav-accent-start', accentStart);
  navScroll.style.setProperty('--nav-accent-end', accentEnd);
}

function centerTopNavButton(activeButton, immediate = false) {
  if (!activeButton) {
    return;
  }
  const navScroll = activeButton.closest('.top-nav-scroll');
  if (!navScroll) {
    return;
  }

  const targetLeft = activeButton.offsetLeft - (navScroll.clientWidth - activeButton.offsetWidth) / 2;
  const maxLeft = Math.max(0, navScroll.scrollWidth - navScroll.clientWidth);
  const boundedLeft = Math.min(Math.max(targetLeft, 0), maxLeft);

  navScroll.scrollTo({
    left: boundedLeft,
    behavior: immediate ? 'auto' : 'smooth'
  });
}

function updateTopNavIndicator(sectionKey, immediate = false) {
  const navScroll = getTopNavScrollElement();
  const indicator = getTopNavIndicatorElement();
  if (!navScroll || !indicator) {
    return;
  }

  const activeButton = navScroll.querySelector(`.sidebar-icon[data-section="${sectionKey}"]`)
    || navScroll.querySelector('.sidebar-icon.active');
  if (!activeButton) {
    return;
  }

  updateTopNavAccent(sectionKey);

  const targetLeft = activeButton.offsetLeft;
  const targetWidth = activeButton.offsetWidth;

  if (immediate) {
    const previousTransition = indicator.style.transition;
    indicator.style.transition = 'none';
    indicator.style.width = `${targetWidth}px`;
    indicator.style.transform = `translate3d(${targetLeft}px, 0, 0)`;
    indicator.getBoundingClientRect();
    indicator.style.transition = previousTransition;
  } else {
    indicator.style.width = `${targetWidth}px`;
    indicator.style.transform = `translate3d(${targetLeft}px, 0, 0)`;
  }

  navScroll.classList.add('nav-ready');
}

function playSectionEnterAnimation(sectionElement) {
  sectionElement.classList.remove('section-enter');
  sectionElement.getBoundingClientRect();
  sectionElement.classList.add('section-enter');
}

function initTopNavMotion() {
  const navScroll = getTopNavScrollElement();
  if (!navScroll) {
    return;
  }

  let frameHandle = 0;
  const syncIndicator = (immediate = true) => {
    if (frameHandle) {
      cancelAnimationFrame(frameHandle);
    }
    frameHandle = requestAnimationFrame(() => {
      updateTopNavIndicator(currentSection || DEFAULT_SECTION, immediate);
      frameHandle = 0;
    });
  };

  window.addEventListener('resize', () => {
    syncIndicator(true);
  });
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    chartInstances[key] = null;
  }
}

function updateLastUpdateTime() {
  const lastUpdate = document.getElementById('lastUpdate');
  if (!lastUpdate) {
    return;
  }
  const now = new Date();
  lastUpdate.textContent = `更新于 ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

function updateMarketStatus() {
  const marketStatusText = document.getElementById('marketStatusText');
  if (!marketStatusText) {
    return;
  }

  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    marketStatusText.textContent = '休市中';
    return;
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 15 * 60;
  marketStatusText.textContent = minutes >= openMinutes && minutes < closeMinutes ? '市场开盘中' : '市场已收盘';
}

function showLoading(targetElement) {
  targetElement.innerHTML = `
    <div class="tab-loading">
      <div class="loading-spinner"></div>
      <p>正在加载数据...</p>
    </div>
  `;
}

function showError(targetElement, message) {
  targetElement.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function executeEmbeddedScripts(targetElement) {
  const scripts = targetElement.querySelectorAll('script');
  scripts.forEach((scriptElement) => {
    const executableScript = document.createElement('script');
    Array.from(scriptElement.attributes).forEach((attr) => {
      executableScript.setAttribute(attr.name, attr.value);
    });
    executableScript.textContent = scriptElement.textContent;
    scriptElement.parentNode.replaceChild(executableScript, scriptElement);
  });
}

async function refreshFundSummary() {
  if (typeof window.reloadFundSharesData === 'function') {
    await window.reloadFundSharesData();
  }
}

function getJson(response) {
  return response.json().catch(() => ({}));
}

async function fetchTabHtml(tabId) {
  const response = await fetch(`/api/tab/${tabId}`);
  const result = await getJson(response);
  if (!response.ok || !result.success) {
    const message = result.message || `加载 ${tabId} 失败`;
    throw new Error(message);
  }
  return result.content || '';
}

function canUseCharts() {
  return typeof window.Chart !== 'undefined';
}

function setChartUnavailable(target) {
  target.innerHTML = '<div class="empty-state">图表库未加载，无法显示图形。</div>';
}

function renderTimingChart(data) {
  const canvas = document.getElementById('timingChart');
  if (!canvas || !data || !Array.isArray(data.labels) || data.labels.length === 0) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(canvas.parentElement);
    return;
  }

  destroyChart('timing');

  const labels = data.labels;
  const changes = (data.change_pcts || []).map((item) => Number(item) || 0);
  const prices = (data.prices || []).map((item) => Number(item) || 0);
  const changeAmounts = (data.change_amounts || []).map((item) => Number(item) || 0);
  const volumes = (data.volumes || []).map((item) => Number(item) || 0);
  const amounts = (data.amounts || []).map((item) => Number(item) || 0);

  const latestPct = changes.length > 0 ? changes[changes.length - 1] : 0;
  const latestPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const title = document.getElementById('timingChartTitle');
  if (title) {
    const color = latestPct >= 0 ? '#f44336' : '#4caf50';
    title.style.color = color;
    title.innerHTML = `上证分时 <span style="font-size: 0.9em;">${latestPct >= 0 ? '+' : ''}${latestPct.toFixed(2)}% (${latestPrice.toFixed(2)})</span>`;
  }

  const ctx = canvas.getContext('2d');
  chartInstances.timing = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '涨跌幅 (%)',
          data: changes,
          borderColor: '#d4a853',
          backgroundColor: 'rgba(212, 168, 83, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const index = context.dataIndex;
              const pct = changes[index] || 0;
              const price = prices[index] || 0;
              const changeAmount = changeAmounts[index] || 0;
              const volume = volumes[index] || 0;
              const amount = amounts[index] || 0;
              return [
                `涨跌幅: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
                `上证指数: ${price.toFixed(2)}`,
                `涨跌额: ${changeAmount >= 0 ? '+' : ''}${changeAmount.toFixed(2)}`,
                `成交量: ${volume.toFixed(0)}万手`,
                `成交额: ${amount.toFixed(2)}亿`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#9a9489', maxTicksLimit: 8 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: {
            color: '#9a9489',
            callback(value) {
              const numberValue = Number(value) || 0;
              return `${numberValue >= 0 ? '+' : ''}${numberValue.toFixed(2)}%`;
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

function renderGoldOneDayChart(records) {
  const canvas = document.getElementById('goldOneDayChart');
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(canvas.parentElement);
    return;
  }

  destroyChart('goldOneDay');

  if (!Array.isArray(records) || records.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state">暂无分时金价数据</div>';
    return;
  }

  const labels = [];
  const prices = [];
  records.forEach((item) => {
    if (item && item.date && item.price !== undefined) {
      const timePart = String(item.date).split(' ')[1] || String(item.date);
      labels.push(timePart);
      prices.push(Number(item.price) || 0);
    }
  });

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state">暂无分时金价数据</div>';
    return;
  }

  const latestPrice = prices[prices.length - 1];
  const latestTime = labels[labels.length - 1];
  const title = document.getElementById('goldOneDayTitle');
  if (title) {
    title.textContent = `分时黄金价格  最新: ¥${latestPrice.toFixed(2)}  ${latestTime}`;
  }

  const ctx = canvas.getContext('2d');
  chartInstances.goldOneDay = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '金价 (元/克)',
          data: prices,
          borderColor: '#c9923a',
          backgroundColor: 'rgba(201, 146, 58, 0.1)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: { color: '#9a9489', maxTicksLimit: 12 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#9a9489' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

function renderGoldHistoryChart(records) {
  const canvas = document.getElementById('goldHistoryChart');
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(canvas.parentElement);
    return;
  }

  destroyChart('goldHistory');

  if (!Array.isArray(records) || records.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state">暂无历史金价数据</div>';
    return;
  }

  const normalized = [];
  records.forEach((item) => {
    if (!item || !item.date || item.china_gold_price === undefined) {
      return;
    }
    const value = Number(String(item.china_gold_price).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(value)) {
      return;
    }
    normalized.push({ date: String(item.date), value });
  });

  if (normalized.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state">暂无历史金价数据</div>';
    return;
  }

  normalized.reverse();
  const labels = normalized.map((item) => item.date);
  const prices = normalized.map((item) => item.value);

  const ctx = canvas.getContext('2d');
  chartInstances.goldHistory = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '中国黄金基础金价 (元/克)',
          data: prices,
          borderColor: '#5cb97a',
          backgroundColor: 'rgba(92, 185, 122, 0.08)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: '#9a9489', maxTicksLimit: 8 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#9a9489' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

async function loadAndRenderFundChart(fundCode) {
  const chartWrap = document.getElementById('fundTrendCanvasWrap');
  const chartTitle = document.getElementById('fundTrendTitle');
  const canvas = document.getElementById('fundTrendChart');

  if (!chartWrap || !canvas || !fundCode) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(chartWrap);
    return;
  }

  try {
    const response = await fetch(`/api/fund/chart-data?code=${encodeURIComponent(fundCode)}`);
    const result = await getJson(response);
    if (!response.ok || result.error || !result.chart_data) {
      throw new Error(result.error || '获取基金估值数据失败');
    }

    const chartData = result.chart_data;
    const labels = Array.isArray(chartData.labels) ? chartData.labels : [];
    const growth = Array.isArray(chartData.growth) ? chartData.growth.map((item) => Number(item) || 0) : [];
    const fundName = result.fund_info?.name || fundCode;

    if (chartTitle) {
      chartTitle.textContent = `基金估值走势 - ${fundCode} ${fundName}`;
    }

    destroyChart('fund');

    if (labels.length === 0 || growth.length === 0) {
      chartWrap.innerHTML = '<div class="empty-state">暂无该基金估值走势数据</div>';
      return;
    }

    chartWrap.innerHTML = '<canvas id="fundTrendChart"></canvas>';
    const realCanvas = document.getElementById('fundTrendChart');
    const ctx = realCanvas.getContext('2d');
    chartInstances.fund = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '涨幅 (%)',
            data: growth,
            borderColor: '#d4a853',
            backgroundColor: 'rgba(212, 168, 83, 0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            ticks: { color: '#9a9489', maxTicksLimit: 8 },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            ticks: {
              color: '#9a9489',
              callback(value) {
                const numberValue = Number(value) || 0;
                return `${numberValue >= 0 ? '+' : ''}${numberValue.toFixed(2)}%`;
              }
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  } catch (error) {
    chartWrap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function shouldSkipCustomLoad(cacheKey, force) {
  return !force && loadedTabs.has(cacheKey);
}

function markCustomLoaded(cacheKey) {
  loadedTabs.add(cacheKey);
  updateLastUpdateTime();
}

async function loadFundsSection(targetElement, force = false) {
  const cacheKey = CUSTOM_SECTION_KEYS.funds;
  if (shouldSkipCustomLoad(cacheKey, force)) {
    return;
  }
  showLoading(targetElement);

  try {
    const [fundHtml, fundMap] = await Promise.all([
      fetchTabHtml('fund'),
      fetch('/api/fund/data').then((response) => response.json())
    ]);

    const funds = Object.entries(fundMap || {}).map(([code, info]) => ({
      code,
      name: info?.fund_name || code,
      shares: Number(info?.shares) || 0
    }));
    funds.sort((a, b) => (b.shares - a.shares) || a.code.localeCompare(b.code));

    const defaultFund = funds.find((item) => item.shares > 0) || funds[0] || null;
    const selectorOptions = funds
      .map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} - ${escapeHtml(item.name)}</option>`)
      .join('');

    const chartHeaderRight = funds.length > 0
      ? `<select class="chart-selector" id="fundChartSelector">${selectorOptions}</select>`
      : '';

    targetElement.innerHTML = `
      <div class="fund-main-section">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">持仓基金</h3>
          </div>
          <div class="chart-card-content">${fundHtml}</div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">估值走势</h3>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title" id="fundTrendTitle">基金估值走势</h3>
            ${chartHeaderRight}
          </div>
          <div class="chart-card-content">
            <div class="chart-canvas-wrap" id="fundTrendCanvasWrap">
              <canvas id="fundTrendChart"></canvas>
            </div>
            ${funds.length === 0 ? '<p class="chart-note">暂无基金，添加后可显示估值图。</p>' : ''}
          </div>
        </div>
      </div>
    `;

    executeEmbeddedScripts(targetElement);
    if (typeof window.autoColorize === 'function') {
      window.autoColorize();
    }
    await refreshFundSummary();

    if (defaultFund) {
      const selector = document.getElementById('fundChartSelector');
      if (selector) {
        selector.value = defaultFund.code;
        selector.addEventListener('change', async (event) => {
          const selectedCode = event.target.value;
          await loadAndRenderFundChart(selectedCode);
          fetch('/api/fund/chart-default', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fund_code: selectedCode })
          }).catch(() => { });
        });
      }
      await loadAndRenderFundChart(defaultFund.code);
    } else {
      const chartWrap = document.getElementById('fundTrendCanvasWrap');
      if (chartWrap) {
        chartWrap.innerHTML = '<div class="empty-state">暂无基金估值图数据</div>';
      }
    }

    markCustomLoaded(cacheKey);
  } catch (error) {
    showError(targetElement, error.message);
  }
}

async function loadTimingSection(targetElement, force = false) {
  const cacheKey = CUSTOM_SECTION_KEYS.timing;
  if (shouldSkipCustomLoad(cacheKey, force)) {
    return;
  }
  showLoading(targetElement);

  try {
    const [timingHtml, timingResponse] = await Promise.all([
      fetchTabHtml('A'),
      fetch('/api/timing').then(getJson)
    ]);

    targetElement.innerHTML = `
      <div class="chart-shell">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title" id="timingChartTitle">上证分时</h3>
          </div>
          <div class="chart-card-content">
            <div class="chart-canvas-wrap">
              <canvas id="timingChart"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">分时明细</h3>
          </div>
          <div class="chart-card-content">${timingHtml}</div>
        </div>
      </div>
    `;

    executeEmbeddedScripts(targetElement);
    if (typeof window.autoColorize === 'function') {
      window.autoColorize();
    }

    renderTimingChart(timingResponse?.success ? timingResponse.data : null);
    markCustomLoaded(cacheKey);
  } catch (error) {
    showError(targetElement, error.message);
  }
}

async function loadPreciousMetalsSection(targetElement, force = false, sectionKey = 'gold-realtime') {
  const cacheKey = CUSTOM_SECTION_KEYS[sectionKey] || CUSTOM_SECTION_KEYS['gold-realtime'];
  if (shouldSkipCustomLoad(cacheKey, force)) {
    return;
  }
  showLoading(targetElement);

  try {
    const [realTimeHtml, historyHtml, oneDayResponse, historyResponse] = await Promise.all([
      fetchTabHtml('real_time_gold'),
      fetchTabHtml('gold'),
      fetch('/api/gold/one-day').then(getJson),
      fetch('/api/gold/history').then(getJson)
    ]);

    targetElement.innerHTML = `
      <div class="metals-grid">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">实时贵金属</h3>
          </div>
          <div class="chart-card-content">${realTimeHtml}</div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title" id="goldOneDayTitle">分时黄金价格</h3>
          </div>
          <div class="chart-card-content">
            <div class="chart-canvas-wrap">
              <canvas id="goldOneDayChart"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">历史金价</h3>
          </div>
          <div class="chart-card-content">
            <div class="chart-canvas-wrap">
              <canvas id="goldHistoryChart"></canvas>
            </div>
            <p class="chart-note">下方保留历史表格数据，便于排序和对比。</p>
            <div style="margin-top: 12px;">${historyHtml}</div>
          </div>
        </div>
      </div>
    `;

    executeEmbeddedScripts(targetElement);
    if (typeof window.autoColorize === 'function') {
      window.autoColorize();
    }

    renderGoldOneDayChart(oneDayResponse?.success ? oneDayResponse.data : []);
    renderGoldHistoryChart(historyResponse?.success ? historyResponse.data : []);
    markCustomLoaded(cacheKey);
  } catch (error) {
    showError(targetElement, error.message);
  }
}

async function fetchAndRenderTab(tabId, targetElement, force = false) {
  if (!force && loadedTabs.has(tabId)) {
    return;
  }

  if (pendingLoads.has(tabId)) {
    await pendingLoads.get(tabId);
    return;
  }

  const loadPromise = (async () => {
    showLoading(targetElement);
    try {
      const content = await fetchTabHtml(tabId);
      targetElement.innerHTML = content;
      executeEmbeddedScripts(targetElement);
      if (typeof window.autoColorize === 'function') {
        window.autoColorize();
      }
      if (tabId === 'fund') {
        await refreshFundSummary();
      }
      loadedTabs.add(tabId);
      updateLastUpdateTime();
    } catch (error) {
      showError(targetElement, error.message);
    }
  })();

  pendingLoads.set(tabId, loadPromise);
  try {
    await loadPromise;
  } finally {
    pendingLoads.delete(tabId);
  }
}

async function loadSectionContent(sectionKey, sectionConfig, targetElement, force = false) {
  if (sectionKey === 'funds') {
    await loadFundsSection(targetElement, force);
    return;
  }
  if (sectionKey === 'timing') {
    await loadTimingSection(targetElement, force);
    return;
  }
  if (sectionKey === 'gold-realtime' || sectionKey === 'gold-history') {
    await loadPreciousMetalsSection(targetElement, force, sectionKey);
    return;
  }
  await fetchAndRenderTab(sectionConfig.tabId, targetElement, force);
}

async function navigateToSection(sectionKey, force = false) {
  const sectionConfig = SECTION_META[sectionKey] || SECTION_META[DEFAULT_SECTION];
  currentSection = sectionKey in SECTION_META ? sectionKey : DEFAULT_SECTION;
  syncSectionToUrl(currentSection);

  let activeButton = null;
  document.querySelectorAll('.sidebar-icon').forEach((icon) => {
    const isActive = icon.dataset.section === currentSection;
    icon.classList.toggle('active', isActive);
    if (isActive) {
      activeButton = icon;
    }
  });
  centerTopNavButton(activeButton, force);
  updateTopNavIndicator(currentSection, force);

  const sectionTitle = document.getElementById('sectionTitle');
  if (sectionTitle) {
    sectionTitle.textContent = sectionConfig.title;
  }

  const summaryBar = document.getElementById('summaryBar');
  if (summaryBar) {
    summaryBar.style.display = sectionConfig.showSummary ? 'grid' : 'none';
  }

  document.querySelectorAll('.content-section').forEach((section) => {
    section.classList.add('hidden');
    section.classList.remove('section-enter');
  });

  const sectionElement = document.getElementById(`${sectionConfig.tabId}Section`);
  const contentElement = document.getElementById(`${sectionConfig.tabId}Content`);

  if (!sectionElement || !contentElement) {
    return;
  }

  sectionElement.classList.remove('hidden');
  playSectionEnterAnimation(sectionElement);
  await loadSectionContent(currentSection, sectionConfig, contentElement, force);
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebarNav');
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (!sidebar || !sidebarToggle) {
    return;
  }
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('expanded');
  });
}

function bindSidebarActions() {
  document.querySelectorAll('.sidebar-icon').forEach((icon) => {
    icon.addEventListener('click', async () => {
      const sectionKey = icon.dataset.section || DEFAULT_SECTION;
      if (sectionKey === currentSection) {
        centerTopNavButton(icon, false);
        updateTopNavIndicator(sectionKey, false);
        return;
      }
      await navigateToSection(sectionKey, false);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  currentSection = getInitialSectionFromUrl();
  updateMarketStatus();
  updateLastUpdateTime();
  setInterval(updateMarketStatus, 60_000);
  setInterval(updateLastUpdateTime, 1_000);

  initSidebarToggle();
  initTopNavMotion();
  bindSidebarActions();
  await navigateToSection(currentSection || DEFAULT_SECTION, true);

  window.addEventListener('popstate', async () => {
    const targetSection = getInitialSectionFromUrl();
    await navigateToSection(targetSection, false);
  });

  window.lanfundRefreshCurrentSection = async function lanfundRefreshCurrentSection() {
    await navigateToSection(currentSection || DEFAULT_SECTION, true);
  };
});
