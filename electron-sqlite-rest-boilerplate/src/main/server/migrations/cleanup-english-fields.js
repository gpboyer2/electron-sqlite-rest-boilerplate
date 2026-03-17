/**
 * 数据清理脚本
 * 清理 system_level_design_tree_nodes 表中 properties 的英文字段
 * 保留中文字段（由 hierarchy-settings 配置）
 *
 * 使用方法: node migrations/cleanup-english-fields.js
 */

const { sequelize } = require('../database/sequelize');

// 需要删除的英文字段映射
const englishFieldsToRemove = [
  'name', // 对应中文字段 "名称"
  'description', // 对应中文字段 "描述"
  'version', // 对应中文字段 "版本"
  'type', // 对应中文字段 "类型"
  'status', // 对应中文字段 "状态"
  'priority', // 对应中文字段 "优先级"
  'category', // 对应中文字段 "分类"
  'author', // 对应中文字段 "作者"
  'createdAt', // 对应中文字段 "创建时间"
  'updatedAt' // 对应中文字段 "更新时间"
];

/**
 * 清理单个节点的 properties 对象，移除英文字段
 * @param {Object} properties - 节点的 properties 对象
 * @returns {Object} 返回包含清理后的 properties 和删除的字段数量的对象
 */
function cleanupProperties(properties) {
  if (!properties || typeof properties !== 'object') {
    return properties;
  }

  const cleaned = { ...properties };
  let removedCount = 0;

  for (const field of englishFieldsToRemove) {
    if (field in cleaned) {
      delete cleaned[field];
      removedCount++;
    }
  }

  return { cleaned, removedCount };
}

/**
 * 主清理函数，清理所有节点中的英文字段
 * @returns {Promise<void>} 无返回值，执行完成后退出进程
 */
async function cleanup() {
  console.log('========== 开始清理英文字段 ==========');
  console.log('开始时间:', new Date().toLocaleString('zh-CN'));

  try {
    // 1. 查询所有节点
    const [nodes] = await sequelize.query(`
      SELECT id, name, properties
      FROM system_level_design_tree_nodes
      WHERE properties IS NOT NULL
    `);

    console.log(`找到 ${nodes.length} 条需要检查的记录`);

    let updatedCount = 0;
    let totalRemovedCount = 0;
    const errorList = [];

    // 2. 逐条处理
    for (const node of nodes) {
      try {
        const originalProps = node.properties;
        const { cleaned, removedCount } = cleanupProperties(originalProps);

        if (removedCount > 0) {
          // 更新数据库
          await sequelize.query(
            `UPDATE system_level_design_tree_nodes SET properties = ? WHERE id = ?`,
            {
              replacements: [JSON.stringify(cleaned), node.id]
            }
          );

          updatedCount++;
          totalRemovedCount += removedCount;
          console.log(`  节点 ${node.id} (${node.name}): 删除了 ${removedCount} 个英文字段`);
        }
      } catch (err) {
        errorList.push({ id: node.id, error: err.message });
        console.error(`  节点 ${node.id} 处理失败:`, err.message);
      }
    }

    // 3. 输出结果
    console.log('\n========== 清理结果汇总 ==========');
    console.log(`总记录数: ${nodes.length}`);
    console.log(`更新记录数: ${updatedCount}`);
    console.log(`删除字段总数: ${totalRemovedCount}`);
    console.log(`失败记录数: ${errorList.length}`);

    if (errorList.length > 0) {
      console.log('\n失败详情:');
      errorList.forEach(({ id, error }) => {
        console.log(`  ${id}: ${error}`);
      });
    }

    console.log('\n========== 清理完成 ==========');
    process.exit(0);
  } catch (error) {
    console.error('\n清理过程发生错误:', error);
    process.exit(1);
  }
}

// 运行清理
cleanup();
