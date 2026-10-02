const adminQuizStates = new Map();

function getState(userId) {
  return adminQuizStates.get(userId) || null;
}

function setState(userId, state) {
  adminQuizStates.set(userId, state);
}

function clearState(userId) {
  adminQuizStates.delete(userId);
}

module.exports = {
  getState,
  setState,
  clearState,
};
