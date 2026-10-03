const {
  getClient,
} = require("../database/client");

async function createCategory({
  nameFa,
  slug,
}) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO fortune_categories (
        name_fa,
        slug
      )
      VALUES ($1, $2)
      ON CONFLICT (slug)
      DO UPDATE SET
        name_fa = EXCLUDED.name_fa,
        updated_at = NOW()
      RETURNING *
    `,
    [
      nameFa,
      slug,
    ]
  );

  return result.rows[0] || null;
}

async function listCategories({
  activeOnly = true,
} = {}) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        id,
        name_fa,
        slug,
        is_active,
        created_at,
        updated_at
      FROM fortune_categories
      ${
        activeOnly
          ? "WHERE is_active = TRUE"
          : ""
      }
      ORDER BY id ASC
    `
  );

  return result.rows;
}

async function getCategoryById(
  categoryId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM fortune_categories
      WHERE id = $1
      LIMIT 1
    `,
    [categoryId]
  );

  return result.rows[0] || null;
}

async function getCategoryBySlug(
  slug
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT *
      FROM fortune_categories
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0] || null;
}

async function createFortune({
  categoryId,
  title = null,
  content,
  sourceUrl = null,
  sourceNumber = null,
  createdBy = null,
}) {
  const db = getClient();

  const result = await db.query(
    `
      INSERT INTO fortunes (
        category_id,
        title,
        content,
        source_url,
        source_number,
        status,
        created_by,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'ACTIVE',
        $6,
        $6
      )
      RETURNING *
    `,
    [
      categoryId,
      title,
      content,
      sourceUrl,
      sourceNumber,
      createdBy,
    ]
  );

  return result.rows[0] || null;
}

async function createFortunes(
  fortunes
) {
  const db = getClient();

  if (
    !Array.isArray(fortunes) ||
    fortunes.length === 0
  ) {
    return [];
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const created = [];

    for (
      const fortune of fortunes
    ) {
      const result =
        await client.query(
          `
            INSERT INTO fortunes (
              category_id,
              title,
              content,
              source_url,
              source_number,
              status,
              created_by,
              updated_by
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              'ACTIVE',
              $6,
              $6
            )
            RETURNING *
          `,
          [
            fortune.categoryId,
            fortune.title || null,
            fortune.content,
            fortune.sourceUrl || null,
            fortune.sourceNumber || null,
            fortune.createdBy || null,
          ]
        );

      if (result.rows[0]) {
        created.push(
          result.rows[0]
        );
      }
    }

    await client.query("COMMIT");

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRandomFortune(
  categoryId
) {
  const db = getClient();

  const result = await db.query(
    `
      SELECT
        f.*
      FROM fortunes f
      WHERE
        f.category_id = $1
        AND f.status = 'ACTIVE'
      ORDER BY RANDOM()
      LIMIT 1
    `,
    [categoryId]
  );

  return result.rows[0] || null;
}

async function countFortunes({
  categoryId = null,
  activeOnly = true,
} = {}) {
  const db = getClient();

  const values = [];
  const conditions = [];

  if (categoryId) {
    values.push(
      Number(categoryId)
    );

    conditions.push(
      `category_id = $${values.length}`
    );
  }

  if (activeOnly) {
    conditions.push(
      "status = 'ACTIVE'"
    );
  }

  const where =
    conditions.length
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM fortunes
      ${where}
    `,
    values
  );

  return Number(
    result.rows[0]?.count || 0
  );
}

module.exports = {
  createCategory,
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  createFortune,
  createFortunes,
  getRandomFortune,
  countFortunes,
};
