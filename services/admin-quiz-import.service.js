const https = require("https");
const http = require("http");
const dns = require("dns").promises;
const net = require("net");

const MAX_PAGE_SIZE = 5 * 1024 * 1024;
const REQUEST_TIMEOUT = 20 * 1000;
const MAX_REDIRECTS = 5;

const ALLOWED_PROTOCOLS = new Set([
  "http:",
  "https:",
]);

function isBlockedIPv4(ip) {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (
      a === 100 &&
      b >= 64 &&
      b <= 127
    ) ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 0 &&
      c === 0
    ) ||
    (
      a === 192 &&
      b === 0 &&
      c === 2
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    (
      a === 198 &&
      (
        b === 18 ||
        b === 19 ||
        (
          b === 51 &&
          c === 100
        )
      )
    ) ||
    (
      a === 203 &&
      b === 0 &&
      c === 113
    )
  );
}

function normalizeIPv6(ip) {
  let value = String(ip || "")
    .toLowerCase()
    .split("%")[0];

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);

    if (net.isIP(mapped) === 4) {
      return mapped;
    }

    const groups = mapped.split(":");

    if (groups.length === 2) {
      const high = parseInt(groups[0], 16);
      const low = parseInt(groups[1], 16);

      if (
        Number.isInteger(high) &&
        Number.isInteger(low)
      ) {
        return [
          (high >> 8) & 255,
          high & 255,
          (low >> 8) & 255,
          low & 255,
        ].join(".");
      }
    }
  }

  return value;
}

function isBlockedIPv6(ip) {
  const normalized = normalizeIPv6(ip);

  if (net.isIP(normalized) === 4) {
    return isBlockedIPv4(normalized);
  }

  if (net.isIP(normalized) !== 6) {
    return true;
  }

  const value = normalized.split("%")[0];

  // Unspecified and loopback.
  if (
    value === "::" ||
    value === "::1"
  ) {
    return true;
  }

  // Unique local addresses: fc00::/7.
  if (/^(fc|fd)/i.test(value)) {
    return true;
  }

  // Link-local: fe80::/10.
  if (/^fe[89ab]/i.test(value)) {
    return true;
  }

  // Multicast: ff00::/8.
  if (/^ff/i.test(value)) {
    return true;
  }

  // IPv4-compatible and IPv4-mapped ranges.
  if (
    value.startsWith("::") ||
    value.startsWith("::ffff:")
  ) {
    return true;
  }

  // Only globally routable 2000::/3 addresses.
  if (!/^2[0-9a-f]{3}:/i.test(value)) {
    return true;
  }

  // Documentation range: 2001:db8::/32.
  if (/^2001:db8:/i.test(value)) {
    return true;
  }

  return false;
}

function isBlockedAddress(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    return isBlockedIPv4(ip);
  }

  if (version === 6) {
    return isBlockedIPv6(ip);
  }

  return true;
}

function validateUrl(input) {
  let parsedUrl;

  try {
    parsedUrl = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (
    !ALLOWED_PROTOCOLS.has(
      parsedUrl.protocol
    )
  ) {
    throw new Error(
      "Only HTTP and HTTPS URLs are supported"
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "URLs containing credentials are not allowed"
    );
  }

  if (
    parsedUrl.port &&
    !["80", "443"].includes(
      parsedUrl.port
    )
  ) {
    throw new Error(
      "Only standard HTTP and HTTPS ports are allowed"
    );
  }

  const hostname = parsedUrl.hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error(
      "Local and internal addresses are not allowed"
    );
  }

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error(
        "Private or reserved IP addresses are not allowed"
      );
    }
  }

  return parsedUrl;
}

async function resolvePublicAddress(hostname) {
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error(
        "Private or reserved IP addresses are not allowed"
      );
    }

    return {
      address: hostname,
      family: net.isIP(hostname),
    };
  }

  let records;

  try {
    records = await dns.lookup(
      hostname,
      {
        all: true,
        verbatim: true,
      }
    );
  } catch {
    throw new Error(
      "Unable to resolve the website hostname"
    );
  }

  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    throw new Error(
      "Website hostname has no valid IP address"
    );
  }

  // Reject the hostname if any returned address is unsafe.
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw new Error(
        "Website resolves to a private or reserved IP address"
      );
    }
  }

  return records[0];
}

