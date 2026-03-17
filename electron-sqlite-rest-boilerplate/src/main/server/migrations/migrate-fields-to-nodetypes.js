/**
 * @file       migrate-fields-to-nodetypes.js
 * @brief      将 node_type_fields 表数据迁移到 node_types.fields 字段，并删除旧表
 * @date       2025-12-30
 */

const { sequelize } = require('../database/sequelize');

/**
 * 将 node_type_fields 表数据迁移到 node_types.fields 字段，并删除旧表
 * @returns {Promise<Object>} 返回包含成功状态和迁移数量的对象
 */
async function migrateFieldsToNodeTypes() {
  console.log('开始迁移 node_type_fields 到 node_types.fields...');

  try {
    // 查询所有 node_type_fields 数据
    const [fields] = await sequelize.query(`
      SELECT * FROM node_type_fields ORDER BY node_type_id, "order"
    `);

    console.log(`找到 ${fields.length} 条字段记录`);

    // 按 node_type_id 分组
    const fieldsByType = {};
    for (const field of fields) {
      if (!fieldsByType[field.node_type_id]) {
        fieldsByType[field.node_type_id] = [];
      }
      fieldsByType[field.node_type_id].push({
        id: field.id,
        field_name: field.field_name,
        field_type: field.field_type,
        required: field.required === 1,
        default_value: field.default_value || '',
        options: field.options ? JSON.parse(field.options) : [],
        placeholder: field.placeholder || '',
        order: field.order || 0
      });
    }

    console.log(`分组后共 ${Object.keys(fieldsByType).length} 个 node_type`);

    // 更新每个 node_type 的 fields 字段
    let successCount = 0;
    for (const [nodeTypeId, fieldsArray] of Object.entries(fieldsByType)) {
      const fieldsJson = JSON.stringify(fieldsArray);
      await sequelize.query(
        `
        UPDATE node_types SET fields = :fields WHERE id = :id
      `,
        {
          replacements: { fields: fieldsJson, id: nodeTypeId }
        }
      );
      successCount++;
      console.log(`已更新 node_type ${nodeTypeId}，包含 ${fieldsArray.length} 个字段`);
    }

    console.log(`迁移完成！成功更新 ${successCount} 个 node_type`);

    // 删除旧的 node_type_fields 表
    console.log('正在删除旧的 node_type_fields 表...');
    await sequelize.query('DROP TABLE IF EXISTS node_type_fields');
    console.log('已删除 node_type_fields 表');

    return { success: true, count: successCount };
  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateFieldsToNodeTypes()
    .then(() => {
      console.log('迁移成功！');
      process.exit(0);
    })
    .catch((err) => {
      console.error('迁移失败:', err);
      process.exit(1);
    });
}

module.exports = { migrateFieldsToNodeTypes };
