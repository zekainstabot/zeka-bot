"use strict";

const fs = require("fs");
const { pipeline } = require("stream/promises");
const { Readable, Transform } = require("stream");

const MAX_TRACK_BYTES = 48 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20000;
const ALLOWED_LICENSES = [
  /^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/i,
  /^https?:\/\/creativecommons\.org\/licenses\/by(?:-sa|-nd)?\/(?:3\.0|4\.0)\/?$/i,
  /^https?:\/\/creativecommons\.org\/publicdomain\/mark\/1\.0\/?$/i,
];

function normalizeLicense(value) {
  return String(value || "").trim().replace(/\?.*$/, "").replace(/#.*$/, "").replace(/\/$/, "");
}

function isAllowedLicense(value) {
  const license = normalizeLicense(value);
  return ALLOWED_LICENSES.some(pattern => pattern.test(license));
}

function asText(value) {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  return String(value || "").trim();
}

function safeSolrPhrase(value) {
  return String(value || "")
    .replace(/[\\+\-!(){}\[\]^"~*?:\/]|&&|\|\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function allowedDownloadHost(hostname, source) {
  const host = String(hostname || "").toLowerCase();
  if (source === "jamendo") return host === "jamendo.com" || host.endsWith(".jamendo.com");
  return host === "archive.org" || host.endsWith(".archive.org");
}

async function fetchJson(url, source) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ZekaBot/1.0 (full-track search)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(source + "_HTTP_" + response.status);
  return response.json();
}

function scoreTrack(track, title, artist) {
  const wantedTitle = String(title || "").toLocaleLowerCase();
  const wantedArtist = String(artist || "").toLocaleLowerCase();
  const gotTitle = String(track.title || "").toLocaleLowerCase();
  const gotArtist = String(track.artist || "").toLocaleLowerCase();
  let score = 0;
  if (wantedTitle && gotTitle === wantedTitle) score += 5;
  else if (wantedTitle && (gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle))) score += 3;
  if (wantedArtist && gotArtist === wantedArtist) score += 4;
  else if (wantedArtist && (gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist))) score += 2;
  return score;
}

async function searchJamendo({ title, artist, query }) {
  const clientId = String(process.env.JAMENDO_CLIENT_ID || "").trim();
  if (!clientId) return null;

  const searches = [...new Set([
    [artist, title].filter(Boolean).join(" "),
    title,
    artist,
    query,
  ].map(value => String(value || "").trim()).filter(Boolean))];

  for (const search of searches) {
    const url = new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "25");
    url.searchParams.set("type", "single albumtrack");
    url.searchParams.set("search", search);
    url.searchParams.set("include", "licenses");
    url.searchParams.set("audiodlformat", "mp32");

    const data = await fetchJson(url, "JAMENDO");
    const tracks = Array.isArray(data.results) ? data.results : [];
    const allowed = tracks
      .filter(item => item.audiodownload_allowed === true && item.audiodownload)
      .map(item => ({
        title: item.name || title || "آهنگ",
        artist: item.artist_name || artist || "هنرمند نامشخص",
        downloadUrl: item.audiodownload,
        licenseUrl: item.license_ccurl || "",
        source: "Jamendo",
        pageUrl: item.shareurl || "",
        duration: Number(item.duration || 0),
      }))
      .filter(item => isAllowedLicense(item.licenseUrl))
      .sort((a, b) => scoreTrack(b, title, artist) - scoreTrack(a, title, artist));

    if (allowed.length) return allowed[0];
  }
  return null;
}

function buildArchiveQueries({ title, artist, query }) {
  const safeTitle = safeSolrPhrase(title || query);
  const safeArtist = safeSolrPhrase(artist);
  const safeQuery = safeSolrPhrase(query);
  if (!safeTitle && !safeQuery) return [];

  const searches = [];
  if (safeTitle && safeArtist) searches.push(`mediatype:audio AND title:"${safeTitle}" AND creator:"${safeArtist}"`);
  if (safeTitle) {
    searches.push(`mediatype:audio AND title:"${safeTitle}"`);
    searches.push(`mediatype:audio AND (title:"${safeTitle}" OR description:"${safeTitle}")`);
  }
  if (safeQuery && safeQuery !== safeTitle) {
    searches.push(`mediatype:audio AND (title:"${safeQuery}" OR description:"${safeQuery}")`);
  }
  return [...new Set(searches)];
}

