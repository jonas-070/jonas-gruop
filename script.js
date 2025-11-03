/* script.js - versión mejorada para audio, video y TV */

const SECTION_MAP = {
    music: 'Música',
    peliculas: 'Películas',
    series: 'Series',
    animes: 'Animes',
    tv: 'TV en vivo',
    descargas: 'Descargas',
    ajustes: 'Ajustes'
};

let contentData = null;
let currentAudio = null;
let currentTrack = null;

document.addEventListener('DOMContentLoaded', () => {
    // Search setup
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => doSearch(searchInput.value));
    if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(searchInput.value); });

    // Modal controls
    const close = document.getElementById('closeModal');
    if (close) close.addEventListener('click', closeModal);
    const modal = document.getElementById('modal');
    if (modal) modal.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

    // Load content
    fetch('assets/content.json')
        .then(r => r.json())
        .then(data => {
            contentData = data;
            populatePage();
        })
        .catch(err => {
            console.warn('No content.json', err);
            contentData = { music: [], peliculas: [], series: [], animes: [], tv: [], descargas: [], ajustes: [] };
            populatePage();
        });

    // Persistent player
    createPlayerBar();
});

// Populate page
function populatePage() {
    const main = document.getElementById('catalog');
    if (!main) return;
    const section = main.dataset.section || null;
    if (!section) {
        // index: multiple sections
        main.innerHTML = '';
        ['music', 'peliculas', 'series', 'animes'].forEach(k => {
            createSectionBlock(main, k, contentData[k] || []);
        });
    } else {
        renderSection(main, section, contentData[section] || []);
    }
}

// Section block
function createSectionBlock(container, key, items) {
    const sec = document.createElement('section');
    sec.className = 'section';
    const head = document.createElement('div');
    head.className = 'section-head';
    const h3 = document.createElement('h3');
    h3.innerText = SECTION_MAP[key] || key;
    const more = document.createElement('div');
    more.style.color = '#9fb0b6';
    more.style.fontSize = '14px';
    more.innerText = 'Ver todo';
    head.appendChild(h3);
    head.appendChild(more);

    const row = document.createElement('div');
    row.className = 'row grid-row';
    if (!items.length) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.innerText = 'Sin contenido por ahora.';
        row.appendChild(p);
    } else items.forEach(it => row.appendChild(buildCard(it)));

    sec.appendChild(head);
    sec.appendChild(row);
    container.appendChild(sec);
}

// Render single section
function renderSection(main, sectionKey, items) {
    main.innerHTML = '';
    const title = document.createElement('h2');
    title.style.margin = '6px 0 14px';
    title.innerText = SECTION_MAP[sectionKey] || sectionKey;
    main.appendChild(title);
    const row = document.createElement('div');
    row.className = 'row grid-row';
    if (!items.length) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.innerText = 'Sin contenido por ahora.';
        row.appendChild(p);
    } else items.forEach(it => row.appendChild(buildCard(it)));
    main.appendChild(row);
}

// Build card
function buildCard(it) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-title', it.title || '');
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = it.thumb || 'assets/default-thumb.jpg';
    img.alt = it.title || '';
    const t = document.createElement('div');
    t.className = 'title';
    t.innerText = it.title || '';
    card.appendChild(img);
    card.appendChild(t);
    card.addEventListener('click', () => openPlayer(it));
    return card;
}

// Search
function doSearch(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { alert('Escribe algo para buscar.'); return; }
    document.querySelectorAll('.card').forEach(card => {
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        card.style.display = title.includes(q) ? '' : 'none';
    });
    window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Open player
function openPlayer(item) {
    if (item.type === 'audio') {
        playAudio(item);
    } else if (item.file) {
        // Video
        const modal = document.getElementById('modal');
        const area = document.getElementById('playerArea');
        area.innerHTML = '';
        const h = document.createElement('h3');
        h.innerText = item.title || 'Reproduciendo';
        area.appendChild(h);
        const v = document.createElement('video');
        v.controls = true;
        v.src = item.file;
        v.style.width = '100%';
        area.appendChild(v);
        v.play().catch(() => { });
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    } else if (item.url) {
        // TV en vivo
        const modal = document.getElementById('modal');
        const area = document.getElementById('playerArea');
        area.innerHTML = '';
        const h = document.createElement('h3');
        h.innerText = item.title || 'TV en vivo';
        area.appendChild(h);
        const iframe = document.createElement('iframe');
        iframe.src = item.url;
        iframe.width = '100%';
        iframe.height = '480';
        iframe.allowFullscreen = true;
        iframe.style.border = 'none';
        area.appendChild(iframe);
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

// Play audio
function playAudio(item) {
    const playerTrack = document.getElementById('playerTrack');
    const playerTitle = document.getElementById('playerTitle');
    if (!currentAudio) {
        currentAudio = new Audio();
        currentAudio.addEventListener('timeupdate', updateProgress);
        currentAudio.addEventListener('ended', onTrackEnd);
    } else {
        currentAudio.pause();
    }
    currentAudio.src = item.file;
    currentAudio.play().catch(() => { });
    currentTrack = item;
    playerTitle.textContent = item.title || 'Reproduciendo';
    document.getElementById('playerThumb').src = item.thumb || 'assets/default-thumb.jpg';
    document.getElementById('playerProgress').style.width = '0%';
    document.getElementById('playerBar').style.display = 'flex';
}

// Persistent player bar
function createPlayerBar() {
    if (document.getElementById('playerBar')) return;
    const bar = document.createElement('div');
    bar.className = 'player-bar';
    bar.id = 'playerBar';
    bar.style.display = 'none';

    const info = document.createElement('div');
    info.className = 'player-info';
    const img = document.createElement('img');
    img.id = 'playerThumb';
    img.src = 'assets/default-thumb.jpg';
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '6px';
    const title = document.createElement('div');
    title.id = 'playerTitle';
    title.style.fontWeight = '700';
    info.appendChild(img);
    info.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'player-controls';
    const playBtn = document.createElement('button');
    playBtn.textContent = '⏯';
    playBtn.addEventListener('click', () => {
        if (!currentAudio) return;
        if (currentAudio.paused) currentAudio.play(); else currentAudio.pause();
    });
    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.style.width = '260px';
    const progInner = document.createElement('div');
    progInner.id = 'playerProgress';
    progInner.style.width = '0%';
    progress.appendChild(progInner);
    controls.appendChild(playBtn);
    controls.appendChild(progress);

    bar.appendChild(info);
    bar.appendChild(controls);
    document.body.appendChild(bar);
}

function updateProgress() {
    if (!currentAudio) return;
    const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
    document.getElementById('playerProgress').style.width = (isFinite(pct) ? pct : 0) + '%';
}

function onTrackEnd() {
    document.getElementById('playerBar').style.display = 'none';
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const area = document.getElementById('playerArea');
    if (area) area.innerHTML = '';
}
