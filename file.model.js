const db = require('../config/db');

async function createFile({
  userId,
  filename,
  originalName,
  folderPath,
  size,
  mimeType,
  storagePath,
}) {
  const result = await db.query(
    `INSERT INTO files
       (user_id, filename, original_name, folder_path, size, mime_type, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, filename, originalName, folderPath, size, mimeType, storagePath]
  );
  return result.rows[0];
}

async function listFilesForUser(userId, folderPath) {
  if (folderPath) {
    const result = await db.query(
      `SELECT id, original_name, folder_path, size, mime_type, created_at, share_token
       FROM files WHERE user_id = $1 AND folder_path = $2
       ORDER BY created_at DESC`,
      [userId, folderPath]
    );
    return result.rows;
  }
  const result = await db.query(
    `SELECT id, original_name, folder_path, size, mime_type, created_at, share_token
     FROM files WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function findById(fileId) {
  const result = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
  return result.rows[0] || null;
}

async function findByShareToken(token) {
  const result = await db.query('SELECT * FROM files WHERE share_token = $1', [token]);
  return result.rows[0] || null;
}

async function deleteById(fileId) {
  const result = await db.query('DELETE FROM files WHERE id = $1 RETURNING *', [fileId]);
  return result.rows[0] || null;
}

async function setShareToken(fileId, token) {
  const result = await db.query(
    'UPDATE files SET share_token = $2 WHERE id = $1 RETURNING *',
    [fileId, token]
  );
  return result.rows[0];
}

module.exports = {
  createFile,
  listFilesForUser,
  findById,
  findByShareToken,
  deleteById,
  setShareToken,
};
