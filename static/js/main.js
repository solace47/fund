// Polyfill process for React libraries
window.process = {
    env: {
        NODE_ENV: 'production'
    }
};

document.addEventListener('DOMContentLoaded', function () {
    // Initialize Auto Colorize
    autoColorize();

    // Legacy Sidebar Toggle (id="sidebar")
    // Used by /market, /market-indices, /precious-metals, /sectors pages
    // Note: /portfolio/ uses sidebarNav with sidebar-nav.js instead
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    if (sidebar && sidebarToggle && sidebar.id === 'sidebar') {
        sidebarToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.classList.toggle('collapsed');
            // Update toggle button direction
            const isCollapsed = sidebar.classList.contains('collapsed');
            sidebarToggle.textContent = isCollapsed ? '▶' : '◀';
            sidebarToggle.title = isCollapsed ? '展开' : '折叠';
        });
    }

    // Mobile Hamburger Menu for Legacy Sidebar
    const hamburger = document.getElementById('hamburgerMenu');
    const mobileSidebar = document.getElementById('sidebar');
    let sidebarOverlay = document.getElementById('sidebarOverlay');

    // Only initialize if hamburger menu exists (mobile support)
    if (hamburger && mobileSidebar) {
        // Create overlay if not exists
        if (!sidebarOverlay) {
            sidebarOverlay = document.createElement('div');
            sidebarOverlay.id = 'sidebarOverlay';
            sidebarOverlay.className = 'sidebar-overlay';
            document.body.appendChild(sidebarOverlay);
        }

        // Toggle sidebar
        hamburger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const isActive = mobileSidebar.classList.contains('mobile-active');

            if (isActive) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });

        // Close sidebar when clicking overlay
        sidebarOverlay.addEventListener('click', closeMobileSidebar);

        // Close sidebar when window is resized to desktop
        window.addEventListener('resize', function () {
            if (window.innerWidth > 768) {
                closeMobileSidebar();
            }
        });

        // Close sidebar when clicking navigation links
        const sidebarLinks = mobileSidebar.querySelectorAll('.sidebar-item');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', closeMobileSidebar);
        });

        function openMobileSidebar() {
            mobileSidebar.classList.add('mobile-active');
            hamburger.classList.add('active');
            sidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        function closeMobileSidebar() {
            mobileSidebar.classList.remove('mobile-active');
            hamburger.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }
});

function autoColorize() {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
        const cells = document.querySelectorAll('.style-table td');
        cells.forEach(cell => {
            // Clear existing color classes first
            cell.classList.remove('positive', 'negative');

            const text = cell.textContent.trim();

            // Skip empty cells or non-data cells
            if (!text || text === '-' || text === 'N/A' || text === '---') {
                return;
            }

            // Handle "利好" (bullish/positive) and "利空" (bearish/negative) for news
            if (text === '利好') {
                cell.classList.add('positive');
                return;
            } else if (text === '利空') {
                cell.classList.add('negative');
                return;
            }

            // Check for percentage format (including cases like +0.15% or -0.15%)
            if (text.includes('%')) {
                // Special handling for "X/Y Z%" format (近30天列) - extract the last percentage
                let cleanText;
                if (text.includes('/') && text.includes(' ')) {
                    // Format like "10/21 -1.14%" - extract the percentage part after space
                    const parts = text.split(' ');
                    const percentPart = parts[parts.length - 1]; // Get last part
                    cleanText = percentPart.replace(/[%,亿万手]/g, '');
                } else {
                    cleanText = text.replace(/[%,亿万手]/g, '');
                }
                const val = parseFloat(cleanText);

                if (!isNaN(val)) {
                    if (val < 0 || text.includes('-')) {
                        cell.classList.add('negative');  // Green for negative
                    } else if (val > 0 || text.includes('+')) {
                        cell.classList.add('positive');   // Red for positive
                    }
                    // val === 0 gets no color (neutral)
                }
            }
            // Check for values starting with + or - (not percentages)
            else if (text.startsWith('+')) {
                cell.classList.add('positive');
            } else if (text.startsWith('-')) {
                cell.classList.add('negative');
            }
        });
    });
}

