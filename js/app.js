(() => {
  'use strict';

  const FAV_KEY = 'sctmg-soundboard-favorites-v1';

  const state = {
    unitsCfg: null,
    quotes: null,
    tab: 'terran',
    search: '',
    openUnit: null,
    activeCategory: {},   // unitKey -> category
    activeVariant: {},    // baseName -> unitKey (for hero variants like Artanis)
    favorites: loadFavorites(),
  };

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

  function quoteId(unitKey, category, file) {
    return `${unitKey}::${category}::${file}`;
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

  // --- grouping heroes with multiple variants (e.g. Artanis LotV/WoL) under one card ---
  function groupUnitsForFaction(faction) {
    const units = state.unitsCfg.units.filter((u) => u.faction === faction);
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
      `<button class="tab-btn" data-tab="favorites">★ Избранное</button>`;
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
      .map((line) => {
        const id = quoteId(unitKey, category, line.file);
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
    const out = [];
    for (const unit of state.unitsCfg.units) {
      const q = state.quotes[unit.key];
      if (!q) continue;
      for (const [cat, lines] of Object.entries(q.categories)) {
        for (const line of lines) out.push({ unit, category: cat, ...line });
      }
    }
    return out;
  }

  function renderFlatQuoteList(items, emptyMsg) {
    if (!items.length) return `<div class="empty-state">${emptyMsg}</div>`;
    return `<div class="quote-list">${items
      .map(({ unit, category, file, text }) => {
        const id = quoteId(unit.key, category, file);
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
      const items = all.filter((x) => state.favorites.has(quoteId(x.unit.key, x.category, x.file)));
      content.innerHTML = renderFlatQuoteList(items, 'Пока пусто. Нажмите ☆ на реплике, чтобы добавить сюда.');
      wireQuoteButtons(content);
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

  async function init() {
    const [unitsCfg, quotes] = await Promise.all([
      fetch('data/units.json').then((r) => r.json()),
      fetch('data/quotes.en.json').then((r) => r.json()),
    ]);
    state.unitsCfg = unitsCfg;
    state.quotes = quotes;

    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      render();
    });

    render();
  }

  init();
})();
