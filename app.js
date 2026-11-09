const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { initializeDatabase } = require("./database/bootstrap");
const { getClient, close } = require("./database/client");
const { getDownloadErrorMessage } = require("./services/download-error.service");
const { startBot } = require("./bot");
const bugReportCleanupService = require("./services/bug-report-cleanup.service");
const { startTempFileCleanupService } = require("./services/scheduled-file-cleanup.service");
const { startZekaMediaExpirationService, stopZekaMediaExpirationService } = require("./services/zeka-media-expiration.service");
const { startDailyCreditScheduler, stopDailyCreditScheduler } = require("./scheduler/daily-credit.scheduler");

const PORT = Number(process.env.PORT) || 10000;
let isReady = false;
let startupError = null;

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

function safeSecretEqual(a, b) {
  const crypto = require("crypto");
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) throw new Error("BODY_TOO_LARGE");
  }
  return JSON.parse(raw || "{}");
}

async function handleWebApi(req, res, url) {
  if (!url.pathname.startsWith("/api/web/")) return false;
  if (!safeSecretEqual(req.headers["x-zeka-web-secret"], process.env.ZEKA_WEB_API_SECRET)) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return true;
  }
  if (!process.env.ZEKA_WEB_API_SECRET) {
    sendJson(res, 503, { error: "WEB_API_NOT_CONFIGURED" });
    return true;
  }

  const db = getClient();

  if (url.pathname === "/api/web/downloads" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const userId = String(body.userId || "");
      const inputUrl = String(body.url || "").trim();
      if (!/^\d+$/.test(userId) || !inputUrl || inputUrl.length > 2048) {
        sendJson(res, 400, { error: "INVALID_INPUT" });
        return true;
      }

      const userResult = await db.query("SELECT id FROM users WHERE id = $1 LIMIT 1", [userId]);
      if (!userResult.rows[0]) {
        sendJson(res, 404, { error: "USER_NOT_FOUND" });
        return true;
      }

      const { parseUrl } = require("./services/url.service");
      const parsed = parseUrl(inputUrl);
      if (!parsed.valid || parsed.platform !== "instagram") {
        sendJson(res, 400, { error: "INVALID_INSTAGRAM_URL" });
        return true;
      }

      const { createDownloadRequest } = require("./services/request.service");
      const result = await createDownloadRequest({
        userId: userResult.rows[0].id,
        platform: parsed.platform,
        originalUrl: inputUrl,
        normalizedUrl: parsed.url,
        contentType: parsed.contentType,
      });

      sendJson(res, 202, {
        requestId: String(result.request.id),
        jobId: String(result.job.id),
        status: result.job.status,
      });
      return true;
    } catch (error) {
      if (error.code === "DUPLICATE_ACTIVE_REQUEST") {
        sendJson(res, 409, { error: "DUPLICATE_ACTIVE_REQUEST" });
      } else if (error.code === "PLATFORM_DISABLED") {
        sendJson(res, 403, { error: "PLATFORM_DISABLED" });
      } else {
        console.error("Web download request failed:", error);
        sendJson(res, 500, { error: "DOWNLOAD_REQUEST_FAILED" });
      }
      return true;
    }
  }


  if (url.pathname === "/api/web/downloads" && req.method === "GET") {
    const userId = String(url.searchParams.get("userId") || "");
    if (!/^\\d+$/.test(userId)) {
      sendJson(res, 400, { error: "INVALID_USER" });
      return true;
    }

    const result = await db.query(
      `SELECT j.id, j.status, j.error_code, j.created_at, j.completed_at,
              j.progress_percent, j.progress_message, j.progress_updated_at,
              r.original_url,
              m.content_type AS media_content_type,
              m.file_deleted_at, m.expires_at
       FROM jobs j
       INNER JOIN requests r ON r.id = j.request_id
       LEFT JOIN zeka_media_queue m ON m.job_id = j.id
       WHERE j.user_id = $1
       ORDER BY j.created_at DESC, j.id DESC
       LIMIT 25`,
      [userId]
    );

    const downloads = result.rows.map((row) => ({
      id: String(row.id),
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.status === "FAILED" ? getDownloadErrorMessage(row.error_code) : null,
      progressPercent: Number(row.progress_percent || 0),
      progressMessage: row.progress_message || null,
      progressUpdatedAt: row.progress_updated_at || null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      originalUrl: row.original_url,
      mediaContentType: row.media_content_type || null,
      previewAvailable: Boolean(
        row.media_content_type &&
        !row.file_deleted_at &&
        row.expires_at &&
        new Date(row.expires_at).getTime() > Date.now()
      ),
    }));

    sendJson(res, 200, { downloads });
    return true;
  }

  const fileMatch = url.pathname.startsWith("/api/web/downloads/") ? url.pathname.slice("/api/web/downloads/".length).match(/^([0-9]+)\/file$/) : null;
  if (fileMatch && req.method === "GET") {
    const userId = String(url.searchParams.get("userId") || "");
    if (!/^\d+$/.test(userId)) {
      sendJson(res, 400, { error: "INVALID_USER" });
      return true;
    }

    const result = await db.query(
      `SELECT j.id, j.status, m.file_path, m.content_type, m.expires_at, m.file_deleted_at
       FROM jobs j
       LEFT JOIN zeka_media_queue m ON m.job_id = j.id
       WHERE j.id = $1 AND j.user_id = $2
       LIMIT 1`,
      [fileMatch[1], userId]
    );
    const row = result.rows[0];
    if (!row || row.status !== "COMPLETED" || !row.file_path) {
      sendJson(res, 404, { error: "DOWNLOAD_FILE_NOT_FOUND" });
      return true;
    }
    if (row.file_deleted_at || !row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) {
      sendJson(res, 410, { error: "DOWNLOAD_FILE_EXPIRED" });
      return true;
    }

    const allowedDownloadRoots = [
      "zeka-instagram",
      "zeka-instagram-downloads",
    ].map((directory) => path.resolve(os.tmpdir(), directory) + path.sep);
    const filePath = path.resolve(String(row.file_path));
    if (!allowedDownloadRoots.some((root) => filePath.startsWith(root))) {
      sendJson(res, 403, { error: "INVALID_FILE_PATH" });
      return true;
    }

    let stat;
    try {
      stat = await fs.promises.stat(filePath);
      if (!stat.isFile() || stat.size <= 0) throw new Error("INVALID_FILE");
    } catch {
      sendJson(res, 410, { error: "DOWNLOAD_FILE_MISSING" });
      return true;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentTypes = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".avif": "image/avif",
    };
    const fileName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "_") || "zeka-media";
    const contentType = contentTypes[extension] || "application/octet-stream";
    const previewRequested = url.searchParams.get("preview") === "1";
    const isPreviewable = contentType.startsWith("image/") || contentType.startsWith("video/");
    const disposition = previewRequested && isPreviewable ? "inline" : "attachment";
    const commonHeaders = {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) {
        res.writeHead(416, { ...commonHeaders, "Content-Range": `bytes */${stat.size}` });
        res.end();
        return true;
      }

      let start;
      let end;
      if (!rangeMatch[1]) {
        const suffixLength = Number(rangeMatch[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          res.writeHead(416, { ...commonHeaders, "Content-Range": `bytes */${stat.size}` });
          res.end();
          return true;
        }
        start = Math.max(0, stat.size - suffixLength);
        end = stat.size - 1;
      } else {
        start = Number(rangeMatch[1]);
        end = rangeMatch[2] ? Number(rangeMatch[2]) : stat.size - 1;
      }

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= stat.size || start > end) {
        res.writeHead(416, { ...commonHeaders, "Content-Range": `bytes */${stat.size}` });
        res.end();
        return true;
      }

      end = Math.min(end, stat.size - 1);
      res.writeHead(206, {
        ...commonHeaders,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      });
      const rangeStream = fs.createReadStream(filePath, { start, end });
      rangeStream.on("error", (error) => {
        console.error("Web download range stream failed:", error);
        res.destroy(error);
      });
      rangeStream.pipe(res);
      return true;
    }

    res.writeHead(200, { ...commonHeaders, "Content-Length": stat.size });
    const stream = fs.createReadStream(filePath);
    stream.on("error", (error) => {
      console.error("Web download file stream failed:", error);
      res.destroy(error);
    });
    stream.pipe(res);
    return true;
  }

  const match = url.pathname.startsWith("/api/web/downloads/") ? url.pathname.slice("/api/web/downloads/".length).match(/^([0-9]+)$/) : null;
  if (match && req.method === "GET") {
    const userId = String(url.searchParams.get("userId") || "");
    if (!/^\d+$/.test(userId)) {
      sendJson(res, 400, { error: "INVALID_USER" });
      return true;
    }
    const result = await db.query(
      `SELECT j.id, j.job_id, j.status, j.error_code, j.created_at, j.completed_at,
              j.progress_percent, j.progress_message, j.progress_updated_at,
              r.id AS request_id, r.original_url,
              m.content_type AS media_content_type,
              m.file_deleted_at, m.expires_at
       FROM jobs j
       INNER JOIN requests r ON r.id = j.request_id
       LEFT JOIN zeka_media_queue m ON m.job_id = j.id
       WHERE j.id = $1 AND j.user_id = $2
       LIMIT 1`,
      [match[1], userId]
    );
    if (!result.rows[0]) {
      sendJson(res, 404, { error: "DOWNLOAD_NOT_FOUND" });
      return true;
    }
    const row = result.rows[0];
    sendJson(res, 200, {
      id: String(row.id),
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.status === "FAILED" ? getDownloadErrorMessage(row.error_code) : null,
      progressPercent: Number(row.progress_percent || 0),
      progressMessage: row.progress_message || null,
      progressUpdatedAt: row.progress_updated_at || null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      originalUrl: row.original_url,
      mediaContentType: row.media_content_type || null,
      previewAvailable: Boolean(row.media_content_type && !row.file_deleted_at && row.expires_at && new Date(row.expires_at).getTime() > Date.now()),
    });
    return true;
  }

  sendJson(res, 404, { error: "NOT_FOUND" });
  return true;
}

function startHealthServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health" || url.pathname === "/") {
      const healthy = isReady && !startupError;
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      res.end(healthy ? "Zeka Bot is running" : startupError ? "Zeka Bot startup failed" : "Zeka Bot is starting");
      return;
    }
    try {
      if (await handleWebApi(req, res, url)) return;
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    } catch (error) {
      console.error("HTTP request failed:", error);
      sendJson(res, 500, { error: "INTERNAL_SERVER_ERROR" });
    }
  });
  server.listen(PORT, "0.0.0.0", () => console.log(`HTTP server running on port ${PORT}`));
  return server;
}

async function setupSuperAdmin() {
  const telegramUserId = Number(process.env.SUPER_ADMIN_TELEGRAM_ID);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    console.log("SUPER_ADMIN_TELEGRAM_ID is not configured. Skipping super admin setup.");
    return;
  }
  const db = getClient();
  const userResult = await db.query("SELECT id FROM users WHERE telegram_user_id = $1 LIMIT 1", [telegramUserId]);
  const user = userResult.rows[0];
  if (!user) {
    console.log("Super admin user was not found. Start the bot with the configured Telegram account first.");
    return;
  }
  const roleResult = await db.query("SELECT id FROM admin_roles WHERE role_key = 'super_admin' LIMIT 1");
  const role = roleResult.rows[0];
  if (!role) throw new Error("super_admin role does not exist");
  await db.query(`INSERT INTO admins (user_id, role_id, is_active) VALUES ($1, $2, TRUE)
    ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id, is_active = TRUE, updated_at = NOW()`, [user.id, role.id]);
  console.log("Super admin setup completed.");
}

async function start() {
  console.log("Zeka Bot starting...");
  const server = startHealthServer();
  try {
    await initializeDatabase();
    console.log("Zeka Bot database initialized.");
    startTempFileCleanupService();
    startZekaMediaExpirationService();
    await bugReportCleanupService.start();
    await setupSuperAdmin();
    await startBot();
    startDailyCreditScheduler();
    startupError = null;
    isReady = true;
    console.log("Zeka Bot is ready.");
  } catch (error) {
    isReady = false;
    startupError = error;
    console.error("Failed to start Zeka Bot.", error);
    stopDailyCreditScheduler();
    bugReportCleanupService.stop();
    stopZekaMediaExpirationService();
    try { await close(); } catch (closeError) { console.error("Failed to close database after startup error:", closeError); }
    await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
    process.exit(1);
  }
}
start();