function sortTable(table, columnIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentSortCol = table.dataset.sortCol;
    const currentSortDir = table.dataset.sortDir || 'asc';
    let direction = 'asc';

    if (currentSortCol == columnIndex) {
        direction = currentSortDir === 'asc' ? 'desc' : 'asc';
    }
    table.dataset.sortCol = columnIndex;
    table.dataset.sortDir = direction;

    rows.sort((a, b) => {
        const aText = a.cells[columnIndex].textContent.trim();
        const bText = b.cells[columnIndex].textContent.trim();
        const valA = parseValue(aText);
        const valB = parseValue(bText);
        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        return direction === 'asc' ? comparison : -comparison;
    });

    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));

    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    const headerToUpdate = table.querySelectorAll('th')[columnIndex];
    if (headerToUpdate) {
        headerToUpdate.classList.add(direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
}

function parseValue(val) {
    if (val === 'N/A' || val === '--' || val === '---' || val === '') {
        return -Infinity;
    }
    const cleanedVal = val.replace(/[%亿万元\/克手]/g, '').replace(/[¥,]/g, '');
    const num = parseFloat(cleanedVal);
    return isNaN(num) ? val.toLowerCase() : num;
}

function openTab(evt, tabId) {
    // Hide all tab contents
    const allContents = document.querySelectorAll('.tab-content');
    allContents.forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tab buttons
    const allButtons = document.querySelectorAll('.tab-button');
    allButtons.forEach(button => {
        button.classList.remove('active');
    });

    // Show the clicked tab's content and add active class to the button
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

// Fund Operations Functions
// 板块分类数据
const SECTOR_CATEGORIES = {
    "科技": ["人工智能", "半导体", "云计算", "5G", "光模块", "CPO", "F5G", "通信设备", "PCB", "消费电子",
        "计算机", "软件开发", "信创", "网络安全", "IT服务", "国产软件", "计算机设备", "光通信",
        "算力", "脑机接口", "通信", "电子", "光学光电子", "元件", "存储芯片", "第三代半导体",
        "光刻胶", "电子化学品", "LED", "毫米波", "智能穿戴", "东数西算", "数据要素", "国资云",
        "Web3.0", "AIGC", "AI应用", "AI手机", "AI眼镜", "DeepSeek", "TMT", "科技"],
    "医药健康": ["医药生物", "医疗器械", "生物疫苗", "CRO", "创新药", "精准医疗", "医疗服务", "中药",
        "化学制药", "生物制品", "基因测序", "超级真菌"],
    "消费": ["食品饮料", "白酒", "家用电器", "纺织服饰", "商贸零售", "新零售", "家居用品", "文娱用品",
        "婴童", "养老产业", "体育", "教育", "在线教育", "社会服务", "轻工制造", "新消费",
        "可选消费", "消费", "家电零部件", "智能家居"],
    "金融": ["银行", "证券", "保险", "非银金融", "国有大型银行", "股份制银行", "城商行", "金融"],
    "能源": ["新能源", "煤炭", "石油石化", "电力", "绿色电力", "氢能源", "储能", "锂电池", "电池",
        "光伏设备", "风电设备", "充电桩", "固态电池", "能源", "煤炭开采", "公用事业", "锂矿"],
    "工业制造": ["机械设备", "汽车", "新能源车", "工程机械", "高端装备", "电力设备", "专用设备",
        "通用设备", "自动化设备", "机器人", "人形机器人", "汽车零部件", "汽车服务",
        "汽车热管理", "尾气治理", "特斯拉", "无人驾驶", "智能驾驶", "电网设备", "电机",
        "高端制造", "工业4.0", "工业互联", "低空经济", "通用航空"],
    "材料": ["有色金属", "黄金股", "贵金属", "基础化工", "钢铁", "建筑材料", "稀土永磁", "小金属",
        "工业金属", "材料", "大宗商品", "资源"],
    "军工": ["国防军工", "航天装备", "航空装备", "航海装备", "军工电子", "军民融合", "商业航天",
        "卫星互联网", "航母", "航空机场"],
    "基建地产": ["建筑装饰", "房地产", "房地产开发", "房地产服务", "交通运输", "物流"],
    "环保": ["环保", "环保设备", "环境治理", "垃圾分类", "碳中和", "可控核聚变", "液冷"],
    "传媒": ["传媒", "游戏", "影视", "元宇宙", "超清视频", "数字孪生"],
    "主题": ["国企改革", "一带一路", "中特估", "中字头", "并购重组", "华为", "新兴产业",
        "国家安防", "安全主题", "农牧主题", "农林牧渔", "养殖业", "猪肉", "高端装备"]
};

// 基金选择模态框相关变量
let currentOperation = null;
let selectedFundsForOperation = [];
let allFunds = [];
let currentFilteredFunds = []; // 当前过滤后的基金列表

// 打开基金选择模态框
async function openFundSelectionModal(operation) {
    currentOperation = operation;
    selectedFundsForOperation = [];

    // 设置标题
    const titles = {
        'hold': '选择要标记持有的基金',
        'unhold': '选择要取消持有的基金',
        'sector': '选择要标注板块的基金',
        'unsector': '选择要删除板块的基金',
        'delete': '选择要删除的基金'
    };
    document.getElementById('fundSelectionTitle').textContent = titles[operation] || '选择基金';

    // 获取所有基金列表
    try {
        const response = await fetch('/api/fund/data');
        const fundMap = await response.json();
        allFunds = Object.entries(fundMap).map(([code, data]) => ({
            code,
            name: data.fund_name,
            is_hold: data.is_hold,
            sectors: data.sectors || []
        }));

        // 根据操作类型过滤基金列表
        let filteredFunds = allFunds;
        switch (operation) {
            case 'hold':
                // 标记持有：只显示未持有的基金
                filteredFunds = allFunds.filter(fund => !fund.is_hold);
                break;
            case 'unhold':
                // 取消持有：只显示已持有的基金
                filteredFunds = allFunds.filter(fund => fund.is_hold);
                break;
            case 'unsector':
                // 删除板块：只显示有板块标记的基金
                filteredFunds = allFunds.filter(fund => fund.sectors && fund.sectors.length > 0);
                break;
            case 'sector':
            case 'delete':
            default:
                // 标注板块、删除基金：显示所有基金
                filteredFunds = allFunds;
                break;
        }

        // 保存当前过滤后的列表，供搜索使用
        currentFilteredFunds = filteredFunds;

        // 渲染基金列表
        renderFundSelectionList(filteredFunds);

        // 显示模态框
        document.getElementById('fundSelectionModal').classList.add('active');
    } catch (e) {
        alert('获取基金列表失败: ' + e.message);
    }
}

// 渲染基金选择列表
function renderFundSelectionList(funds) {
    const listContainer = document.getElementById('fundSelectionList');
    listContainer.innerHTML = funds.map(fund => `
            <div class="sector-item" style="text-align: left; padding: 12px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px;"
                 onclick="toggleFundSelection('${fund.code}', this)">
                <input type="checkbox" class="fund-selection-checkbox" data-code="${fund.code}"
                       style="width: 18px; height: 18px; cursor: pointer;" onclick="event.stopPropagation(); toggleFundSelectionByCheckbox('${fund.code}', this)">
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${fund.code} - ${fund.name}</div>
                    ${fund.is_hold ? '<span style="color: #667eea; font-size: 12px;">持有</span>' : ''}
                    ${fund.sectors && fund.sectors.length > 0 ? `<span style="color: #8b949e; font-size: 12px;">板块: ${fund.sectors.join(', ')}</span>` : ''}
                </div>
            </div>
        `).join('');
}

// 切换基金选择状态（点击整个行）
function toggleFundSelection(code, element) {
    const checkbox = element.querySelector('.fund-selection-checkbox');
    checkbox.checked = !checkbox.checked;
    updateFundSelection(code, checkbox.checked, element);
}

// 切换基金选择状态（点击复选框）
function toggleFundSelectionByCheckbox(code, checkbox) {
    const element = checkbox.closest('.sector-item');
    updateFundSelection(code, checkbox.checked, element);
}

// 更新基金选择状态
function updateFundSelection(code, checked, element) {
    if (checked) {
        if (!selectedFundsForOperation.includes(code)) {
            selectedFundsForOperation.push(code);
        }
        element.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
    } else {
        selectedFundsForOperation = selectedFundsForOperation.filter(c => c !== code);
        element.style.backgroundColor = '';
    }
}

// 关闭基金选择模态框
function closeFundSelectionModal() {
    document.getElementById('fundSelectionModal').classList.remove('active');
    currentOperation = null;
    selectedFundsForOperation = [];
}

// 确认基金选择
async function confirmFundSelection() {
    if (selectedFundsForOperation.length === 0) {
        alert('请至少选择一个基金');
        return;
    }

    // 根据操作类型执行相应的操作
    switch (currentOperation) {
        case 'hold':
            await markHold(selectedFundsForOperation);
            break;
        case 'unhold':
            await unmarkHold(selectedFundsForOperation);
            break;
        case 'sector':
            const selectedCodes = selectedFundsForOperation; // 先保存选中的基金代码
            closeFundSelectionModal();
            openSectorModal(selectedCodes);
            return; // 不关闭，等待板块选择
        case 'unsector':
            await removeSector(selectedFundsForOperation);
            break;
        case 'delete':
            await deleteFunds(selectedFundsForOperation);
            break;
    }

    closeFundSelectionModal();
}

// 基金选择搜索
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('fundSelectionSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const keyword = this.value.toLowerCase();
            // 在当前过滤后的列表中搜索，而不是在所有基金中搜索
            const filtered = currentFilteredFunds.filter(fund =>
                fund.code.includes(keyword) || fund.name.toLowerCase().includes(keyword)
            );
            renderFundSelectionList(filtered);
        });
    }
});

// 确认对话框相关函数
let confirmCallback = null;

function showConfirmDialog(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDialog').classList.add('active');
    confirmCallback = onConfirm;
}

function closeConfirmDialog() {
    document.getElementById('confirmDialog').classList.remove('active');
    confirmCallback = null;
}

// 确认对话框按钮事件 - confirmBtn 只在 portfolio 页面存在
const confirmBtn = document.getElementById('confirmBtn');
if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
        if (confirmCallback) {
            confirmCallback();
        }
        closeConfirmDialog();
    });
}

// 添加基金
async function addFunds() {
    const input = document.getElementById('fundCodesInput');
    const codes = input.value.trim();
    if (!codes) {
        alert('请输入基金代码');
        return;
    }

    try {
        const response = await fetch('/api/fund/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes })
        });
        const result = await response.json();
        if (result.success) {
            alert(result.message);
            location.reload();
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}

// 删除基金
async function deleteFunds(codes) {
    showConfirmDialog(
        '删除基金',
        `确定要删除 ${codes.length} 只基金吗？`,
        async () => {
            try {
                const response = await fetch('/api/fund/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codes: codes.join(',') })
                });
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert(result.message);
                }
            } catch (e) {
                alert('操作失败: ' + e.message);
            }
        }
    );
}

// 标记持有
async function markHold(codes) {
    showConfirmDialog(
        '标记持有',
        `确定要标记 ${codes.length} 只基金为持有吗？`,
        async () => {
            try {
                const response = await fetch('/api/fund/hold', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codes: codes.join(','), hold: true })
                });
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert(result.message);
                }
            } catch (e) {
                alert('操作失败: ' + e.message);
            }
        }
    );
}