async function searchInternetArchive({ title, artist, query }) {
  const queries = buildArchiveQueries({ title, artist, query });
  for (const searchQuery of queries) {
    const url = new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("fl[]", "identifier");
    url.searchParams.append("fl[]", "title");
    url.searchParams.append("fl[]", "creator");
    url.searchParams.append("fl[]", "licenseurl");
    url.searchParams.set("rows", "25");
    url.searchParams.set("page", "1");
    url.searchParams.set("output", "json");

    const data = await fetchJson(url, "ARCHIVE_SEARCH");
    const docs = Array.isArray(data?.response?.docs) ? data.response.docs : [];
    for (const doc of docs) {
      if (!doc.identifier) continue;
      try {
        const metadata = await fetchJson(
          "https://archive.org/metadata/" + encodeURIComponent(doc.identifier),
          "ARCHIVE_METADATA"
        );
        const itemMetadata = metadata?.metadata || {};
        if (itemMetadata.mediatype !== "audio") continue;

        const licenseUrl = asText(itemMetadata.licenseurl || doc.licenseurl);
        if (!isAllowedLicense(licenseUrl)) continue;

        const files = Array.isArray(metadata.files) ? metadata.files : [];
        const mp3Files = files
          .filter(file => {
            const name = String(file.name || "");
            const size = Number(file.size || 0);
            return name.toLowerCase().endsWith(".mp3")
              && size > 0
              && size <= MAX_TRACK_BYTES
              && !file.source?.toLowerCase?.().includes("derivative")
              && !name.startsWith("__");
          })
          .sort((a, b) => {
            const originalA = a.source === "original" ? 1 : 0;
            const originalB = b.source === "original" ? 1 : 0;
            return originalB - originalA || Number(b.size || 0) - Number(a.size || 0);
          });

        const file = mp3Files[0];
        if (!file) continue;

        const fileUrl = "https://archive.org/download/"
          + encodeURIComponent(doc.identifier) + "/"
          + String(file.name).split("/").map(encodeURIComponent).join("/");

        return {
          title: asText(itemMetadata.title || doc.title) || title || "آهنگ",
          artist: asText(itemMetadata.creator || doc.creator) || artist || "هنرمند نامشخص",
          downloadUrl: fileUrl,
          licenseUrl,
          source: "Internet Archive",
          pageUrl: "https://archive.org/details/" + encodeURIComponent(doc.identifier),
          duration: 0,
        };
      } catch (error) {
        console.warn("Archive item skipped:", doc.identifier, error.message);
      }
    }
  }
  return null;
}

async function searchFullTrack({ title = "", artist = "", query = "" }) {
  try {
    const jamendo = await searchJamendo({ title, artist, query });
    if (jamendo) return jamendo;
  } catch (error) {
    console.warn("Jamendo search failed:", error.message);
  }
  return searchInternetArchive({ title, artist, query });
}

async function downloadFullTrack(track, destination) {
  const parsed = new URL(track.downloadUrl);
  if (parsed.protocol !== "https:" || !allowedDownloadHost(parsed.hostname, track.source === "Jamendo" ? "jamendo" : "archive")) {
    throw new Error("UNTRUSTED_MUSIC_DOWNLOAD_URL");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(parsed, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "ZekaBot/1.0" },
    });
    if (!response.ok || !response.body) throw new Error("MUSIC_DOWNLOAD_HTTP_" + response.status);

    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || !allowedDownloadHost(finalUrl.hostname, track.source === "Jamendo" ? "jamendo" : "archive")) {
      throw new Error("UNTRUSTED_MUSIC_REDIRECT");
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      throw new Error("MUSIC_PROVIDER_RETURNED_PAGE");
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_TRACK_BYTES) throw new Error("MUSIC_FILE_TOO_LARGE");

    let received = 0;
    const limiter = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > MAX_TRACK_BYTES) return callback(new Error("MUSIC_FILE_TOO_LARGE"));
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body),
      limiter,
      fs.createWriteStream(destination),
      { signal: controller.signal }
    );
    if (!received) throw new Error("EMPTY_MUSIC_FILE");

    const handle = await fs.promises.open(destination, "r");
    try {
      const header = Buffer.alloc(3);
      await handle.read(header, 0, 3, 0);
      const isMp3 = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33
        || header[0] === 0xff && (header[1] & 0xe0) === 0xe0;
      if (!isMp3) throw new Error("DOWNLOADED_FILE_IS_NOT_MP3");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (controller.signal.aborted || error.name === "AbortError") {
      throw new Error("MUSIC_DOWNLOAD_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  searchFullTrack,
  downloadFullTrack,
  isAllowedLicense,
  MAX_TRACK_BYTES,
};
