const { testConnection } = require('../../database/database');

function getHealthStatus() {
  testConnection();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  };
}

module.exports = {
  getHealthStatus
};