// 取消持有
async function unmarkHold(codes) {
    showConfirmDialog(
        '取消持有',
        `确定要取消 ${codes.length} 只基金的持有标记吗？`,
        async () => {
            try {
                const response = await fetch('/api/fund/hold', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codes: codes.join(','), hold: false })
                });
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert(result.message);
                }
            } catch (e) {
                alert('操作失败: ' + e.message);
            }
        }
    );
}

// 打开板块选择模态框（用于标注板块）
let selectedCodesForSector = [];

function openSectorModal(codes) {
    selectedCodesForSector = codes;
    document.getElementById('sectorModal').classList.add('active');
    renderSectorCategories();
}

// 删除板块标记
async function removeSector(codes) {
    showConfirmDialog(
        '删除板块标记',
        `确定要删除 ${codes.length} 只基金的板块标记吗？`,
        async () => {
            try {
                const response = await fetch('/api/fund/sector/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ codes: codes.join(',') })
                });
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert(result.message);
                }
            } catch (e) {
                alert('操作失败: ' + e.message);
            }
        }
    );
}

// 板块选择相关
let selectedSectors = [];

function renderSectorCategories() {
    // 生成板块分类HTML
    const container = document.getElementById('sectorCategories');
    container.innerHTML = '';

    for (const [category, sectors] of Object.entries(SECTOR_CATEGORIES)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'sector-category';

        const header = document.createElement('div');
        header.className = 'sector-category-header';
        header.innerHTML = `<span>${category}</span><span>▼</span>`;
        header.onclick = () => {
            const items = categoryDiv.querySelector('.sector-items');
            items.style.display = items.style.display === 'none' ? 'grid' : 'none';
        };

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'sector-items';

        sectors.forEach(sector => {
            const item = document.createElement('div');
            item.className = 'sector-item';
            item.textContent = sector;
            item.onclick = () => {
                item.classList.toggle('selected');
                if (item.classList.contains('selected')) {
                    if (!selectedSectors.includes(sector)) {
                        selectedSectors.push(sector);
                    }
                } else {
                    selectedSectors = selectedSectors.filter(s => s !== sector);
                }
            };
            itemsDiv.appendChild(item);
        });

        categoryDiv.appendChild(header);
        categoryDiv.appendChild(itemsDiv);
        container.appendChild(categoryDiv);
    }

    selectedSectors = [];
    document.getElementById('sectorModal').classList.add('active');
}

function closeSectorModal() {
    document.getElementById('sectorModal').classList.remove('active');
    selectedSectors = [];
}

async function confirmSector() {
    if (selectedCodesForSector.length === 0) {
        alert('请先选择基金');
        closeSectorModal();
        return;
    }
    if (selectedSectors.length === 0) {
        alert('请至少选择一个板块');
        return;
    }

    try {
        const response = await fetch('/api/fund/sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: selectedCodesForSector.join(','), sectors: selectedSectors })
        });
        const result = await response.json();
        closeSectorModal();
        if (result.success) {
            alert(result.message);
            location.reload();
        } else {
            alert(result.message);
        }
    } catch (e) {
        closeSectorModal();
        alert('操作失败: ' + e.message);
    }
}

