import os

os.makedirs("cache", exist_ok=True)

import importlib
import json
from pathlib import Path

import urllib3
from dotenv import load_dotenv
from flask import Flask, request, redirect, jsonify, \
    send_file, send_from_directory
from loguru import logger

import fund
from src.database import Database
from src.module_html import (
    enhance_fund_tab_content,
)

# 加载环境变量
load_dotenv()

urllib3.disable_warnings()
urllib3.util.ssl_.DEFAULT_CIPHERS = ":".join(
    [
        "ECDHE+AESGCM",
        "ECDHE+CHACHA20",
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        "RSA+AESGCM",
        'AES128-SHA',
        'AES256-SHA',
    ]
)

app = Flask(__name__)
app.secret_key = "luobobo"
db = Database()  # 初始化数据库

LOCAL_USER_ID = int(os.getenv("LANFUND_LOCAL_USER_ID", "1"))
LOCAL_USERNAME = os.getenv("LANFUND_LOCAL_USERNAME", "").strip() or None
FRONTEND_DIST_DIR = Path(__file__).resolve().parent / "frontend" / "dist"


def get_current_user_id():
    """无登录模式下的固定用户ID"""
    return LOCAL_USER_ID


def get_current_username():
    """无登录模式下可选的展示用户名"""
    return LOCAL_USERNAME


@app.route('/api/health', methods=['GET'])
def api_health():
    """后端健康检查"""
    return jsonify({'success': True, 'service': 'fund-backend'})


@app.route('/app/', defaults={'path': ''})
@app.route('/app', defaults={'path': ''})
@app.route('/app/<path:path>')
def serve_frontend(path):
    """生产环境下托管前端构建产物"""
    if not FRONTEND_DIST_DIR.exists():
        return jsonify({
            'success': False,
            'message': 'frontend/dist 不存在，请先在 frontend 目录执行 npm run build'
        }), 404

    if path:
        file_path = FRONTEND_DIST_DIR / path
        if file_path.exists() and file_path.is_file():
            return send_from_directory(str(FRONTEND_DIST_DIR), path)

    return send_from_directory(str(FRONTEND_DIST_DIR), 'index.html')


@app.route('/fund/sector', methods=['GET'])
def get_sector_funds():
    """获取指定板块的基金列表"""
    bk_id = request.args.get("bk_id")
    importlib.reload(fund)
    my_fund = fund.LanFund(db=db)
    return my_fund.select_fund_html(bk_id=bk_id)


# API endpoints for fund operations
@app.route('/api/fund/add', methods=['POST'])
def api_fund_add():
    """添加基金"""
    try:
        data = request.json
        codes = data.get('codes', '')
        if not codes:
            return {'success': False, 'message': '请提供基金代码'}
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        my_fund.add_code(codes)
        return {'success': True, 'message': f'已添加基金: {codes}'}
    except Exception as e:
        logger.error(f"添加基金失败: {e}")
        return {'success': False, 'message': f'添加失败: {str(e)}'}


@app.route('/api/fund/delete', methods=['POST'])
def api_fund_delete():
    """删除基金"""
    try:
        data = request.json
        codes = data.get('codes', '')
        if not codes:
            return {'success': False, 'message': '请提供基金代码'}
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        my_fund.delete_code(codes)
        return {'success': True, 'message': f'已删除基金: {codes}'}
    except Exception as e:
        logger.error(f"删除基金失败: {e}")
        return {'success': False, 'message': f'删除失败: {str(e)}'}


@app.route('/api/fund/hold', methods=['POST'])
def api_fund_hold():
    """设置/取消持有标记"""
    try:
        data = request.json
        codes = data.get('codes', '')
        hold = data.get('hold', True)
        if not codes:
            return {'success': False, 'message': '请提供基金代码'}
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        code_list = [c.strip() for c in codes.split(',')]
        for code in code_list:
            if code in my_fund.CACHE_MAP:
                my_fund.CACHE_MAP[code]['is_hold'] = hold
        my_fund.save_cache()
        action = '标记持有' if hold else '取消持有'
        return {'success': True, 'message': f'已{action}: {codes}'}
    except Exception as e:
        logger.error(f"设置持有标记失败: {e}")
        return {'success': False, 'message': f'操作失败: {str(e)}'}