function fetchPage(inputUrl, redirectCount = 0, previousProtocol = null) {
  return new Promise(
    async (resolve, reject) => {
      let parsedUrl;

      try {
        parsedUrl = validateUrl(inputUrl);

        if (redirectCount > MAX_REDIRECTS) {
          throw new Error(
            "Too many redirects"
          );
        }

        if (
          previousProtocol === "https:" &&
          parsedUrl.protocol === "http:"
        ) {
          throw new Error(
            "HTTPS to HTTP redirects are not allowed"
          );
        }
      } catch (error) {
        reject(error);
        return;
      }

      try {
        const hostname = parsedUrl.hostname
          .replace(/^\[|\]$/g, "");

        const resolved =
          await resolvePublicAddress(hostname);

        const client =
          parsedUrl.protocol === "https:"
            ? https
            : http;

        const request = client.get(
          parsedUrl,
          {
            lookup: (
              requestedHostname,
              options,
              callback
            ) => {
              if (typeof options === "function") {
                callback = options;
              }

              callback(
                null,
                resolved.address,
                resolved.family
              );
            },

            headers: {
              "User-Agent":
                "ZekaBot-QuizImporter/1.0",

              Accept:
                "text/html,application/xhtml+xml",
            },
          },
          (response) => {
            const status =
              response.statusCode || 0;

            if (
              status >= 300 &&
              status < 400
            ) {
              const location =
                response.headers.location;

              response.resume();

              if (!location) {
                reject(
                  new Error(
                    "Redirect response has no location"
                  )
                );

                return;
              }

              if (
                redirectCount >= MAX_REDIRECTS
              ) {
                reject(
                  new Error(
                    "Too many redirects"
                  )
                );

                return;
              }

              let redirectUrl;

              try {
                redirectUrl = new URL(
                  location,
                  parsedUrl
                ).toString();
              } catch {
                reject(
                  new Error(
                    "Invalid redirect URL"
                  )
                );

                return;
              }

              fetchPage(
                redirectUrl,
                redirectCount + 1,
                parsedUrl.protocol
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

            const contentType = String(
              response.headers["content-type"] || ""
            ).toLowerCase();

            if (
              contentType &&
              !contentType.includes("text/html") &&
              !contentType.includes("application/xhtml+xml")
            ) {
              response.resume();

              reject(
                new Error(
                  "The URL does not return an HTML page"
                )
              );

              return;
            }

            const contentLength = Number(
              response.headers["content-length"] || 0
            );

            if (
              contentLength > MAX_PAGE_SIZE
            ) {
              response.destroy();

              reject(
                new Error(
                  "Page is too large"
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

                if (size > MAX_PAGE_SIZE) {
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
                  Buffer.concat(chunks)
                    .toString("utf8")
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
      } catch (error) {
        reject(error);
      }
    }
  );
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(
      /&#(\d+);/g,
      (_, code) =>
        String.fromCodePoint(
          Number(code)
        )
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, code) =>
        String.fromCodePoint(
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
    .replace(/\u200c/g, "‌")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeOption(value) {
  return cleanText(value)
    .replace(
      /^[\s\u200c]*[الفبجد][\s\u200c]*[)\-.:：]\s*/u,
      ""
    )
    .replace(
      /^[A-Da-d][\s\u200c]*[)\-.:：]\s*/,
      ""
    )
    .trim();
}

function getCorrectOption(optionText) {
  return /(?:✅|✔️|✓|☑️)/u.test(
    String(optionText || "")
  );
}

function removeCorrectMarker(value) {
  return cleanText(value)
    .replace(
      /(?:✅|✔️|✓|☑️)/gu,
      ""
    )
    .trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const persianIndex = persian.indexOf(digit);

    if (persianIndex >= 0) return String(persianIndex);

    const arabicIndex = arabic.indexOf(digit);
    return arabicIndex >= 0 ? String(arabicIndex) : digit;
  });
}

function normalizeCorrectOptionIndex(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }

  const index = Number(value);

  return Number.isInteger(index) && index >= 0 && index <= 3
    ? index
    : null;
}

function parseQuestionBlocks(html) {
  const text = String(html || "")
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

  const lines = text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);

  const questions = [];

  let current = null;

  for (const line of lines) {
    const questionMatch = line.match(
      /^\s*([0-9۰-۹٠-٩]{1,4})[.)]\s*(.+)$/
    );

    if (questionMatch) {
      if (
        current &&
        current.options.length
      ) {
        questions.push(current);
      }

      current = {
        sourceNumber: Number(
          normalizeDigits(questionMatch[1])
        ),
        question: questionMatch[2].trim(),
        options: [],
      };

      continue;
    }

    if (!current) {
      continue;
    }

    const optionMatch = line.match(
      /^\s*(الف|ب|ج|د|[A-Da-d])[\s.)\-:：]+\s*(.+)$/u
    );

    if (optionMatch) {
      const raw = optionMatch[2].trim();

      current.options.push({
        text: removeCorrectMarker(raw),
        correct: getCorrectOption(raw),
      });

      continue;
    }

    if (current.options.length === 0) {
      current.question += ` ${line}`;
    }
  }

  if (
    current &&
    current.options.length
  ) {
    questions.push(current);
  }

  return questions
    .filter(
      (item) =>
        item.question &&
        item.options.length === 4
    )
    .map((item) => {
      const correctIndexes =
        item.options
          .map(
            (option, index) =>
              option.correct ? index : -1
          )
          .filter((index) => index >= 0);

      return {
        sourceNumber: item.sourceNumber,

        question: cleanText(
          item.question
        ),

        options: item.options.map(
          (option) => option.text
        ),

        correctOption:
          correctIndexes.length === 1
            ? correctIndexes[0]
            : null,
      };
    });
}

async function importFromUrl(url) {
  const normalizedUrl = String(
    url || ""
  ).trim();

  if (!normalizedUrl) {
    throw new Error(
      "URL is required"
    );
  }

  const parsedUrl = validateUrl(
    normalizedUrl
  );

  const html = await fetchPage(
    parsedUrl.toString()
  );

  const questions = parseQuestionBlocks(
    html
  );

  return {
    url: parsedUrl.toString(),
    total: questions.length,
    questions,
  };
}

module.exports = {
  importFromUrl,
  parseQuestionBlocks,
  normalizeCorrectOptionIndex,
  cleanText,
  validateUrl,
  isBlockedAddress,
};
