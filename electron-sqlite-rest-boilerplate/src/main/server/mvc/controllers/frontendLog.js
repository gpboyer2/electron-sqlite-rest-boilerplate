/**
 * 前端日志控制器
 * 日志通过 WebSocket 实时发送，此控制器仅处理查询
 */
const FrontendLogService = require('../services/frontendLog');

// 清理操作节流配置
const CLEAN_THROTTLE_DELAY = 5000; // 5秒
let last_clean_time = 0;
let is_cleaning = false;

class FrontendLogController {
  // 查询前端日志列表（清理操作节流，查询操作正常执行）
  // params: { current_page, page_size }
  static async query(req, res) {
    try {
      const { current_page = 1, page_size = 100 } = req.query;

      // 验证 current_page
      const current_page_num = parseInt(current_page);
      if (isNaN(current_page_num) || current_page_num < 1) {
        return res.apiError(null, '当前页码必须是大于0的正整数');
      }
      if (current_page_num > 100000) {
        return res.apiError(null, '当前页码超出有效范围');
      }

      // 验证 page_size
      const page_size_num = parseInt(page_size);
      if (isNaN(page_size_num) || page_size_num < 1) {
        return res.apiError(null, '每页数量必须是大于0的正整数');
      }
      if (page_size_num > 1000) {
        return res.apiError(null, '每页数量不能超过1000条');
      }

      // 清理操作节流：5秒内只执行一次
      const now = Date.now();
      if (!is_cleaning && now - last_clean_time > CLEAN_THROTTLE_DELAY) {
        is_cleaning = true;
        const three_minutes_ago = now - 3 * 60 * 1000;
        FrontendLogService.cleanOldLogs(three_minutes_ago).finally(() => {
          last_clean_time = Date.now();
          is_cleaning = false;
        });
      }

      // 获取日志
      const log_list = await FrontendLogService.getAllLogs();

      // 只提取 message 字段
      const message_list = log_list.map((log) => log.message);

      // 手动分页
      const total = message_list.length;
      const start_index = (current_page_num - 1) * page_size_num;
      const end_index = start_index + page_size_num;
      const paginated_list = message_list.slice(start_index, end_index);

      res.apiSuccess({
        list: paginated_list,
        pagination: {
          current_page: current_page_num,
          page_size: page_size_num,
          total
        }
      });
    } catch (error) {
      res.apiError(null, error.message);
    }
  }
}

module.exports = FrontendLogController;
