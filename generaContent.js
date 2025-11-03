// generaContentAvanzado.js
// Ejecutar: node generaContentAvanzado.js
// Abre la terminal integrada de VS Code

const fs = require('fs');
const path = require('path');

// Configuración: carpetas dentro de assets
const contentFolders = {
    "musicas": "musicas",
    "peliculas": "peliculas",
    "series": "series",
    "animes": "animes",
    "tv": "tv"
};

const assetsPath = path.join(__dirname, 'assets');
const outputFile = path.join(assetsPath, 'content.json');

// Extensiones aceptadas por tipo de archivo
const validExtensions = ['.mp3', '.wav', '.mp4', '.mkv', '.avi', '.jpg', '.png', '.webm'];

// Función recursiva para explorar carpetas y subcarpetas
function scanFolder(folderPath) {
    if (!fs.existsSync(folderPath)) return [];

    const items = fs.readdirSync(folderPath);
    let result = [];

    items.forEach(item => {
        const fullPath = path.join(folderPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            // Si es carpeta, agregamos como subcategoría
            const subItems = scanFolder(fullPath);
            if (subItems.length > 0) {
                result.push({
                    category: item,
                    items: subItems
                });
            }
        } else {
            // Si es archivo válido, lo agregamos
            const ext = path.extname(item).toLowerCase();
            if (validExtensions.includes(ext)) {
                result.push({
                    title: path.parse(item).name,
                    file: fullPath.replace(__dirname + "\\", "").replace(/\\/g, "/")
                });
            }
        }
    });

    return result;
}

let content = {};

// Recorremos cada categoría principal
for (const [category, folderName] of Object.entries(contentFolders)) {
    const folderPath = path.join(assetsPath, folderName);
    content[category] = scanFolder(folderPath);
}

fs.writeFileSync(outputFile, JSON.stringify(content, null, 4), 'utf8');

console.log(`✅ content.json avanzado generado con categorías y subcategorías.`);
