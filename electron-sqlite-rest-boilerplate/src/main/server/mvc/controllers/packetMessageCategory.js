// 报文层级分类控制器
const PacketMessageCategoryService = require('../services/packetMessageCategory');
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('httpApi');

class PacketMessageCategoryController {
  /**
   * 获取所有分类（平铺列表）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回分类列表
   */
  static async getAllCategories(req, res) {
    try {
      const category_list = await PacketMessageCategoryService.getAllCategories();
      res.apiSuccess(category_list);
    } catch (error) {
      logger.error('[PacketMessageCategory] getAllCategories error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取分类树（包含报文，用于资源管理器展示）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回分类树
   */
  static async getCategoryTree(req, res) {
    try {
      const tree = await PacketMessageCategoryService.getCategoryTree();
      res.apiSuccess(tree);
    } catch (error) {
      logger.error('[PacketMessageCategory] getCategoryTree error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取分类详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回分类详情
   */
  static async getCategoryById(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少参数 id');
      }
      const category = await PacketMessageCategoryService.getCategoryById(id);
      if (!category) {
        return res.apiError(null, '分类不存在');
      }
      res.apiSuccess(category);
    } catch (error) {
      logger.error('[PacketMessageCategory] getCategoryById error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 创建分类（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回创建结果
   */
  static async createCategory(req, res) {
    try {
      const data_list = Array.isArray(req.body) ? req.body : [req.body];

      // 验证 data_list
      if (!Array.isArray(data_list) || data_list.length === 0) {
        return res.apiError(null, '参数必须是非空数组');
      }

      // 验证每个分类项
      for (const item of data_list) {
        if (!item.name || item.name === '') {
          return res.apiError(null, '分类名称不能为空');
        }
        if (typeof item.name !== 'string') {
          return res.apiError(null, '分类名称必须是字符串');
        }
        if (item.name.length > 500) {
          return res.apiError(null, '分类名称长度不能超过500个字符');
        }
      }

      const result = await PacketMessageCategoryService.createCategoryList(data_list);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessageCategory] createCategory error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 更新分类（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回更新结果
   */
  static async updateCategory(req, res) {
    try {
      const data_list = Array.isArray(req.body) ? req.body : [req.body];
      const result = await PacketMessageCategoryService.updateCategoryList(data_list);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessageCategory] updateCategory error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 删除分类（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回删除结果
   */
  static async deleteCategory(req, res) {
    try {
      const id_list = Array.isArray(req.body.ids) ? req.body.ids : [req.body.ids];
      const result = await PacketMessageCategoryService.deleteCategoryList(id_list);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessageCategory] deleteCategory error:', error);
      res.apiError(null, error.message);
    }
  }
}

module.exports = PacketMessageCategoryController;
