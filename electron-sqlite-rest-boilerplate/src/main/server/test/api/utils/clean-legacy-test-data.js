#!/usr/bin/env node

/**
 * 清理遗留测试数据脚本
 *
 * 用于删除测试过程中遗留的测试数据
 * 使用方法: node clean-legacy-test-data.js [--dry-run]
 *
 * 选项:
 *   --dry-run  只显示将要删除的数据，不实际删除
 *   --confirm   确认后执行删除
 */

const path = require('path')
const { sequelize } = require('../../../database/sequelize')

// 解析命令行参数
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const isConfirm = args.includes('--confirm')

/**
 * 清理层级节点中的测试数据
 */
async function cleanHierarchyNodes() {
  console.log('\n[清理] 层级节点 (hierarchy_nodes)')

  // 查找测试数据（名称包含特定模式的节点）
  const patterns = [
    '%待删除节点%',
    '%测试节点%',
    '%TEST_NODE%',
    '%test-node-%',
    '%测试通信节点%',
    '%多选测试节点%',
    '%test-multi-%'
  ]

  let deleteCount = 0

  for (const pattern of patterns) {
    const [rows] = await sequelize.query(
      'SELECT id, name FROM hierarchy_nodes WHERE name LIKE ?;',
      { replacements: [pattern] }
    )

    if (rows.length > 0) {
      console.log(`  找到 ${rows.length} 条匹配 "${pattern}" 的数据:`)
      for (const row of rows) {
        console.log(`    - id: ${row.id}, name: ${row.name}`)
      }

      if (!isDryRun) {
        const ids = rows.map((r) => r.id)
        for (const id of ids) {
          await sequelize.query('DELETE FROM hierarchy_nodes WHERE id = ?;', {
            replacements: [id]
          })
        }
      }
      deleteCount += rows.length
    }
  }

  return deleteCount
}

/**
 * 清理层级类型中的测试数据
 */
async function cleanHierarchyLevels() {
  console.log('\n[清理] 层级类型 (hierarchy_levels)')

  const patterns = ['%TEST_LEVEL%', '%测试层级%']

  let deleteCount = 0

  for (const pattern of patterns) {
    const [rows] = await sequelize.query(
      'SELECT id, type_name, display_name FROM hierarchy_levels WHERE type_name LIKE ? OR display_name LIKE ?;',
      { replacements: [pattern, pattern] }
    )

    if (rows.length > 0) {
      console.log(`  找到 ${rows.length} 条匹配 "${pattern}" 的数据:`)
      for (const row of rows) {
        console.log(
          `    - id: ${row.id}, type_name: ${row.type_name}, display_name: ${row.display_name}`
        )
      }

      if (!isDryRun) {
        const ids = rows.map((r) => r.id)
        for (const id of ids) {
          await sequelize.query('DELETE FROM hierarchy_levels WHERE id = ?;', {
            replacements: [id]
          })
        }
      }
      deleteCount += rows.length
    }
  }

  return deleteCount
}

/**
 * 清理报文配置中的测试数据
 */
async function cleanPacketMessages() {
  console.log('\n[清理] 报文配置 (packet_messages)')

  const patterns = ['%测试报文草稿%', '%测试报文%', '%测试流程图%']

  let deleteCount = 0

  for (const pattern of patterns) {
    const [rows] = await sequelize.query(
      'SELECT id, name FROM packet_messages WHERE name LIKE ?;',
      { replacements: [pattern] }
    )

    if (rows.length > 0) {
      console.log(`  找到 ${rows.length} 条匹配 "${pattern}" 的数据:`)
      for (const row of rows) {
        console.log(`    - id: ${row.id}, name: ${row.name}`)
      }

      if (!isDryRun) {
        const ids = rows.map((r) => r.id)
        for (const id of ids) {
          await sequelize.query('DELETE FROM packet_messages WHERE id = ?;', {
            replacements: [id]
          })
        }
      }
      deleteCount += rows.length
    }
  }

  return deleteCount
}

