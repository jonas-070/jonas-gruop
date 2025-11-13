/**
 * generaContentavanzado.js
 * Escaneo avanzado de la carpeta ./assets/
 * Genera un archivo ./assets/content.json con metadatos extendidos.
 *
 * Requiere tener instalado:
 *   ffprobe (viene con ffmpeg) -> usado para obtener duración, resolución, bitrate, etc.
 *
 * Ejecuta con:
 *   node generaContentavanzado.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// CONFIGURACIÓN GENERAL
const projectRoot = __dirname;
const assetsDir = path.join(projectRoot, "assets");
const outFile = path.join(assetsDir, "content.json");
const baseUrl = ""; // <-- coloca aquí tu dominio si lo tienes, ej: "https://tuweb.com/"

const VIDEO_EXT = [".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv"];
const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a", ".flac"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const LINK_FILE_EXT = [".txt", ".m3u", ".m3u8", ".url", ".csv"];
const SUBTITLE_EXT = [".srt", ".vtt"];
const extractUrlsRegex = /(https?:\/\/[^\s"'<>\]]+)/gi;

const makePublicPath = (relPath) =>
  baseUrl
    ? baseUrl.replace(/\/+$/, "") +
      "/" +
      relPath.replace(/^\/+/, "").replace(/\\/g, "/")
    : relPath.replace(/\\/g, "/");

// -------------------------------------------------------------
// FUNCIONES AUXILIARES
// -------------------------------------------------------------
function extractUrls(text) {
  if (!text) return [];
  const matches = [];
  let m;
  while ((m = extractUrlsRegex.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return [...new Set(matches)];
}

function safeTitle(name) {
  return name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, " ").trim();
}

function getMediaInfo(filePath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration:stream=width,height,bit_rate -of json "${filePath}"`;
    const result = execSync(cmd, { encoding: "utf8" });
    const info = JSON.parse(result);
    const duration = parseFloat(info.format?.duration || 0);
    const width = info.streams?.[0]?.width || null;
    const height = info.streams?.[0]?.height || null;
    const bitrate = info.format?.bit_rate || null;
    return { duration, width, height, bitrate };
  } catch {
    return {};
  }
}

function scanFolder(folder) {
  const results = [];
  if (!fs.existsSync(folder)) return results;
  const entries = fs.readdirSync(folder);

  for (const entry of entries) {
    const fullPath = path.join(folder, entry);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      results.push({
        folder: path.relative(assetsDir, fullPath),
        items: scanFolder(fullPath),
      });
      continue;
    }

    const ext = path.extname(entry).toLowerCase();
    const relPath = path.relative(projectRoot, fullPath);
    const publicUrl = makePublicPath(relPath);
    const size = stats.size;
    const title = safeTitle(entry);

    if (VIDEO_EXT.includes(ext)) {
      const meta = getMediaInfo(fullPath);
      results.push({
        title,
        type: "video",
        file: publicUrl,
        size,
        ...meta,
      });
    } else if (AUDIO_EXT.includes(ext)) {
      const meta = getMediaInfo(fullPath);
      results.push({
        title,
        type: "audio",
        file: publicUrl,
        size,
        ...meta,
      });
    } else if (IMAGE_EXT.includes(ext)) {
      results.push({ title, type: "image", file: publicUrl, size });
    } else if (LINK_FILE_EXT.includes(ext)) {
      try {
        const text = fs.readFileSync(fullPath, "utf8");
        const urls = extractUrls(text);
        if (urls.length) {
          urls.forEach((url, i) =>
            results.push({
              title: `${title} ${urls.length > 1 ? "#" + (i + 1) : ""}`,
              type: "stream",
              url,
              source: publicUrl,
            })
          );
        } else {
          results.push({ title, type: "textfile", file: publicUrl, size });
        }
      } catch (err) {
        results.push({ title, type: "textfile", file: publicUrl, error: err.message });
      }
    } else if (SUBTITLE_EXT.includes(ext)) {
      results.push({ title, type: "subtitle", file: publicUrl, size });
    } else {
      results.push({ title, type: "file", file: publicUrl, size });
    }
  }

  return results;
}

function attachThumbnails(list) {
  const flat = [];
  const flatten = (arr) => {
    arr.forEach((i) => {
      if (i.items) flatten(i.items);
      else flat.push(i);
    });
  };
  flatten(list);

  flat.forEach((it) => {
    if (!it.file) return;
    const dir = path.dirname(it.file);
    const name = path.basename(it.file, path.extname(it.file));
    const thumbPath = path.join(dir, "thumbs", `${name}.jpg`);
    const thumbLocal = path.join(projectRoot, thumbPath);
    if (fs.existsSync(thumbLocal))
      it.thumb = makePublicPath(path.relative(projectRoot, thumbLocal));
  });

  return list;
}

// -------------------------------------------------------------
// PRINCIPAL
// -------------------------------------------------------------
function generateCatalog() {
  const categories = {
    peliculas: [],
    series: [],
    animes: [],
    musicas: [],
    tv: [],
    otros: [],
  };

  const dirs = fs.readdirSync(assetsDir);
  for (const dir of dirs) {
    const full = path.join(assetsDir, dir);
    if (!fs.statSync(full).isDirectory()) continue;

    const items = scanFolder(full);
    attachThumbnails(items);

    if (dir.toLowerCase().includes("pelicula")) categories.peliculas.push(...items);
    else if (dir.toLowerCase().includes("serie")) categories.series.push(...items);
    else if (dir.toLowerCase().includes("anime")) categories.animes.push(...items);
    else if (dir.toLowerCase().includes("music")) categories.musicas.push(...items);
    else if (dir.toLowerCase().includes("tv")) categories.tv.push(...items);
    else categories.otros.push(...items);
  }

  return categories;
}

try {
  console.log("🚀 Escaneando contenido multimedia avanzado...");
  const catalog = generateCatalog();
  fs.writeFileSync(outFile, JSON.stringify(catalog, null, 2), "utf8");
  console.log("✅ Catálogo avanzado generado en:", outFile);
} catch (e) {
  console.error("❌ Error:", e);
}