@app.route('/api/fund/sector', methods=['POST'])
def api_fund_sector():
    """设置板块标记"""
    try:
        data = request.json
        codes = data.get('codes', '')
        sectors = data.get('sectors', [])
        if not codes:
            return {'success': False, 'message': '请提供基金代码'}
        if not sectors:
            return {'success': False, 'message': '请选择板块'}
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        code_list = [c.strip() for c in codes.split(',')]
        # 使用Web专用方法
        my_fund.mark_fund_sector_web(code_list, sectors)
        return {'success': True, 'message': f'已标注板块: {codes} -> {", ".join(sectors)}'}
    except Exception as e:
        logger.error(f"标注板块失败: {e}")
        return {'success': False, 'message': f'操作失败: {str(e)}'}
@app.route('/api/fund/sector/remove', methods=['POST'])
def api_fund_sector_remove():
    """删除板块标记"""
    try:
        data = request.json
        codes = data.get('codes', '')
        if not codes:
            return {'success': False, 'message': '请提供基金代码'}
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        code_list = [c.strip() for c in codes.split(',')]
        # 使用Web专用方法
        my_fund.unmark_fund_sector_web(code_list)
        return {'success': True, 'message': f'已删除板块标记: {codes}'}
    except Exception as e:
        logger.error(f"删除板块标记失败: {e}")
        return {'success': False, 'message': f'操作失败: {str(e)}'}
# ==================== File Upload/Download ====================
@app.route('/api/fund/upload', methods=['POST'])
def api_fund_upload():
    """上传fund_map.json文件"""
    try:
        if 'file' not in request.files:
            return {'success': False, 'message': '未找到上传文件'}
        file = request.files['file']
        if file.filename == '':
            return {'success': False, 'message': '未选择文件'}
        if not file.filename.endswith('.json'):
            return {'success': False, 'message': '只支持JSON文件'}
        # 读取并解析JSON
        content = file.read().decode('gbk')  # 使用GBK编码
        fund_map = json.loads(content)
        # 验证数据格式
        if not isinstance(fund_map, dict):
            return {'success': False, 'message': '文件格式错误：应为JSON对象'}
        for code, fund_data in fund_map.items():
            if not isinstance(fund_data, dict):
                return {'success': False, 'message': f'基金{code}数据格式错误'}
            if 'fund_key' not in fund_data or 'fund_name' not in fund_data:
                return {'success': False, 'message': f'基金{code}缺少必要字段'}
        # 保存到数据库
        user_id = get_current_user_id()
        success = db.save_user_funds(user_id, fund_map)
        if success:
            return {'success': True, 'message': f'成功导入{len(fund_map)}个基金'}
        else:
            return {'success': False, 'message': '保存失败'}
    except json.JSONDecodeError:
        return {'success': False, 'message': 'JSON格式错误'}
    except Exception as e:
        logger.error(f"上传文件失败: {e}")
        return {'success': False, 'message': f'上传失败: {str(e)}'}
@app.route('/api/fund/download', methods=['GET'])
def api_fund_download():
    """下载fund_map.json文件"""
    try:
        user_id = get_current_user_id()
        fund_map = db.get_user_funds(user_id)
        # 生成JSON文件
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', encoding='gbk', suffix='.json', delete=False) as f:
            json.dump(fund_map, f, ensure_ascii=False, indent=4)
            temp_path = f.name
        return send_file(
            temp_path,
            as_attachment=True,
            download_name='fund_map.json',
            mimetype='application/json'
        )
    except Exception as e:
        logger.error(f"下载文件失败: {e}")
        return {'success': False, 'message': f'下载失败: {str(e)}'}
