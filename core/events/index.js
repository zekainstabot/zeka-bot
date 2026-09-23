const listeners = new Map();

function on(eventName, handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Event handler must be a function");
  }

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }

  listeners.get(eventName).add(handler);

  return () => off(eventName, handler);
}

function off(eventName, handler) {
  const handlers = listeners.get(eventName);

  if (!handlers) {
    return false;
  }

  const removed = handlers.delete(handler);

  if (handlers.size === 0) {
    listeners.delete(eventName);
  }

  return removed;
}

async function emit(eventName, payload = {}) {
  const handlers = listeners.get(eventName);

  if (!handlers) {
    return;
  }

  for (const handler of [...handlers]) {
    await handler(payload);
  }
}

function clear() {
  listeners.clear();
}

module.exports = {
  on,
  off,
  emit,
  clear,
};
