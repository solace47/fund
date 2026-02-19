import {
  buildLineChartOptions,
  buildLineDataset,
  buildRangeButtonsHtml,
  createOrUpdateLineChart,
  formatPrice,
  formatSigned,
  normalizeRangeValue,
  sliceByRange,
  toNumberSeries
} from './charts/factory.js';

const SECTION_META = {
  news: { tabId: 'kx', title: '7*24快讯', showSummary: false, showHeader: false },
  indices: { tabId: 'marker', title: '全球指数', showSummary: false, showHeader: false },
  'gold-realtime': { tabId: 'real_time_gold', title: '实时贵金属', showSummary: false, showHeader: false },
  'gold-history': { tabId: 'gold', title: '历史金价', showSummary: false, showHeader: false },
  volume: { tabId: 'seven_A', title: '成交量趋势', showSummary: false, showHeader: false },
  timing: { tabId: 'A', title: '上证分时', showSummary: false, showHeader: false },
  funds: { tabId: 'fund', title: '自选基金', showSummary: true, showHeader: false },
  sectors: { tabId: 'bk', title: '行业板块', showSummary: false, showHeader: false },
  query: { tabId: 'select_fund', title: '板块基金查询', showSummary: false, showHeader: false }
};

const CUSTOM_SECTION_KEYS = {
  funds: 'custom:funds',
  timing: 'custom:timing',
  'gold-realtime': 'custom:gold-realtime',
  'gold-history': 'custom:gold-history'
};

const DEFAULT_SECTION = 'funds';
const SECTION_QUERY_KEY = 'section';
const NAV_ACTIVE_ACCENT = ['#ECEFF3', '#E3E8EE'];
const SECTION_REFRESH_INTERVALS = {
  funds: 10_000,
  timing: 6_000,
  news: 10_000,
  indices: 20_000,
  'gold-realtime': 12_000,
  'gold-history': 30_000,
  volume: 25_000,
  sectors: 30_000,
  query: 300_000
};
const DEFAULT_REFRESH_INTERVAL = 10_000;
const BACKGROUND_REFRESH_INTERVAL = 30_000;
const MIN_REFRESH_GAP = 1_500;
const FLOATING_REFRESH_STORAGE_KEY = 'lanfund:floating-refresh:v1';
const FLOATING_REFRESH_COOLDOWN = 2_000;
const FLOATING_REFRESH_EDGE_GAP_DESKTOP = -10;
const FLOATING_REFRESH_EDGE_GAP_MOBILE = -8;
const FLOATING_REFRESH_BOTTOM_GAP = 16;
const loadedTabs = new Set();
const pendingLoads = new Map();
const chartInstances = {
  timing: null,
  goldOneDay: null,
  goldHistory: null,
  fund: null
};
const CHART_RANGE_PRESETS = {
  timing: [
    { value: '60', label: '1H', count: 60 },
    { value: '120', label: '2H', count: 120 },
    { value: '240', label: '4H', count: 240 },
    { value: 'all', label: '全部', count: 0 }
  ],
  goldOneDay: [
    { value: '60', label: '1H', count: 60 },
    { value: '180', label: '3H', count: 180 },
    { value: 'all', label: '全部', count: 0 }
  ],
  goldHistory: [
    { value: '30', label: '30D', count: 30 },
    { value: '90', label: '90D', count: 90 },
    { value: '180', label: '180D', count: 180 },
    { value: 'all', label: '全部', count: 0 }
  ],
  fund: [
    { value: '30', label: '30', count: 30 },
    { value: '60', label: '60', count: 60 },
    { value: '120', label: '120', count: 120 },
    { value: 'all', label: '全部', count: 0 }
  ]
};
const chartRangeState = {
  timing: '240',
  goldOneDay: '180',
  goldHistory: '90',
  fund: '120'
};
const chartDataCache = {
  timing: null,
  goldOneDay: null,
  goldHistory: null,
  fund: null
};
let currentSection = DEFAULT_SECTION;
let realtimeRefreshTimer = null;
let refreshInFlight = false;
let queuedRefreshReason = '';
let lastRefreshAt = 0;
let floatingRefreshButton = null;
let floatingRefreshState = null;
let floatingRefreshCooldownUntil = 0;

if (typeof window !== 'undefined') {
  // Let legacy script delegate /app refresh scheduling to this module.
  window.__lanfundManagedRefresh = true;
}

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

function updateTopNavAccent() {
  const navScroll = getTopNavScrollElement();
  if (!navScroll) {
    return;
  }

  const [accentStart, accentEnd] = NAV_ACTIVE_ACCENT;
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

  updateTopNavAccent();

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

function getSectionRefreshInterval(sectionKey = currentSection) {
  return SECTION_REFRESH_INTERVALS[sectionKey] || DEFAULT_REFRESH_INTERVAL;
}

function clearRealtimeRefreshTimer() {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = null;
  }
}

function scheduleRealtimeRefresh(preferImmediate = false) {
  clearRealtimeRefreshTimer();

  const interval = getSectionRefreshInterval(currentSection || DEFAULT_SECTION);
  const elapsed = Date.now() - lastRefreshAt;
  let delay = preferImmediate ? Math.max(300, MIN_REFRESH_GAP - elapsed) : interval;

  if (document.hidden) {
    delay = Math.max(delay, BACKGROUND_REFRESH_INTERVAL);
  }

  realtimeRefreshTimer = setTimeout(async () => {
    if (!document.hidden) {
      await refreshCurrentSectionSilently('timer');
    }
    scheduleRealtimeRefresh(false);
  }, delay);
}

function getRowBaseKey(row) {
  const first = row.cells?.[0]?.textContent?.trim() || '';
  if (first) {
    return first;
  }
  const second = row.cells?.[1]?.textContent?.trim() || '';
  return `${first}||${second}`;
}

