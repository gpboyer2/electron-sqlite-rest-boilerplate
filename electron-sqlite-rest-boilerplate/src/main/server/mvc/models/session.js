/**
 * 用户会话模型，处理用户会话的CRUD操作
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const { UserSession } = require('../../database/models');
const { Op } = require('sequelize');

class SessionModel {
  /**
   * 创建会话
   * 一个用户只能有一个活跃 session，先删除该用户的所有旧 session
   * @param {Object} sessionData - 会话数据
   * @param {number} sessionData.user_id - 用户ID
   * @param {string} sessionData.token - 会话令牌
   * @returns {Promise<Object>} 创建的会话对象
   */
  static async create(sessionData) {
    try {
      console.log(
        '[Session] 创建会话 - UserId:',
        sessionData.user_id,
        'Token前缀:',
        sessionData.token.substring(0, 20) + '...'
      );
      // 一个用户只能有一个活跃 session，先删除该用户的所有旧 session
      await UserSession.destroy({ where: { user_id: sessionData.user_id } });
      // 创建新 session
      const session = await UserSession.create(sessionData);
      console.log(
        '[Session] 会话创建成功 - SessionId:',
        session.session_id,
        'Status:',
        session.status
      );
      return session;
    } catch (error) {
      logger.error('创建会话失败:', error);
      throw error;
    }
  }

  /**
   * 根据 Token 查询会话
   * @param {string} token - 会话令牌
   * @returns {Promise<Object|null>} 查询到的会话对象，不存在则返回 null
   */
  static async findByToken(token) {
    try {
      const session = await UserSession.findOne({ where: { token: token }, raw: true });
      if (session) {
        console.log(
          '[Session] 查询会话 - Token前缀:',
          token.substring(0, 20) + '...',
          'Status:',
          session.status,
          'UserId:',
          session.user_id
        );
      } else {
        console.log('[Session] 查询会话 - Token前缀:', token.substring(0, 20) + '...', '会话不存在');
      }
      return session;
    } catch (error) {
      logger.error('查询会话失败:', error);
      throw error;
    }
  }

  /**
   * 根据 Token 更新会话状态
   * @param {string} token - 会话令牌
   * @param {Object} updateData - 要更新的数据
   * @returns {Promise<Array>} 更新结果，第一个元素为受影响的行数
   */
  static async updateByToken(token, updateData) {
    try {
      return await UserSession.update(updateData, { where: { token: token } });
    } catch (error) {
      logger.error('更新会话失败:', error);
      throw error;
    }
  }

  /**
   * 注销会话（将状态设为0）
   * @param {string} token - 会话令牌
   * @returns {Promise<Array>} 更新结果，第一个元素为受影响的行数
   */
  static async revoke(token) {
    try {
      return await UserSession.update({ status: 0 }, { where: { token: token } });
    } catch (error) {
      logger.error('注销会话失败:', error);
      throw error;
    }
  }

  /**
   * 注销用户的所有会话
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 更新结果，第一个元素为受影响的行数
   */
  static async revokeByUserId(userId) {
    try {
      console.log('[Session] 注销用户所有会话 - UserId:', userId);
      const result = await UserSession.update({ status: 0 }, { where: { user_id: userId } });
      console.log('[Session] 注销完成 - 影响行数:', result[0]);
      return result;
    } catch (error) {
      logger.error('注销用户所有会话失败:', error);
      throw error;
    }
  }

  /**
   * 注销用户的所有会话（保留指定的当前会话）
   * @param {number} userId - 用户ID
   * @param {string} exceptToken - 要保留的会话令牌
   * @returns {Promise<Array>} 更新结果，第一个元素为受影响的行数
   */
  static async revokeByUserIdExcept(userId, exceptToken) {
    try {
      console.log(
        '[Session] 注销用户其他会话 - UserId:',
        userId,
        '保留Token:',
        exceptToken ? exceptToken.substring(0, 20) + '...' : 'none'
      );
      const whereCondition = { user_id: userId };
      if (exceptToken) {
        whereCondition.token = { [Op.ne]: exceptToken };
      }
      const result = await UserSession.update({ status: 0 }, { where: whereCondition });
      console.log('[Session] 注销完成 - 影响行数:', result[0]);
      return result;
    } catch (error) {
      logger.error('注销用户其他会话失败:', error);
      throw error;
    }
  }

  /**
   * 删除过期会话
   * @returns {Promise<number>} 删除的会话数量
   */
  static async deleteExpired() {
    try {
      return await UserSession.destroy({ where: { expires_at: { [Op.lt]: Date.now() } } });
    } catch (error) {
      logger.error('删除过期会话失败:', error);
      throw error;
    }
  }
}

module.exports = SessionModel;
