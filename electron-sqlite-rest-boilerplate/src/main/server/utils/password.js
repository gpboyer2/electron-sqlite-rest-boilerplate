const crypto = require('crypto');

const PASSWORD_SCHEME = 'scrypt';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_SCHEME}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const [scheme, salt, hash] = storedHash.split('$');
  if (scheme !== PASSWORD_SCHEME || !salt || !hash) {
    return false;
  }

  const candidateHash = crypto.scryptSync(password, salt, 64);
  const originalHash = Buffer.from(hash, 'hex');

  if (candidateHash.length !== originalHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateHash, originalHash);
}

module.exports = {
  hashPassword,
  verifyPassword
};