function buildIndexedRowKeys(rows) {
  const counters = new Map();
  return rows.map((row) => {
    const base = getRowBaseKey(row);
    const seen = counters.get(base) || 0;
    counters.set(base, seen + 1);
    return `${base}#${seen}`;
  });
}

function patchTableBodyRows(currentBody, nextBody) {
  const currentRows = Array.from(currentBody.querySelectorAll('tr'));
  const nextRows = Array.from(nextBody.querySelectorAll('tr'));

  if (currentRows.length === 0 && nextRows.length === 0) {
    return false;
  }

  const currentKeys = buildIndexedRowKeys(currentRows);
  const nextKeys = buildIndexedRowKeys(nextRows);

  // Fast path: same structure, patch changed rows in place.
  if (currentRows.length === nextRows.length && currentKeys.every((key, idx) => key === nextKeys[idx])) {
    let changed = false;
    for (let i = 0; i < currentRows.length; i += 1) {
      const currentRow = currentRows[i];
      const nextRow = nextRows[i];
      if (currentRow.className !== nextRow.className) {
        currentRow.className = nextRow.className;
        changed = true;
      }
      const currentCells = Array.from(currentRow.cells);
      const nextCells = Array.from(nextRow.cells);
      if (currentCells.length !== nextCells.length) {
        if (currentRow.innerHTML !== nextRow.innerHTML) {
          currentRow.innerHTML = nextRow.innerHTML;
          changed = true;
        }
        continue;
      }

      for (let j = 0; j < currentCells.length; j += 1) {
        const currentCell = currentCells[j];
        const nextCell = nextCells[j];
        const activeElement = document.activeElement;
        if (activeElement && (activeElement === currentCell || currentCell.contains(activeElement))) {
          continue;
        }
        if (currentCell.className !== nextCell.className) {
          currentCell.className = nextCell.className;
          changed = true;
        }
        if (currentCell.innerHTML !== nextCell.innerHTML) {
          currentCell.innerHTML = nextCell.innerHTML;
          changed = true;
        }
      }
    }
    return changed;
  }

  // Fallback path: keyed reorder + minimal row replacement.
  const rowMap = new Map();
  currentRows.forEach((row, index) => {
    rowMap.set(currentKeys[index], row);
  });

  let changed = currentRows.length !== nextRows.length;
  const fragment = document.createDocumentFragment();
  nextRows.forEach((nextRow, index) => {
    const key = nextKeys[index];
    const existingRow = rowMap.get(key);
    if (existingRow) {
      if (existingRow.className !== nextRow.className) {
        existingRow.className = nextRow.className;
        changed = true;
      }
      const existingCells = Array.from(existingRow.cells);
      const nextCells = Array.from(nextRow.cells);
      if (existingCells.length !== nextCells.length) {
        if (existingRow.innerHTML !== nextRow.innerHTML) {
          existingRow.innerHTML = nextRow.innerHTML;
          changed = true;
        }
      } else {
        for (let j = 0; j < existingCells.length; j += 1) {
          const existingCell = existingCells[j];
          const nextCell = nextCells[j];
          const activeElement = document.activeElement;
          if (activeElement && (activeElement === existingCell || existingCell.contains(activeElement))) {
            continue;
          }
          if (existingCell.className !== nextCell.className) {
            existingCell.className = nextCell.className;
            changed = true;
          }
          if (existingCell.innerHTML !== nextCell.innerHTML) {
            existingCell.innerHTML = nextCell.innerHTML;
            changed = true;
          }
        }
      }
      fragment.appendChild(existingRow);
      rowMap.delete(key);
    } else {
      fragment.appendChild(nextRow.cloneNode(true));
      changed = true;
    }
  });

  if (rowMap.size > 0) {
    changed = true;
  }

  if (!changed) {
    return false;
  }

  currentBody.innerHTML = '';
  currentBody.appendChild(fragment);
  return true;
}

function patchSingleTable(currentContainer, nextContainer) {
  const currentTable = currentContainer.querySelector('table');
  const nextTable = nextContainer.querySelector('table');
  if (!currentTable || !nextTable) {
    return false;
  }

  if (currentTable.className !== nextTable.className) {
    currentTable.className = nextTable.className;
  }

  const currentHead = currentTable.querySelector('thead');
  const nextHead = nextTable.querySelector('thead');
  if ((currentHead && !nextHead) || (!currentHead && nextHead)) {
    currentTable.innerHTML = nextTable.innerHTML;
    return true;
  }
  if (currentHead && nextHead && currentHead.innerHTML !== nextHead.innerHTML) {
    currentHead.innerHTML = nextHead.innerHTML;
  }

  const currentBody = currentTable.querySelector('tbody');
  const nextBody = nextTable.querySelector('tbody');
  if (!currentBody || !nextBody) {
    if (currentTable.innerHTML !== nextTable.innerHTML) {
      currentTable.innerHTML = nextTable.innerHTML;
      return true;
    }
    return true;
  }

  patchTableBodyRows(currentBody, nextBody);
  return true;
}

function patchTableOnly(targetElement, incomingHtml) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = incomingHtml;

  const nextTables = Array.from(wrapper.querySelectorAll('.table-container'));
  const currentTables = Array.from(targetElement.querySelectorAll('.table-container'));

  if (nextTables.length === 0 || currentTables.length === 0 || nextTables.length !== currentTables.length) {
    return false;
  }

  for (let i = 0; i < nextTables.length; i += 1) {
    const handled = patchSingleTable(currentTables[i], nextTables[i]);
    if (!handled) {
      return false;
    }
  }
  return true;
}

