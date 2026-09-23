const processedKeys = new Set();

function has(key) {
  return processedKeys.has(String(key));
}

function mark(key) {
  processedKeys.add(String(key));
}

function checkAndMark(key) {
  const normalizedKey = String(key);

  if (processedKeys.has(normalizedKey)) {
    return false;
  }

  processedKeys.add(normalizedKey);
  return true;
}

function remove(key) {
  return processedKeys.delete(String(key));
}

function clear() {
  processedKeys.clear();
}

module.exports = {
  has,
  mark,
  checkAndMark,
  remove,
  clear,
};
