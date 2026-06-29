const db = require('../config/db');

async function resolveEntityId(table, value, searchColumns = []) {
  if (!value) return null;

  const normalized = String(value).trim();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  if (!searchColumns.length) {
    return null;
  }

  const exactWhere = searchColumns.map((column) => `${column} = ?`).join(' OR ');
  const exactParams = searchColumns.map(() => normalized);
  const [exactRows] = await db.query(`SELECT id FROM ${table} WHERE ${exactWhere} LIMIT 1`, exactParams);
  if (exactRows.length) {
    return exactRows[0].id;
  }

  const likeValue = `%${normalized}%`;
  const [likeRows] = await db.query(
    `SELECT id FROM ${table} WHERE CONCAT_WS(' ', ${searchColumns.join(', ')}) LIKE ? LIMIT 1`,
    [likeValue]
  );

  return likeRows.length ? likeRows[0].id : null;
}

module.exports = {
  resolveEntityId,
};
