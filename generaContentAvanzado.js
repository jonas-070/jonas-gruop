const fs = require('fs');
const path = require('path');

const assetsPath = path.join(__dirname, 'assets');
const outputFile = path.join(assetsPath, 'content.json');

// Extensiones permitidas por categoría
const categories = {
    "musicas": ['.mp3', '.wav', '.m4a', '.mp4', '.mkv', '.webm'],
    "peliculas": ['.mp4', '.mkv', '.avi', '.webm'],
    "series": ['.mp4', '.mkv', '.avi', '.webm'],
    "animes": ['.mp4', '.mkv', '.avi', '.webm'],
    "tv": ['.txt']
};

function scanFolder(categoryName, folderPath) {
    if (!fs.existsSync(folderPath)) return [];

    let result = [];
    const items = fs.readdirSync(folderPath);

    items.forEach(item => {
        const fullPath = path.join(folderPath, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            // Recursivo para subcarpetas
            const subItems = scanFolder(categoryName, fullPath);
            if (subItems.length > 0) {
                result.push({
                    category: item,
                    items: subItems
                });
            }
        } else {
            const ext = path.extname(item).toLowerCase();
            if (categories[categoryName].includes(ext)) {
                let entry = { title: path.parse(item).name };

                if (categoryName === 'tv') {
                    // Para TV, leer la URL dentro del archivo .txt
                    const url = fs.readFileSync(fullPath, 'utf8').trim();
                    entry.url = url;
                } else {
                    // Para música, series, películas, animes
                    entry.file = path.relative(__dirname, fullPath).replace(/\\/g, "/");

                    // Buscar miniaturas en carpeta "thumbs"
                    const thumbsFolder = path.join(path.dirname(fullPath), 'thumbs');
                    const thumbJpg = path.join(thumbsFolder, path.parse(item).name + '.jpg');
                    const thumbPng = path.join(thumbsFolder, path.parse(item).name + '.png');

                    if (fs.existsSync(thumbJpg)) entry.thumb = path.relative(__dirname, thumbJpg).replace(/\\/g, "/");
                    else if (fs.existsSync(thumbPng)) entry.thumb = path.relative(__dirname, thumbPng).replace(/\\/g, "/");
                    else entry.thumb = 'assets/default-thumb.jpg';
                }

                result.push(entry);
            }
        }
    });

    return result;
}

let content = {};
for (const [category] of Object.entries(categories)) {
    const folderPath = path.join(assetsPath, category);
    content[category] = scanFolder(category, folderPath);
}

// Guardar JSON
fs.writeFileSync(outputFile, JSON.stringify(content, null, 4), 'utf8');
console.log("✅ content.json completo generado con todas las categorías y subcarpetas.");
