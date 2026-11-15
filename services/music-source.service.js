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
  if (source === "archive") return host === "archive.org" || host.endsWith(".archive.org");
  if (source === "openverse") {
    return host === "upload.wikimedia.org"
      || host === "wikimedia.org" || host.endsWith(".wikimedia.org")
      || host === "archive.org" || host.endsWith(".archive.org")
      || host === "jamendo.com" || host.endsWith(".jamendo.com")
      || host === "ccmixter.org" || host.endsWith(".ccmixter.org")
      || host === "freesound.org" || host.endsWith(".freesound.org")
      || host === "musopen.org" || host.endsWith(".musopen.org");
  }
  return false;
}

async function fetchJson(url, source) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ZekaBot/1.0 (full-track search)" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(source + "_HTTP_" + response.status);
  return response.json();
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTrack(track, title, artist, query = "") {
  const wantedTitle = normalizeSearchText(title);
  const wantedArtist = normalizeSearchText(artist);
  const wantedQuery = normalizeSearchText([artist, title].filter(Boolean).join(" ") || query);
  const gotTitle = normalizeSearchText(track.title);
  const gotArtist = normalizeSearchText(track.artist);
  const gotCombined = (gotTitle + " " + gotArtist).trim();
  let score = 0;
  if (wantedTitle && gotTitle === wantedTitle) score += 10;
  else if (wantedTitle && gotTitle && (gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle))) score += 6;
  if (wantedArtist && gotArtist === wantedArtist) score += 8;
  else if (wantedArtist && gotArtist && (gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist))) score += 4;
  if (wantedQuery && gotCombined === wantedQuery) score += 8;
  const tokens = [...new Set(wantedQuery.split(/\s+/).filter(token => token.length > 1))];
  if (tokens.length) {
    const matched = tokens.filter(token => gotCombined.includes(token)).length;
    score += Math.round((matched / tokens.length) * 6);
  }
  return score;
}

function buildSearchVariants({ title = "", artist = "", query = "" }) {
  const raw = [ [artist, title].filter(Boolean).join(" "), title, query, artist ]
    .map(value => String(value || "").trim())
    .filter(value => value.length >= 2);
  const expanded = [];
  for (const value of raw) {
    expanded.push(value);
    const normalized = normalizeSearchText(value);
    if (normalized && normalized !== value) expanded.push(normalized);
    const noBrackets = value.replace(/[([{].*?[)\\]}]/g, " ").replace(/\s+/g, " ").trim();
    if (noBrackets && noBrackets !== value) expanded.push(noBrackets);
  }
  return [...new Set(expanded)].slice(0, 8);
}

async function searchDeezerMetadata(terms) {
  const variants = buildSearchVariants(terms);
  for (const term of variants) {
    try {
      const url = new URL("https://api.deezer.com/search");
      url.searchParams.set("q", term);
      url.searchParams.set("limit", "12");
      const data = await fetchJson(url, "DEEZER");
      const rows = Array.isArray(data?.data) ? data.data : [];
      const ranked = rows.map(item => ({
        title: String(item.title || "").trim(),
        artist: String(item.artist?.name || "").trim(),
        album: String(item.album?.title || "").trim(),
        source: "Deezer",
        score: scoreTrack({ title: item.title, artist: item.artist?.name }, terms.title, terms.artist, terms.query || term),
      })).filter(item => item.title && item.artist && item.score >= 2)
        .sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked.slice(0, 5);
    } catch (error) {
      console.warn("Deezer metadata search failed:", error.message);
    }
  }
  return [];
}

