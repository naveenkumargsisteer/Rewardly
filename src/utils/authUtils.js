const crypto = require('node:crypto');

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(String(pwd).trim()).digest('hex');
}

function parsePhoneAndAuth(rawPhone) {
  const str = String(rawPhone || '');
  if (!str.includes('###auth:')) {
    return { phone: str.trim(), passwordHash: null };
  }
  const [phone, authPart] = str.split('###auth:');
  const [hash] = (authPart || '').split('###');
  return { phone: phone.trim(), passwordHash: hash || null };
}

function packPhoneAndAuth(phone, passwordHash) {
  const basePhone = String(phone || '').split('###')[0].trim();
  if (!passwordHash) return basePhone;
  return `${basePhone}###auth:${passwordHash}`;
}

module.exports = {
  hashPassword,
  parsePhoneAndAuth,
  packPhoneAndAuth,
};

