/**
 * generaContent.js
 * Escanea ./assets y genera ./assets/content.json
 *
 * Uso:
 *   node generaContent.js
 *
 * Opciones:
 *   - EDITA la variable `baseUrl` si quieres que los archivos locales apunten a
 *     un dominio o ruta pública (ej: https://tudominio.com/jonas-gruop/).
 *
 * NOTA:
 *   - No cambia nombres de archivos. Si subes a GitHub Pages asegúrate de que
 *     los nombres y rutas estén exactamente iguales (mayúsculas/minúsculas).
 */

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const assetsDir = path.join(projectRoot, 'assets');
const outFile = path.join(assetsDir, 'content.json');

// Si vas a publicar en un dominio, pon aquí la URL base pública (opcional).
// Ejemplo: 'https://jonas-070.github.io/jonas-gruop/'
const baseUrl = ''; // deja '' para rutas relativas (assets/...)
const makePublicPath = (relativePath) => {
  // relativePath expected like 'assets/peliculas/p1.mp4'
  if (!baseUrl) return relativePath.replace(/\\/g, '/');
  // join baseUrl + relativePath (asegura una sola slash)
  return baseUrl.replace(/\/+$/, '') + '/' + relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
};

// extensiones por tipo (añade las que necesites)
const VIDEO_EXT = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.ogv', '.ts', '.m3u8'];
const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const SUBTITLE_EXT = ['.srt', '.vtt'];

// archivos que pueden contener URLs
const LINK_FILE_EXT = ['.txt', '.m3u', '.m3u8', '.url', '.csv', '.list'];

