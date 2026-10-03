const fortuneRepository = require(
  "../repositories/fortune.repository"
);

async function listCategories({
  activeOnly = true,
} = {}) {
  return fortuneRepository.listCategories({
    activeOnly,
  });
}

async function getCategoryById(
  categoryId
) {
  return fortuneRepository.getCategoryById(
    categoryId
  );
}

async function getCategoryBySlug(
  slug
) {
  return fortuneRepository.getCategoryBySlug(
    slug
  );
}

async function createFortune({
  categoryId,
  title = null,
  content,
  sourceUrl = null,
  sourceNumber = null,
  createdBy = null,
}) {
  if (!categoryId) {
    throw new Error(
      "Fortune category is required"
    );
  }

  if (
    !content ||
    !String(content).trim()
  ) {
    throw new Error(
      "Fortune content is required"
    );
  }

  return fortuneRepository.createFortune({
    categoryId,
    title,
    content:
      String(content).trim(),
    sourceUrl,
    sourceNumber,
    createdBy,
  });
}

async function createFortunes(
  fortunes
) {
  if (
    !Array.isArray(fortunes) ||
    fortunes.length === 0
  ) {
    return [];
  }

  for (
    const fortune of fortunes
  ) {
    if (
      !fortune.categoryId ||
      !fortune.content ||
      !String(
        fortune.content
      ).trim()
    ) {
      throw new Error(
        "Invalid fortune data"
      );
    }
  }

  return fortuneRepository.createFortunes(
    fortunes.map(
      (fortune) => ({
        ...fortune,
        content:
          String(
            fortune.content
          ).trim(),
      })
    )
  );
}

async function getRandomFortune(
  categoryId
) {
  if (!categoryId) {
    throw new Error(
      "Fortune category is required"
    );
  }

  return fortuneRepository.getRandomFortune(
    categoryId
  );
}

async function countFortunes({
  categoryId = null,
  activeOnly = true,
} = {}) {
  return fortuneRepository.countFortunes({
    categoryId,
    activeOnly,
  });
}

module.exports = {
  listCategories,
  getCategoryById,
  getCategoryBySlug,
  createFortune,
  createFortunes,
  getRandomFortune,
  countFortunes,
};
