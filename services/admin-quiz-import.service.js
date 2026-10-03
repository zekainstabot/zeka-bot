const https = require("https");
const http = require("http");

const MAX_PAGE_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 20 * 1000;

function fetchPage(url) {
  return new Promise(
    (resolve, reject) => {
      let parsedUrl;

      try {
        parsedUrl = new URL(url);
      } catch {
        reject(
          new Error(
            "Invalid URL"
          )
        );

        return;
      }

      if (
        ![
          "http:",
          "https:",
        ].includes(
          parsedUrl.protocol
        )
      ) {
        reject(
          new Error(
            "Only HTTP and HTTPS URLs are supported"
          )
        );

        return;
      }

      const client =
        parsedUrl.protocol ===
        "https:"
          ? https
          : http;

      const request =
        client.get(
          parsedUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml",
            },
          },
          (response) => {
            const status =
              response.statusCode || 0;

            if (
              status >= 300 &&
              status < 400 &&
              response.headers.location
            ) {
              response.resume();

              fetchPage(
                new URL(
                  response.headers.location,
                  parsedUrl
                ).toString()
              )
                .then(resolve)
                .catch(reject);

              return;
            }

            if (
              status < 200 ||
              status >= 300
            ) {
              response.resume();

              reject(
                new Error(
                  `HTTP ${status}`
                )
              );

              return;
            }

            let size = 0;
            const chunks = [];

            response.on(
              "data",
              (chunk) => {
                size += chunk.length;

                if (
                  size >
                  MAX_PAGE_SIZE
                ) {
                  response.destroy(
                    new Error(
                      "Page is too large"
                    )
                  );

                  return;
                }

                chunks.push(chunk);
              }
            );

            response.on(
              "end",
              () => {
                resolve(
                  Buffer.concat(
                    chunks
                  ).toString("utf8")
                );
              }
            );

            response.on(
              "error",
              reject
            );
          }
        );

      request.setTimeout(
        REQUEST_TIMEOUT,
        () => {
          request.destroy(
            new Error(
              "Request timeout"
            )
          );
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}

function decodeHtmlEntities(
  value
) {
  return String(value || "")
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&#(\d+);/g,
      (_, code) =>
        String.fromCharCode(
          Number(code)
        )
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code) =>
        String.fromCharCode(
          parseInt(code, 16)
        )
    );
}

function cleanText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(
      /\u200c/g,
      "‌"
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n\s+/g,
      "\n"
    )
    .trim();
}

function normalizeOption(
  value
) {
  return cleanText(value)
    .replace(
      /^[\s\u200c]*[الفبجدد][\s\u200c]*[)\-.:：]\s*/u,
      ""
    )
    .replace(
      /^[A-Da-d][\s\u200c]*[)\-.:：]\s*/,
      ""
    )
    .trim();
}

function getCorrectOption(
  optionText
) {
  const clean =
    String(optionText || "");

  if (
    /(?:✅|✔️|✓|☑️)/u.test(
      clean
    )
  ) {
    return true;
  }

  return false;
}

function removeCorrectMarker(
  value
) {
  return cleanText(value)
    .replace(
      /(?:✅|✔️|✓|☑️)/gu,
      ""
    )
    .trim();
}

function parseQuestionBlocks(
  html
) {
  const text =
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        "\n"
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        "\n"
      )
      .replace(
        /<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi,
        "\n"
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      );

  const lines =
    text
      .split(/\r?\n/)
      .map(cleanText)
      .filter(Boolean);

  const questions = [];

  let current = null;

  for (
    const line of lines
  ) {
    const questionMatch =
      line.match(
        /^\s*(\d{1,4})[.)]\s*(.+)$/
      );

    if (questionMatch) {
      if (
        current &&
        current.options.length
      ) {
        questions.push(
          current
        );
      }

      current = {
        sourceNumber:
          Number(
            questionMatch[1]
          ),
        question:
          questionMatch[2].trim(),
        options: [],
      };

      continue;
    }

    if (!current) {
      continue;
    }

    const optionMatch =
      line.match(
        /^\s*([الفبجد]|[A-Da-d])[\s.)\-:：]+\s*(.+)$/u
      );

    if (optionMatch) {
      const raw =
        optionMatch[2].trim();

      current.options.push({
        text:
          removeCorrectMarker(
            raw
          ),
        correct:
          getCorrectOption(
            raw
          ),
      });

      continue;
    }

    if (
      current.options.length ===
      0
    ) {
      current.question +=
        ` ${line}`;
    }
  }

  if (
    current &&
    current.options.length
  ) {
    questions.push(
      current
    );
  }

  return questions
    .filter(
      (item) =>
        item.question &&
        item.options.length ===
          4
    )
    .map(
      (item) => {
        const correctIndexes =
          item.options
            .map(
              (
                option,
                index
              ) =>
                option.correct
                  ? index
                  : -1
            )
            .filter(
              (index) =>
                index >= 0
            );

        return {
          sourceNumber:
            item.sourceNumber,
          question:
            cleanText(
              item.question
            ),
          options:
            item.options.map(
              (option) =>
                option.text
            ),
          correctOption:
            correctIndexes.length ===
            1
              ? correctIndexes[0]
              : null,
        };
      }
    );
}

async function importFromUrl(
  url
) {
  const normalizedUrl =
    String(url || "").trim();

  if (!normalizedUrl) {
    throw new Error(
      "URL is required"
    );
  }

  const html =
    await fetchPage(
      normalizedUrl
    );

  const questions =
    parseQuestionBlocks(
      html
    );

  return {
    url:
      normalizedUrl,
    total:
      questions.length,
    questions,
  };
}

module.exports = {
  importFromUrl,
  parseQuestionBlocks,
  cleanText,
};
