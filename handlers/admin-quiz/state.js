const adminQuizStates = new Map();
const importStates = new Map();

function getState(userId) {
  return adminQuizStates.get(userId) || null;
}

function setState(userId, state) {
  adminQuizStates.set(userId, state);
}

function clearState(userId) {
  adminQuizStates.delete(userId);
}

function getImportState(userId) {
  return importStates.get(userId) || null;
}

function setImportState(userId, state) {
  importStates.set(userId, state);
}

function clearImportState(userId) {
  importStates.delete(userId);
}

module.exports = {
  getState,
  setState,
  clearState,
  getImportState,
  setImportState,
  clearImportState,
};
