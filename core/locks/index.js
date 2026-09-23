const locks = new Map();

function acquire(key, owner, ttlMs = 30000) {
  const normalizedKey = String(key);
  const now = Date.now();

  const existing = locks.get(normalizedKey);

  if (existing && existing.expiresAt > now) {
    return false;
  }

  locks.set(normalizedKey, {
    owner: String(owner),
    acquiredAt: now,
    expiresAt: now + ttlMs,
  });

  return true;
}

function release(key, owner) {
  const normalizedKey = String(key);
  const existing = locks.get(normalizedKey);

  if (!existing || existing.owner !== String(owner)) {
    return false;
  }

  locks.delete(normalizedKey);
  return true;
}

function isLocked(key) {
  const existing = locks.get(String(key));

  if (!existing) {
    return false;
  }

  if (existing.expiresAt <= Date.now()) {
    locks.delete(String(key));
    return false;
  }

  return true;
}

function clear() {
  locks.clear();
}

module.exports = {
  acquire,
  release,
  isLocked,
  clear,
};