// 板块搜索功能
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('sectorSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const keyword = this.value.toLowerCase();
            const categories = document.querySelectorAll('.sector-category');

            categories.forEach(category => {
                const items = category.querySelectorAll('.sector-item');
                let hasVisible = false;

                items.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    if (text.includes(keyword)) {
                        item.style.display = 'block';
                        hasVisible = true;
                    } else {
                        item.style.display = 'none';
                    }
                });

                category.style.display = hasVisible || keyword === '' ? 'block' : 'none';
            });
        });
    }

    // ==================== 新增功能：份额管理和文件操作 ====================

    // 更新基金份额
    window.updateShares = async function (fundCode, shares) {
        if (!fundCode) {
            alert('基金代码无效');
            return;
        }

        try {
            const sharesValue = parseFloat(shares) || 0;
            const response = await fetch('/api/fund/shares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: fundCode, shares: sharesValue })
            });
            const result = await response.json();
            if (result.success) {
                // 更新成功后重新计算持仓统计
                calculatePositionSummary();
                // 可选：显示成功提示
                const input = document.getElementById('shares_' + fundCode);
                if (input) {
                    input.style.borderColor = '#4CAF50';
                    setTimeout(() => {
                        input.style.borderColor = '#ddd';
                    }, 1000);
                }
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert('更新份额失败: ' + e.message);
        }
    };

    // 下载fund_map.json
    window.downloadFundMap = function () {
        window.location.href = '/api/fund/download';
    };

    // 上传fund_map.json
    window.uploadFundMap = async function (file) {
        if (!file) {
            alert('请选择文件');
            return;
        }

        if (!file.name.endsWith('.json')) {
            alert('只支持JSON文件');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/fund/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            if (result.success) {
                alert(result.message);
                location.reload();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert('上传失败: ' + e.message);
        }
    };

    // 计算并显示持仓统计
    function calculatePositionSummary() {
        let totalValue = 0;
        let estimatedGain = 0;
        let actualGain = 0;
        let settledValue = 0;
        const today = new Date().toISOString().split('T')[0];

        // 存储每个基金的详细涨跌信息
        const fundDetailsData = [];

        // 遍历所有基金行
        const fundRows = document.querySelectorAll('.style-table tbody tr');
        fundRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return;

            // 获取基金代码（第一列）
            const codeCell = cells[0];
            const fundCode = codeCell.textContent.trim();

            // 从全局数据获取份额
            const shares = (window.fundSharesData && window.fundSharesData[fundCode]) || 0;
            if (shares <= 0) return;

            try {
                // 获取基金名称（第二列，索引1），使用 innerHTML 保留 HTML 标签（如板块标签样式）
                const fundName = cells[1].innerHTML.trim();

                // 解析净值 "1.234(2025-02-02)" (第三列，索引2)
                const netValueText = cells[2].textContent.trim();
                const netValueMatch = netValueText.match(/([0-9.]+)\(([0-9-]+)\)/);
                if (!netValueMatch) return;

                const netValue = parseFloat(netValueMatch[1]);
                let netValueDate = netValueMatch[2];

                // 处理净值日期格式：API可能返回"MM-DD"或"YYYY-MM-DD"
                // 如果是"MM-DD"格式，添加当前年份
                if (netValueDate.length === 5) {  // 格式为"MM-DD"
                    const currentYear = new Date().getFullYear();
                    netValueDate = `${currentYear}-${netValueDate}`;
                }

                // 解析估值增长率 (第四列，索引3)
                const estimatedGrowthText = cells[3].textContent.trim();
                const estimatedGrowth = estimatedGrowthText !== 'N/A' ?
                    parseFloat(estimatedGrowthText.replace('%', '')) : 0;

                // 解析日涨幅 (第五列，索引4)
                const dayGrowthText = cells[4].textContent.trim();
                const dayGrowth = dayGrowthText !== 'N/A' ?
                    parseFloat(dayGrowthText.replace('%', '')) : 0;

                // 计算持仓市值
                const positionValue = shares * netValue;
                totalValue += positionValue;

                // 计算预估涨跌（始终计算）
                const fundEstimatedGain = positionValue * estimatedGrowth / 100;
                estimatedGain += fundEstimatedGain;

                // 计算实际涨跌
                // 逻辑：只有当净值日期是今天时（今日净值已更新），才计算实际涨跌
                let fundActualGain = 0;
                if (netValueDate === today) {
                    // 今日净值已更新，计算实际收益
                    fundActualGain = positionValue * dayGrowth / 100;
                    actualGain += fundActualGain;
                    settledValue += positionValue;
                }

                // 获取板块数据
                const sectors = window.fundSectorsData && window.fundSectorsData[fundCode] ? window.fundSectorsData[fundCode] : [];

                // 收集每个基金的详细涨跌信息
                fundDetailsData.push({
                    code: fundCode,
                    name: fundName,
                    shares: shares,
                    positionValue: positionValue,
                    estimatedGain: fundEstimatedGain,
                    estimatedGainPct: estimatedGrowth,
                    actualGain: fundActualGain,
                    actualGainPct: netValueDate === today ? dayGrowth : 0,
                    sectors: sectors
                });
            } catch (e) {
                console.warn('解析基金数据失败:', fundCode, e);
            }
        });

        // 保存基金明细数据到全局变量，供炫耀卡片使用
        window.fundDetailsData = fundDetailsData;

        // 隐藏旧版持仓统计区域（已迁移到顶部summary bar）
        const summaryDiv = document.getElementById('positionSummary');
        if (summaryDiv) {
            summaryDiv.style.display = 'none';
        }

        // 更新持仓基金页面的汇总数据 (始终执行)
        // 更新总持仓金额
        const totalValueEl = document.getElementById('totalValue');
        if (totalValueEl) {
            totalValueEl.className = 'sensitive-value';
            const realValueSpan = totalValueEl.querySelector('.real-value');
            if (realValueSpan) {
                realValueSpan.textContent = totalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        }

        // 更新今日预估
        const estimatedGainEl = document.getElementById('estimatedGain');
        const estimatedGainPctEl = document.getElementById('estimatedGainPct');
        if (estimatedGainEl && estimatedGainPctEl) {
            const estGainPct = totalValue > 0 ? (estimatedGain / totalValue * 100) : 0;
            const estSign = estimatedGain >= 0 ? '+' : '';
            const sensitiveSpan = estimatedGainEl.querySelector('.sensitive-value');
            if (sensitiveSpan) {
                sensitiveSpan.className = estimatedGain >= 0 ? 'sensitive-value positive' : 'sensitive-value negative';
            }
            const realValueSpan = estimatedGainEl.querySelector('.real-value');
            if (realValueSpan) {
                realValueSpan.textContent = `${estSign}${Math.abs(estimatedGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            estimatedGainPctEl.textContent = ` (${estSign}${estGainPct.toFixed(2)}%)`;
            estimatedGainPctEl.style.color = estimatedGain >= 0 ? '#f44336' : '#4caf50';
        }

        // 更新今日实际（只有当有基金净值更新至今日时才显示数值）
        const actualGainEl = document.getElementById('actualGain');
        const actualGainPctEl = document.getElementById('actualGainPct');
        if (actualGainEl && actualGainPctEl) {
            if (settledValue > 0) {
                const actGainPct = (actualGain / settledValue * 100);
                const actSign = actualGain >= 0 ? '+' : '';
                const sensitiveSpan = actualGainEl.querySelector('.sensitive-value');
                if (sensitiveSpan) {
                    sensitiveSpan.className = actualGain >= 0 ? 'sensitive-value positive' : 'sensitive-value negative';
                }
                const realValueSpan = actualGainEl.querySelector('.real-value');
                if (realValueSpan) {
                    realValueSpan.textContent = `${actSign}${Math.abs(actualGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
                actualGainPctEl.textContent = ` (${actSign}${actGainPct.toFixed(2)}%)`;
                actualGainPctEl.style.color = actualGain >= 0 ? '#f44336' : '#4caf50';
            } else {
                const sensitiveSpan = actualGainEl.querySelector('.sensitive-value');
                if (sensitiveSpan) {
                    sensitiveSpan.className = 'sensitive-value';
                }
                const realValueSpan = actualGainEl.querySelector('.real-value');
                if (realValueSpan) {
                    realValueSpan.textContent = '净值未更新';
                }
                actualGainPctEl.textContent = '';
            }
        }

        // 更新持仓数量
        const holdCountEl = document.getElementById('holdCount');
        if (holdCountEl) {
            // 从全局数据计算持仓数量
            let heldCount = 0;
            if (window.fundSharesData) {
                for (const code in window.fundSharesData) {
                    if (window.fundSharesData[code] > 0) {
                        heldCount++;
                    }
                }
            }
            holdCountEl.textContent = heldCount + ' 只';
        }

        // 填充分基金明细表格
        const fundDetailsDiv = document.getElementById('fundDetailsSummary');
        if (fundDetailsDiv && fundDetailsData.length > 0) {
            fundDetailsDiv.style.display = 'block';
            const tableBody = document.getElementById('fundDetailsTableBody');
            if (tableBody) {
                tableBody.innerHTML = fundDetailsData.map(fund => {
                    const estColor = fund.estimatedGain >= 0 ? '#f44336' : '#4caf50';
                    const actColor = fund.actualGain >= 0 ? '#f44336' : '#4caf50';
                    const estSign = fund.estimatedGain >= 0 ? '+' : '-';
                    const actSign = fund.actualGain >= 0 ? '+' : '-';
                    // 基金名称中已包含板块标签，不再重复添加
                    return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 10px; text-align: center; vertical-align: middle; color: var(--accent); font-weight: 500;">${fund.code}</td>
                                <td style="padding: 10px; text-align: center; vertical-align: middle; color: var(--text-main); white-space: nowrap; min-width: 120px;">${fund.name}</td>
                                <td class="sensitive-value" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono);"><span class="real-value">${fund.shares.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="hidden-value">****</span></td>
                                <td class="sensitive-value" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono); font-weight: 600;"><span class="real-value">${fund.positionValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="hidden-value">****</span></td>
                                <td class="sensitive-value ${estColor === '#f44336' ? 'positive' : 'negative'}" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono); color: ${estColor}; font-weight: 500;"><span class="real-value">${estSign}${Math.abs(fund.estimatedGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="hidden-value">****</span></td>
                                <td class="${estColor === '#f44336' ? 'positive' : 'negative'}" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono); color: ${estColor}; font-weight: 500;">${estSign}${fund.estimatedGainPct.toFixed(2)}%</td>
                                <td class="sensitive-value ${actColor === '#f44336' ? 'positive' : 'negative'}" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono); color: ${actColor}; font-weight: 500;"><span class="real-value">${actSign}${Math.abs(fund.actualGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span class="hidden-value">****</span></td>
                                <td class="${actColor === '#f44336' ? 'positive' : 'negative'}" style="padding: 10px; text-align: center; vertical-align: middle; font-family: var(--font-mono); color: ${actColor}; font-weight: 500;">${actSign}${fund.actualGainPct.toFixed(2)}%</td>
                            </tr>
                        `;
                }).join('');
            }
        } else if (fundDetailsDiv) {
            fundDetailsDiv.style.display = 'none';
        }

        // Update new summary bar if it exists (sidebar layout)
        const summaryBar = document.getElementById('summaryBar');
        if (summaryBar) {
            // Count held funds from global data
            let heldCount = 0;
            if (window.fundSharesData) {
                for (const code in window.fundSharesData) {
                    if (window.fundSharesData[code] > 0) {
                        heldCount++;
                    }
                }
            }

            // Update total value
            const summaryTotalValue = document.getElementById('summaryTotalValue');
            if (summaryTotalValue) {
                summaryTotalValue.textContent = totalValue.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }



            // Update estimated gain
            const summaryEstGain = document.getElementById('summaryEstGain');
            if (summaryEstGain) {
                const estSign = estimatedGain >= 0 ? '+' : '-';
                summaryEstGain.textContent = `${estSign}${Math.abs(estimatedGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                summaryEstGain.style.color = estimatedGain >= 0 ? '#f44336' : '#4caf50';
            }

            // Update estimated change
            const summaryEstChange = document.getElementById('summaryEstChange');
            if (summaryEstChange) {
                const estGainPct = totalValue > 0 ? (estimatedGain / totalValue * 100) : 0;
                const estSign = estimatedGain >= 0 ? '+' : '';
                summaryEstChange.textContent = `${estSign}${estGainPct.toFixed(2)}%`;
                summaryEstChange.className = 'summary-change ' + (estimatedGain >= 0 ? 'positive' : 'negative');
            }

            // Update actual gain
            const summaryActualGain = document.getElementById('summaryActualGain');
            if (summaryActualGain) {
                const actSign = actualGain >= 0 ? '+' : '-';
                summaryActualGain.textContent = `${actSign}${Math.abs(actualGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                summaryActualGain.style.color = actualGain >= 0 ? '#f44336' : '#4caf50';
            }

            // Update actual change
            const summaryActualChange = document.getElementById('summaryActualChange');
            if (summaryActualChange) {
                if (settledValue > 0) {
                    const actGainPct = (actualGain / settledValue * 100);
                    const actSign = actualGain >= 0 ? '+' : '';
                    summaryActualChange.textContent = `${actSign}${actGainPct.toFixed(2)}%`;
                    summaryActualChange.className = 'summary-change ' + (actualGain >= 0 ? 'positive' : 'negative');
                } else {
                    summaryActualChange.textContent = '0.00%';
                    summaryActualChange.className = 'summary-change neutral';
                }
            }

            // Update 今日实际涨跌 (new summary card)
            const summaryRealGain = document.getElementById('summaryRealGain');
            if (summaryRealGain) {
                if (settledValue > 0) {
                    const actSign = actualGain >= 0 ? '+' : '-';
                    summaryRealGain.textContent = `${actSign}${Math.abs(actualGain).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    summaryRealGain.style.color = actualGain >= 0 ? '#f44336' : '#4caf50';
                } else {
                    summaryRealGain.textContent = '净值未更新';
                    summaryRealGain.style.color = '';
                }
            }

            const summaryRealChange = document.getElementById('summaryRealChange');
            if (summaryRealChange) {
                if (settledValue > 0) {
                    const actGainPct = (actualGain / settledValue * 100);
                    const actSign = actualGain >= 0 ? '+' : '';
                    summaryRealChange.textContent = `${actSign}${actGainPct.toFixed(2)}%`;
                    summaryRealChange.className = 'summary-change ' + (actualGain >= 0 ? 'positive' : 'negative');
                } else {
                    summaryRealChange.textContent = '--';
                    summaryRealChange.className = 'summary-change neutral';
                }
            }

            // Update hold count
            const summaryHoldCount = document.getElementById('summaryHoldCount');
            if (summaryHoldCount) {
                summaryHoldCount.textContent = `${heldCount} 只`;
            }
        }
    }

    // 页面加载时加载份额数据并计算持仓统计
    async function loadSharesData() {
        try {
            // 从后端API获取用户的基金数据（包含份额）
            const response = await fetch('/api/fund/data');
            if (response.ok) {
                const fundData = await response.json();

                // 初始化全局份额数据存储
                window.fundSharesData = {};
                window.fundSectorsData = {};  // 存储板块数据

                // 填充份额数据到全局存储
                for (const [code, data] of Object.entries(fundData)) {
                    if (data.shares !== undefined && data.shares !== null) {
                        window.fundSharesData[code] = parseFloat(data.shares) || 0;
                    }
                    // 存储板块数据
                    if (data.sectors && data.sectors.length > 0) {
                        window.fundSectorsData[code] = data.sectors;
                    }

                    // 如果有份额输入框，也填充（旧版页面兼容）
                    const sharesInput = document.getElementById('shares_' + code);
                    if (sharesInput && data.shares) {
                        sharesInput.value = data.shares;
                    }
                }

                console.log('已加载份额数据:', window.fundSharesData);

                // 计算持仓统计
                calculatePositionSummary();
            }
        } catch (e) {
            console.error('加载份额数据失败:', e);
            // 即使加载失败，也尝试计算持仓统计
            calculatePositionSummary();
        }
    }

    // 初始化
    loadSharesData();
    window.reloadFundSharesData = loadSharesData;
    window.recalculatePositionSummary = calculatePositionSummary;

    // 展开/收起基金行详情
    window.toggleFundExpand = function (fundCode) {
        const fundRow = document.querySelector(`.fund-row[data-code="${fundCode}"]`);
        if (fundRow) {
            fundRow.classList.toggle('expanded');
        }
    };

    // 全局暴露其他必要的函数
    window.openFundSelectionModal = openFundSelectionModal;
    window.closeFundSelectionModal = closeFundSelectionModal;
    window.confirmFundSelection = confirmFundSelection;
    window.downloadFundMap = downloadFundMap;
    window.uploadFundMap = uploadFundMap;
    window.addFunds = addFunds;
    window.markHold = markHold;
    window.unmarkHold = unmarkHold;
    window.deleteFunds = deleteFunds;
    window.openSectorModal = openSectorModal;
    window.closeSectorModal = closeSectorModal;
    window.confirmSector = confirmSector;
    window.removeSector = removeSector;

    // ==================== Holding Modal Functions ====================

    // 当前正在编辑持仓的基金代码
    let currentSharesFundCode = null;
    let currentModalNetValue = null;
    let isSyncingHoldingInputs = false;
    let holdingInputMode = 'amount';

    function roundToTwo(value) {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    function normalizeHeaderText(text) {
        return String(text || '').replace(/\s+/g, '').replace(/[↑↓↕⇅]/g, '');
    }

    function getFundTableColumnMap() {
        const map = {};
        const table = document.querySelector('.style-table');
        if (!table) return map;
        const headers = table.querySelectorAll('thead th');
        headers.forEach((th, idx) => {
            const key = normalizeHeaderText(th.textContent);
            if (key) map[key] = idx;
        });
        return map;
    }

    function getFundRowByCode(fundCode) {
        const button = document.getElementById('sharesBtn_' + fundCode);
        if (button) {
            const row = button.closest('tr');
            if (row) return row;
        }

        const columnMap = getFundTableColumnMap();
        const codeIdx = columnMap['基金代码'];
        const rows = document.querySelectorAll('.style-table tbody tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            let rowCode = '';
            if (typeof codeIdx === 'number' && cells[codeIdx]) {
                rowCode = cells[codeIdx].textContent.trim();
            }
            if (!rowCode) {
                const fallbackCodeMatch = row.textContent.match(/\b\d{6}\b/);
                rowCode = fallbackCodeMatch ? fallbackCodeMatch[0] : '';
            }
            if (rowCode === fundCode) {
                return row;
            }
        }
        return null;
    }

    function parseFundSnapshot(fundCode) {
        const snapshot = {
            netValue: null,
            netValueDate: '--',
            dayGrowth: null
        };

        const row = getFundRowByCode(fundCode);
        if (!row) return snapshot;

        const columnMap = getFundTableColumnMap();
        const cells = row.querySelectorAll('td');
        const netValueIdx = columnMap['净值'];
        const dayGrowthIdx = columnMap['日涨幅'];

        if (typeof netValueIdx === 'number' && cells[netValueIdx]) {
            const netValueText = cells[netValueIdx].textContent.trim();
            const match = netValueText.match(/([0-9.]+)\(([0-9-]+)\)/);
            if (match) {
                snapshot.netValue = parseFloat(match[1]);
                snapshot.netValueDate = match[2];
            }
        } else {
            for (const cell of cells) {
                const text = cell.textContent.trim();
                const match = text.match(/([0-9.]+)\(([0-9-]+)\)/);
                if (match) {
                    snapshot.netValue = parseFloat(match[1]);
                    snapshot.netValueDate = match[2];
                    break;
                }
            }
        }

        if (typeof dayGrowthIdx === 'number' && cells[dayGrowthIdx]) {
            const dayGrowthText = cells[dayGrowthIdx].textContent.trim();
            if (dayGrowthText !== 'N/A') {
                const parsed = parseFloat(dayGrowthText.replace('%', ''));
                snapshot.dayGrowth = Number.isNaN(parsed) ? null : parsed;
            }
        }

        return snapshot;
    }

    function formatNetValueDate(dateText) {
        if (!dateText || dateText === '--') return '--';
        if (dateText.length === 5) return dateText;
        if (dateText.length === 10) return dateText.slice(5);
        return dateText;
    }

    function getHoldingMetaStorageKey(fundCode) {
        return `lanfund:holding-meta:${fundCode}`;
    }

    function loadHoldingMeta(fundCode) {
        try {
            const raw = localStorage.getItem(getHoldingMetaStorageKey(fundCode));
            if (!raw) return { profit: '', days: '' };
            const parsed = JSON.parse(raw);
            return {
                profit: parsed && parsed.profit !== undefined ? String(parsed.profit) : '',
                days: parsed && parsed.days !== undefined ? String(parsed.days) : ''
            };
        } catch (e) {
            return { profit: '', days: '' };
        }
    }

    function saveHoldingMeta(fundCode, profit, days) {
        try {
            localStorage.setItem(getHoldingMetaStorageKey(fundCode), JSON.stringify({ profit, days }));
        } catch (e) {
            console.warn('保存持仓附加信息失败:', e);
        }
    }

    function applyHoldingInputMode() {
        const amountInput = document.getElementById('sharesModalAmountInput');
        const sharesInput = document.getElementById('sharesModalInput');
        const modeBtn = document.getElementById('sharesModalModeBtn');
        if (!amountInput || !sharesInput || !modeBtn) return;

        const hasNetValue = currentModalNetValue && currentModalNetValue > 0;
        if (!hasNetValue) {
            holdingInputMode = 'shares';
        }

        const isAmountMode = holdingInputMode === 'amount' && hasNetValue;
        amountInput.readOnly = !isAmountMode;
        amountInput.style.opacity = isAmountMode ? '1' : '0.7';
        sharesInput.readOnly = isAmountMode;
        sharesInput.style.opacity = isAmountMode ? '0.7' : '1';
        modeBtn.textContent = isAmountMode ? '转换为份额输入' : '转换为金额输入';
        modeBtn.disabled = !hasNetValue;
    }

    function updateHoldingDerivedValues(sourceField) {
        const amountInput = document.getElementById('sharesModalAmountInput');
        const sharesInput = document.getElementById('sharesModalInput');
        const preview = document.getElementById('sharesModalSharesPreview');

        if (!amountInput || !sharesInput || !preview || isSyncingHoldingInputs) return;

        const hasNetValue = currentModalNetValue && currentModalNetValue > 0;
        isSyncingHoldingInputs = true;

        let amount = parseFloat(amountInput.value);
        let shares = parseFloat(sharesInput.value);

        if (sourceField === 'amount' && hasNetValue) {
            shares = Number.isNaN(amount) ? 0 : roundToTwo(amount / currentModalNetValue);
            sharesInput.value = shares > 0 ? shares.toFixed(2) : '';
        } else if (sourceField === 'shares' && hasNetValue) {
            amount = Number.isNaN(shares) ? 0 : roundToTwo(shares * currentModalNetValue);
            amountInput.value = amount > 0 ? amount.toFixed(2) : '';
        } else if (sourceField === 'init' && hasNetValue) {
            if (!Number.isNaN(shares) && shares > 0) {
                amount = roundToTwo(shares * currentModalNetValue);
                amountInput.value = amount.toFixed(2);
            } else if (!Number.isNaN(amount) && amount > 0) {
                shares = roundToTwo(amount / currentModalNetValue);
                sharesInput.value = shares.toFixed(2);
            }
        }

        const finalShares = parseFloat(sharesInput.value) || 0;
        const finalAmount = parseFloat(amountInput.value) || 0;
        if (hasNetValue) {
            preview.textContent =
                `换算份额：${finalShares.toFixed(2)} 份 | 当前持仓市值：${finalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            preview.textContent = `换算份额：${finalShares.toFixed(2)} 份 | 净值不可用，暂无法按金额换算`;
        }

        isSyncingHoldingInputs = false;
    }

    function bindHoldingModalInputs() {
        const amountInput = document.getElementById('sharesModalAmountInput');
        const sharesInput = document.getElementById('sharesModalInput');

        if (amountInput && !amountInput.dataset.bound) {
            amountInput.addEventListener('input', () => updateHoldingDerivedValues('amount'));
            amountInput.dataset.bound = '1';
        }
        if (sharesInput && !sharesInput.dataset.bound) {
            sharesInput.addEventListener('input', () => updateHoldingDerivedValues('shares'));
            sharesInput.dataset.bound = '1';
        }
    }

    function bindHoldingModalClose() {
        const modal = document.getElementById('sharesModal');
        if (modal && !modal.dataset.closeBound) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal && typeof window.closeSharesModal === 'function') {
                    window.closeSharesModal();
                }
            });
            modal.dataset.closeBound = '1';
        }
    }

    function ensureHoldingModalExists() {
        const requiredIds = [
            'sharesModalNetInfo',
            'sharesModalModeBtn',
            'sharesModalAmountInput',
            'sharesModalInput',
            'sharesModalProfitInput',
            'sharesModalDaysInput',
            'sharesModalSharesPreview'
        ];

        const modalContent = `
                <div class="sector-modal-content" style="max-width: 460px;">
                    <div class="sector-modal-header">修改持仓</div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 8px; color: var(--text-main); font-weight: 500;">最新净值（日期）</label>
                            <div id="sharesModalNetInfo" style="padding: 10px; background: rgba(30, 41, 59, 0.45); border-radius: 6px; color: var(--text-main);">--</div>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                            <button id="sharesModalModeBtn" class="btn btn-secondary" onclick="toggleHoldingInputMode()">转换为份额输入</button>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label for="sharesModalAmountInput" style="display: block; margin-bottom: 8px; color: var(--text-main); font-weight: 500;">持有金额</label>
                            <input type="number" id="sharesModalAmountInput" step="0.01" min="0" placeholder="请输入持有金额"
                                   style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--card-bg); color: var(--text-main);">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label for="sharesModalInput" style="display: block; margin-bottom: 8px; color: var(--text-main); font-weight: 500;">持仓份额</label>
                            <input type="number" id="sharesModalInput" step="0.01" min="0" placeholder="请输入持仓份额"
                                   style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--card-bg); color: var(--text-main);">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label for="sharesModalProfitInput" style="display: block; margin-bottom: 8px; color: var(--text-main); font-weight: 500;">持有收益</label>
                            <input type="number" id="sharesModalProfitInput" step="0.01" placeholder="请输入持有收益"
                                   style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--card-bg); color: var(--text-main);">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label for="sharesModalDaysInput" style="display: block; margin-bottom: 8px; color: var(--text-main); font-weight: 500;">持有天数</label>
                            <input type="number" id="sharesModalDaysInput" step="1" min="0" placeholder="请输入持有天数"
                                   style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background: var(--card-bg); color: var(--text-main);">
                        </div>
                        <div id="sharesModalSharesPreview" style="padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; color: var(--text-main); font-size: 13px;">
                            换算份额：0.00 份 | 当前持仓市值：0.00
                        </div>
                        <div style="margin-top: 8px; font-size: 12px; color: var(--text-dim);">
                            说明：金额和份额会按当前净值双向换算，保存时以份额为准。
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 15px;">
                            <button class="btn btn-secondary" style="color: #ef4444; border-color: rgba(239,68,68,0.35);" onclick="openHoldingSyncAction('buy')">同步加仓</button>
                            <button class="btn btn-secondary" style="color: #10b981; border-color: rgba(16,185,129,0.35);" onclick="openHoldingSyncAction('sell')">同步减仓</button>
                            <button class="btn btn-secondary" style="color: #3b82f6; border-color: rgba(59,130,246,0.35);" onclick="openHoldingSyncAction('dca')">同步定投</button>
                            <button class="btn btn-secondary" style="color: #6366f1; border-color: rgba(99,102,241,0.35);" onclick="openHoldingSyncAction('convert')">同步转换</button>
                        </div>
                    </div>
                    <div class="sector-modal-footer">
                        <button class="btn btn-secondary" onclick="closeSharesModal()">取消</button>
                        <button class="btn btn-primary" onclick="confirmShares()">确定</button>
                    </div>
                </div>
            `;

        let modal = document.getElementById('sharesModal');
        const hasCompleteStructure = requiredIds.every((id) => document.getElementById(id));

        if (modal && !hasCompleteStructure) {
            modal.innerHTML = modalContent;
        }

        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'sector-modal';
            modal.id = 'sharesModal';
            modal.innerHTML = modalContent;
            document.body.appendChild(modal);
        }

        bindHoldingModalClose();
        bindHoldingModalInputs();
    }

    // 获取基金份额（从内存中）
    window.getFundShares = function (fundCode) {
        if (window.fundSharesData && window.fundSharesData[fundCode]) {
            return window.fundSharesData[fundCode];
        }
        return 0;
    };

    // 更新持仓按钮状态
    function updateSharesButton(fundCode, shares) {
        const button = document.getElementById('sharesBtn_' + fundCode);
        if (button) {
            button.textContent = '修改';
            if (shares > 0) {
                button.style.background = '#10b981';
            } else {
                button.style.background = '#3b82f6';
            }
        }
    }

    // 同步操作按钮占位
    window.openHoldingSyncAction = function (action) {
        const actionMap = {
            buy: '同步加仓',
            sell: '同步减仓',
            dca: '同步定投',
            convert: '同步转换'
        };
        const actionName = actionMap[action] || '同步操作';
        alert(`${actionName}功能保留中，后续将接入对应页面`);
    };

    window.toggleHoldingInputMode = function () {
        holdingInputMode = holdingInputMode === 'amount' ? 'shares' : 'amount';
        applyHoldingInputMode();
    };

    // 打开持仓设置弹窗
    window.openSharesModal = function (fundCode) {
        ensureHoldingModalExists();
        currentSharesFundCode = fundCode;
        const modal = document.getElementById('sharesModal');
        const header = modal ? modal.querySelector('.sector-modal-header') : null;
        const netInfo = document.getElementById('sharesModalNetInfo');
        const amountInput = document.getElementById('sharesModalAmountInput');
        const sharesInput = document.getElementById('sharesModalInput');
        const profitInput = document.getElementById('sharesModalProfitInput');
        const daysInput = document.getElementById('sharesModalDaysInput');

        if (!modal || !netInfo || !amountInput || !sharesInput || !profitInput || !daysInput) return;

        const sharesValue = window.getFundShares(fundCode) || 0;
        const snapshot = parseFundSnapshot(fundCode);
        const meta = loadHoldingMeta(fundCode);
        currentModalNetValue = snapshot.netValue && snapshot.netValue > 0 ? snapshot.netValue : null;

        sharesInput.value = sharesValue > 0 ? Number(sharesValue).toFixed(2) : '';
        amountInput.value = '';
        profitInput.value = meta.profit;
        daysInput.value = meta.days;
        holdingInputMode = 'amount';

        if (header) {
            header.textContent = '修改持仓';
        }

        if (currentModalNetValue) {
            const dateText = formatNetValueDate(snapshot.netValueDate);
            const growthValue = snapshot.dayGrowth;
            let growthText = '--';
            let growthColor = 'var(--text-dim)';
            if (growthValue !== null && !Number.isNaN(growthValue)) {
                growthText = `${growthValue >= 0 ? '+' : ''}${growthValue.toFixed(2)}%`;
                growthColor = growthValue >= 0 ? '#ef4444' : '#16a34a';
            }
            netInfo.innerHTML =
                `最新净值（${dateText}）：<span style="font-weight: 600;">${currentModalNetValue.toFixed(4)}</span> <span style="color: ${growthColor}; font-weight: 600;">${growthText}</span>`;
            amountInput.placeholder = '请输入持仓金额';
        } else {
            netInfo.textContent = '最新净值暂不可用';
            amountInput.placeholder = '净值不可用，暂无法按金额换算';
        }

        applyHoldingInputMode();
        updateHoldingDerivedValues('init');
        modal.classList.add('active');
        setTimeout(() => (holdingInputMode === 'amount' ? amountInput : sharesInput).focus(), 100);
    };

    // 关闭持仓设置弹窗
    window.closeSharesModal = function () {
        const modal = document.getElementById('sharesModal');
        if (modal) {
            modal.classList.remove('active');
        }
        currentSharesFundCode = null;
        currentModalNetValue = null;
    };

    // 确认设置持仓（保存份额）
    window.confirmShares = async function () {
        if (!currentSharesFundCode) {
            alert('未选择基金');
            return;
        }

        const sharesInput = document.getElementById('sharesModalInput');
        const amountInput = document.getElementById('sharesModalAmountInput');
        const profitInput = document.getElementById('sharesModalProfitInput');
        const daysInput = document.getElementById('sharesModalDaysInput');
        let shares = parseFloat(sharesInput ? sharesInput.value : '');
        const amount = parseFloat(amountInput ? amountInput.value : '');
        const profitRaw = profitInput ? profitInput.value.trim() : '';
        const daysRaw = daysInput ? daysInput.value.trim() : '';

        if (!Number.isNaN(amount) && amount === 0) {
            shares = 0;
        }
        if (Number.isNaN(shares)) {
            shares = 0;
        }
        shares = roundToTwo(shares);

        if (shares < 0) {
            alert('持仓份额不能为负数');
            return;
        }

        if (daysRaw) {
            const parsedDays = parseInt(daysRaw, 10);
            if (Number.isNaN(parsedDays) || parsedDays < 0) {
                alert('持有天数请输入大于等于 0 的整数');
                return;
            }
        }

        try {
            const response = await fetch('/api/fund/shares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: currentSharesFundCode, shares })
            });
            const result = await response.json();

            if (result.success) {
                if (!window.fundSharesData) {
                    window.fundSharesData = {};
                }
                window.fundSharesData[currentSharesFundCode] = shares;

                saveHoldingMeta(currentSharesFundCode, profitRaw, daysRaw);
                updateSharesButton(currentSharesFundCode, shares);
                calculatePositionSummary();
                window.closeSharesModal();

                alert(result.message);
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert('更新持仓失败: ' + e.message);
        }
    };

    // 全局暴露持仓相关函数
    window.openSharesModal = openSharesModal;
    window.closeSharesModal = closeSharesModal;
    window.confirmShares = confirmShares;
    window.getFundShares = getFundShares;
    window.openHoldingSyncAction = openHoldingSyncAction;

    ensureHoldingModalExists();

    // ==================== Auto-Refresh System ====================
    let refreshInterval;
    const REFRESH_INTERVAL = 60000; // 60 seconds

    // Start auto-refresh
    function startAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        refreshInterval = setInterval(() => {
            refreshCurrentPage();
        }, REFRESH_INTERVAL);
        console.log('Auto-refresh started (60s interval)');
    }

    // Stop auto-refresh
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
            console.log('Auto-refresh stopped');
        }
    }

    // Refresh current page data based on route
    async function refreshCurrentPage() {
        const path = window.location.pathname;
        const refreshBtn = document.getElementById('refreshBtn');

        // Update button state if exists
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '刷新中...';
        }

        try {
            switch (path) {
                case '/':
                case '/app':
                case '/app/':
                    if (typeof window.lanfundRefreshCurrentSection === 'function') {
                        await window.lanfundRefreshCurrentSection();
                    } else {
                        await fetchPortfolioData();
                    }
                    break;
                case '/portfolio':
                    await fetchPortfolioData();
                    break;
                case '/market-indices':
                    await fetchMarketIndicesData();
                    break;
                case '/precious-metals':
                    await fetchPreciousMetalsData();
                    break;
                case '/sectors':
                    await fetchSectorsData();
                    break;
                case '/market':
                    await fetchNewsData();
                    break;
                default:
                    console.log('No refresh handler for path:', path);
            }
        } catch (e) {
            console.error('Refresh failed:', e);
        } finally {
            // Restore button state
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '刷新';
            }
        }
    }

    // Portfolio page data fetch
    async function fetchPortfolioData() {
        try {
            // Fetch timing data
            const timingRes = await fetch('/api/timing');
            const timingResult = await timingRes.json();
            if (timingResult.success && timingResult.data) {
                updateTimingChart(timingResult.data);
            }

            // Auto-colorize will be called after table updates
            autoColorize();
        } catch (e) {
            console.error('Failed to refresh portfolio data:', e);
        }
    }

    // Market indices page data fetch
    async function fetchMarketIndicesData() {
        try {
            // Fetch global indices
            const indicesRes = await fetch('/api/indices/global');
            const indicesResult = await indicesRes.json();

            // Fetch volume data
            const volumeRes = await fetch('/api/indices/volume');
            const volumeResult = await volumeRes.json();

            if (indicesResult.success) {
                updateGlobalIndicesTable(indicesResult.data);
            }
            if (volumeResult.success) {
                updateVolumeChart(volumeResult.data);
            }

            autoColorize();
        } catch (e) {
            console.error('Failed to refresh market indices:', e);
        }
    }

    // Precious metals page data fetch
    async function fetchPreciousMetalsData() {
        try {
            // Fetch real-time gold prices
            const realtimeRes = await fetch('/api/gold/real-time');
            const realtimeResult = await realtimeRes.json();

            // Fetch gold one-day (timing) data
            const oneDayRes = await fetch('/api/gold/one-day');
            const oneDayResult = await oneDayRes.json();

            // Fetch gold history
            const historyRes = await fetch('/api/gold/history');
            const historyResult = await historyRes.json();

            if (realtimeResult.success) {
                updateRealtimeGoldTable(realtimeResult.data);
            }
            if (oneDayResult.success) {
                updateGoldOneDayChart(oneDayResult.data);
            }
            if (historyResult.success) {
                updateGoldHistoryTable(historyResult.data);
            }

            autoColorize();
        } catch (e) {
            console.error('Failed to refresh precious metals:', e);
        }
    }

    // Sectors page data fetch
    async function fetchSectorsData() {
        try {
            // Fetch sectors data
            const sectorsRes = await fetch('/api/sectors');
            const sectorsResult = await sectorsRes.json();

            if (sectorsResult.success) {
                updateSectorsTable(sectorsResult.data);
            }

            autoColorize();
        } catch (e) {
            console.error('Failed to refresh sectors:', e);
        }
    }

    // News page data fetch
    async function fetchNewsData() {
        try {
            const newsRes = await fetch('/api/news/7x24');
            const newsResult = await newsRes.json();

            if (newsResult.success) {
                updateNewsTable(newsResult.data);
            }

            autoColorize();
        } catch (e) {
            console.error('Failed to refresh news:', e);
        }
    }

    // Update functions (placeholders - to be implemented based on page structure)
    function updateTimingChart(data) {
        // Update timing chart if chart instance exists
        if (window.timingChartInstance && data.labels && data.labels.length > 0) {
            window.timingChartInstance.data.labels = data.labels;
            window.timingChartInstance.data.datasets[0].data = data.change_pcts || data.prices;
            window.timingChartInstance.update();

            // Update title
            const titleEl = document.getElementById('timingChartTitle');
            if (titleEl && data.current_price !== undefined) {
                const changePct = data.change_pct || 0;
                const color = changePct >= 0 ? '#f44336' : '#4caf50';
                titleEl.style.color = color;
                titleEl.innerHTML = '上证分时 <span style="font-size:0.9em;">' +
                    (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '% (' +
                    data.current_price.toFixed(2) + ')</span>';
            }
        }
    }

    function updateGlobalIndicesTable(data) {
        // Find and update the global indices table
        const table = document.querySelector('.style-table');
        if (table && data) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = data.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.value}</td>
                            <td>${item.change}</td>
                        </tr>
                    `).join('');
            }
        }
    }

    function updateVolumeChart(data) {
        // Update volume chart if exists
        if (window.volumeChartInstance && data.labels && data.labels.length > 0) {
            window.volumeChartInstance.data.labels = data.labels;
            window.volumeChartInstance.data.datasets[0].data = data.total || [];
            window.volumeChartInstance.update();
        }
    }

    function updateRealtimeGoldTable(data) {
        const table = document.querySelector('.style-table');
        if (table && data) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = data.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.price}</td>
                            <td>${item.change_amount}</td>
                            <td>${item.change_pct}</td>
                            <td>${item.open_price}</td>
                            <td>${item.high_price}</td>
                            <td>${item.low_price}</td>
                            <td>${item.prev_close}</td>
                            <td>${item.update_time}</td>
                            <td>${item.unit}</td>
                        </tr>
                    `).join('');
            }
        }
    }

    function updateGoldOneDayChart(data) {
        // Update gold one-day timing chart if exists
        if (!data || !Array.isArray(data) || data.length === 0) return;

        const labels = [];
        const prices = [];

        data.forEach(item => {
            if (item.date && item.price !== undefined) {
                // 只显示时间部分 (HH:MM:SS)
                const timePart = item.date.split(' ')[1] || item.date;
                labels.push(timePart);
                prices.push(parseFloat(item.price));
            }
        });

        // 获取最新价格和时间用于图例显示
        let labelText = '金价 (元/克)';
        if (data.length > 0) {
            const latestData = data[data.length - 1];
            const timePart = latestData.date.split(' ')[1] || latestData.date;
            labelText = `金价 (元/克)  最新: ¥${latestData.price}  ${timePart}`;
        }

        if (window.goldOneDayChartInstance) {
            // 更新现有图表
            window.goldOneDayChartInstance.data.labels = labels;
            window.goldOneDayChartInstance.data.datasets[0].data = prices;
            window.goldOneDayChartInstance.data.datasets[0].label = labelText;
            window.goldOneDayChartInstance.update();
        }
    }

    function updateGoldHistoryTable(data) {
        // Similar implementation for gold history table
        const tables = document.querySelectorAll('.style-table');
        if (tables.length > 1 && data) {
            const tbody = tables[1].querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = data.map(item => `
                        <tr>
                            <td>${item.date}</td>
                            <td>${item.china_gold_price}</td>
                            <td>${item.chow_tai_fook_price}</td>
                            <td>${item.china_gold_change}</td>
                            <td>${item.chow_tai_fook_change}</td>
                        </tr>
                    `).join('');
            }
        }
    }

    function updateSectorsTable(data) {
        const table = document.querySelector('.style-table');
        if (table && data) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = data.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.change}</td>
                            <td>${item.main_inflow}</td>
                            <td>${item.main_inflow_pct}</td>
                            <td>${item.small_inflow}</td>
                            <td>${item.small_inflow_pct}</td>
                        </tr>
                    `).join('');
            }
        }
    }

    function updateNewsTable(data) {
        const table = document.querySelector('.style-table');
        if (table && data) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = data.map(item => {
                    // 为利好/利空添加颜色类
                    let sourceClass = '';
                    if (item.source === '利好') {
                        sourceClass = 'positive';
                    } else if (item.source === '利空') {
                        sourceClass = 'negative';
                    }

                    return `
                        <tr>
                            <td>${item.time}</td>
                            <td class="${sourceClass}">${item.source}</td>
                            <td>${item.content}</td>
                        </tr>
                        `;
                }).join('');
            }
        }
    }

    // Page visibility detection - pause refresh when tab is hidden
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            // Immediate refresh when tab becomes visible
            refreshCurrentPage();
            startAutoRefresh();
        }
    });

    // Start auto-refresh on page load
    startAutoRefresh();

    // Expose refresh function globally for manual refresh button
    window.refreshCurrentPage = refreshCurrentPage;

});