# ==================== Shares Management ====================
@app.route('/api/fund/shares', methods=['POST'])
def api_fund_shares():
    """更新基金持仓份额"""
    try:
        data = request.json
        code = data.get('code', '').strip()
        shares = data.get('shares', 0)
        if not code:
            return {'success': False, 'message': '请提供基金代码'}
        try:
            shares = float(shares)
            if shares < 0:
                return {'success': False, 'message': '份额不能为负数'}
        except (ValueError, TypeError):
            return {'success': False, 'message': '份额格式错误'}
        user_id = get_current_user_id()
        success = db.update_fund_shares(user_id, code, shares)
        if success:
            # 如果份额>0，自动标记为持有
            if shares > 0:
                fund_map = db.get_user_funds(user_id)
                if code in fund_map:
                    fund_map[code]['is_hold'] = True
                    fund_map[code]['shares'] = shares
                    db.save_user_funds(user_id, fund_map)
            return {'success': True, 'message': f'已更新份额: {shares}'}
        else:
            return {'success': False, 'message': '更新失败，基金不存在'}
    except Exception as e:
        logger.error(f"更新份额失败: {e}")
        return {'success': False, 'message': f'更新失败: {str(e)}'}
@app.route('/api/fund/data', methods=['GET'])
def api_fund_data():
    """获取用户的基金数据（用于前端加载份额等信息）"""
    try:
        user_id = get_current_user_id()
        fund_map = db.get_user_funds(user_id)
        return jsonify(fund_map)
    except Exception as e:
        logger.error(f"获取基金数据失败: {e}")
        return jsonify({'error': str(e)}), 500
