const fs = require("fs/promises");

async function fileExists(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function deleteFile(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await fs.unlink(filePath);

    console.log(
      `Temporary file deleted: ${filePath}`
    );

    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    console.error(
      `Failed to delete file: ${filePath}`,
      error
    );

    return false;
  }
}

module.exports = {
  fileExists,
  deleteFile,
};
