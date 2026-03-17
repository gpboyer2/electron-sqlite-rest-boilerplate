/**
 * 报文工具函数
 * @fileoverview 提供报文相关的工具函数
 * @author CSSC Node View
 * @version 1.0.0
 * @since 2026-02-06
 */

/**
 * 按 message_id 去重报文列表，每个 message_id 只保留一个显示版本
 * 优先显示草稿，如果没有草稿则显示已发布版本
 * @param {Array} packet_list - 报文列表
 * @returns {Array} 去重后的报文列表
 */
function dedupePacketsByMessageId(packet_list) {
  // 按 message_id 分组报文，每个 message_id 只保留一个显示版本
  // 优先显示草稿，如果没有草稿则显示已发布版本
  const message_id_map = new Map();
  for (const packet of packet_list) {
    const message_id = packet.message_id;
    if (!message_id) {
      // 没有 message_id 的报文直接添加（历史数据兼容）
      if (!message_id_map.has('__no_message_id__')) {
        message_id_map.set('__no_message_id__', []);
      }
      message_id_map.get('__no_message_id__').push(packet);
      continue;
    }

    const is_draft = packet.publish_status === 0;
    const existing = message_id_map.get(message_id);

    if (!existing) {
      // 第一次遇到这个 message_id，直接添加
      message_id_map.set(message_id, [packet]);
    } else {
      // 已存在同 message_id 的报文
      const existing_draft = existing.find((p) => p.publish_status === 0);
      if (existing_draft) {
        // 已有草稿，跳过当前报文
        continue;
      }
      if (is_draft) {
        // 当前是草稿，替换原有的已发布版本
        message_id_map.set(message_id, [packet]);
      }
      // 否则保持原有版本不变
    }
  }

  // 展开去重后的报文列表
  const filtered_packet_list = [];
  for (const packets of message_id_map.values()) {
    filtered_packet_list.push(...packets);
  }
  return filtered_packet_list;
}

module.exports = {
  dedupePacketsByMessageId
};
