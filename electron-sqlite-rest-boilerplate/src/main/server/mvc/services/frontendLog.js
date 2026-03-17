/**
 * 前端日志服务，处理前端日志相关业务逻辑
 */
const FrontendLogModel = require('../models/frontendLog');

class FrontendLogService {
  /**
   * 解析日志消息并创建
   */
  static async parseAndCreate(message) {
    try {
      // 解析日志级别和内容
      const level_match = message.match(/^\[([A-Z-]+)\]\s*/);
      let level = 'LOG';
      let content = message;

      if (level_match) {
        level = level_match[1];
        content = message.substring(level_match[0].length);
      }

      return await FrontendLogModel.create(level, content);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 批量解析并创建日志
   */
  static async parseAndCreateBatch(message_list) {
    try {
      const log_list = [];

      for (const message of message_list) {
        // 解析日志级别和内容
        const level_match = message.match(/^\[([A-Z-]+)\]\s*/);
        let level = 'LOG';
        let content = message;

        if (level_match) {
          level = level_match[1];
          content = message.substring(level_match[0].length);
        }

        log_list.push({ level, message: content });
      }

      if (log_list.length === 0) {
        return 0;
      }

      await FrontendLogModel.createBatch(log_list);
      return log_list.length;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取所有前端日志
   */
  static async getAllLogs() {
    try {
      return await FrontendLogModel.findAll();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 清理指定时间之前的日志
   */
  static async cleanOldLogs(before_timestamp) {
    try {
      return await FrontendLogModel.cleanOld(before_timestamp);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = FrontendLogService;