async function searchMusicBrainzMetadata(terms) {
  const variants = buildSearchVariants(terms);
  for (const term of variants.slice(0, 4)) {
    try {
      const url = new URL("https://musicbrainz.org/ws/2/recording/");
      url.searchParams.set("query", term);
      url.searchParams.set("fmt", "json");
      url.searchParams.set("limit", "10");
      const data = await fetchJson(url, "MUSICBRAINZ");
      const rows = Array.isArray(data?.recordings) ? data.recordings : [];
      const ranked = rows.map(item => ({
        title: String(item.title || "").trim(),
        artist: (item["artist-credit"] || []).map(part => part.name || part.artist?.name || "").join(" ").trim(),
        source: "MusicBrainz",
        score: scoreTrack({ title: item.title, artist: (item["artist-credit"] || []).map(part => part.name || part.artist?.name || "").join(" ") }, terms.title, terms.artist, terms.query || term),
      })).filter(item => item.title && item.artist && item.score >= 2)
        .sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked.slice(0, 5);
    } catch (error) {
      console.warn("MusicBrainz metadata search failed:", error.message);
    }
  }
  return [];
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
      .filter(item => scoreTrack(item, title, artist, query) >= 2)
      .sort((a, b) => scoreTrack(b, title, artist, query) - scoreTrack(a, title, artist, query));

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

function isAllowedOpenverseLicense(track) {
  const license = String(track.license || "").toLowerCase();
  const version = String(track.license_version || "").toLowerCase();
  const permitted = new Set(["cc0", "pdm", "by", "by-sa", "by-nd"]);
  if (!permitted.has(license)) return false;
  if (license === "cc0" || license === "pdm") return true;
  return ["3.0", "4.0"].includes(version);
}

async function searchOpenverse({ title, artist, query }) {
  const searches = [...new Set([
    [artist, title].filter(Boolean).join(" "),
    title,
    query,
  ].map(value => String(value || "").trim()).filter(Boolean))];

  for (const term of searches) {
    const url = new URL("https://api.openverse.org/v1/audio/");
    url.searchParams.set("q", term.slice(0, 200));
    url.searchParams.set("category", "music");
    url.searchParams.set("license_type", "commercial");
    url.searchParams.set("extension", "mp3");
    url.searchParams.set("page_size", "20");
    url.searchParams.set("page", "1");

    const data = await fetchJson(url, "OPENVERSE");
    const results = Array.isArray(data.results) ? data.results : [];
    const candidates = results
      .filter(item => item && item.url && String(item.filetype || "").toLowerCase() === "mp3")
      .filter(item => Number(item.filesize || 0) === 0 || Number(item.filesize) <= MAX_TRACK_BYTES)
      .filter(isAllowedOpenverseLicense)
      .filter(item => {
        try {
          const mediaUrl = new URL(item.url);
          return mediaUrl.protocol === "https:" && allowedDownloadHost(mediaUrl.hostname, "openverse");
        } catch {
          return false;
        }
      })
      .map(item => ({
        title: asText(item.title) || title || term,
        artist: asText(item.creator) || artist || "هنرمند نامشخص",
        downloadUrl: item.url,
        licenseUrl: item.license_url || "",
        licenseName: item.license || "",
        licenseVersion: item.license_version || "",
        attribution: item.attribution || "",
        source: "Openverse",
        pageUrl: item.foreign_landing_url || "",
        duration: Number(item.duration || 0) / 1000,
      }))
      .filter(item => {
        const score = scoreTrack(item, title, artist, term);
        return score >= 3 || String(item.title).toLocaleLowerCase().includes(term.toLocaleLowerCase());
      })
      .sort((a, b) => scoreTrack(b, title, artist, term) - scoreTrack(a, title, artist, term));

    if (candidates.length) return candidates[0];
  }
  return null;
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


function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim();
}
async function searchMokhtalefMusic({ title, artist, query }) {
  const term = [artist, title].filter(Boolean).join(" ") || query;
  if (!term || term.length > 180) return null;
  const url = new URL("https://mokhtalefmusic.com/");
  url.searchParams.set("s", term);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZekaBot/1.0; +https://github.com/zekainstabot/zeka-bot)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("MOKHTALEF_HTTP_" + response.status);
  const html = await response.text();
  const candidates = [];
  const anchorPattern = /<a\b([^>]*?)\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const hrefValue = match[2] || match[3] || match[4] || "";
    let href;
    try { href = new URL(decodeHtml(hrefValue), "https://mokhtalefmusic.com/"); } catch { continue; }
    const host = href.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "mokhtalefmusic.com" || href.pathname === "/" || href.pathname.startsWith("/wp-")) continue;
    const attrs = (match[1] || "") + " " + (match[5] || "");
    const titleMatch = attrs.match(/\btitle\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    const name = stripHtml(titleMatch ? (titleMatch[1] || titleMatch[2]) : match[6]);
    if (!name || name.length < 4 || /ادامه مطلب|صفحه بعدی|قبلی/i.test(name)) continue;
    const score = scoreTrack({ title: name, artist: "" }, title, artist, query);
    if (score >= 1) candidates.push({ name, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  // Discovery only: never fetch or redistribute audio from this site without
  // a separately verifiable license allowing redistribution.
  return { title: candidates[0].name, artist: artist || "", source: "مختلف موزیک" };
}
async function searchFullTrack({ title = "", artist = "", query = "" }) {
  const searchProviders = async (terms) => {
    try {
      const jamendo = await searchJamendo(terms);
      if (jamendo) return jamendo;
    } catch (error) {
      console.warn("Jamendo search failed:", error.message);
    }
    try {
      const openverse = await searchOpenverse(terms);
      if (openverse) return openverse;
    } catch (error) {
      console.warn("Openverse search failed:", error.message);
    }
    try {
      const archive = await searchInternetArchive(terms);
      if (archive) return archive;
    } catch (error) {
      console.warn("Internet Archive search failed:", error.message);
    }
    return null;
  };

  const originalTerms = { title, artist, query };
  const originalResult = await searchProviders(originalTerms);
  if (originalResult) return originalResult;

  // Use Mokhtalef Music as an additional discovery index, then look for the
  // discovered title again only in sources with verifiable download permission.
  try {
    const discovered = await searchMokhtalefMusic(originalTerms);
    if (discovered?.title) {
      const discoveredTerms = {
        title: discovered.title,
        artist: discovered.artist || artist,
        query: discovered.title,
      };
      const discoveredResult = await searchProviders(discoveredTerms);
      if (discoveredResult) return discoveredResult;
    }
  } catch (error) {
    console.warn("Mokhtalef Music search failed:", error.message);
  }
  return null;
}

async function searchAndDownloadFullTrack({ title = "", artist = "", query = "", destination }) {
  if (!destination) throw new Error("MUSIC_DESTINATION_REQUIRED");
  const providers = [
    ["Jamendo", searchJamendo],
    ["Openverse", searchOpenverse],
    ["Internet Archive", searchInternetArchive],
  ];
  const tryTerms = async (terms) => {
    for (const [name, searchProvider] of providers) {
      let track = null;
      try { track = await searchProvider(terms); }
      catch (error) { console.warn(name + " search failed:", error.message); continue; }
      if (!track) continue;
      try {
        await fs.promises.rm(destination, { force: true });
        await downloadFullTrack(track, destination);
        return track;
      } catch (error) {
        console.warn(name + " MP3 download failed; trying next source:", error.message);
        await fs.promises.rm(destination, { force: true }).catch(() => {});
      }
    }
    return null;
  };

  const originalTerms = { title, artist, query };
  const attempted = new Set();
  const attempt = async (terms) => {
    const key = normalizeSearchText([terms.artist, terms.title, terms.query].join(" "));
    if (!key || attempted.has(key)) return null;
    attempted.add(key);
    return tryTerms(terms);
  };

  let track = await attempt(originalTerms);
  if (track) return track;

  // Metadata catalogs identify likely title/artist pairs; they are never used as
  // audio download sources. Full MP3 delivery still requires a licensed provider.
  const [deezerMatches, mbMatches] = await Promise.all([
    searchDeezerMetadata(originalTerms),
    searchMusicBrainzMetadata(originalTerms),
  ]);
  const metadataMatches = [...deezerMatches, ...mbMatches]
    .sort((a, b) => b.score - a.score);
  for (const match of metadataMatches.slice(0, 6)) {
    track = await attempt({ title: match.title, artist: match.artist, query: match.title + " " + match.artist });
    if (track) return track;
  }

  try {
    const discovered = await searchMokhtalefMusic(originalTerms);
    if (discovered?.title) {
      track = await attempt({
        title: discovered.title,
        artist: discovered.artist || artist,
        query: discovered.title,
      });
      if (track) return track;
    }
  } catch (error) {
    console.warn("Mokhtalef Music discovery failed:", error.message);
  }

  // Search broad title variants in each permitted full-track catalog.
  for (const variant of buildSearchVariants(originalTerms).slice(0, 5)) {
    track = await attempt({ title: variant, artist, query: variant });
    if (track) return track;
  }
  return null;
}

async function downloadFullTrack(track, destination) {
  const parsed = new URL(track.downloadUrl);
  const sourceKey = track.source === "Jamendo"
    ? "jamendo"
    : track.source === "Openverse"
      ? "openverse"
      : "archive";
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !allowedDownloadHost(parsed.hostname, sourceKey)) {
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
    if (finalUrl.protocol !== "https:" || finalUrl.username || finalUrl.password || !allowedDownloadHost(finalUrl.hostname, sourceKey)) {
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
  searchAndDownloadFullTrack,
  searchMokhtalefMusic,
  downloadFullTrack,
  isAllowedLicense,
  MAX_TRACK_BYTES,
};
