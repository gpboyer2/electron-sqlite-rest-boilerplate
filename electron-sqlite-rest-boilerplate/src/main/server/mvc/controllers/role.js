// 角色管理控制器，只提供增删改查四个接口，入参都是数组
const RoleModel = require('../models/role');

// 超级管理员角色ID和代码（系统约定）
const SUPER_ADMIN_ROLE_ID = 1;
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

class RoleController {
  /**
   * 查询角色列表
   * @param {Object} req - 请求对象
   * @param {Object} req.query - 查询参数
   * @param {number} [req.query.status] - 角色状态（0-禁用，1-启用）
   * @param {Object} req.user - 当前用户信息
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回角色列表
   */
  static async list(req, res) {
    try {
      const { status } = req.query;
      const currentUser = req.user;
      const result = await RoleModel.findAll(
        status !== undefined ? parseInt(status) : null,
        currentUser // 传入当前用户信息用于权限过滤
      );
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 新增角色（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {Array<Object>} req.body.data - 角色数据数组
   * @param {string} req.body.data[].role_name - 角色名称（2-50字符）
   * @param {string} req.body.data[].role_code - 角色代码（最大50字符）
   * @param {string} [req.body.data[].description] - 角色描述（最大200字符）
   * @param {number} req.body.data[].status - 角色状态（0-禁用，1-启用）
   * @param {number} req.body.data[].role_level - 角色级别（1-10000）
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回创建结果
   */
  static async create(req, res) {
    try {
      const { data } = req.body;
      if (!Array.isArray(data) || data.length === 0) {
        return res.apiError(null, '参数 data 必须是非空数组');
      }

      const resultList = [];
      for (const item of data) {
        // 验证必填字段
        if (!item.role_name || !item.role_code) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色名称和角色代码不能为空'
          });
          continue;
        }

        // 验证 role_name 类型
        if (typeof item.role_name !== 'string') {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色名称必须是字符串'
          });
          continue;
        }
        // 验证 role_name 长度（2-50字符）
        if (item.role_name.trim().length < 2) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色名称长度不能少于2个字符'
          });
          continue;
        }
        if (item.role_name.length > 50) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色名称长度不能超过50个字符'
          });
          continue;
        }

        // 验证 role_code 类型
        if (typeof item.role_code !== 'string') {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色代码必须是字符串'
          });
          continue;
        }
        // 验证 role_code 长度
        if (item.role_code.length > 50) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色代码长度不能超过50个字符'
          });
          continue;
        }

        // 验证 description 长度（如果提供）
        if (item.description !== undefined && item.description !== null) {
          if (typeof item.description !== 'string') {
            resultList.push({
              success: false,
              role_code: item.role_code,
              message: '角色描述必须是字符串'
            });
            continue;
          }
          if (item.description.length > 200) {
            resultList.push({
              success: false,
              role_code: item.role_code,
              message: '角色描述长度不能超过200个字符'
            });
            continue;
          }
        }

        // 验证 status 类型、范围和必填性
        if (item.status === undefined || item.status === null) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色状态不能为空'
          });
          continue;
        }
        if (typeof item.status !== 'number' || isNaN(item.status)) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色状态必须是数字'
          });
          continue;
        }
        if (item.status !== 0 && item.status !== 1) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色状态必须是0（禁用）或1（启用）'
          });
          continue;
        }

        // 验证 role_level 类型、范围和必填性
        if (item.role_level === undefined || item.role_level === null) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色级别不能为空'
          });
          continue;
        }
        if (typeof item.role_level !== 'number' || isNaN(item.role_level)) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色级别必须是数字'
          });
          continue;
        }
        if (item.role_level <= 0) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色级别必须是正整数'
          });
          continue;
        }
        if (item.role_level > 10000) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '角色级别超出有效范围'
          });
          continue;
        }

        // 禁止创建超级管理员角色
        if (
          item.role_code === SUPER_ADMIN_ROLE_CODE ||
          item.role_code.toUpperCase() === 'SUPER_ADMIN'
        ) {
          resultList.push({
            success: false,
            role_code: item.role_code,
            message: '不能创建超级管理员角色'
          });
          continue;
        }

        // 检查角色代码是否已存在
        const existRole = await RoleModel.findByRoleCode(item.role_code);
        if (existRole) {
          resultList.push({ success: false, role_code: item.role_code, message: '角色代码已存在' });
          continue;
        }
        const created = await RoleModel.create(item);
        resultList.push({ success: true, role_id: created.role_id, role_code: item.role_code });
      }

      const successCount = resultList.filter((r) => r.success).length;
      if (successCount === 0) {
        const failedMessage = resultList
          .map((r) => r.message)
          .filter(Boolean)
          .join('; ');
        return res.apiError(resultList, `创建失败: ${failedMessage || '未知错误'}`);
      }
      res.apiSuccess(resultList, `成功创建 ${successCount} 个角色`);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 更新角色（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {Array<Object>} req.body.data - 角色更新数据数组
   * @param {number} req.body.data[].role_id - 角色ID
   * @param {string} [req.body.data[].role_name] - 角色名称（2-50字符）
   * @param {string} [req.body.data[].role_code] - 角色代码（最大50字符）
   * @param {string} [req.body.data[].description] - 角色描述（最大200字符）
   * @param {number} [req.body.data[].status] - 角色状态（0-禁用，1-启用）
   * @param {number} [req.body.data[].role_level] - 角色级别（1-10000）
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回更新结果
   */
  static async update(req, res) {
    try {
      const { data } = req.body;
      if (!Array.isArray(data) || data.length === 0) {
        return res.apiError(null, '参数 data 必须是非空数组');
      }

      const resultList = [];
      for (const item of data) {
        if (!item.role_id) {
          resultList.push({ success: false, message: '缺少 role_id' });
          continue;
        }
        const role = await RoleModel.findByRoleId(item.role_id);
        if (!role) {
          resultList.push({ success: false, role_id: item.role_id, message: '角色不存在' });
          continue;
        }

        // 验证 role_level 范围（如果提供）
        if (item.role_level !== undefined) {
          if (typeof item.role_level !== 'number' || isNaN(item.role_level)) {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '角色级别必须是数字'
            });
            continue;
          }
          if (item.role_level <= 0) {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '角色级别必须是正整数'
            });
            continue;
          }
          if (item.role_level > 10000) {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '角色级别超出有效范围'
            });
            continue;
          }
        }

        // 验证 status 范围（如果提供）
        if (item.status !== undefined) {
          if (typeof item.status !== 'number' || isNaN(item.status)) {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '角色状态必须是数字'
            });
            continue;
          }
          if (item.status !== 0 && item.status !== 1) {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '角色状态必须是0（禁用）或1（启用）'
            });
            continue;
          }
        }

        // 禁止修改超级管理员角色
        if (role.role_id === SUPER_ADMIN_ROLE_ID || role.role_code === SUPER_ADMIN_ROLE_CODE) {
          resultList.push({
            success: false,
            role_id: item.role_id,
            message: '不能修改超级管理员角色'
          });
          continue;
        }

        // 如果更新角色代码，检查是否重复
        if (item.role_code && item.role_code !== role.role_code) {
          // 禁止将角色代码改为超级管理员
          if (item.role_code.toUpperCase() === 'SUPER_ADMIN') {
            resultList.push({
              success: false,
              role_id: item.role_id,
              message: '不能将角色代码设置为超级管理员'
            });
            continue;
          }
          const existRole = await RoleModel.findByRoleCode(item.role_code);
          if (existRole) {
            resultList.push({ success: false, role_id: item.role_id, message: '角色代码已存在' });
            continue;
          }
        }
        const { role_id, ...updateData } = item;
        await RoleModel.update(role_id, updateData);
        resultList.push({ success: true, role_id });
      }

      const successCount = resultList.filter((r) => r.success).length;
      if (successCount === 0) {
        const failedMessage = resultList
          .map((r) => r.message)
          .filter(Boolean)
          .join('; ');
        return res.apiError(resultList, `更新失败: ${failedMessage || '未知错误'}`);
      }
      res.apiSuccess(resultList, `成功更新 ${successCount} 个角色`);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 删除角色（支持批量）
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {Array<number>} req.body.data - 角色ID数组
   * @param {Object} res - 响应对象
   * @returns {Promise<void>} 返回删除结果
   */
  static async delete(req, res) {
    try {
      const { data } = req.body;
      if (!Array.isArray(data) || data.length === 0) {
        return res.apiError(null, '参数 data 必须是非空数组');
      }

      const resultList = [];
      for (const roleId of data) {
        const role = await RoleModel.findByRoleId(roleId);
        if (!role) {
          resultList.push({ success: false, role_id: roleId, message: '角色不存在' });
          continue;
        }
        // 防止删除超级管理员角色
        if (role.role_code === 'SUPER_ADMIN') {
          resultList.push({ success: false, role_id: roleId, message: '不能删除超级管理员角色' });
          continue;
        }
        // 检查是否有用户关联
        const hasUsers = await RoleModel.hasUsers(roleId);
        if (hasUsers) {
          resultList.push({ success: false, role_id: roleId, message: '该角色下有用户，不能删除' });
          continue;
        }
        await RoleModel.delete(roleId);
        resultList.push({ success: true, role_id: roleId });
      }

      const successCount = resultList.filter((r) => r.success).length;
      if (successCount === 0) {
        const failedMessage = resultList
          .map((r) => r.message)
          .filter(Boolean)
          .join('; ');
        return res.apiError(resultList, `删除失败: ${failedMessage || '未知错误'}`);
      }
      res.apiSuccess(resultList, `成功删除 ${successCount} 个角色`);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }
}

module.exports = RoleController;
