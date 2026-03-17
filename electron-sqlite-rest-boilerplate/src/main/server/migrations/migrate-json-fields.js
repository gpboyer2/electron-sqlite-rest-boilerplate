/**
 * 数据迁移脚本
 * 将所有 JSON 字段从 TEXT 类型迁移为 JSON 类型，并转换数据格式
 *
 * 使用方法: node migrations/migrate-json-fields.js
 */

const { sequelize } = require('../database/sequelize');

/**
 * 安全解析 JSON 字符串
 * @param {string|Object} value - 需要解析的值
 * @returns {Object|null} 返回解析后的对象，解析失败返回 null
 */
function safeParseJSON(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn('JSON 解析失败:', value.substring(0, 100));
      return null;
    }
  }
  return value;
}

/**
 * 使用原生 SQL 迁移表的 JSON 字段
 * @param {string} tableName - 表名
 * @param {Array<string>} jsonFields - 需要迁移的 JSON 字段名数组
 * @returns {Promise<Object>} 返回包含更新数量和跳过数量的对象
 */
async function migrateTable(tableName, jsonFields) {
  console.log(`\n========== 迁移 ${tableName} 表 ==========`);

  try {
    // 1. 查询所有记录
    const [records] = await sequelize.query(`SELECT * FROM ${tableName}`);
    console.log(`找到 ${records.length} 条记录`);

    // 2. 检查每条记录的字段是否需要迁移
    const migrations = [];

    for (const record of records) {
      for (const field of jsonFields) {
        const rawValue = record[field];

        // 检测是否需要迁移
        if (rawValue === null || rawValue === undefined) {
          continue;
        }

        // 如果是字符串，说明数据库存储的是 JSON 字符串，需要迁移
        if (typeof rawValue === 'string' && rawValue.trim() !== '') {
          const parsed = safeParseJSON(rawValue);
          if (parsed !== null) {
            migrations.push({
              id: record.id,
              field: field,
              newValue: parsed
            });
            console.log(`  记录 ID=${record.id}: 字段 ${field} 需要迁移`);
            console.log(`    原值类型: ${typeof rawValue}, 长度: ${rawValue.length}`);
          } else {
            console.log(`  记录 ID=${record.id}: 字段 ${field} JSON 解析失败，跳过`);
          }
        }
      }
    }

    // 3. 先修改字段类型为 JSON（如果需要）
    for (const field of jsonFields) {
      try {
        // 检查字段类型
        const [columnInfo] = await sequelize.query(`
          SELECT data_type FROM information_schema.columns
          WHERE table_name = '${tableName}' AND column_name = '${field}'
        `);

        if (columnInfo.length > 0 && columnInfo[0].data_type === 'text') {
          console.log(`  修改字段 ${tableName}.${field} 类型从 TEXT 到 JSON`);
          await sequelize.query(
            `ALTER TABLE ${tableName} ALTER COLUMN ${field} TYPE JSON USING ${field}::json`
          );
        }
      } catch (e) {
        console.log(`  注意: 字段 ${tableName}.${field} 类型修改跳过或失败: ${e.message}`);
      }
    }

    // 4. 执行更新操作
    let updateCount = 0;
    for (const migration of migrations) {
      try {
        // 使用参数化查询，将 JSON 对象直接作为参数
        const jsonString = JSON.stringify(migration.newValue);
        await sequelize.query(
          `UPDATE ${tableName} SET ${migration.field} = :newValue WHERE id = :id`,
          {
            replacements: {
              id: migration.id,
              newValue: jsonString
            }
          }
        );
        updateCount++;
        console.log(`  记录 ID=${migration.id}: 已更新`);
      } catch (e) {
        console.error(`  记录 ID=${migration.id}: 更新失败 - ${e.message}`);
      }
    }

    const skipCount = records.length * jsonFields.length - migrations.length;
    console.log(`${tableName} 迁移完成: 更新 ${updateCount} 条, 跳过 ${skipCount} 条`);
    return { updated: updateCount, skipped: skipCount };
  } catch (error) {
    console.error(`${tableName} 迁移失败:`, error.message);
    console.error(`错误堆栈:`, error.stack);
    return { updated: 0, skipped: 0, error: error.message };
  }
}

/**
 * 主迁移函数，迁移所有表的 JSON 字段
 * @returns {Promise<void>} 无返回值，执行完成后退出进程
 */
async function migrate() {
  console.log('========== 开始 JSON 字段迁移 ==========');
  console.log('开始时间:', new Date().toLocaleString('zh-CN'));

  const startTime = Date.now();
  const results = {};

  try {
    // 1. 迁移 packet_messages.fields
    results.packetMessages = await migrateTable('packet_messages', ['fields']);

    // 2. 迁移 node_types.fields
    results.nodeTypes = await migrateTable('node_types', ['fields']);

    // 3. 迁移 communication_nodes.endpoint_description 和 config
    results.communicationNodes = await migrateTable('communication_nodes', [
      'endpoint_description',
      'config'
    ]);

    // 4. 迁移 system_level_design_tree_nodes.properties
    results.systemLevelDesignTreeNodes = await migrateTable('system_level_design_tree_nodes', [
      'properties'
    ]);

    // 5. 迁移 flowcharts.nodes 和 edges
    results.flowcharts = await migrateTable('flowcharts', ['nodes', 'edges']);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n========== 迁移结果汇总 ==========');
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const [table, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`${table}: 失败 - ${result.error}`);
      } else {
        console.log(`${table}: 更新 ${result.updated} 条, 跳过 ${result.skipped} 条`);
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
      }
    }

    console.log(`\n总计: 更新 ${totalUpdated} 条记录, 跳过 ${totalSkipped} 条记录`);
    console.log(`耗时: ${duration} 秒`);
    console.log('结束时间:', new Date().toLocaleString('zh-CN'));
    console.log('\n========== 迁移完成 ==========');

    process.exit(0);
  } catch (error) {
    console.error('\n迁移过程发生错误:', error);
    process.exit(1);
  }
}

// 运行迁移
migrate();
