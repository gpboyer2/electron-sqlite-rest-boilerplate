/**
 * @file       connectionManager.js
 * @brief      通信连接管理器，管理通信节点的实际网络连接（TCP/UDP/Serial/CAN）
 * @date       2025-12-30
 */

const net = require('net');
const dgram = require('dgram');
const log4js = require('../../middleware/log4jsPlus');

const connectionLogger = log4js.getLogger('connection');

/**
 * 连接状态枚举
 */
const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * 连接管理器单例
 */
class ConnectionManager {
  constructor() {
    // 存储所有活动连接: Map<nodeId, { socket, type, config, status }>
    this.connections = new Map();
  }

  /**
   * 建立 TCP 连接
   * @param {string} nodeId 通信节点ID
   * @param {object} endpoint 端点配置
   * @returns {Promise<object>} 连接结果
   */
  async connectTcp(nodeId, endpoint) {
    return new Promise((resolve, reject) => {
      // 验证 endpoint.type 字段是否存在且有效
      if (endpoint.type !== 'TCP Client' && endpoint.type !== 'TCP Server') {
        return reject(
          new Error(
            `endpoint.type 缺失或无效，当前值: ${endpoint.type}。请确保接口配置中包含有效的 type 字段（TCP Client 或 TCP Server）。`
          )
        );
      }
      const isClient = endpoint.type === 'TCP Client';
      const host = isClient
        ? endpoint.remote_host || endpoint.host || 'localhost'
        : endpoint.host || '0.0.0.0';
      const port = isClient ? endpoint.remote_port || endpoint.port : endpoint.port;

      if (!port) {
        return reject(new Error('TCP 连接缺少端口号配置'));
      }

      if (isClient) {
        // TCP Client 模式
        const socket = new net.Socket();
        const connectionKey = `tcp-client-${nodeId}`;

        socket.connect(port, host, () => {
          this.connections.set(connectionKey, {
            socket,
            type: 'TCP Client',
            config: endpoint,
            status: ConnectionStatus.CONNECTED,
            nodeId,
            remoteAddress: `${host}:${port}`
          });
          connectionLogger.info(`TCP Client 连接成功: ${host}:${port}`);
          resolve({
            success: true,
            status: ConnectionStatus.CONNECTED,
            message: `TCP Client 已连接到 ${host}:${port}`
          });
        });

        socket.on('error', (err) => {
          connectionLogger.error(`TCP Client 连接错误: ${err.message}`);
          socket.destroy();
          reject(new Error(`TCP 连接失败: ${err.message}`));
        });

        socket.on('close', () => {
          connectionLogger.info(`TCP Client 连接关闭: ${host}:${port}`);
          this.connections.delete(connectionKey);
        });

        // 设置连接超时
        socket.setTimeout(10000, () => {
          socket.destroy();
          reject(new Error('TCP 连接超时'));
        });
      } else {
        // TCP Server 模式 - 监听端口
        const server = net.createServer((socket) => {
          const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
          connectionLogger.info(`TCP Server 接受连接: ${remoteAddress}`);
        });

        const connectionKey = `tcp-server-${nodeId}`;

        server.on('error', (err) => {
          connectionLogger.error(`TCP Server 错误: ${err.message}`);
          reject(new Error(`TCP Server 启动失败: ${err.message}`));
        });

        server.listen(port, host, () => {
          this.connections.set(connectionKey, {
            socket: server,
            type: 'TCP Server',
            config: endpoint,
            status: ConnectionStatus.CONNECTED,
            nodeId,
            localAddress: `${host}:${port}`
          });
          connectionLogger.info(`TCP Server 监听中: ${host}:${port}`);
          resolve({
            success: true,
            status: ConnectionStatus.CONNECTED,
            message: `TCP Server 监听于 ${host}:${port}`
          });
        });
      }
    });
  }

