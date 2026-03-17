/**
 * 数据迁移脚本
 * 将 system_level_design_tree_nodes 表的 name 字段迁移到 properties.name
 * 然后删除 name 列
 *
 * 使用方法: node migrations/migrate-name-to-properties.js
 */

const { sequelize } = require('../database/sequelize');

/**
 * 检查 system_level_design_tree_nodes 表的 name 列是否存在
 * @returns {Promise<boolean>} 返回 name 列是否存在
 */
async function checkNameColumnExists() {
  try {
    const [columns] = await sequelize.query(`
      PRAGMA table_info(system_level_design_tree_nodes)
    `);
    return columns.some((col) => col.name === 'name');
  } catch (error) {
    console.error('检查列失败:', error.message);
    return false;
  }
}

/**
 * 迁移 name 字段到 properties.name
 * @param {Object} options - 配置选项
 * @param {boolean} options.silent - 是否静默模式（不输出日志）
 * @returns {Promise<Object>} 迁移结果
 */
async function migrateNameToProperties(options = {}) {
  const { silent = false } = options;

  if (!silent) {
    console.log('========== 开始迁移 name 字段到 properties.name ==========');
    console.log('开始时间:', new Date().toLocaleString('zh-CN'));
  }

  try {
    // 1. 检查 name 列是否存在
    const hasNameColumn = await checkNameColumnExists();
    if (!hasNameColumn) {
      if (!silent) {
        console.log('name 列不存在，跳过迁移');
        console.log('========== 迁移完成（无需迁移） ==========');
      }
      return { success: true, migrated: 0, skipped: 0, dropped: false };
    }
    if (!silent) console.log('检测到 name 列，开始迁移...');

    // 2. 查询所有有 name 值但 properties 中没有"名称"的记录
    const [nodes] = await sequelize.query(`
      SELECT id, name, properties
      FROM system_level_design_tree_nodes
      WHERE name IS NOT NULL AND name != ''
    `);

    if (!silent) console.log(`找到 ${nodes.length} 条需要迁移的记录`);

    if (nodes.length === 0 && !silent) {
      console.log('没有需要迁移的数据');
    }

    let updatedCount = 0;
    let skippedCount = 0;
    const errorList = [];

    // 3. 逐条处理
    for (const node of nodes) {
      try {
        let properties = node.properties;
        // 解析 properties（如果是字符串）
        if (typeof properties === 'string') {
          try {
            properties = JSON.parse(properties);
          } catch (e) {
            properties = {};
          }
        }
        if (!properties || typeof properties !== 'object') {
          properties = {};
        }

        // 如果已经有"name"字段，跳过
        if (properties.name) {
          skippedCount++;
          if (!silent) console.log(`  跳过节点 ${node.id}: 已有"name"字段`);
          continue;
        }

        // 将 name 迁移到 properties.name
        properties.name = node.name;

        // 更新数据库
        await sequelize.query(
          `UPDATE system_level_design_tree_nodes SET properties = ? WHERE id = ?`,
          {
            replacements: [JSON.stringify(properties), node.id]
          }
        );

        updatedCount++;
        if (!silent) console.log(`  节点 ${node.id}: "${node.name}" -> properties.name`);
      } catch (err) {
        errorList.push({ id: node.id, error: err.message });
        if (!silent) console.error(`  节点 ${node.id} 迁移失败:`, err.message);
      }
    }

    // 4. 输出迁移结果
    if (!silent) {
      console.log('\n========== 迁移结果汇总 ==========');
      console.log(`总记录数: ${nodes.length}`);
      console.log(`成功迁移: ${updatedCount}`);
      console.log(`跳过（已有name）: ${skippedCount}`);
      console.log(`失败记录数: ${errorList.length}`);
    }

    if (errorList.length > 0) {
      if (!silent) {
        console.log('\n失败详情:');
        errorList.forEach(({ id, error }) => {
          console.log(`  ${id}: ${error}`);
        });
      }
      return {
        success: false,
        migrated: updatedCount,
        skipped: skippedCount,
        errors: errorList,
        dropped: false
      };
    }

    // 5. 删除 name 列
    if (!silent) console.log('\n========== 删除 name 列 ==========');
    try {
      await sequelize.query(`ALTER TABLE system_level_design_tree_nodes DROP COLUMN name`);
      if (!silent) console.log('name 列已成功删除');
    } catch (error) {
      if (!silent) {
        console.error('删除 name 列失败:', error.message);
        console.log('请手动执行: ALTER TABLE system_level_design_tree_nodes DROP COLUMN name');
      }
      return {
        success: false,
        migrated: updatedCount,
        skipped: skippedCount,
        error: '删除列失败',
        dropped: false
      };
    }

    if (!silent) {
      console.log('\n========== 迁移完成 ==========');
      console.log('结束时间:', new Date().toLocaleString('zh-CN'));
    }

    return {
      success: true,
      migrated: updatedCount,
      skipped: skippedCount,
      dropped: true
    };
  } catch (error) {
    if (!silent) console.error('\n迁移过程发生错误:', error);
    return {
      success: false,
      error: error.message,
      migrated: 0,
      skipped: 0,
      dropped: false
    };
  }
}

// 直接运行脚本时（命令行调用）
if (require.main === module) {
  migrateNameToProperties().then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
}

module.exports = { migrateNameToProperties };