// Helper: extrae urls http(s) de un texto
function extractUrls(text) {
  if (!text) return [];
  const re = /(https?:\/\/[^\s"'<>\]\)]+)/gi;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1].replace(/["',;]+$/g, '')); // trim punctuation at end
  }
  return [...new Set(matches)];
}

// Helper: sanitize title from filename
function niceTitleFromName(name) {
  // quita extension y reemplaza guiones múltiples
  const t = name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim();
  return t;
}

// Escanea una carpeta recursivamente y devuelve estructura
function scanFolder(folderPath, relBase = 'assets') {
  const items = [];
  if (!fs.existsSync(folderPath)) return items;
  const entries = fs.readdirSync(folderPath);
  for (const entry of entries) {
    const full = path.join(folderPath, entry);
    const stats = fs.statSync(full);
    if (stats.isDirectory()) {
      // si dentro hay thumbs o subcarpetas, las procesamos recursivamente
      const sub = scanFolder(full, relBase);
      if (sub.length > 0) {
        items.push({
          folder: path.relative(assetsDir, full).replace(/\\/g, '/'),
          items: sub
        });
      }
    } else if (stats.isFile()) {
      const ext = path.extname(entry).toLowerCase();
      const relPath = path.relative(projectRoot, full).replace(/\\/g, '/'); // 'assets/...'
      const publicPath = makePublicPath(relPath);
      const size = stats.size || 0;
      // detect type
      if (VIDEO_EXT.includes(ext)) {
        items.push({
          title: niceTitleFromName(entry),
          type: 'video',
          file: publicPath,
          local: relPath,
          size,
        });
      } else if (AUDIO_EXT.includes(ext)) {
        items.push({
          title: niceTitleFromName(entry),
          type: 'audio',
          file: publicPath,
          local: relPath,
          size,
        });
      } else if (IMAGE_EXT.includes(ext)) {
        // imágenes: las listamos como assets de imagen (posibles thumbs)
        items.push({
          title: entry,
          type: 'image',
          file: publicPath,
          local: relPath,
          size,
        });
      } else if (SUBTITLE_EXT.includes(ext)) {
        items.push({
          title: entry,
          type: 'subtitle',
          file: publicPath,
          local: relPath,
          size,
        });
      } else if (LINK_FILE_EXT.includes(ext)) {
        // lee el archivo y extrae urls
        try {
          const content = fs.readFileSync(full, 'utf8');
          const urls = extractUrls(content);
          if (urls.length > 0) {
            // si hay varias urls, crea un entry por cada una
            urls.forEach((u, idx) => {
              items.push({
                title: `${niceTitleFromName(entry)}${urls.length > 1 ? ' #' + (idx + 1) : ''}`,
                type: 'stream',
                url: u,
                sourceFile: relPath,
                size,
              });
            });
          } else {
            // si no hay urls, almacena como texto (por si quieres revisar)
            items.push({
              title: niceTitleFromName(entry),
              type: 'textfile',
              file: publicPath,
              local: relPath,
              size,
            });
          }
        } catch (e) {
          items.push({
            title: niceTitleFromName(entry),
            type: 'textfile',
            file: publicPath,
            local: relPath,
            size,
            error: String(e),
          });
        }
      } else {
        // otro tipo de archivo: lo registramos genérico
        items.push({
          title: niceTitleFromName(entry),
          type: 'file',
          file: publicPath,
          local: relPath,
          ext,
          size,
        });
      }
    }
  }
  return items;
}

// Postprocesado: buscar thumbs para videos/audios si existe folder thumbs al lado
function attachThumbnails(items) {
  // items may contain nested folder objects, flatten to find files
  function flat(list) {
    const out = [];
    list.forEach(it => {
      if (it.items && Array.isArray(it.items)) {
        // folder object
        out.push(...flat(it.items));
      } else {
        out.push(it);
      }
    });
    return out;
  }
  const flatItems = flat(items);

  // build map of folder -> thumbs files
  const thumbsMap = {}; // folderRelPath -> { nameNoExt: publicPath }
  flatItems.forEach(it => {
    if (!it.local) return;
    const dir = path.dirname(it.local); // relative path like 'assets/peliculas'
    const thumbsDir = path.join(projectRoot, dir, 'thumbs');
    if (!fs.existsSync(thumbsDir)) return;
    if (!thumbsMap[dir]) {
      const files = fs.readdirSync(thumbsDir);
      thumbsMap[dir] = {};
      files.forEach(f => {
        const n = path.parse(f).name.toLowerCase();
        const ext = path.extname(f).toLowerCase();
        if (IMAGE_EXT.includes(ext)) {
          const relThumb = path.relative(projectRoot, path.join(thumbsDir, f)).replace(/\\/g, '/');
          thumbsMap[dir][n] = makePublicPath(relThumb);
        }
      });
    }
  });

  // attach thumb if matches filename
  flatItems.forEach(it => {
    if (!it.local) return;
    const dir = path.dirname(it.local);
    const nameNoExt = path.parse(it.local).name.toLowerCase();
    const map = thumbsMap[dir];
    if (map && map[nameNoExt]) {
      it.thumb = map[nameNoExt];
    } else {
      // try fallback: assets/default-thumb.jpg
      const def = path.join(assetsDir, 'default-thumb.jpg');
      if (fs.existsSync(def)) it.thumb = makePublicPath(path.relative(projectRoot, def).replace(/\\/g, '/'));
      else it.thumb = '';
    }
  });

  return items;
}

// Estructura final de JSON: por categoría base (musicas, peliculas, series, animes, tv, otros)
function buildCatalog() {
  const catalog = {
    musicas: [],
    peliculas: [],
    series: [],
    animes: [],
    tv: [],
    otros: []
  };

  // scan top-level subfolders under assets
  if (!fs.existsSync(assetsDir)) {
    console.error('No existe carpeta assets/ en el proyecto. Crea assets/ y vuelve a intentar.');
    process.exit(1);
  }

  const folders = fs.readdirSync(assetsDir);
  for (const f of folders) {
    const full = path.join(assetsDir, f);
    const stats = fs.statSync(full);
    if (!stats.isDirectory()) continue;
    const relFolder = path.relative(assetsDir, full).replace(/\\/g, '/'); // e.g. 'peliculas'
    const items = scanFolder(full, 'assets/' + relFolder);
    // attach thumbnails inside this folder's items
    const withThumbs = attachThumbnails(items);

    // distribute into catalog
    const key = f.toLowerCase();
    if (key.includes('music') || key.includes('musica') || key.includes('musicas')) catalog.musicas.push(...withThumbs);
    else if (key.includes('pelicula') || key.includes('peliculas') || key === 'peliculas') catalog.peliculas.push(...withThumbs);
    else if (key.includes('serie') || key.includes('series') || key === 'series') catalog.series.push(...withThumbs);
    else if (key.includes('anime') || key === 'animes') catalog.animes.push(...withThumbs);
    else if (key.includes('tv') || key === 'tv') catalog.tv.push(...withThumbs);
    else catalog.otros.push(...withThumbs);
  }

  return catalog;
}

// Ejecuta
try {
  console.log('Escaneando assets/ ... esto puede tardar si tienes muchos archivos');
  const catalog = buildCatalog();
  fs.writeFileSync(outFile, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('✅ Generado:', outFile);
} catch (err) {
  console.error('Error generando content.json:', err);
  process.exit(1);
}