function patchSectionContent(targetElement, incomingHtml) {
  const patched = patchTableOnly(targetElement, incomingHtml);
  if (patched) {
    return;
  }
  targetElement.innerHTML = incomingHtml;
  executeEmbeddedScripts(targetElement);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  const now = new Date();
  const text = `更新于 ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  ['lastUpdate', 'holdingsLastUpdate'].forEach((id) => {
    const target = document.getElementById(id);
    if (target) {
      target.textContent = text;
    }
  });
}

function getFloatingRefreshEdgeGap() {
  return window.innerWidth <= 768 ? FLOATING_REFRESH_EDGE_GAP_MOBILE : FLOATING_REFRESH_EDGE_GAP_DESKTOP;
}

function getFloatingRefreshTopBounds(buttonHeight = 54) {
  const navShell = document.querySelector('.top-nav-shell');
  const navBottom = navShell ? navShell.getBoundingClientRect().bottom : 68;
  const minTop = Math.max(14, Math.round(navBottom + 8));
  const maxTop = Math.max(minTop, window.innerHeight - buttonHeight - FLOATING_REFRESH_BOTTOM_GAP);
  return { minTop, maxTop };
}

function loadFloatingRefreshState() {
  let saved = null;
  try {
    const raw = window.localStorage.getItem(FLOATING_REFRESH_STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    saved = null;
  }

  const defaultTop = Math.round(window.innerHeight * 0.48);
  const edge = saved?.edge === 'left' ? 'left' : 'right';
  const top = Number.isFinite(Number(saved?.top)) ? Number(saved.top) : defaultTop;
  return { edge, top };
}

function saveFloatingRefreshState(state) {
  if (!state) {
    return;
  }
  try {
    window.localStorage.setItem(FLOATING_REFRESH_STORAGE_KEY, JSON.stringify({
      edge: state.edge === 'left' ? 'left' : 'right',
      top: Math.round(Number(state.top) || 0)
    }));
  } catch (error) {
    // Ignore localStorage failures (private mode / quota / disabled storage).
  }
}

function applyFloatingRefreshState(button, state, options = {}) {
  if (!button || !state) {
    return;
  }
  const animate = Boolean(options.animate);
  const edge = state.edge === 'left' ? 'left' : 'right';
  const bounds = getFloatingRefreshTopBounds(button.offsetHeight || 54);
  const top = clampNumber(Number(state.top) || bounds.minTop, bounds.minTop, bounds.maxTop);
  const edgeGap = getFloatingRefreshEdgeGap();

  button.classList.toggle('snap-anim', animate);
  button.style.top = `${Math.round(top)}px`;
  button.style.left = edge === 'left' ? `${edgeGap}px` : 'auto';
  button.style.right = edge === 'right' ? `${edgeGap}px` : 'auto';
  button.dataset.edge = edge;

  state.top = top;
  state.edge = edge;
}

function setFloatingRefreshLoading(isLoading) {
  if (!floatingRefreshButton) {
    return;
  }
  floatingRefreshButton.classList.toggle('is-loading', isLoading);
  floatingRefreshButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

function initFloatingRefreshButton() {
  if (floatingRefreshButton || document.getElementById('floatingRefreshButton')) {
    floatingRefreshButton = document.getElementById('floatingRefreshButton');
    return;
  }

  const button = document.createElement('button');
  button.id = 'floatingRefreshButton';
  button.className = 'floating-refresh-button';
  button.type = 'button';
  button.title = '刷新当前板块（可拖动到左右侧）';
  button.setAttribute('aria-label', '刷新当前板块');
  button.innerHTML = `
    <span class="floating-refresh-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M3 12a9 9 0 0 1 15.3-6.3" />
        <path d="M18.3 5.7V10H14" />
        <path d="M21 12a9 9 0 0 1-15.3 6.3" />
        <path d="M5.7 18.3V14H10" />
      </svg>
    </span>
  `;
  document.body.appendChild(button);

  floatingRefreshButton = button;
  floatingRefreshState = loadFloatingRefreshState();
  applyFloatingRefreshState(button, floatingRefreshState, { animate: false });

  let pointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let buttonStartLeft = 0;
  let buttonStartTop = 0;
  let moved = false;
  let suppressClickUntil = 0;

  const finishDrag = (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    pointerId = null;
    button.classList.remove('is-dragging');
    try {
      button.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore release errors.
    }

    if (!moved) {
      return;
    }

    const rect = button.getBoundingClientRect();
    floatingRefreshState = {
      edge: rect.left + rect.width / 2 <= window.innerWidth / 2 ? 'left' : 'right',
      top: rect.top
    };
    applyFloatingRefreshState(button, floatingRefreshState, { animate: true });
    saveFloatingRefreshState(floatingRefreshState);
    suppressClickUntil = Date.now() + 320;
    moved = false;
  };

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }

    pointerId = event.pointerId;
    moved = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;

    const rect = button.getBoundingClientRect();
    buttonStartLeft = rect.left;
    buttonStartTop = rect.top;

    button.classList.add('is-dragging');
    button.classList.remove('snap-anim');
    button.style.left = `${Math.round(buttonStartLeft)}px`;
    button.style.right = 'auto';
    button.style.top = `${Math.round(buttonStartTop)}px`;
    if (typeof button.setPointerCapture === 'function') {
      button.setPointerCapture(pointerId);
    }
    event.preventDefault();
  });

  button.addEventListener('pointermove', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) {
      return;
    }

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      moved = true;
    }

    const width = button.offsetWidth || 68;
    const height = button.offsetHeight || 54;
    const bounds = getFloatingRefreshTopBounds(height);
    const minLeft = 6;
    const maxLeft = Math.max(minLeft, window.innerWidth - width - 6);
    const nextLeft = clampNumber(buttonStartLeft + dx, minLeft, maxLeft);
    const nextTop = clampNumber(buttonStartTop + dy, bounds.minTop, bounds.maxTop);

    button.style.left = `${Math.round(nextLeft)}px`;
    button.style.top = `${Math.round(nextTop)}px`;
  });

  button.addEventListener('pointerup', finishDrag);
  button.addEventListener('pointercancel', finishDrag);

  button.addEventListener('click', async (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }
    if (Date.now() < floatingRefreshCooldownUntil) {
      return;
    }

    floatingRefreshCooldownUntil = Date.now() + FLOATING_REFRESH_COOLDOWN;
    setFloatingRefreshLoading(true);
    try {
      await refreshCurrentSectionSilently('manual-fab');
      scheduleRealtimeRefresh(false);
    } catch (error) {
      console.error('手动刷新失败:', error);
    } finally {
      setFloatingRefreshLoading(false);
    }
  });

  window.addEventListener('resize', () => {
    if (!floatingRefreshButton || !floatingRefreshState) {
      return;
    }
    applyFloatingRefreshState(floatingRefreshButton, floatingRefreshState, { animate: false });
    saveFloatingRefreshState(floatingRefreshState);
  });
}

function updateMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  let marketState = 'closed';
  let marketText = '市场已收盘';

  if (day === 0 || day === 6) {
    marketState = 'rest';
    marketText = '休市中';
  } else {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = 9 * 60 + 30;
    const closeMinutes = 15 * 60;
    if (minutes >= openMinutes && minutes < closeMinutes) {
      marketState = 'open';
      marketText = '市场开盘中';
    }
  }

  ['marketStatusText', 'holdingsMarketStatusText'].forEach((id) => {
    const target = document.getElementById(id);
    if (target) {
      target.textContent = marketText;
    }
  });

  ['marketStatusBadge', 'holdingsMarketStatusBadge'].forEach((id) => {
    const badge = document.getElementById(id);
    if (badge) {
      badge.dataset.marketState = marketState;
    }
  });
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

function isChartReusable(key, canvas) {
  return Boolean(chartInstances[key] && chartInstances[key].canvas === canvas);
}

function getRangePresets(chartKey) {
  return CHART_RANGE_PRESETS[chartKey] || [{ value: 'all', label: '全部', count: 0 }];
}

function getChartRange(chartKey) {
  const presets = getRangePresets(chartKey);
  chartRangeState[chartKey] = normalizeRangeValue(chartRangeState[chartKey], presets, 'all');
  return chartRangeState[chartKey];
}

function setChartRange(chartKey, rangeValue) {
  const presets = getRangePresets(chartKey);
  chartRangeState[chartKey] = normalizeRangeValue(rangeValue, presets, 'all');
}

function getChartRangeControls(chartKey) {
  return buildRangeButtonsHtml(chartKey, getRangePresets(chartKey), getChartRange(chartKey));
}

function syncChartRangeButtons(chartKey, root = document) {
  const selected = getChartRange(chartKey);
  root.querySelectorAll(`.chart-range[data-chart-key="${chartKey}"] .chart-range-btn`).forEach((button) => {
    button.classList.toggle('active', button.dataset.range === selected);
  });
}

function syncAllChartRangeButtons(root = document) {
  Object.keys(CHART_RANGE_PRESETS).forEach((chartKey) => {
    syncChartRangeButtons(chartKey, root);
  });
}

function updateChartTitle(titleId, baseTitle, metaText, trendValue = 0) {
  const title = document.getElementById(titleId);
  if (!title) {
    return;
  }

  const trendClass = trendValue > 0 ? 'up' : (trendValue < 0 ? 'down' : 'flat');
  const meta = metaText ? ` <span class="chart-title-meta ${trendClass}">${escapeHtml(metaText)}</span>` : '';
  title.innerHTML = `${escapeHtml(baseTitle)}${meta}`;
}

function sliceChartPayload(chartKey, labels, seriesMap) {
  const selectedRange = getChartRange(chartKey);
  return sliceByRange(labels, seriesMap, selectedRange, getRangePresets(chartKey));
}

function rerenderChartByKey(chartKey) {
  if (chartKey === 'timing') {
    drawTimingChart();
    return;
  }
  if (chartKey === 'goldOneDay') {
    drawGoldOneDayChart();
    return;
  }
  if (chartKey === 'goldHistory') {
    drawGoldHistoryChart();
    return;
  }
  if (chartKey === 'fund') {
    drawFundTrendChart();
  }
}

function renderTimingChart(data) {
  if (!data || !Array.isArray(data.labels) || data.labels.length === 0) {
    chartDataCache.timing = null;
    destroyChart('timing');
    const wrap = document.querySelector('#timingChart')?.parentElement;
    if (wrap) {
      wrap.innerHTML = '<div class="empty-state">暂无上证分时数据</div>';
    }
    return;
  }

  chartDataCache.timing = {
    labels: data.labels,
    changes: toNumberSeries(data.change_pcts),
    prices: toNumberSeries(data.prices),
    changeAmounts: toNumberSeries(data.change_amounts),
    volumes: toNumberSeries(data.volumes),
    amounts: toNumberSeries(data.amounts)
  };
  drawTimingChart();
}

function drawTimingChart() {
  const cache = chartDataCache.timing;
  let canvas = document.getElementById('timingChart');
  if (!cache) {
    return;
  }
  if (!canvas) {
    const chartWrap = document.querySelector('#timingChartTitle')?.closest('.chart-card')?.querySelector('.chart-canvas-wrap');
    if (chartWrap) {
      chartWrap.innerHTML = '<canvas id="timingChart"></canvas>';
      canvas = document.getElementById('timingChart');
    }
  }
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(canvas.parentElement);
    return;
  }

  const latestPct = cache.changes.length > 0 ? cache.changes[cache.changes.length - 1] : 0;
  const latestPrice = cache.prices.length > 0 ? cache.prices[cache.prices.length - 1] : 0;
  updateChartTitle('timingChartTitle', '上证分时', `${formatSigned(latestPct, 2, '%')} (${formatPrice(latestPrice, 2)})`, latestPct);

  const sliced = sliceChartPayload('timing', cache.labels, {
    changes: cache.changes,
    prices: cache.prices,
    changeAmounts: cache.changeAmounts,
    volumes: cache.volumes,
    amounts: cache.amounts
  });
  const labels = sliced.labels;
  const payload = sliced.seriesMap;
  if (labels.length === 0) {
    return;
  }

  const dataset = buildLineDataset({
    label: '涨跌幅 (%)',
    data: payload.changes,
    semanticTrend: true,
    semanticBaseline: 0,
    palette: {
      up: '#e0314d',
      down: '#0b8b74',
      neutral: '#7a879d'
    },
    fillAboveAlpha: 0.15,
    fillBelowAlpha: 0.13
  });
  const options = buildLineChartOptions({
    maxXTicks: 8,
    yTitle: '涨跌幅 (%)',
    yTickFormatter: (value) => formatSigned(value, 2, '%'),
    zeroAxis: true,
    extrema: true,
    extremaFormatter: (value) => formatSigned(value, 2, '%'),
    decimationSamples: 96,
    tooltipCallbacks: {
      title(context) {
        return `时间: ${context[0]?.label || '--'}`;
      },
      label(context) {
        const index = context.dataIndex;
        const pct = payload.changes?.[index] || 0;
        const price = payload.prices?.[index] || 0;
        const changeAmount = payload.changeAmounts?.[index] || 0;
        const volume = payload.volumes?.[index] || 0;
        const amount = payload.amounts?.[index] || 0;
        return [
          `涨跌幅: ${formatSigned(pct, 2, '%')}`,
          `上证指数: ${formatPrice(price, 2)}`,
          `涨跌额: ${formatSigned(changeAmount, 2)}`,
          `成交量: ${formatPrice(volume, 0)}万手`,
          `成交额: ${formatPrice(amount, 2)}亿`
        ];
      }
    }
  });

  createOrUpdateLineChart({
    chartKey: 'timing',
    chartInstances,
    canvas,
    labels,
    dataset,
    options,
    payload
  });
}

function renderGoldOneDayChart(records) {
  const chartWrap = document.querySelector('#goldOneDayChart')?.parentElement
    || document.querySelector('#goldOneDayTitle')?.closest('.chart-card')?.querySelector('.chart-canvas-wrap');
  if (!chartWrap) {
    return;
  }
  if (!Array.isArray(records) || records.length === 0) {
    chartDataCache.goldOneDay = null;
    destroyChart('goldOneDay');
    chartWrap.innerHTML = '<div class="empty-state">暂无分时金价数据</div>';
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
    chartDataCache.goldOneDay = null;
    destroyChart('goldOneDay');
    chartWrap.innerHTML = '<div class="empty-state">暂无分时金价数据</div>';
    return;
  }

  chartDataCache.goldOneDay = { labels, prices };
  drawGoldOneDayChart();
}

function drawGoldOneDayChart() {
  const cache = chartDataCache.goldOneDay;
  const chartWrap = document.querySelector('#goldOneDayChart')?.parentElement
    || document.querySelector('#goldOneDayTitle')?.closest('.chart-card')?.querySelector('.chart-canvas-wrap');
  if (!chartWrap || !cache) {
    return;
  }

  let canvas = document.getElementById('goldOneDayChart');
  if (!canvas) {
    chartWrap.innerHTML = '<canvas id="goldOneDayChart"></canvas>';
    canvas = document.getElementById('goldOneDayChart');
  }
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(chartWrap);
    return;
  }

  const latestPrice = cache.prices[cache.prices.length - 1] || 0;
  const latestTime = cache.labels[cache.labels.length - 1] || '--';
  const startPrice = cache.prices[0] || 0;
  const trend = latestPrice - startPrice;
  updateChartTitle('goldOneDayTitle', '分时黄金价格', `最新 ¥${formatPrice(latestPrice, 2)} ${latestTime}`, trend);

  const sliced = sliceChartPayload('goldOneDay', cache.labels, {
    prices: cache.prices
  });
  const labels = sliced.labels;
  const payload = sliced.seriesMap;
  if (labels.length === 0) {
    return;
  }

  const dataset = buildLineDataset({
    label: '金价 (元/克)',
    data: payload.prices,
    semanticTrend: false,
    fixedColor: '#c88a2f',
    fillAlpha: 0.11
  });
  const options = buildLineChartOptions({
    maxXTicks: 10,
    yTickFormatter: (value) => `¥${formatPrice(value, 1)}`,
    extrema: true,
    extremaFormatter: (value) => `¥${formatPrice(value, 2)}`,
    decimationSamples: 90,
    tooltipCallbacks: {
      title(context) {
        return `时间: ${context[0]?.label || '--'}`;
      },
      label(context) {
        const index = context.dataIndex;
        const price = payload.prices?.[index] || 0;
        return `金价: ¥${formatPrice(price, 2)} / 克`;
      }
    }
  });

  createOrUpdateLineChart({
    chartKey: 'goldOneDay',
    chartInstances,
    canvas,
    labels,
    dataset,
    options,
    payload
  });
}

function renderGoldHistoryChart(records) {
  const chartWrap = document.querySelector('#goldHistoryChart')?.parentElement
    || document.querySelector('#goldHistoryChart')?.closest('.chart-canvas-wrap')
    || document.querySelector('.metals-grid .chart-card:nth-child(3) .chart-canvas-wrap');
  if (!chartWrap) {
    return;
  }

  if (!Array.isArray(records) || records.length === 0) {
    chartDataCache.goldHistory = null;
    destroyChart('goldHistory');
    chartWrap.innerHTML = '<div class="empty-state">暂无历史金价数据</div>';
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
    chartDataCache.goldHistory = null;
    destroyChart('goldHistory');
    chartWrap.innerHTML = '<div class="empty-state">暂无历史金价数据</div>';
    return;
  }

  normalized.reverse();
  chartDataCache.goldHistory = {
    labels: normalized.map((item) => item.date),
    prices: normalized.map((item) => item.value)
  };
  drawGoldHistoryChart();
}

function drawGoldHistoryChart() {
  const cache = chartDataCache.goldHistory;
  const chartWrap = document.querySelector('#goldHistoryChart')?.parentElement
    || document.querySelector('#goldHistoryChart')?.closest('.chart-canvas-wrap')
    || document.querySelector('.metals-grid .chart-card:nth-child(3) .chart-canvas-wrap');
  if (!chartWrap || !cache) {
    return;
  }

  let canvas = document.getElementById('goldHistoryChart');
  if (!canvas) {
    chartWrap.innerHTML = '<canvas id="goldHistoryChart"></canvas>';
    canvas = document.getElementById('goldHistoryChart');
  }
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(chartWrap);
    return;
  }

  const latestPrice = cache.prices[cache.prices.length - 1] || 0;
  const prevPrice = cache.prices[cache.prices.length - 2] || latestPrice;
  updateChartTitle('goldHistoryTitle', '历史金价', `最新 ¥${formatPrice(latestPrice, 2)}`, latestPrice - prevPrice);

  const sliced = sliceChartPayload('goldHistory', cache.labels, {
    prices: cache.prices
  });
  const labels = sliced.labels;
  const payload = sliced.seriesMap;
  if (labels.length === 0) {
    return;
  }

  const dataset = buildLineDataset({
    label: '中国黄金基础金价 (元/克)',
    data: payload.prices,
    semanticTrend: false,
    fixedColor: '#4f6f99',
    fillAlpha: 0.1,
    tension: 0.22
  });
  const options = buildLineChartOptions({
    maxXTicks: 8,
    yTickFormatter: (value) => `¥${formatPrice(value, 1)}`,
    extrema: true,
    extremaFormatter: (value) => `¥${formatPrice(value, 2)}`,
    decimationSamples: 72,
    tooltipCallbacks: {
      title(context) {
        return `日期: ${context[0]?.label || '--'}`;
      },
      label(context) {
        const index = context.dataIndex;
        const price = payload.prices?.[index] || 0;
        return `中国黄金基础金价: ¥${formatPrice(price, 2)} / 克`;
      }
    }
  });

  createOrUpdateLineChart({
    chartKey: 'goldHistory',
    chartInstances,
    canvas,
    labels,
    dataset,
    options,
    payload
  });
}

async function loadAndRenderFundChart(fundCode) {
  const chartWrap = document.getElementById('fundTrendCanvasWrap');
  let canvas = document.getElementById('fundTrendChart');

  if (!chartWrap || !fundCode) {
    return;
  }
  if (!canvas) {
    chartWrap.innerHTML = '<canvas id="fundTrendChart"></canvas>';
    canvas = document.getElementById('fundTrendChart');
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
    const growth = toNumberSeries(chartData.growth);
    const netValues = toNumberSeries(chartData.net_values);
    const fundName = result.fund_info?.name || fundCode;

    if (labels.length === 0 || growth.length === 0) {
      destroyChart('fund');
      chartDataCache.fund = null;
      chartWrap.innerHTML = '<div class="empty-state">暂无该基金估值走势数据</div>';
      return;
    }

    chartDataCache.fund = {
      fundCode,
      fundName,
      labels,
      growth,
      netValues
    };
    drawFundTrendChart();
  } catch (error) {
    chartDataCache.fund = null;
    destroyChart('fund');
    chartWrap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function drawFundTrendChart() {
  const cache = chartDataCache.fund;
  const chartWrap = document.getElementById('fundTrendCanvasWrap');
  let canvas = document.getElementById('fundTrendChart');
  if (!chartWrap || !cache) {
    return;
  }

  if (!canvas) {
    chartWrap.innerHTML = '<canvas id="fundTrendChart"></canvas>';
    canvas = document.getElementById('fundTrendChart');
  }
  if (!canvas) {
    return;
  }
  if (!canUseCharts()) {
    setChartUnavailable(chartWrap);
    return;
  }

  const latestGrowth = cache.growth[cache.growth.length - 1] || 0;
  const latestNet = cache.netValues[cache.netValues.length - 1] || 0;
  updateChartTitle(
    'fundTrendTitle',
    `基金估值走势 - ${cache.fundCode} ${cache.fundName}`,
    `${formatSigned(latestGrowth, 2, '%')} | 净值 ${formatPrice(latestNet, 4)}`,
    latestGrowth
  );

  const sliced = sliceChartPayload('fund', cache.labels, {
    growth: cache.growth,
    netValues: cache.netValues
  });
  const labels = sliced.labels;
  const payload = sliced.seriesMap;
  if (labels.length === 0) {
    return;
  }

  const dataset = buildLineDataset({
    label: '涨幅 (%)',
    data: payload.growth,
    semanticTrend: true,
    semanticBaseline: 0,
    palette: {
      up: '#e0314d',
      down: '#0b8b74',
      neutral: '#7a879d'
    },
    fillAboveAlpha: 0.15,
    fillBelowAlpha: 0.13,
    tension: 0.35
  });
  const options = buildLineChartOptions({
    maxXTicks: 8,
    yTitle: '涨幅 (%)',
    yTickFormatter: (value) => formatSigned(value, 2, '%'),
    zeroAxis: true,
    extrema: true,
    extremaFormatter: (value) => formatSigned(value, 2, '%'),
    decimationSamples: 96,
    tooltipCallbacks: {
      title(context) {
        return `时间: ${context[0]?.label || '--'}`;
      },
      label(context) {
        const index = context.dataIndex;
        const growth = payload.growth?.[index] || 0;
        const netValue = payload.netValues?.[index] || 0;
        return [
          `涨幅: ${formatSigned(growth, 2, '%')}`,
          `净值: ${formatPrice(netValue, 4)}`
        ];
      }
    }
  });

  createOrUpdateLineChart({
    chartKey: 'fund',
    chartInstances,
    canvas,
    labels,
    dataset,
    options,
    payload
  });
}

function bindChartRangeControls() {
  if (bindChartRangeControls.bound) {
    return;
  }
  bindChartRangeControls.bound = true;

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.chart-range-btn');
    if (!button) {
      return;
    }

    const chartKey = button.dataset.chartKey;
    const rangeValue = button.dataset.range;
    if (!chartKey || !rangeValue || !CHART_RANGE_PRESETS[chartKey]) {
      return;
    }

    event.preventDefault();
    const previous = getChartRange(chartKey);
    setChartRange(chartKey, rangeValue);
    const next = getChartRange(chartKey);
    syncChartRangeButtons(chartKey);
    if (next !== previous || !button.classList.contains('active')) {
      rerenderChartByKey(chartKey);
    }
  });
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

    const selectorControl = funds.length > 0
      ? `<select class="chart-selector" id="fundChartSelector">${selectorOptions}</select>`
      : '';
    const chartHeaderRight = `
      <div class="chart-header-actions">
        ${selectorControl}
        ${getChartRangeControls('fund')}
      </div>
    `;

    targetElement.innerHTML = `
      <div class="fund-main-section">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title">持仓基金</h3>
            <div class="chart-header-actions holdings-header-meta">
              <span class="market-status market-status--prominent" id="holdingsMarketStatusBadge" data-market-state="closed">
                <span class="status-dot"></span>
                <span id="holdingsMarketStatusText">市场已收盘</span>
              </span>
              <span class="last-update last-update--prominent" id="holdingsLastUpdate">更新于 --:--:--</span>
            </div>
          </div>
          <div class="chart-card-content">${fundHtml}</div>
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
    syncAllChartRangeButtons(targetElement);
    updateMarketStatus();
    updateLastUpdateTime();
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
      chartDataCache.fund = null;
      destroyChart('fund');
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
            <div class="chart-header-actions">
              ${getChartRangeControls('timing')}
            </div>
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
    syncAllChartRangeButtons(targetElement);
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
            <div class="chart-header-actions">
              ${getChartRangeControls('goldOneDay')}
            </div>
          </div>
          <div class="chart-card-content">
            <div class="chart-canvas-wrap">
              <canvas id="goldOneDayChart"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-card-title" id="goldHistoryTitle">历史金价</h3>
            <div class="chart-header-actions">
              ${getChartRangeControls('goldHistory')}
            </div>
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
    syncAllChartRangeButtons(targetElement);
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

function normalizeFundList(fundMap) {
  const funds = Object.entries(fundMap || {}).map(([code, info]) => ({
    code,
    name: info?.fund_name || code,
    shares: Number(info?.shares) || 0
  }));
  funds.sort((a, b) => (b.shares - a.shares) || a.code.localeCompare(b.code));
  return funds;
}

async function refreshFundsSectionSilently(targetElement) {
  const fundContent = targetElement.querySelector('.fund-main-section .chart-card:nth-child(1) .chart-card-content');
  if (!fundContent) {
    await loadFundsSection(targetElement, true);
    return;
  }

  const selectorBeforePatch = targetElement.querySelector('#fundChartSelector');
  const previousCode = selectorBeforePatch?.value || '';
  const fundCodesInputBeforePatch = targetElement.querySelector('#fundCodesInput');
  const draftFundCodes = fundCodesInputBeforePatch?.value || '';
  const shouldRestoreFocus = document.activeElement === fundCodesInputBeforePatch;

  const [fundHtml, fundMap] = await Promise.all([
    fetchTabHtml('fund'),
    fetch('/api/fund/data').then((response) => response.json())
  ]);

  patchSectionContent(fundContent, fundHtml);
  const fundCodesInputAfterPatch = targetElement.querySelector('#fundCodesInput');
  if (fundCodesInputAfterPatch && draftFundCodes && fundCodesInputAfterPatch.value !== draftFundCodes) {
    fundCodesInputAfterPatch.value = draftFundCodes;
  }
  if (shouldRestoreFocus && fundCodesInputAfterPatch) {
    fundCodesInputAfterPatch.focus();
  }

  const selector = targetElement.querySelector('#fundChartSelector');
  if (typeof window.autoColorize === 'function') {
    window.autoColorize();
  }
  await refreshFundSummary();

  const funds = normalizeFundList(fundMap);
  const defaultFund = funds.find((item) => item.shares > 0) || funds[0] || null;
  const nextCode = (previousCode && funds.some((item) => item.code === previousCode))
    ? previousCode
    : defaultFund?.code;

  if (selector) {
    const options = funds
      .map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)} - ${escapeHtml(item.name)}</option>`)
      .join('');
    if (selector.innerHTML !== options) {
      selector.innerHTML = options;
    }
  }

  if (nextCode) {
    if (selector) {
      selector.value = nextCode;
    }
    await loadAndRenderFundChart(nextCode);
    return;
  }

  const chartWrap = document.getElementById('fundTrendCanvasWrap');
  chartDataCache.fund = null;
  destroyChart('fund');
  if (chartWrap) {
    chartWrap.innerHTML = '<div class="empty-state">暂无基金估值图数据</div>';
  }
}

async function refreshTimingSectionSilently(targetElement) {
  const detailContent = targetElement.querySelector('.chart-shell .chart-card:nth-child(2) .chart-card-content');
  if (!detailContent) {
    await loadTimingSection(targetElement, true);
    return;
  }

  const [timingHtml, timingResponse] = await Promise.all([
    fetchTabHtml('A'),
    fetch('/api/timing').then(getJson)
  ]);

  patchSectionContent(detailContent, timingHtml);
  if (typeof window.autoColorize === 'function') {
    window.autoColorize();
  }
  renderTimingChart(timingResponse?.success ? timingResponse.data : null);
}

async function refreshPreciousMetalsSectionSilently(targetElement, sectionKey = 'gold-realtime') {
  const realTimeContent = targetElement.querySelector('.metals-grid .chart-card:nth-child(1) .chart-card-content');
  const historyCardContent = targetElement.querySelector('.metals-grid .chart-card:nth-child(3) .chart-card-content');
  const historyTableContainer = historyCardContent?.lastElementChild || null;

  if (!realTimeContent || !historyTableContainer) {
    await loadPreciousMetalsSection(targetElement, true, sectionKey);
    return;
  }

  const [realTimeHtml, historyHtml, oneDayResponse, historyResponse] = await Promise.all([
    fetchTabHtml('real_time_gold'),
    fetchTabHtml('gold'),
    fetch('/api/gold/one-day').then(getJson),
    fetch('/api/gold/history').then(getJson)
  ]);

  patchSectionContent(realTimeContent, realTimeHtml);
  patchSectionContent(historyTableContainer, historyHtml);
  if (typeof window.autoColorize === 'function') {
    window.autoColorize();
  }

  renderGoldOneDayChart(oneDayResponse?.success ? oneDayResponse.data : []);
  renderGoldHistoryChart(historyResponse?.success ? historyResponse.data : []);
}

async function refreshSimpleSectionSilently(sectionConfig, targetElement) {
  const html = await fetchTabHtml(sectionConfig.tabId);
  patchSectionContent(targetElement, html);
  if (typeof window.autoColorize === 'function') {
    window.autoColorize();
  }
}

async function refreshSectionContentSilently(sectionKey, sectionConfig, targetElement) {
  if (sectionKey === 'funds') {
    await refreshFundsSectionSilently(targetElement);
    return;
  }
  if (sectionKey === 'timing') {
    await refreshTimingSectionSilently(targetElement);
    return;
  }
  if (sectionKey === 'gold-realtime' || sectionKey === 'gold-history') {
    await refreshPreciousMetalsSectionSilently(targetElement, sectionKey);
    return;
  }
  await refreshSimpleSectionSilently(sectionConfig, targetElement);
}

async function refreshCurrentSectionSilently(reason = 'manual') {
  if (refreshInFlight) {
    queuedRefreshReason = reason;
    return;
  }

  const elapsed = Date.now() - lastRefreshAt;
  if (elapsed < MIN_REFRESH_GAP) {
    return;
  }

  const sectionConfig = SECTION_META[currentSection] || SECTION_META[DEFAULT_SECTION];
  const contentElement = document.getElementById(`${sectionConfig.tabId}Content`);
  if (!contentElement) {
    return;
  }

  refreshInFlight = true;
  try {
    await refreshSectionContentSilently(currentSection, sectionConfig, contentElement);
    lastRefreshAt = Date.now();
    updateLastUpdateTime();
  } catch (error) {
    console.error(`静默刷新失败(${reason}):`, error);
  } finally {
    refreshInFlight = false;
    if (queuedRefreshReason) {
      const nextReason = queuedRefreshReason;
      queuedRefreshReason = '';
      await refreshCurrentSectionSilently(nextReason);
    }
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

  const contentHeader = document.querySelector('.content-header');
  if (contentHeader) {
    contentHeader.style.display = sectionConfig.showHeader ? 'flex' : 'none';
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
  lastRefreshAt = Date.now();
  scheduleRealtimeRefresh(false);
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

  initFloatingRefreshButton();
  initSidebarToggle();
  initTopNavMotion();
  bindSidebarActions();
  bindChartRangeControls();
  await navigateToSection(currentSection || DEFAULT_SECTION, true);

  window.addEventListener('popstate', async () => {
    const targetSection = getInitialSectionFromUrl();
    await navigateToSection(targetSection, false);
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      clearRealtimeRefreshTimer();
      return;
    }

    const interval = getSectionRefreshInterval(currentSection || DEFAULT_SECTION);
    const staleFor = Date.now() - lastRefreshAt;
    if (staleFor >= Math.min(interval, 12_000)) {
      await refreshCurrentSectionSilently('visibility');
    }
    scheduleRealtimeRefresh(false);
  });

  window.lanfundRefreshCurrentSection = async function lanfundRefreshCurrentSection(options = {}) {
    const forceFull = Boolean(options?.forceFull);
    if (forceFull) {
      await navigateToSection(currentSection || DEFAULT_SECTION, true);
      return;
    }
    await refreshCurrentSectionSilently(options?.reason || 'external');
    scheduleRealtimeRefresh(false);
  };

  window.lanfundGetCurrentRefreshInterval = function lanfundGetCurrentRefreshInterval() {
    return getSectionRefreshInterval(currentSection || DEFAULT_SECTION);
  };
});
