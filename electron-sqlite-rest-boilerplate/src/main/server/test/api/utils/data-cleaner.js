/**
 * 数据清理器
 * 测试结束后删除所有创建的测试数据
 *
 * 核心思路：
 * 1. 从 dataTracker 获取所有追踪的数据
 * 2. 遍历每条数据，调用其记录的删除 API
 * 3. 不需要考虑模块类型、层级关系等业务逻辑
 */

const { ExpectedMismatchError } = require('../lib/assertions')

class DataCleaner {
  constructor() {
    this.apiClient = null
    this.dataTracker = null
  }

  /**
   * 设置 API 客户端
   * @param {Object} client - API 客户端实例
   */
  setApiClient(client) {
    this.apiClient = client
  }

  /**
   * 设置数据追踪器
   * @param {Object} tracker - 数据追踪器实例
   */
  setDataTracker(tracker) {
    this.dataTracker = tracker
  }

  /**
   * 清理所有测试数据
   * 遍历所有追踪的数据，直接调用删除 API
   * @returns {Promise<{totalCleaned: number, totalFailed: number}>} 清理结果统计
   */
  async cleanAll() {
    if (!this.apiClient || !this.dataTracker) {
      throw new Error('请先设置 apiClient 和 dataTracker')
    }

    const allData = this.dataTracker.getAll()
    if (allData.length === 0) {
      console.log('\n[数据清理] 没有需要清理的测试数据')
      return { totalCleaned: 0, totalFailed: 0 }
    }

    console.log(`\n[数据清理] 开始清理 ${allData.length} 条测试数据...`)

    let successCount = 0
    let failedCount = 0

    // 按创建时间倒序删除（后创建的先删除）
    const sortedData = [...allData].sort((a, b) => b.createdAt - a.createdAt)

    for (const item of sortedData) {
      const deleteUrl = item.deleteUrl

      try {
        // 判断请求方法：以 /delete 结尾的路径使用 POST
        if (deleteUrl.endsWith('/delete')) {
          const id = item.data.id

          // 安全检查：如果 ID 为空，跳过此条记录
          // 因为 { ids: [null] } 会导致后端查询 parent_id = null 的所有节点（根节点），造成误删
          if (!id) {
            console.warn(`  [WARN] ${deleteUrl} - ID 为空，跳过删除`)
            failedCount++
            continue
          }

          // system-level-design-tree 和 packet-messages 使用 { ids: [...] }
          if (
            deleteUrl.includes('system-level-design-tree/nodes/delete') ||
            deleteUrl.includes('/packet-messages/delete')
          ) {
            await this.apiClient.post(deleteUrl, { ids: [id] }, { expect: 'success' })
          } else if (deleteUrl.includes('/hierarchy/')) {
            // hierarchy 模块使用 { id }
            await this.apiClient.post(deleteUrl, { id }, { expect: 'success' })
          } else {
            // 其他模块使用 { data: [id] }
            await this.apiClient.post(deleteUrl, { data: [id] }, { expect: 'success' })
          }
        } else if (deleteUrl.includes('/delete-') || deleteUrl.includes('/delete-comm-node')) {
          // POST 请求，路径包含 /delete- 前缀或 /delete-comm-node，入参从请求体获取
          // 例如 /flowcharts/delete-comm-node 需要 { comm_node_id: ... }
          await this.apiClient.post(deleteUrl, item.data, { expect: 'success' })
        } else {
          // DELETE 请求（完整路径已包含 ID）- 现在已不使用此模式
          await this.apiClient.delete(deleteUrl, { expect: 'success' })
        }
        successCount++
        console.log(`  [OK] ${deleteUrl}`)
      } catch (error) {
        // 如果是 ExpectedMismatchError 且实际结果是 error（数据已删除或不存在），算作成功
        if (error instanceof ExpectedMismatchError && error.actual === 'error') {
          successCount++
          console.log(`  [OK] ${deleteUrl} (已删除)`)
        } else {
          failedCount++
          console.warn(`  [FAIL] ${deleteUrl} - ${error.message}`)
        }
      }
    }

    console.log(`\n[数据清理完成] 成功: ${successCount} 条, 失败: ${failedCount} 条`)

    return {
      totalCleaned: successCount,
      totalFailed: failedCount
    }
  }
}

module.exports = DataCleaner
