/**
 * PhoneCount - Core Application Engine
 * Client-side manual stock counter with localStorage sync
 */

(function () {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_KEYS = {
    PRODUCTS: 'phonecount_products',
    CATEGORIES: 'phonecount_categories',
    HISTORY: 'phonecount_history',
    SETTINGS: 'phonecount_settings'
  };

  // --- Default Configuration & Demo Data ---
  const DEFAULT_SETTINGS = {
    theme: 'dark',
    lowStockThreshold: 2
  };

  const DEFAULT_CATEGORIES = [
    'All',
    'Apple',
    'Samsung',
    'Xiaomi',
    'Oppo',
    'Huawei',
    'Realme',
    'Other'
  ];

  const DEMO_PRODUCTS = [
    { brand: 'Apple', model: 'iPhone 13', category: 'Apple', storage: '128 GB', color: 'Black', sku: 'IP13-128-BLK', location: 'Shelf A1', condition: 'New', quantity: 7, notes: 'Sealed pack' },
    { brand: 'Apple', model: 'iPhone 13', category: 'Apple', storage: '128 GB', color: 'Blue', sku: 'IP13-128-BLU', location: 'Shelf A1', condition: 'New', quantity: 3, notes: 'Blue variant' },
    { brand: 'Apple', model: 'iPhone 14', category: 'Apple', storage: '128 GB', color: 'Midnight', sku: 'IP14-128-MID', location: 'Shelf A2', condition: 'New', quantity: 5, notes: '' },
    { brand: 'Apple', model: 'iPhone 15', category: 'Apple', storage: '128 GB', color: 'Black', sku: 'IP15-128-BLK', location: 'Shelf A3', condition: 'New', quantity: 1, notes: 'Display model included' },
    { brand: 'Samsung', model: 'Galaxy S21', category: 'Samsung', storage: '128 GB', color: 'Phantom Gray', sku: 'S21-128-GRY', location: 'Shelf B1', condition: 'Refurbished', quantity: 4, notes: 'Grade A' },
    { brand: 'Samsung', model: 'Galaxy S21 Ultra', category: 'Samsung', storage: '256 GB', color: 'Phantom Black', sku: 'S21U-256-BLK', location: 'Shelf B1', condition: 'Used - Excellent', quantity: 2, notes: 'Box only' },
    { brand: 'Samsung', model: 'Galaxy S22', category: 'Samsung', storage: '128 GB', color: 'Green', sku: 'S22-128-GRN', location: 'Shelf B2', condition: 'New', quantity: 0, notes: 'Awaiting shipment' },
    { brand: 'Samsung', model: 'Galaxy S23', category: 'Samsung', storage: '256 GB', color: 'Cream', sku: 'S23-256-CRM', location: 'Shelf B3', condition: 'New', quantity: 6, notes: '' },
    { brand: 'Xiaomi', model: 'Redmi Note 12', category: 'Xiaomi', storage: '128 GB', color: 'Onyx Gray', sku: 'RN12-128-GRY', location: 'Shelf C1', condition: 'New', quantity: 10, notes: 'Fast mover' },
    { brand: 'Xiaomi', model: 'Redmi Note 13', category: 'Xiaomi', storage: '256 GB', color: 'Mint Green', sku: 'RN13-256-MNT', location: 'Shelf C1', condition: 'New', quantity: 8, notes: '' },
    { brand: 'Oppo', model: 'Reno 8', category: 'Oppo', storage: '128 GB', color: 'Shimmer Gold', sku: 'OPP-R8-128', location: 'Shelf D1', condition: 'New', quantity: 2, notes: '' },
    { brand: 'Huawei', model: 'Nova 9', category: 'Huawei', storage: '128 GB', color: 'Starry Blue', sku: 'HW-NOV9-128', location: 'Shelf D2', condition: 'Refurbished', quantity: 0, notes: 'Check charger' }
  ];

  // --- Application State ---
  let products = [];
  let categories = [];
  let historyLogs = [];
  let settings = { ...DEFAULT_SETTINGS };

  let currentActiveCategory = 'All';
  let searchQuery = '';
  let activeFilterStock = 'all';
  let activeFilterStorage = 'all';
  let activeFilterCondition = 'all';
  let activeSort = 'recent';
  let viewingProductId = null;
  let formUploadedImageData = '';

  // --- Admin Detection ---
  const IS_ADMIN = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // --- Initializer ---
  async function init() {
    if (!IS_ADMIN) {
      document.body.classList.add('read-only');
    }

    await loadState();
    applyTheme(settings.theme);
    setupEventListeners();
    renderAll();
  }

  // --- State & Storage Handlers ---
  async function loadState() {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };

      const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      categories = storedCategories ? JSON.parse(storedCategories) : [...DEFAULT_CATEGORIES];

      const storedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      historyLogs = storedHistory ? JSON.parse(storedHistory) : [];

      if (IS_ADMIN) {
        // Admin: Load your working inventory from local storage
        const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        if (storedProducts) {
          products = JSON.parse(storedProducts);
        } else {
          products = DEMO_PRODUCTS.map((p, idx) => ({
            ...p,
            id: 'pc_' + Date.now() + '_' + idx,
            imei: '',
            image: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
          saveProducts();
        }
      } else {
        // Public Visitors: Always fetch the immutable published file
        const response = await fetch('./inventory.json?t=' + Date.now());
        if (response.ok) {
          products = await response.json();
        } else {
          products = [];
        }
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  }

  function saveProducts() {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    renderStats();
  }

  function saveCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyLogs));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- Stock Logic ---
  function getStockStatus(qty) {
    if (qty <= 0) return { label: 'Out of Stock', css: 'badge-out-of-stock', key: 'out-of-stock' };
    if (qty <= settings.lowStockThreshold) return { label: 'Low Stock', css: 'badge-low-stock', key: 'low-stock' };
    return { label: 'In Stock', css: 'badge-in-stock', key: 'in-stock' };
  }

  // --- Quantity Modification Core ---
  function changeProductQuantity(productId, delta, isAbsolute = false) {
    if (!IS_ADMIN) return; // Prevent any modifications on live visitors' browsers

    const item = products.find(p => p.id === productId);
    if (!item) return;

    const oldQty = Number(item.quantity) || 0;
    let newQty = isAbsolute ? Number(delta) : oldQty + delta;
    if (newQty < 0) newQty = 0;
    if (newQty === oldQty && !isAbsolute) return;

    item.quantity = newQty;
    item.updatedAt = new Date().toISOString();
    saveProducts();

    updateDomCounters(productId, newQty);
    if (viewingProductId === productId) {
      renderProductDetails(productId);
    }
  }

  function updateDomCounters(productId, qty) {
    const miniCounter = document.querySelector(`[data-counter-id="${productId}"]`);
    if (miniCounter) {
      miniCounter.textContent = qty;
      miniCounter.classList.remove('bump');
      void miniCounter.offsetWidth;
      miniCounter.classList.add('bump');

      // Update badge on card
      const card = miniCounter.closest('.product-card');
      if (card) {
        const badgeEl = card.querySelector('.card-badge span');
        if (badgeEl) {
          const status = getStockStatus(qty);
          badgeEl.className = `badge ${status.css}`;
          badgeEl.textContent = status.label;
        }
      }
    }
  }

  // --- Render Functions ---
  function renderAll() {
    renderCategoryPills();
    renderStorageFilterOptions();
    renderBrandDataList();
    renderCategoryDropdowns();
    renderInventory();
    renderCategoriesView();
    renderStats();
  }

  function renderStats() {
    let totalQty = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach(p => {
      const q = Number(p.quantity) || 0;
      totalQty += q;
      if (q === 0) outOfStock++;
      else if (q <= settings.lowStockThreshold) lowStock++;
    });

    document.getElementById('stat-total-qty').textContent = totalQty;
    document.getElementById('stat-total-products').textContent = products.length;
    document.getElementById('stat-low-stock').textContent = lowStock;
    document.getElementById('stat-out-of-stock').textContent = outOfStock;
  }

  function renderCategoryPills() {
    const container = document.getElementById('category-pills-container');
    container.innerHTML = '';

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `pill-btn ${cat === currentActiveCategory ? 'active' : ''}`;
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        currentActiveCategory = cat;
        renderCategoryPills();
        renderInventory();
      });
      container.appendChild(btn);
    });
  }

  function renderStorageFilterOptions() {
    const select = document.getElementById('filter-storage');
    const existing = select.value;
    const storages = Array.from(new Set(products.map(p => (p.storage || '').trim()).filter(Boolean)));

    select.innerHTML = '<option value="all">All Storage</option>';
    storages.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      select.appendChild(opt);
    });
    if (storages.includes(existing)) select.value = existing;
  }

  function renderBrandDataList() {
    const list = document.getElementById('brand-datalist');
    const brands = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));
    list.innerHTML = brands.map(b => `<option value="${escapeHtml(b)}"></option>`).join('');
  }

  function renderCategoryDropdowns() {
    const catSelect = document.getElementById('prod-category');
    const validCats = categories.filter(c => c !== 'All');
    catSelect.innerHTML = validCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function renderInventory() {
    const grid = document.getElementById('product-grid');
    const emptyState = document.getElementById('inventory-empty');

    const filtered = products.filter(p => {
      // Category pill filter
      if (currentActiveCategory !== 'All') {
        const catMatch = (p.category || '').toLowerCase() === currentActiveCategory.toLowerCase() ||
                         (p.brand || '').toLowerCase() === currentActiveCategory.toLowerCase();
        if (!catMatch) return false;
      }

      // Stock status filter
      if (activeFilterStock !== 'all') {
        const status = getStockStatus(p.quantity).key;
        if (status !== activeFilterStock) return false;
      }

      // Storage filter
      if (activeFilterStorage !== 'all') {
        if ((p.storage || '').trim() !== activeFilterStorage) return false;
      }

      // Condition filter
      if (activeFilterCondition !== 'all') {
        if (p.condition !== activeFilterCondition) return false;
      }

      // Live search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const searchTarget = `${p.brand} ${p.model} ${p.storage} ${p.color} ${p.sku} ${p.imei} ${p.location}`.toLowerCase();
        if (!searchTarget.includes(q)) return false;
      }

      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (activeSort === 'name-asc') return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      if (activeSort === 'name-desc') return `${b.brand} ${b.model}`.localeCompare(`${a.brand} ${a.model}`);
      if (activeSort === 'qty-asc') return (a.quantity || 0) - (b.quantity || 0);
      if (activeSort === 'qty-desc') return (b.quantity || 0) - (a.quantity || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');

      if (products.length === 0) {
        emptyState.innerHTML = `
          <h3>Your inventory is empty.</h3>
          <p>Add your first phone to start counting.</p>
          <button class="btn btn-primary" id="btn-empty-add">+ Add Product</button>
        `;
        document.getElementById('btn-empty-add').addEventListener('click', () => switchView('view-add-product'));
      } else {
        emptyState.innerHTML = `
          <h3>No phones found.</h3>
          <p>Try another model, SKU, or clear filters.</p>
          <button class="btn btn-secondary" id="btn-reset-search">Clear Search & Filters</button>
        `;
        document.getElementById('btn-reset-search').addEventListener('click', () => {
          searchQuery = '';
          document.getElementById('inventory-search').value = '';
          currentActiveCategory = 'All';
          activeFilterStock = 'all';
          activeFilterStorage = 'all';
          activeFilterCondition = 'all';
          document.getElementById('filter-stock').value = 'all';
          document.getElementById('filter-storage').value = 'all';
          document.getElementById('filter-condition').value = 'all';
          renderCategoryPills();
          renderInventory();
        });
      }
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = filtered.map(p => {
      const status = getStockStatus(p.quantity);
      return `
        <article class="product-card" data-id="${p.id}">
          <div class="card-img-wrap">
            <div class="card-badge"><span class="badge ${status.css}">${status.label}</span></div>
            ${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.brand)} ${escapeHtml(p.model)}" loading="lazy">` : `
              <div class="card-placeholder-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
            `}
          </div>
          <div class="card-body">
            <span class="card-brand">${escapeHtml(p.brand)}</span>
            <h3 class="card-model">${escapeHtml(p.model)}</h3>
            <p class="card-specs">${escapeHtml(p.storage || 'N/A')} • ${escapeHtml(p.color || 'Standard')}</p>
            <div class="card-meta">
              <span>SKU: ${escapeHtml(p.sku || 'None')}</span>
              <span>${escapeHtml(p.location || 'No shelf')}</span>
            </div>

            <div class="card-counter-section">
              <button class="counter-btn-mini btn-qty-dec" data-id="${p.id}" aria-label="Decrease quantity">">−</button>
              <span class="counter-number-mini" data-counter-id="${p.id}">${p.quantity}</span>
              <button class="counter-btn-mini btn-qty-inc" data-id="${p.id}" aria-label="Increase quantity">+</button>
            </div>

            <button class="btn-view-product" data-view-id="${p.id}">View Product</button>
          </div>
        </article>
      `;
    }).join('');

    // Attach immediate click events to counter & cards
    grid.querySelectorAll('.btn-qty-dec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeProductQuantity(btn.dataset.id, -1);
      });
    });

    grid.querySelectorAll('.btn-qty-inc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeProductQuantity(btn.dataset.id, 1);
      });
    });

    grid.querySelectorAll('.btn-view-product').forEach(btn => {
      btn.addEventListener('click', () => {
        openProductDetails(btn.dataset.viewId);
      });
    });
  }

  function renderCategoriesView() {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = categories.filter(c => c !== 'All').map(cat => {
      const count = products.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase() || (p.brand || '').toLowerCase() === cat.toLowerCase()).length;
      return `
        <div class="category-card" data-cat="${escapeHtml(cat)}">
          <span class="category-name">${escapeHtml(cat)}</span>
          <span class="category-badge">${count} phones</span>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        currentActiveCategory = card.dataset.cat;
        renderCategoryPills();
        switchView('view-inventory');
        renderInventory();
      });
    });
  }

  function openProductDetails(id) {
    viewingProductId = id;
    renderProductDetails(id);
    switchView('view-product-details');
  }

  function renderProductDetails(id) {
    const p = products.find(prod => prod.id === id);
    if (!p) {
      switchView('view-inventory');
      return;
    }

    const status = getStockStatus(p.quantity);
    document.getElementById('detail-model').textContent = p.model;
    document.getElementById('detail-subtitle').textContent = `${p.brand} • ${p.storage || 'N/A'} • ${p.color || 'Standard'}`;
    
    const badge = document.getElementById('detail-stock-badge');
    badge.className = `badge ${status.css}`;
    badge.textContent = status.label;

    const imgContainer = document.getElementById('detail-img-box');
    if (p.image) {
      imgContainer.innerHTML = `<img src="${p.image}" alt="${escapeHtml(p.model)}">`;
    } else {
      imgContainer.innerHTML = `
        <div class="card-placeholder-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </div>
      `;
    }

    const tags = document.getElementById('detail-tags');
    tags.innerHTML = `
      <span class="spec-tag">${escapeHtml(p.category || p.brand)}</span>
      <span class="spec-tag">${escapeHtml(p.condition || 'New')}</span>
      <span class="spec-tag">${escapeHtml(p.location || 'Store Floor')}</span>
    `;

    // Large quantity control
    const display = document.getElementById('detail-quantity-display');
    display.textContent = p.quantity;
    display.classList.remove('bump');
    void display.offsetWidth;
    display.classList.add('bump');

    // Specs
    document.getElementById('spec-brand').textContent = p.brand;
    document.getElementById('spec-model').textContent = p.model;
    document.getElementById('spec-storage').textContent = p.storage || 'None specified';
    document.getElementById('spec-color').textContent = p.color || 'None specified';
    document.getElementById('spec-sku').textContent = p.sku || 'None';
    document.getElementById('spec-imei').textContent = p.imei || 'Not recorded';
    document.getElementById('spec-location').textContent = p.location || 'None';
    document.getElementById('spec-condition').textContent = p.condition || 'New';
    document.getElementById('spec-category').textContent = p.category || 'General';
    document.getElementById('spec-updated').textContent = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'Never';
    document.getElementById('spec-notes').textContent = p.notes || 'No notes provided.';

    // History
    renderProductHistory(p.id);
  }

  function renderProductHistory(productId) {
    const list = document.getElementById('history-log-list');
    const logs = historyLogs.filter(h => h.productId === productId);

    if (logs.length === 0) {
      list.innerHTML = '<p style="color:var(--secondary); font-size:0.85rem;">No count adjustments recorded yet.</p>';
      return;
    }

    list.innerHTML = logs.map(h => {
      const isInc = h.diff > 0;
      const pillClass = h.diff === 0 ? 'neutral' : isInc ? 'inc' : 'dec';
      const sign = h.diff > 0 ? `+${h.diff}` : `${h.diff}`;
      const timeStr = formatRelativeTime(new Date(h.timestamp));

      return `
        <div class="history-item">
          <div class="history-change">
            <span class="history-pill ${pillClass}">${sign}</span>
            <span class="history-text">Quantity ${h.from} → ${h.to}</span>
          </div>
          <span class="history-time">${timeStr}</span>
        </div>
      `;
    }).join('');
  }

  // --- View Switching Navigation ---
  function switchView(viewId) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.nav-link, .mobile-nav-item, .nav-icon-btn').forEach(btn => {
      if (btn.dataset.target === viewId) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Image Handling (Base64 + Compression) ---
  function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 480;
        const MAX_HEIGHT = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        formUploadedImageData = canvas.toDataURL('image/jpeg', 0.82);
        updateFormImagePreview(formUploadedImageData);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateFormImagePreview(dataUrl) {
    const previewImg = document.getElementById('image-preview');
    const placeholder = document.querySelector('.image-placeholder-icon');
    const btnRemove = document.getElementById('btn-remove-image');

    if (dataUrl) {
      previewImg.src = dataUrl;
      previewImg.classList.remove('hidden');
      placeholder.classList.add('hidden');
      btnRemove.classList.remove('hidden');
    } else {
      previewImg.src = '';
      previewImg.classList.add('hidden');
      placeholder.classList.remove('hidden');
      btnRemove.classList.add('hidden');
      formUploadedImageData = '';
      document.getElementById('product-image-input').value = '';
    }
  }

  // --- Modal Utility ---
  function openModal(title, bodyContent, actions) {
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';

    if (typeof bodyContent === 'string') {
      bodyEl.innerHTML = bodyContent;
    } else {
      bodyEl.appendChild(bodyContent);
    }

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn ${action.className || 'btn-secondary'}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.onClick) action.onClick();
        closeModal();
      });
      footerEl.appendChild(btn);
    });

    backdrop.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
  }

  // --- Toast System ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // --- Themes ---
  function applyTheme(theme) {
    settings.theme = theme;
    saveSettings();

    document.querySelectorAll('.theme-select-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === theme);
    });

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.body.setAttribute('data-theme', theme);
    }
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Navigation routing
    document.querySelectorAll('[data-target]').forEach(elem => {
      elem.addEventListener('click', () => {
        const target = elem.dataset.target;
        if (target === 'view-add-product') {
          resetProductForm();
        }
        switchView(target);
      });
    });

    // Back to inventory
    document.getElementById('btn-back-to-inventory').addEventListener('click', () => {
      switchView('view-inventory');
    });

    // Live search input
    const searchInput = document.getElementById('inventory-search');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderInventory();
    });

    // Filters & Sorting
    document.getElementById('sort-select').addEventListener('change', (e) => {
      activeSort = e.target.value;
      renderInventory();
    });

    document.getElementById('filter-stock').addEventListener('change', (e) => {
      activeFilterStock = e.target.value;
      renderInventory();
    });

    document.getElementById('filter-storage').addEventListener('change', (e) => {
      activeFilterStorage = e.target.value;
      renderInventory();
    });

    document.getElementById('filter-condition').addEventListener('change', (e) => {
      activeFilterCondition = e.target.value;
      renderInventory();
    });

    // Product Detail Page Counter
    document.getElementById('btn-detail-increment').addEventListener('click', () => {
      if (viewingProductId) changeProductQuantity(viewingProductId, 1);
    });

    document.getElementById('btn-detail-decrement').addEventListener('click', () => {
      if (viewingProductId) changeProductQuantity(viewingProductId, -1);
    });

    // Set Exact Quantity Modal
    document.getElementById('btn-open-set-quantity').addEventListener('click', () => {
      if (!viewingProductId) return;
      const current = products.find(p => p.id === viewingProductId);
      if (!current) return;

      const container = document.createElement('div');
      container.innerHTML = `
        <p style="margin-bottom:12px;">Current quantity: <strong>${current.quantity}</strong></p>
        <div class="form-field">
          <label for="modal-input-qty">New Quantity</label>
          <input type="number" id="modal-input-qty" min="0" value="${current.quantity}" style="font-size:1.3rem; padding:12px;" autofocus>
        </div>
      `;

      openModal('Set Quantity', container, [
        { label: 'Cancel', className: 'btn-secondary' },
        {
          label: 'Save',
          className: 'btn-primary',
          onClick: () => {
            const inputVal = container.querySelector('#modal-input-qty').value;
            const newQty = parseInt(inputVal, 10);
            if (!isNaN(newQty) && newQty >= 0) {
              changeProductQuantity(viewingProductId, newQty, true);
              showToast('Quantity updated', 'success');
            }
          }
        }
      ]);
    });

    // Add / Edit Product Form Submission
    const form = document.getElementById('product-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const editId = document.getElementById('form-product-id').value;
      const brand = document.getElementById('prod-brand').value.trim();
      const model = document.getElementById('prod-model').value.trim();
      const category = document.getElementById('prod-category').value;
      const storage = document.getElementById('prod-storage').value.trim();
      const color = document.getElementById('prod-color').value.trim();
      const sku = document.getElementById('prod-sku').value.trim();
      const imei = document.getElementById('prod-imei').value.trim();
      const location = document.getElementById('prod-location').value.trim();
      const condition = document.getElementById('prod-condition').value;
      const quantity = parseInt(document.getElementById('prod-quantity').value, 10) || 0;
      const notes = document.getElementById('prod-notes').value.trim();

      // Duplicate SKU Check (excluding current device in edit mode)
      if (sku) {
        const skuConflict = products.some(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editId);
        if (skuConflict) {
          showToast(`SKU '${sku}' already exists on another item.`, 'error');
          return;
        }
      }

      if (editId) {
        // Edit Mode (leaves quantity untouched as requested)
        const item = products.find(p => p.id === editId);
        if (item) {
          item.brand = brand;
          item.model = model;
          item.category = category;
          item.storage = storage;
          item.color = color;
          item.sku = sku;
          item.imei = imei;
          item.location = location;
          item.condition = condition;
          item.notes = notes;
          item.image = formUploadedImageData;
          item.updatedAt = new Date().toISOString();

          saveProducts();
          showToast('Product updated', 'success');
          openProductDetails(item.id);
        }
      } else {
        // Create New Product
        const newProduct = {
          id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          brand,
          model,
          category: category || brand,
          storage,
          color,
          sku,
          imei,
          image: formUploadedImageData,
          location,
          condition,
          quantity,
          notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        products.unshift(newProduct);
        saveProducts();
        showToast('Product added successfully', 'success');
        openProductDetails(newProduct.id);
      }

      // Automatically register new category/brand if absent
      if (brand && !categories.map(c => c.toLowerCase()).includes(brand.toLowerCase())) {
        categories.push(brand);
        saveCategories();
      }

      renderAll();
    });

    document.getElementById('btn-cancel-form').addEventListener('click', () => {
      if (viewingProductId) openProductDetails(viewingProductId);
      else switchView('view-inventory');
    });

    // Image Input Change & Remove
    document.getElementById('product-image-input').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageUpload(e.target.files[0]);
      }
    });

    document.getElementById('btn-remove-image').addEventListener('click', () => {
      updateFormImagePreview('');
    });

    // Detail actions: Edit & Delete
    document.getElementById('btn-edit-details').addEventListener('click', () => {
      if (!viewingProductId) return;
      const p = products.find(prod => prod.id === viewingProductId);
      if (!p) return;

      document.getElementById('form-product-title').textContent = 'Edit Product';
      document.getElementById('form-product-id').value = p.id;
      document.getElementById('prod-brand').value = p.brand;
      document.getElementById('prod-model').value = p.model;
      document.getElementById('prod-category').value = p.category;
      document.getElementById('prod-storage').value = p.storage;
      document.getElementById('prod-color').value = p.color;
      document.getElementById('prod-sku').value = p.sku;
      document.getElementById('prod-imei').value = p.imei;
      document.getElementById('prod-location').value = p.location;
      document.getElementById('prod-condition').value = p.condition;
      document.getElementById('prod-notes').value = p.notes;

      // Quantity cannot be modified through the standard edit form
      document.getElementById('form-quantity-wrapper').classList.add('hidden');

      formUploadedImageData = p.image || '';
      updateFormImagePreview(formUploadedImageData);

      switchView('view-add-product');
    });

    document.getElementById('btn-delete-details').addEventListener('click', () => {
      if (!viewingProductId) return;
      const current = products.find(p => p.id === viewingProductId);
      if (!current) return;

      openModal(
        'Delete this product?',
        `<p>Are you sure you want to delete <strong>${escapeHtml(current.brand)} ${escapeHtml(current.model)}</strong>?</p><p style="margin-top:6px; color:var(--danger)">This action cannot be undone.</p>`,
        [
          { label: 'Cancel', className: 'btn-secondary' },
          {
            label: 'Delete',
            className: 'btn-danger',
            onClick: () => {
              products = products.filter(p => p.id !== viewingProductId);
              historyLogs = historyLogs.filter(h => h.productId !== viewingProductId);
              saveProducts();
              saveHistory();
              showToast('Product deleted', 'success');
              viewingProductId = null;
              renderAll();
              switchView('view-inventory');
            }
          }
        ]
      );
    });

    // Categories View: Add category modal
    document.getElementById('btn-open-category-modal').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Category or Brand Name';
      input.className = 'num-input';
      input.style.width = '100%';
      input.style.marginTop = '8px';

      const wrap = document.createElement('div');
      wrap.innerHTML = '<label>New category name:</label>';
      wrap.appendChild(input);

      openModal('Add Category', wrap, [
        { label: 'Cancel', className: 'btn-secondary' },
        {
          label: 'Add',
          className: 'btn-primary',
          onClick: () => {
            const val = input.value.trim();
            if (val && !categories.some(c => c.toLowerCase() === val.toLowerCase())) {
              categories.push(val);
              saveCategories();
              renderCategoryPills();
              renderCategoryDropdowns();
              renderCategoriesView();
              showToast(`Category "${val}" created`, 'success');
            }
          }
        }
      ]);
    });

    // Settings: Theme Buttons
    document.querySelectorAll('.theme-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.themeVal);
      });
    });

    // Settings: Low stock threshold
    const lowStockInput = document.getElementById('setting-low-stock');
    lowStockInput.value = settings.lowStockThreshold;
    document.getElementById('btn-save-threshold').addEventListener('click', () => {
      const val = parseInt(lowStockInput.value, 10);
      if (!isNaN(val) && val >= 0) {
        settings.lowStockThreshold = val;
        saveSettings();
        renderStats();
        renderInventory();
        showToast('Threshold updated', 'success');
      }
    });

    // Settings: Export JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const payload = {
        app: 'PhoneCount',
        version: 1,
        exportedAt: new Date().toISOString(),
        products,
        categories,
        settings,
        history: historyLogs
      };
      downloadFile(JSON.stringify(payload, null, 2), 'phonecount-backup.json', 'application/json');
      showToast('Inventory exported', 'success');
    });

    // Settings: Export CSV
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      const headers = ['Brand', 'Model', 'Storage', 'Color', 'SKU', 'IMEI', 'Location', 'Condition', 'Quantity', 'Notes'];
      const rows = products.map(p => [
        csvClean(p.brand),
        csvClean(p.model),
        csvClean(p.storage),
        csvClean(p.color),
        csvClean(p.sku),
        csvClean(p.imei),
        csvClean(p.location),
        csvClean(p.condition),
        p.quantity,
        csvClean(p.notes)
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      downloadFile(csvContent, `phonecount-inventory-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
      showToast('Inventory exported to CSV', 'success');
    });

    // Settings: Import JSON
    const importInput = document.getElementById('import-json-file');
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed.products || !Array.isArray(parsed.products)) {
            throw new Error('Invalid PhoneCount format: products missing.');
          }

          openModal(
            'Import Backup Data?',
            `<p>This will overwrite your existing <strong>${products.length}</strong> items with <strong>${parsed.products.length}</strong> items from the file.</p><p style="margin-top:6px; color:var(--warning);">Confirm replacement?</p>`,
            [
              { label: 'Cancel', className: 'btn-secondary' },
              {
                label: 'Replace & Import',
                className: 'btn-primary',
                onClick: () => {
                  products = parsed.products;
                  if (Array.isArray(parsed.categories)) categories = parsed.categories;
                  if (Array.isArray(parsed.history)) historyLogs = parsed.history;
                  if (parsed.settings) settings = { ...DEFAULT_SETTINGS, ...parsed.settings };

                  saveProducts();
                  saveCategories();
                  saveHistory();
                  saveSettings();
                  applyTheme(settings.theme);
                  renderAll();
                  showToast('Backup imported successfully', 'success');
                }
              }
            ]
          );
        } catch (err) {
          showToast('Invalid backup file', 'error');
        } finally {
          importInput.value = '';
        }
      };
      reader.readAsText(file);
    });

    // Settings: Clear All Data
    document.getElementById('btn-clear-all-data').addEventListener('click', () => {
      openModal(
        'Clear All Data?',
        '<p>Are you completely sure? This will wipe all inventory, category presets, and change logs from this device.</p><p style="color:var(--danger); margin-top:6px;">This action cannot be recovered.</p>',
        [
          { label: 'Cancel', className: 'btn-secondary' },
          {
            label: 'Clear All Data',
            className: 'btn-danger',
            onClick: () => {
              localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
              localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
              localStorage.removeItem(STORAGE_KEYS.HISTORY);
              localStorage.removeItem(STORAGE_KEYS.SETTINGS);
              products = [];
              categories = [...DEFAULT_CATEGORIES];
              historyLogs = [];
              settings = { ...DEFAULT_SETTINGS };
              saveProducts();
              saveCategories();
              saveHistory();
              saveSettings();
              renderAll();
              showToast('All data cleared', 'info');
              switchView('view-inventory');
            }
          }
        ]
      );
    });

    // Modal backdrop click dismissal
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  }

  function resetProductForm() {
    document.getElementById('form-product-title').textContent = 'Add Product';
    document.getElementById('form-product-id').value = '';
    document.getElementById('product-form').reset();
    document.getElementById('form-quantity-wrapper').classList.remove('hidden');
    document.getElementById('prod-quantity').value = '1';
    updateFormImagePreview('');
  }

  // --- Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function csvClean(val) {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function formatRelativeTime(date) {
    const diffSec = Math.floor((new Date() - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  }

  // Launch app on load
  document.addEventListener('DOMContentLoaded', init);
})();