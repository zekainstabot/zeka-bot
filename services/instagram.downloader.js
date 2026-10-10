async function downloadStoryWithGalleryDl({
  url,
  jobDirectory,
}) {
  console.log(
    "Instagram Story gallery-dl fallback started without cookies."
  );

  const args = [
    "-D",
    jobDirectory,
    "--no-mtime",
    url,
  ];

  await execFileAsync(
    "gallery-dl",
    args,
    {
      timeout: 90000,
      maxBuffer: 5 * 1024 * 1024,
    }
  );

  const supportedExtensions = [
    ".mp4",
    ".mov",
    ".webm",
    ".mkv",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".avif",
  ];

  function collectMediaFiles(directory) {
    const found = [];

    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const fullPath = path.join(
        directory,
        entry.name
      );

      if (entry.isDirectory()) {
        found.push(
          ...collectMediaFiles(fullPath)
        );
        continue;
      }

      if (
        entry.isFile() &&
        supportedExtensions.includes(
          path.extname(entry.name).toLowerCase()
        )
      ) {
        found.push(fullPath);
      }
    }

    return found;
  }

  const files = collectMediaFiles(jobDirectory);

  if (!files.length) {
    throw new Error(
      "gallery-dl finished but no supported Story media was found."
    );
  }

  files.sort((a, b) => {
    const aIsVideo =
      detectFileContentType(a) === "VIDEO";

    const bIsVideo =
      detectFileContentType(b) === "VIDEO";

    if (aIsVideo !== bIsVideo) {
      return aIsVideo ? -1 : 1;
    }

    return (
      fs.statSync(b).size -
      fs.statSync(a).size
    );
  });

  const filePath = files[0];

  console.log(
    "Instagram Story gallery-dl completed:",
    filePath
  );

  return {
    success: true,
    filePath,
    fileSize: fs.statSync(filePath).size,
    contentType: detectFileContentType(filePath),
    mediaType: "STORY",
    sourceUrl: url,
    finalCost: null,
  };
}