@app.route('/api/client/fund/config', methods=['POST'])
def api_client_fund_config():
    """客户端配置同步接口（无登录模式）"""
    try:
        data = request.json or {}
        action = data.get('action', 'get')
        user_id = get_current_user_id()
        if action == 'get':
            # 获取用户配置
            fund_map = db.get_user_funds(user_id)
            return jsonify({'success': True, 'fund_map': fund_map})
        elif action == 'push':
            # 推送配置到服务器
            fund_map = data.get('fund_map')
            if not isinstance(fund_map, dict):
                return jsonify({'success': False, 'message': '配置格式错误'}), 400
            if db.save_user_funds(user_id, fund_map):
                return jsonify({'success': True, 'message': '配置已同步'})
            else:
                return jsonify({'success': False, 'message': '保存失败'}), 500
        return jsonify({'success': False, 'message': '无效的操作类型'}), 400
    except Exception as e:
        logger.error(f"客户端配置同步失败: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
@app.route('/api/tab/<tab_id>', methods=['GET'])
def api_get_tab_data(tab_id):
    """按需加载单个tab的数据"""
    try:
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        # 定义tab ID到函数的映射
        tab_functions = {
            'kx': my_fund.kx_html,
            'marker': my_fund.marker_html,
            'real_time_gold': my_fund.real_time_gold_html,
            'gold': my_fund.gold_html,
            'seven_A': my_fund.seven_A_html,
            'A': my_fund.A_html,
            'fund': my_fund.fund_html,
            'bk': my_fund.bk_html,
            'select_fund': my_fund.select_fund_html,
        }
        if tab_id not in tab_functions:
            return jsonify({'success': False, 'message': f'未知的tab ID: {tab_id}'}), 404
        # 获取数据
        content = tab_functions[tab_id]()
        # 如果是fund tab，需要增强内容（传递份额数据）
        if tab_id == 'fund':
            user_id = get_current_user_id()
            fund_map = db.get_user_funds(user_id)
            shares_map = {code: data.get('shares', 0) for code, data in fund_map.items()}
            content = enhance_fund_tab_content(content, shares_map)
        return jsonify({'success': True, 'content': content})
    except Exception as e:
        logger.error(f"加载tab {tab_id} 数据失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
# ==================== New API Endpoints for Auto-Refresh ====================
@app.route('/api/timing', methods=['GET'])
def api_timing_data():
    """获取上证分时数据"""
    try:
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        # 使用现有的 get_timing_chart_data 方法
        data = my_fund.get_timing_chart_data()
        # 添加当前价格和涨跌幅信息（使用原始数据中的正确涨跌幅）
        if data['prices']:
            data['current_price'] = data['prices'][-1]
            data['change'] = data['change_amounts'][-1] if data.get('change_amounts') else 0
            data['change_pct'] = data['change_pcts'][-1] if data.get('change_pcts') else 0
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"获取上证分时数据失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/news/7x24', methods=['GET'])
def api_news_7x24():
    """获取7*24快讯"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取快讯数据
        result = my_fund.kx(True)
        # 将数据转换为JSON格式
        # kx() 返回的是 list of dicts，需要正确提取字段
        news_items = []
        if result:
            for item in result:
                try:
                    # 提取标题和内容
                    title = item.get('title', '')
                    if not title and 'content' in item and 'items' in item['content']:
                        content_items = item['content'].get('items', [])
                        if content_items and len(content_items) > 0:
                            title = content_items[0].get('data', '')
                    # 提取发布时间
                    publish_time = item.get('publish_time', '')
                    if publish_time:
                        # 转换时间戳为可读格式
                        import datetime
                        try:
                            publish_time = datetime.datetime.fromtimestamp(int(publish_time)).strftime("%H:%M:%S")
                        except:
                            publish_time = ''
                    # 提取评估（利好/利空）
                    evaluate = item.get('evaluate', '')
                    news_items.append({
                        'time': publish_time,
                        'content': title,
                        'source': evaluate if evaluate else ''
                    })
                except Exception as e:
                    logger.debug(f"Error processing news item: {e}")
                    continue
        return jsonify({'success': True, 'data': news_items})
    except Exception as e:
        logger.error(f"获取7*24快讯失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/indices/global', methods=['GET'])
def api_indices_global():
    """获取全球指数数据"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取全球指数数据 - 使用正确的方法名
        result = my_fund.get_market_info(True)
        # 将数据转换为JSON格式
        # result 格式: [[名称, 指数, 涨跌幅], ...]
        indices = []
        if result:
            for item in result:
                if len(item) >= 3:
                    # 清理涨跌幅中的颜色代码和%符号
                    change_str = item[2] if item[2] else "0%"
                    change_str = change_str.replace('%', '').replace('\033[1;31m', '').replace('\033[1;32m', '')
                    change = float(change_str) if change_str else 0
                    indices.append({
                        'name': item[0],
                        'value': item[1],
                        'change': change_str + '%',
                        'change_pct': change
                    })
        return jsonify({'success': True, 'data': indices})
    except Exception as e:
        logger.error(f"获取全球指数失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/indices/volume', methods=['GET'])
def api_indices_volume():
    """获取成交量趋势数据"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 使用现有的 get_volume_chart_data 方法
        data = my_fund.get_volume_chart_data()
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(f"获取成交量趋势失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/gold/real-time', methods=['GET'])
def api_gold_realtime():
    """获取实时贵金属价格"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取实时金价数据
        # real_time_gold 返回 [[...], [...], [...]] 三个贵金属的数据
        # 每个数组有10列: [名称, 最新价, 涨跌额, 涨跌幅, 开盘价, 最高价, 最低价, 昨收价, 更新时间, 单位]
        result = my_fund.real_time_gold(True)
        # 将数据转换为JSON格式，保留所有10列
        gold_data = []
        gold_names = ['中国黄金', '周大福', '周生生']  # 根据API代码 JO_71, JO_92233, JO_92232
        if result and len(result) >= 3:
            # result[0], result[1], result[2] 分别是三种贵金属的数据
            for i, gold_type_data in enumerate(result):
                if len(gold_type_data) >= 4:  # 至少需要前4列
                    gold_data.append({
                        'name': gold_type_data[0] if gold_type_data else gold_names[i],
                        'price': gold_type_data[1] if len(gold_type_data) > 1 else '',
                        'change_amount': gold_type_data[2] if len(gold_type_data) > 2 else '',
                        'change_pct': gold_type_data[3] if len(gold_type_data) > 3 else '',
                        'open_price': gold_type_data[4] if len(gold_type_data) > 4 else '',
                        'high_price': gold_type_data[5] if len(gold_type_data) > 5 else '',
                        'low_price': gold_type_data[6] if len(gold_type_data) > 6 else '',
                        'prev_close': gold_type_data[7] if len(gold_type_data) > 7 else '',
                        'update_time': gold_type_data[8] if len(gold_type_data) > 8 else '',
                        'unit': gold_type_data[9] if len(gold_type_data) > 9 else ''
                    })
        return jsonify({'success': True, 'data': gold_data})
    except Exception as e:
        logger.error(f"获取实时金价失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/gold/history', methods=['GET'])
def api_gold_history():
    """获取历史金价数据"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取历史金价数据 (gold 是静态方法，返回 raw data)
        result = my_fund.gold(True)
        # gold 返回格式: [[日期, 中国黄金基础金价, 周大福金价, 中国黄金基础金价涨跌, 周大福金价涨跌], ...]
        gold_history = []
        if result:
            for item in result:
                if len(item) >= 3:
                    gold_history.append({
                        'date': item[0],
                        'china_gold_price': item[1],
                        'chow_tai_fook_price': item[2],
                        'china_gold_change': item[3] if len(item) > 3 else '',
                        'chow_tai_fook_change': item[4] if len(item) > 4 else ''
                    })
        return jsonify({'success': True, 'data': gold_history})
    except Exception as e:
        logger.error(f"获取历史金价失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/gold/one-day', methods=['GET'])
def api_gold_one_day():
    """获取分时黄金价格数据"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取分时黄金数据 (one_day_gold 是静态方法，返回 raw data)
        result = my_fund.one_day_gold()
        # one_day_gold 返回格式: [{"date": "2024-01-01 09:30:00", "price": 123.45}, ...]
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        logger.error(f"获取分时黄金数据失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/sectors', methods=['GET'])
def api_sectors():
    """获取行业板块数据"""
    try:
        importlib.reload(fund)
        # 获取板块数据 (bk 是静态方法，返回 raw data)
        # 需要从API获取板块代码
        import requests
        url = "https://push2.eastmoney.com/api/qt/clist/get"
        params = {
            "cb": "",
            "fid": "f62",
            "po": "1",
            "pz": "100",
            "pn": "1",
            "np": "1",
            "fltt": "2",
            "invt": "2",
            "ut": "8dec03ba335b81bf4ebdf7b29ec27d15",
            "fs": "m:90 t:2",
            "fields": "f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124,f1,f13"
        }
        response = requests.get(url, params=params, timeout=10, verify=False)
        if str(response.json()["data"]):
            data = response.json()["data"]
            sectors = []
            for bk in data["diff"]:
                sectors.append({
                    'code': bk["f12"],  # 板块代码
                    'name': bk["f14"],  # 板块名称
                    'change': str(bk["f3"]) + "%",  # 涨跌幅
                    'main_inflow': str(round(bk["f62"] / 100000000, 2)) + "亿",  # 主力净流入
                    'main_inflow_pct': str(round(bk["f184"], 2)) + "%",  # 主力净流入占比
                    'small_inflow': str(round(bk["f84"] / 100000000, 2)) + "亿",  # 小单净流入
                    'small_inflow_pct': str(round(bk["f87"], 2)) + "%"  # 小单流入占比
                })
            # 按涨跌幅降序排序（与原始 bk() 函数的排序逻辑一致）
            sectors = sorted(
                sectors,
                key=lambda x: float(x['change'].replace("%", "")) if x['main_inflow_pct'] != "N/A" else -99,
                reverse=True
            )
        else:
            sectors = []
        return jsonify({'success': True, 'data': sectors})
    except Exception as e:
        logger.error(f"获取行业板块失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/fund/list', methods=['GET'])
def api_fund_list():
    """获取基金列表（含份额数据）"""
    try:
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        # 获取用户基金数据
        fund_map = db.get_user_funds(user_id)
        # 将数据转换为JSON格式
        funds = []
        for code, data in fund_map.items():
            fund_info = my_fund.CACHE_MAP.get(code, {})
            funds.append({
                'code': code,
                'name': data.get('fund_name', fund_info.get('name', '')),
                'shares': data.get('shares', 0),
                'is_hold': data.get('is_hold', False),
                'sectors': data.get('sectors', []),
                'net_value': fund_info.get('net_value', 0),
                'day_growth': fund_info.get('day_growth', 0),
                'estimated_growth': fund_info.get('estimated_growth', 0)
            })
        return jsonify({'success': True, 'data': funds})
    except Exception as e:
        logger.error(f"获取基金列表失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/api/sector/<sector_id>', methods=['GET'])
def api_sector_funds(sector_id):
    """获取指定板块的基金列表"""
    try:
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=get_current_user_id(), db=db)
        # 获取板块基金数据
        result = my_fund.select_fund(bk_id=sector_id, is_return=True)
        # 将数据转换为JSON格式
        funds = []
        if result:
            for item in result:
                if len(item) >= 5:
                    funds.append({
                        'code': item[0],
                        'name': item[1],
                        'net_value': item[2],
                        'day_growth': item[3],
                        'estimated_growth': item[4] if len(item) > 4 else ''
                    })
        return jsonify({'success': True, 'data': funds})
    except Exception as e:
        logger.error(f"获取板块基金失败: {e}")
        return jsonify({'success': False, 'message': f'数据加载失败: {str(e)}'}), 500
@app.route('/', methods=['GET'])
def get_index():
    # 统一使用现代前端入口
    return redirect('/app?section=funds')
@app.route('/fund', methods=['GET'])
def get_fund():
    # 保留旧路由兼容，转发到统一前端入口
    return redirect('/app?section=funds')
@app.route('/market', methods=['GET'])
def get_market():
    return redirect('/app?section=news')
@app.route('/precious-metals', methods=['GET'])
def get_precious_metals():
    return redirect('/app?section=gold-realtime')
@app.route('/market-indices', methods=['GET'])
def get_market_indices():
    return redirect('/app?section=indices')
@app.route('/portfolio', methods=['GET'])
def get_portfolio():
    """兼容旧路由并转发到统一前端入口"""
    add = request.args.get("add")
    delete = request.args.get("delete")

    # 兼容历史 URL 参数能力
    if add:
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        my_fund.add_code(add)
    if delete:
        user_id = get_current_user_id()
        importlib.reload(fund)
        my_fund = fund.LanFund(user_id=user_id, db=db)
        my_fund.delete_code(delete)
    return redirect('/app?section=funds')
@app.route('/api/fund/chart-data')
def api_fund_chart_data():
    """获取基金估值趋势图数据"""
    fund_code = request.args.get('code')
    if not fund_code:
        return jsonify({'error': 'Missing fund code'}), 400
    user_id = get_current_user_id()
    user_funds = db.get_user_funds(user_id)
    if fund_code not in user_funds:
        return jsonify({'error': 'Fund not in user list'}), 400
    fund_data = {
        'fund_key': user_funds[fund_code]['fund_key'],
        'fund_name': user_funds[fund_code]['fund_name']
    }
    importlib.reload(fund)
    my_fund = fund.LanFund(user_id=user_id, db=db)
    chart_data = my_fund.get_fund_chart_data(fund_code, fund_data)
    return jsonify({
        'chart_data': chart_data,
        'fund_info': {
            'code': fund_code,
            'name': fund_data['fund_name']
        }
    })
@app.route('/api/fund/chart-default', methods=['POST'])
def api_fund_chart_default():
    """设置估值趋势图默认基金"""
    data = request.json
    fund_code = data.get('fund_code')
    if not fund_code:
        return jsonify({'error': 'Missing fund code'}), 400
    user_id = get_current_user_id()
    user_funds = db.get_user_funds(user_id)
    if fund_code not in user_funds:
        return jsonify({'error': 'Fund not in user list'}), 400
    db.update_chart_default(user_id, fund_code)
    return jsonify({'success': True})
@app.route('/sectors', methods=['GET'])
def get_sectors():
    return redirect('/app?section=sectors')


if __name__ == '__main__':
    port = int(os.getenv('LANFUND_PORT', '8311'))
    debug = os.getenv('LANFUND_DEBUG', '1').lower() in ('1', 'true', 'yes')
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=debug)
