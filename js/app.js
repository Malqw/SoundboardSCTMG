(() => {
  'use strict';

  const FAV_KEY = 'sctmg-soundboard-favorites-v1';
  const LANG_KEY = 'sctmg-soundboard-lang-v1';
  const TMG_KEY = 'sctmg-soundboard-tmg-only-v1';

  const LANGS = [
    { key: 'en', label: 'EN', file: 'data/quotes.en.json' },
    { key: 'ru', label: 'RU', file: 'data/quotes.ru.json' },
    { key: 'classic', label: 'SC1', file: 'data/quotes.classic.json' },
  ];

  const state = {
    unitsCfg: null,
    packs: {},           // lang key -> loaded quotes data
    quotes: null,         // = state.packs[state.lang], kept in sync in setLang()
    lang: loadLang(),
    tab: 'terran',
    search: '',
    openUnit: null,
    activeCategory: {},   // unitKey -> category
    activeVariant: {},    // baseName -> unitKey (for hero variants like Artanis)
    favorites: loadFavorites(),
    tmgOnly: loadTmgOnly(),
    music: [],
    musicSource: 'sc2',    // 'sc2' | 'sc1' — which playlist sub-tab is shown
    musicIndex: null,      // key of the currently playing track, or null if nothing loaded
  };

  function loadLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      return LANGS.some((l) => l.key === v) ? v : 'en';
    } catch {
      return 'en';
    }
  }
  function saveLang() {
    try { localStorage.setItem(LANG_KEY, state.lang); } catch { /* ignore */ }
  }

  function loadTmgOnly() {
    try {
      const v = localStorage.getItem(TMG_KEY);
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  }
  function saveTmgOnly() {
    try { localStorage.setItem(TMG_KEY, state.tmgOnly ? '1' : '0'); } catch { /* ignore */ }
  }

  // 'en'/'ru' packs are StarCraft II audio, 'classic' is StarCraft (1998) audio —
  // the unit roster shown must match whichever game the active pack belongs to.
  function currentGame() {
    return state.lang === 'classic' ? 'sc1' : 'sc2';
  }

  function loadFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }
  function saveFavorites() {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites]));
    } catch { /* storage unavailable, ignore */ }
  }

  // Index-based, not file-based: the same logical quote points at a different audio
  // file per language pack, but should stay favorited/identifiable across the switch.
  function quoteId(unitKey, category, index) {
    return `${unitKey}::${category}::${index}`;
  }

  let currentAudio = null;
  function playQuote(file, rowEl) {
    document.querySelectorAll('.quote-row.playing').forEach((el) => el.classList.remove('playing'));
    const audio = new Audio(file);
    currentAudio = audio;
    rowEl.classList.add('playing');
    audio.addEventListener('ended', () => rowEl.classList.remove('playing'));
    audio.addEventListener('error', () => {
      rowEl.classList.remove('playing');
      showToast('Не удалось воспроизвести файл');
    });
    audio.play().catch(() => {
      rowEl.classList.remove('playing');
      showToast('Нажмите ещё раз (браузер заблокировал автовоспроизведение)');
    });
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // --- background music player: independent of quote playback, keeps going while
  // browsing other tabs (persistent <audio>, mini-player bar rendered outside #content) ---
  const musicAudio = new Audio();
  musicAudio.addEventListener('timeupdate', updateMiniProgress);
  musicAudio.addEventListener('ended', () => stepMusic(1));
  musicAudio.addEventListener('error', () => showToast('Не удалось воспроизвести трек'));

  // Playing track is tracked by its unique `key`, not array index — indices shift
  // when the SC1/SC2 filter changes, a stable key doesn't.
  function currentMusicList() {
    return state.music.filter((t) => t.source === state.musicSource);
  }

  function playMusicByKey(key) {
    const track = state.music.find((t) => t.key === key);
    if (!track) return;
    state.musicIndex = key;
    musicAudio.src = track.file;
    musicAudio.play().catch(() => showToast('Нажмите play ещё раз (браузер заблокировал автовоспроизведение)'));
    updateMiniPlayer();
    if (state.tab === 'music') render();
  }

  function stepMusic(delta) {
    const list = currentMusicList();
    if (!list.length) return;
    const pos = list.findIndex((t) => t.key === state.musicIndex);
    const next = ((pos + delta) % list.length + list.length) % list.length;
    playMusicByKey(list[next].key);
  }

  function toggleMusicByKey(key) {
    if (state.musicIndex === key && !musicAudio.paused) {
      musicAudio.pause();
      updateMiniPlayer();
      if (state.tab === 'music') render();
    } else if (state.musicIndex === key) {
      musicAudio.play().catch(() => {});
      updateMiniPlayer();
    } else {
      playMusicByKey(key);
    }
  }

  function stopMusic() {
    musicAudio.pause();
    musicAudio.removeAttribute('src');
    state.musicIndex = null;
    updateMiniPlayer();
    if (state.tab === 'music') render();
  }

  function updateMiniProgress() {
    const fill = document.getElementById('miniProgress');
    if (!fill || !musicAudio.duration) return;
    fill.style.width = `${(musicAudio.currentTime / musicAudio.duration) * 100}%`;
  }

  function updateMiniPlayer() {
    const bar = document.getElementById('miniPlayer');
    if (state.musicIndex === null) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const track = state.music.find((t) => t.key === state.musicIndex);
    document.getElementById('miniTrackName').textContent = track ? track.name : '';
    document.getElementById('miniPlayToggle').textContent = musicAudio.paused ? '▶' : '⏸';
  }

  // --- grouping heroes with multiple variants (e.g. Artanis LotV/WoL) under one card ---
  function groupUnitsForFaction(faction) {
    const game = currentGame();
    const units = state.unitsCfg.units.filter(
      (u) =>
        u.faction === faction &&
        (!state.tmgOnly || u.tmg === true) &&
        (!u.games || u.games.includes(game))
    );
    const groups = [];
    const seenBase = new Map();
    for (const u of units) {
      const base = u.name.replace(/\s*\(.*?\)\s*/g, '').trim();
      if (seenBase.has(base)) {
        seenBase.get(base).variants.push(u);
      } else {
        const g = { base, primary: u, variants: [u] };
        seenBase.set(base, g);
        groups.push(g);
      }
    }
    return groups;
  }

  function unitHasAudio(unitKey) {
    const q = state.quotes[unitKey];
    return !!q && Object.values(q.categories).some((arr) => arr.length);
  }

  function renderTabs() {
    const tabsEl = document.getElementById('tabs');
    const factionTabs = state.unitsCfg.factions.map(
      (f) => `<button class="tab-btn" data-tab="${f.key}">${f.name}</button>`
    );
    tabsEl.innerHTML =
      factionTabs.join('') +
      `<button class="tab-btn" data-tab="favorites">★ Избранное</button>` +
      `<button class="tab-btn" data-tab="music">🎵 Музыка</button>`;
    tabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === state.tab);
      btn.addEventListener('click', () => {
        state.tab = btn.dataset.tab;
        state.search = '';
        document.getElementById('search').value = '';
        render();
      });
    });
  }

  function categoriesForUnit(unitKey) {
    const q = state.quotes[unitKey];
    if (!q) return [];
    const order = state.unitsCfg.categoryOrder;
    return order.filter((c) => (q.categories[c] || []).length > 0);
  }

  function renderQuoteList(unitKey, category) {
    const q = state.quotes[unitKey];
    const lines = (q && q.categories[category]) || [];
    if (!lines.length) return '<div class="empty-state">Нет реплик в этой категории.</div>';
    return `<div class="quote-list">${lines
      .map((line, index) => {
        const id = quoteId(unitKey, category, index);
        const fav = state.favorites.has(id);
        return `
        <div class="quote-row" data-file="${escapeAttr(line.file)}">
          <button class="quote-play" data-file="${escapeAttr(line.file)}">
            <span class="icon">▶</span>
            <span>${escapeHtml(line.text || '(без текста)')}</span>
          </button>
          <button class="quote-fav ${fav ? 'active' : ''}" data-id="${escapeAttr(id)}"
            data-unit="${unitKey}" data-cat="${category}" data-file="${escapeAttr(line.file)}">
            ${fav ? '★' : '☆'}
          </button>
        </div>`;
      })
      .join('')}</div>`;
  }

  function renderUnitCard(group) {
    const variants = group.variants;
    const activeVariantKey = state.activeVariant[group.base] || variants[0].key;
    const activeUnit = variants.find((v) => v.key === activeVariantKey) || variants[0];
    const isOpen = state.openUnit === group.base;
    const hasAudio = variants.some((v) => unitHasAudio(v.key));
    const pending = activeUnit.pending || !unitHasAudio(activeUnit.key);

    const cats = categoriesForUnit(activeUnit.key);
    const activeCat = state.activeCategory[activeUnit.key] || cats[0];

    const variantRow =
      variants.length > 1
        ? `<div class="variant-row">${variants
            .map(
              (v) =>
                `<button class="variant-btn ${v.key === activeUnit.key ? 'active' : ''}" data-base="${escapeAttr(group.base)}" data-unit="${v.key}">${escapeHtml(v.subtitle || v.name)}</button>`
            )
            .join('')}</div>`
        : '';

    const catRow = cats.length
      ? `<div class="cat-row">${cats
          .map((c) => {
            const label = state.unitsCfg.categoryLabels[c] || c;
            const count = state.quotes[activeUnit.key].categories[c].length;
            return `<button class="cat-btn ${c === activeCat ? 'active' : ''}" data-unit="${activeUnit.key}" data-cat="${c}">${label} <span class="cat-count">${count}</span></button>`;
          })
          .join('')}</div>`
      : '';

    const body = pending
      ? `<div class="unit-pending-note">Звуков пока нет — юнит в очереди на добавление.</div>`
      : `${variantRow}${catRow}${activeCat ? renderQuoteList(activeUnit.key, activeCat) : ''}`;

    return `
    <div class="unit-card ${isOpen ? 'open' : ''} ${pending ? 'pending' : ''}" data-faction="${activeUnit.faction}" data-base="${escapeAttr(group.base)}">
      <div class="unit-header" data-base="${escapeAttr(group.base)}">
        <div class="unit-title">
          <div class="unit-name">${escapeHtml(group.base)}${activeUnit.hero ? ' <span class="unit-badge">герой</span>' : ''}</div>
          <div class="unit-sub">${escapeHtml(activeUnit.subtitle || '')}</div>
        </div>
        <div class="unit-caret">▾</div>
      </div>
      <div class="unit-body">${isOpen ? body : ''}</div>
    </div>`;
  }

  function renderFactionTab() {
    const groups = groupUnitsForFaction(state.tab);
    return groups.map(renderUnitCard).join('');
  }

  function flattenAllQuotes() {
    const game = currentGame();
    const out = [];
    for (const unit of state.unitsCfg.units) {
      if (state.tmgOnly && unit.tmg !== true) continue;
      if (unit.games && !unit.games.includes(game)) continue;
      const q = state.quotes[unit.key];
      if (!q) continue;
      for (const [cat, lines] of Object.entries(q.categories)) {
        lines.forEach((line, index) => out.push({ unit, category: cat, index, ...line }));
      }
    }
    return out;
  }

  function renderFlatQuoteList(items, emptyMsg) {
    if (!items.length) return `<div class="empty-state">${emptyMsg}</div>`;
    return `<div class="quote-list">${items
      .map(({ unit, category, index, file, text }) => {
        const id = quoteId(unit.key, category, index);
        const fav = state.favorites.has(id);
        const catLabel = state.unitsCfg.categoryLabels[category] || category;
        return `
        <div class="quote-row" data-file="${escapeAttr(file)}">
          <button class="quote-play" data-file="${escapeAttr(file)}">
            <span class="icon">▶</span>
            <span>
              ${escapeHtml(text || '(без текста)')}
              <div class="quote-unit-tag">${escapeHtml(unit.name)} · ${escapeHtml(catLabel)}</div>
            </span>
          </button>
          <button class="quote-fav ${fav ? 'active' : ''}" data-id="${escapeAttr(id)}"
            data-unit="${unit.key}" data-cat="${category}" data-file="${escapeAttr(file)}">
            ${fav ? '★' : '☆'}
          </button>
        </div>`;
      })
      .join('')}</div>`;
  }

  function renderMusicTab() {
    const sourceRow = `<div class="variant-row">${[
      { key: 'sc2', label: 'StarCraft II' },
      { key: 'sc1', label: 'StarCraft (классика)' },
    ]
      .map(
        (s) =>
          `<button class="variant-btn ${s.key === state.musicSource ? 'active' : ''}" data-music-source="${s.key}">${s.label}</button>`
      )
      .join('')}</div>`;

    const list = currentMusicList();
    if (!list.length) return sourceRow + '<div class="empty-state">Треков пока нет.</div>';
    const rows = list
      .map((track) => {
        const isPlaying = state.musicIndex === track.key && !musicAudio.paused;
        return `
        <div class="music-row ${isPlaying ? 'playing' : ''}" data-key="${escapeAttr(track.key)}">
          <span class="icon">${isPlaying ? '⏸' : '▶'}</span>
          <span class="music-name">${escapeHtml(track.name)}</span>
        </div>`;
      })
      .join('');
    return `${sourceRow}<div class="music-hint">Фоновая музыка — играет, пока вы листаете сайт.</div><div class="music-list">${rows}</div>`;
  }

  function wireMusicRows(root) {
    root.querySelectorAll('.music-row').forEach((row) => {
      row.addEventListener('click', () => toggleMusicByKey(row.dataset.key));
    });
    root.querySelectorAll('[data-music-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.musicSource = btn.dataset.musicSource;
        render();
      });
    });
  }

  function render() {
    renderTabs();
    const content = document.getElementById('content');

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      const items = flattenAllQuotes().filter((x) => (x.text || '').toLowerCase().includes(q));
      content.innerHTML = renderFlatQuoteList(items, 'Ничего не найдено.');
      wireQuoteButtons(content);
      return;
    }

    if (state.tab === 'favorites') {
      const all = flattenAllQuotes();
      const items = all.filter((x) => state.favorites.has(quoteId(x.unit.key, x.category, x.index)));
      content.innerHTML = renderFlatQuoteList(items, 'Пока пусто. Нажмите ☆ на реплике, чтобы добавить сюда.');
      wireQuoteButtons(content);
      return;
    }

    if (state.tab === 'music') {
      content.innerHTML = renderMusicTab();
      wireMusicRows(content);
      return;
    }

    content.innerHTML = renderFactionTab();
    wireUnitCards(content);
    wireQuoteButtons(content);
  }

  function wireUnitCards(root) {
    root.querySelectorAll('.unit-header').forEach((header) => {
      header.addEventListener('click', () => {
        const base = header.dataset.base;
        state.openUnit = state.openUnit === base ? null : base;
        render();
      });
    });
    root.querySelectorAll('.variant-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeVariant[btn.dataset.base] = btn.dataset.unit;
        render();
      });
    });
    root.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.activeCategory[btn.dataset.unit] = btn.dataset.cat;
        render();
      });
    });
  }

  function wireQuoteButtons(root) {
    root.querySelectorAll('.quote-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.quote-row');
        playQuote(btn.dataset.file, row);
      });
    });
    root.querySelectorAll('.quote-fav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (state.favorites.has(id)) state.favorites.delete(id);
        else state.favorites.add(id);
        saveFavorites();
        render();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  async function loadPack(langKey) {
    if (state.packs[langKey]) return state.packs[langKey];
    const lang = LANGS.find((l) => l.key === langKey);
    const data = await fetch(lang.file).then((r) => r.json());
    state.packs[langKey] = data;
    return data;
  }

  async function setLang(langKey) {
    if (langKey === state.lang && state.quotes) return;
    await loadPack(langKey);
    state.lang = langKey;
    state.quotes = state.packs[langKey];
    saveLang();
    renderLangSwitch();
    render();
  }

  function renderLangSwitch() {
    const el = document.getElementById('langSwitch');
    el.innerHTML = LANGS.map(
      (l) => `<button class="lang-btn ${l.key === state.lang ? 'active' : ''}" data-lang="${l.key}">${l.label}</button>`
    ).join('');
    el.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
  }

  function renderTmgToggle() {
    const btn = document.getElementById('tmgToggle');
    btn.classList.toggle('active', state.tmgOnly);
    btn.textContent = state.tmgOnly ? 'TMG' : 'Все юниты';
    btn.title = state.tmgOnly
      ? 'Показаны только юниты StarCraft: The Miniatures Game. Нажмите, чтобы увидеть весь ростер игры.'
      : 'Показан весь ростер игры. Нажмите, чтобы вернуться только к юнитам TMG.';
  }

  function wireMiniPlayer() {
    document.getElementById('miniPlayToggle').addEventListener('click', () => {
      if (state.musicIndex !== null) toggleMusicByKey(state.musicIndex);
    });
    document.getElementById('miniNext').addEventListener('click', () => {
      if (state.musicIndex !== null) stepMusic(1);
    });
    document.getElementById('miniClose').addEventListener('click', stopMusic);
    document.querySelector('.mini-progress-track').addEventListener('click', (e) => {
      if (state.musicIndex === null || !musicAudio.duration) return;
      const track = e.currentTarget;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      musicAudio.currentTime = ratio * musicAudio.duration;
      updateMiniProgress();
    });
  }

  async function init() {
    const [unitsCfg, music] = await Promise.all([
      fetch('data/units.json').then((r) => r.json()),
      fetch('data/music.json').then((r) => r.json()).catch(() => []),
    ]);
    state.unitsCfg = unitsCfg;
    state.music = music;
    state.quotes = await loadPack(state.lang);

    renderLangSwitch();
    renderTmgToggle();
    wireMiniPlayer();
    document.getElementById('tmgToggle').addEventListener('click', () => {
      state.tmgOnly = !state.tmgOnly;
      saveTmgOnly();
      renderTmgToggle();
      render();
    });

    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      render();
    });

    render();
  }

  init();
})();