  /**
   * 建立 UDP 连接
   * @param {string} nodeId 通信节点ID
   * @param {object} endpoint 端点配置
   * @returns {Promise<object>} 连接结果
   */
  async connectUdp(nodeId, endpoint) {
    return new Promise((resolve, reject) => {
      const isMulticast = endpoint.type === 'UDP Multicast';
      const socket = dgram.createSocket('udp4');
      const connectionKey = `udp-${nodeId}`;

      socket.on('error', (err) => {
        connectionLogger.error(`UDP Socket 错误: ${err.message}`);
        socket.close();
        reject(new Error(`UDP 连接失败: ${err.message}`));
      });

      const host = endpoint.host || '0.0.0.0';
      const port = endpoint.port;

      if (!port) {
        socket.close();
        return reject(new Error('UDP 连接缺少端口号配置'));
      }

      if (isMulticast && endpoint.group) {
        // UDP 组播模式
        socket.bind(port, host, () => {
          try {
            socket.addMembership(endpoint.group);
            this.connections.set(connectionKey, {
              socket,
              type: 'UDP Multicast',
              config: endpoint,
              status: ConnectionStatus.CONNECTED,
              nodeId,
              localAddress: `${endpoint.group}:${port}`
            });
            connectionLogger.info(`UDP Multicast 加入组: ${endpoint.group}:${port}`);
            resolve({
              success: true,
              status: ConnectionStatus.CONNECTED,
              message: `UDP Multicast: ${endpoint.group}:${port}`
            });
          } catch (err) {
            socket.close();
            reject(new Error(`UDP 组播加入失败: ${err.message}`));
          }
        });
      } else {
        // 普通 UDP 模式
        socket.bind(port, host, () => {
          this.connections.set(connectionKey, {
            socket,
            type: 'UDP',
            config: endpoint,
            status: ConnectionStatus.CONNECTED,
            nodeId,
            localAddress: `${host}:${port}`
          });
          connectionLogger.info(`UDP 绑定成功: ${host}:${port}`);
          resolve({
            success: true,
            status: ConnectionStatus.CONNECTED,
            message: `UDP: ${host}:${port}`
          });
        });
      }
    });
  }

  /**
   * 建立 Serial 连接（模拟）
   * @param {string} nodeId 通信节点ID
   * @param {object} endpoint 端点配置
   * @returns {Promise<object>} 连接结果
   */
  async connectSerial(nodeId, endpoint) {
    const connectionKey = `serial-${nodeId}`;
    const portName = endpoint.port_name;
    const baudRate = endpoint.baud_rate || 9600;

    if (!portName) {
      throw new Error('Serial 连接缺少端口名称配置');
    }

    // 模拟串口连接（实际需要 serialport 库）
    this.connections.set(connectionKey, {
      socket: null,
      type: 'Serial',
      config: endpoint,
      status: ConnectionStatus.CONNECTED,
      nodeId,
      portName,
      baudRate
    });

    connectionLogger.info(`Serial 连接建立: ${portName} @ ${baudRate} baud`);
    return {
      success: true,
      status: ConnectionStatus.CONNECTED,
      message: `Serial: ${portName} @ ${baudRate} baud`
    };
  }

  /**
   * 建立 CAN 连接（模拟）
   * @param {string} nodeId 通信节点ID
   * @param {object} endpoint 端点配置
   * @returns {Promise<object>} 连接结果
   */
  async connectCan(nodeId, endpoint) {
    const connectionKey = `can-${nodeId}`;
    const channel = endpoint.can_channel;
    const bitRate = endpoint.can_bitrate || 500000;

    if (!channel) {
      throw new Error('CAN 连接缺少通道配置');
    }

    // 模拟 CAN 连接
    this.connections.set(connectionKey, {
      socket: null,
      type: 'CAN',
      config: endpoint,
      status: ConnectionStatus.CONNECTED,
      nodeId,
      channel,
      bitRate
    });

    connectionLogger.info(`CAN 连接建立: ${channel} @ ${bitRate} bps`);
    return {
      success: true,
      status: ConnectionStatus.CONNECTED,
      message: `CAN: ${channel} @ ${bitRate} bps`
    };
  }