/**
 * 清理流程图中的测试数据
 */
async function cleanFlowcharts() {
  console.log('\n[清理] 流程图 (flowcharts)')

  const patterns = ['%测试流程图%']

  let deleteCount = 0

  for (const pattern of patterns) {
    const [rows] = await sequelize.query('SELECT id, name FROM flowcharts WHERE name LIKE ?;', {
      replacements: [pattern]
    })

    if (rows.length > 0) {
      console.log(`  找到 ${rows.length} 条匹配 "${pattern}" 的数据:`)
      for (const row of rows) {
        console.log(`    - id: ${row.id}, name: ${row.name}`)
      }

      if (!isDryRun) {
        const ids = rows.map((r) => r.id)
        for (const id of ids) {
          await sequelize.query('DELETE FROM flowcharts WHERE id = ?;', {
            replacements: [id]
          })
        }
      }
      deleteCount += rows.length
    }
  }

  return deleteCount
}

/**
 * 清理通信节点中的测试数据
 */
async function cleanCommunicationNodes() {
  console.log('\n[清理] 通信节点 (communication_nodes)')

  const patterns = ['%test-node-%', '%测试通信节点%', '%多选测试节点%', '%test-multi-%']

  let deleteCount = 0

  for (const pattern of patterns) {
    const [rows] = await sequelize.query(
      'SELECT id, node_id, name FROM communication_nodes WHERE node_id LIKE ? OR name LIKE ?;',
      { replacements: [pattern, pattern] }
    )

    if (rows.length > 0) {
      console.log(`  找到 ${rows.length} 条匹配 "${pattern}" 的数据:`)
      for (const row of rows) {
        console.log(`    - id: ${row.id}, node_id: ${row.node_id}, name: ${row.name}`)
      }

      if (!isDryRun) {
        const ids = rows.map((r) => r.id)
        for (const id of ids) {
          await sequelize.query('DELETE FROM communication_nodes WHERE id = ?;', {
            replacements: [id]
          })
        }
      }
      deleteCount += rows.length
    }
  }

  return deleteCount
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('========================================')
    console.log('     遗留测试数据清理工具')
    console.log('========================================')

    if (isDryRun) {
      console.log('\n[模式] 预览模式（不会实际删除数据）')
    } else if (!isConfirm) {
      console.log('\n[提示] 使用 --confirm 确认执行删除，或 --dry-run 预览')
      return
    } else {
      console.log('\n[模式] 执行删除模式')
    }

    // 连接数据库
    await sequelize.authenticate()
    console.log('\n[数据库] 连接成功')

    // 清理各模块的测试数据
    const nodeCount = await cleanHierarchyNodes()
    const levelCount = await cleanHierarchyLevels()
    const packetCount = await cleanPacketMessages()
    const flowchartCount = await cleanFlowcharts()
    const commNodeCount = await cleanCommunicationNodes()

    const totalDeleted = nodeCount + levelCount + packetCount + flowchartCount + commNodeCount

    console.log('\n========================================')
    console.log('     清理统计')
    console.log('========================================')
    console.log(`层级节点: ${nodeCount} 条`)
    console.log(`层级类型: ${levelCount} 条`)
    console.log(`报文配置: ${packetCount} 条`)
    console.log(`流程图: ${flowchartCount} 条`)
    console.log(`通信节点: ${commNodeCount} 条`)
    console.log(`-------------------------`)
    console.log(`总计: ${totalDeleted} 条`)

    if (isDryRun) {
      console.log('\n[提示] 这是预览模式，未实际删除数据')
      console.log('[提示] 如需执行删除，请运行: node clean-legacy-test-data.js --confirm')
    } else {
      console.log('\n[完成] 测试数据已清理')
    }

    process.exit(0)
  } catch (error) {
    console.error('\n[错误]', error.message)
    process.exit(1)
  }
}

// 运行主函数
main()