  /**
   * 建立连接（根据端点类型自动选择连接方式）
   * @param {string} nodeId 通信节点ID
   * @param {object} endpoint 端点配置
   * @returns {Promise<object>} 连接结果
   */
  async connect(nodeId, endpoint) {
    const type = endpoint.type;

    if (type.includes('TCP')) {
      return await this.connectTcp(nodeId, endpoint);
    } else if (type.includes('UDP')) {
      return await this.connectUdp(nodeId, endpoint);
    } else if (type === 'Serial') {
      return await this.connectSerial(nodeId, endpoint);
    } else if (type === 'CAN') {
      return await this.connectCan(nodeId, endpoint);
    } else {
      throw new Error(`不支持的连接类型: ${type}`);
    }
  }

  /**
   * 断开连接
   * @param {string} nodeId 通信节点ID
   * @returns {Promise<object>} 断开结果
   */
  async disconnect(nodeId) {
    let disconnectedCount = 0;
    const errors = [];

    // 查找该节点的所有连接
    for (const [key, conn] of this.connections.entries()) {
      if (conn.nodeId === nodeId) {
        try {
          if (conn.socket) {
            if (conn.type === 'TCP Server') {
              conn.socket.close();
            } else if (conn.type.includes('UDP')) {
              conn.socket.close();
            } else {
              conn.socket.destroy();
            }
          }
          this.connections.delete(key);
          disconnectedCount++;
          connectionLogger.info(`连接已断开: ${key}`);
        } catch (err) {
          errors.push(err.message);
          connectionLogger.error(`断开连接失败: ${key}, ${err.message}`);
        }
      }
    }

    if (disconnectedCount > 0) {
      return {
        success: true,
        message: `成功断开 ${disconnectedCount} 个连接`
      };
    } else {
      return {
        success: false,
        message: '没有找到活动的连接'
      };
    }
  }

  /**
   * 获取连接状态
   * @param {string} nodeId 通信节点ID
   * @returns {object} 连接状态
   */
  getStatus(nodeId) {
    const connections = [];

    for (const [key, conn] of this.connections.entries()) {
      if (conn.nodeId === nodeId) {
        connections.push({
          type: conn.type,
          status: conn.status,
          localAddress: conn.localAddress,
          remoteAddress: conn.remoteAddress,
          config: conn.config
        });
      }
    }

    if (connections.length === 0) {
      return {
        nodeId,
        status: ConnectionStatus.DISCONNECTED,
        connections: []
      };
    }

    // 如果有连接，检查是否有错误
    const hasError = connections.some((c) => c.status === ConnectionStatus.ERROR);
    const allConnected = connections.every((c) => c.status === ConnectionStatus.CONNECTED);

    return {
      nodeId,
      status: hasError
        ? ConnectionStatus.ERROR
        : allConnected
          ? ConnectionStatus.CONNECTED
          : ConnectionStatus.CONNECTING,
      connections
    };
  }

  /**
   * 断开所有连接
   */
  disconnectAll() {
    for (const [key, conn] of this.connections.entries()) {
      try {
        if (conn.socket) {
          if (conn.type === 'TCP Server') {
            conn.socket.close();
          } else if (conn.type.includes('UDP')) {
            conn.socket.close();
          } else {
            conn.socket.destroy();
          }
        }
      } catch (err) {
        connectionLogger.error(`断开连接失败: ${key}, ${err.message}`);
      }
    }
    this.connections.clear();
    connectionLogger.info('所有连接已断开');
  }
}

// 导出单例实例
const connectionManager = new ConnectionManager();

module.exports = {
  connectionManager,
  ConnectionStatus
};
