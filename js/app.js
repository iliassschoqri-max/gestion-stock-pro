(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const titles = {
    dashboard: 'Tableau de bord',
    products: 'Produits',
    movements: 'Mouvements',
    help: 'Aide du projet'
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const dateFr = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  const statusBadge = p => {
    const s = Store.status(p);
    if (s === 'out') return '<span class="badge badge-danger">Rupture</span>';
    if (s === 'low') return '<span class="badge badge-warning">Stock bas</span>';
    return '<span class="badge badge-success">Disponible</span>';
  };

  /* ---------- Toasts / confirmation ---------- */
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2800);
    setTimeout(() => el.remove(), 3200);
  }

  let confirmAction = null;
  function confirmBox(title, message, action) {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    confirmAction = action;
    openModal('modal-confirm');
  }

  /* ---------- Modals ---------- */
  function openModal(id) { $('#' + id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModals() {
    $$('.modal-backdrop').forEach(m => m.hidden = true);
    document.body.style.overflow = '';
    confirmAction = null;
  }

  document.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeModals();
    if (e.target.classList.contains('modal-backdrop')) closeModals();
    const go = e.target.closest('[data-go]');
    if (go) switchView(go.dataset.go);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

  $('#confirm-ok').addEventListener('click', async () => {
    const fn = confirmAction;
    closeModals();
    if (fn) await fn();
  });

  /* ---------- Rendu global ---------- */
  async function renderAll() {
    await Promise.all([
      renderDashboard().catch(() => {}),
      renderProducts().catch(() => {}),
      renderMovements().catch(() => {}),
      updateNavCounts().catch(() => {})
    ]);
  }

  async function updateNavCounts() {
    const [p, m] = await Promise.all([Store.getProducts(), Store.getMovements()]);
    const alerts = p.filter(x => Store.status(x) !== 'ok').length;
    $('#count-products').textContent = p.length;
    $('#count-movements').textContent = m.length;
    $('#count-dashboard').textContent = alerts || '';
    $('#count-dashboard').className = alerts ? 'nav-count nav-count-danger' : 'nav-count';
  }

  /* ---------- Navigation ---------- */
  async function switchView(view) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $('#page-title').textContent = titles[view];
    $('#sidebar').classList.remove('open');
    await renderAll();
  }

  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  /* ---------- Dashboard ---------- */
  function animateStats() {
    $$('#stats .stat-value').forEach(el => {
      const target = Number(el.dataset.num || 0);
      const asMoney = el.dataset.money === '1';
      const start = performance.now();
      const step = now => {
        const t = Math.min((now - start) / 650, 1);
        const val = target * (1 - Math.pow(1 - t, 3));
        el.textContent = asMoney ? money(val) : Math.round(val);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  async function renderDashboard() {
    const [s, products, movements, cats] = await Promise.all([
      Store.stats(),
      Store.getProducts(),
      Store.getMovements(),
      Store.byCategory()
    ]);

    const cards = [
      { label: 'Références', value: s.totalRef || 0, icon: '▣', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
      { label: 'Unités en stock', value: s.totalUnits || 0, icon: 'Σ', bg: 'var(--success-soft)', fg: 'var(--success)' },
      { label: 'Valeur du stock', value: s.totalValue || 0, money: true, icon: '€', bg: 'var(--warning-soft)', fg: 'var(--warning)' },
      { label: 'Alertes', value: (s.lowStock || 0) + (s.outOfStock || 0), icon: '!', bg: 'var(--danger-soft)', fg: 'var(--danger)' }
    ];
    $('#stats').innerHTML = cards.map(c => `
      <div class="stat">
        <div class="stat-icon" style="background:${c.bg};color:${c.fg}">${c.icon}</div>
        <div>
          <div class="stat-value" data-num="${c.value}"${c.money ? ' data-money="1"' : ''}>${c.money ? money(0) : 0}</div>
          <div class="stat-label">${c.label}</div>
        </div>
      </div>`).join('');
    animateStats();

    const alerts = products.filter(p => Store.status(p) !== 'ok');
    $('#alerts-count').textContent = alerts.length;
    $('#alerts-list').innerHTML = alerts.length ? alerts.map(p => `
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">${esc(p.name)}</div>
          <div class="list-sub">${esc(p.ref)} · seuil ${p.min}</div>
        </div>
        <span class="qty ${p.qty === 0 ? 'qty-out' : ''}">${p.qty} u.</span>
        ${statusBadge(p)}
      </div>`).join('') : '<div class="empty">Aucune alerte, tout va bien.</div>';

    const recents = movements.slice(0, 5);
    $('#recent-movements').innerHTML = recents.length ? recents.map(m => {
      const p = products.find(x => x.id === m.productId);
      return `
      <div class="list-item">
        <div class="list-main">
          <div class="list-title">${esc(p ? p.name : (m.productName || 'Produit supprimé'))}</div>
          <div class="list-sub">${dateFr(m.date)} · ${esc(m.reason || '—')}</div>
        </div>
        <span class="qty ${m.type === 'in' ? 'qty-in' : 'qty-out'}">${m.type === 'in' ? '+' : '−'}${m.qty}</span>
      </div>`;
    }).join('') : '<div class="empty">Aucun mouvement.</div>';

    const max = Math.max(...cats.map(c => c[1]), 1);
    $('#category-chart').innerHTML = cats.length ? cats.map(([name, val]) => `
      <div class="bar-row">
        <div class="bar-label">${esc(name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(val / max * 100).toFixed(1)}%"></div></div>
        <div class="bar-value">${money(val)}</div>
      </div>`).join('') : '<div class="empty">Aucune donnée.</div>';
  }

  /* ---------- Products ---------- */
  async function filteredProducts() {
    const all = await Store.getProducts();
    // Filtres lus APRÈS l'await (idem mouvements) : évite qu'un rendu lent
    // n'écrase la table avec les valeurs de filtre d'avant
    const q = $('#search').value.trim().toLowerCase();
    const cat = $('#filter-category').value;
    const st = $('#filter-status').value;
    return all.filter(p =>
      (!q || [p.name, p.ref, p.category, p.desc].join(' ').toLowerCase().includes(q)) &&
      (!cat || p.category === cat) &&
      (!st || Store.status(p) === st)
    );
  }

  async function refreshCategoryFilters() {
    const cats = await Store.categories();
    const sel = $('#filter-category');
    const current = sel.value;
    sel.innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
    if (cats.includes(current)) sel.value = current;
    $('#categories').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  }

  let productsRender = 0;
  async function renderProducts() {
    const render = ++productsRender;
    await refreshCategoryFilters();
    const list = await filteredProducts();
    if (render !== productsRender) return; // un rendu plus récent va écrire
    $('#products-count').textContent = `${list.length} produit(s)`;
    $('#products-empty').hidden = list.length > 0;
    $('#products-body').innerHTML = list.map(p => `
      <tr>
        <td>${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="">` : '<span class="thumb thumb-empty">–</span>'}</td>
        <td class="ref">${esc(p.ref)}</td>
        <td>
          <div class="prod-name">${esc(p.name)}</div>
          <div class="prod-desc">${esc(p.desc || '')}</div>
        </td>
        <td>${esc(p.category || '—')}</td>
        <td class="num">${money(p.price)}</td>
        <td class="num qty">${p.qty}</td>
        <td>${statusBadge(p)}</td>
        <td class="actions-col">
          <span class="row-actions">
            <button class="btn btn-sm" data-edit="${p.id}">Modifier</button>
            <button class="btn btn-sm btn-danger" data-del="${p.id}">Suppr.</button>
          </span>
        </td>
      </tr>`).join('');
  }

  $('#products-body').addEventListener('click', async e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (edit) await openProductForm(edit.dataset.edit);
    if (del) {
      const p = await Store.getById(del.dataset.del);
      confirmBox('Supprimer le produit', `Supprimer « ${p.name} » et tout son historique ?`, async () => {
        await Store.deleteProduct(p.id);
        await renderAll();
        toast('Produit supprimé');
      });
    }
  });

  async function openProductForm(id) {
    const p = id ? await Store.getById(id) : null;
    $('#product-modal-title').textContent = p ? 'Modifier le produit' : 'Nouveau produit';
    $('#p-id').value = p ? p.id : '';
    $('#p-ref').value = p ? p.ref : '';
    $('#p-name').value = p ? p.name : '';
    $('#p-category').value = p ? p.category : '';
    $('#p-price').value = p ? p.price : '';
    $('#p-qty').value = p ? p.qty : '';
    $('#p-min').value = p ? p.min : 5;
    $('#p-desc').value = p ? (p.desc || '') : '';
    $('#p-image').value = '';
    $('#p-preview').innerHTML = p && p.image_url
      ? `<img src="${esc(p.image_url)}" alt="">`
      : 'Aucune image';
    openModal('modal-product');
    $('#p-ref').focus();
  }

  $('#p-image').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { $('#p-preview').innerHTML = `<img src="${ev.target.result}" alt="">`; };
    reader.readAsDataURL(file);
  });

  $('#btn-add-product').addEventListener('click', () => openProductForm());

  $('#form-product').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#p-id').value;
    const data = {
      ref: $('#p-ref').value.trim(),
      name: $('#p-name').value.trim(),
      category: $('#p-category').value.trim() || 'Divers',
      price: Number($('#p-price').value),
      qty: Number($('#p-qty').value),
      min: Number($('#p-min').value) || 0,
      desc: $('#p-desc').value.trim()
    };

    const all = await Store.getProducts();
    const dup = all.find(p => p.ref.toLowerCase() === data.ref.toLowerCase() && p.id !== id);
    if (dup) return toast('Cette référence existe déjà', 'error');

    try {
      if (id) {
        const before = (await Store.getById(id)).qty;
        await Store.updateProduct(id, data);
        if (data.qty !== before) {
          await Store.addMovement({
            productId: id,
            type: data.qty > before ? 'in' : 'out',
            qty: Math.abs(data.qty - before),
            reason: 'Ajustement manuel',
            author: Store.getSession()?.username || 'Édition'
          });
        }
        toast('Produit mis à jour');
      } else {
        await Store.addProduct(data, $('#p-image').files[0]);
        toast('Produit créé');
      }
      closeModals();
      await renderAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  /* ---------- Movements ---------- */
  let movementsRender = 0;
  async function renderMovements() {
    const render = ++movementsRender;
    const movements = await Store.getMovements();
    if (render !== movementsRender) return; // un rendu plus récent va écrire
    // Filtre et recherche lus APRÈS l'await : une réponse tardive ne peut plus
    // réécrire la table avec un filtre obsolète (course entre rendus)
    const type = $('#filter-type').value;
    const q = $('#search').value.trim().toLowerCase();

    const list = movements.filter(m => {
      const hay = [m.productName || '', m.productRef || '', m.reason, m.author].join(' ').toLowerCase();
      return (!type || m.type === type) && (!q || hay.includes(q));
    });
    $('#movements-count').textContent = `${list.length} mouvement(s)`;
    $('#movements-empty').hidden = list.length > 0;
    $('#movements-body').innerHTML = list.map(m => `
      <tr>
        <td>${dateFr(m.date)}</td>
        <td>
          <div class="prod-name">${esc(m.productName || 'Produit supprimé')}</div>
          <div class="ref">${esc(m.productRef || '')}</div>
        </td>
        <td>${m.type === 'in'
          ? '<span class="badge badge-success">Entrée</span>'
          : '<span class="badge badge-danger">Sortie</span>'}</td>
        <td class="num qty ${m.type === 'in' ? 'qty-in' : 'qty-out'}">${m.type === 'in' ? '+' : '−'}${m.qty}</td>
        <td>${esc(m.reason || '—')}</td>
        <td>${esc(m.author || '—')}</td>
      </tr>`).join('');
  }

  async function openMovementForm() {
    const opts = await Store.getProducts();
    if (!opts.length) return toast('Créez d\'abord un produit', 'error');
    $('#m-product').innerHTML = opts.map(p => `<option value="${p.id}">${esc(p.ref)} — ${esc(p.name)} (${p.qty} u.)</option>`).join('');
    $('#m-type').value = 'in';
    $('#m-qty').value = '';
    $('#m-reason').value = '';
    $('#m-author').value = Store.getSession()?.username || '';
    openModal('modal-movement');
    $('#m-qty').focus();
  }

  $('#btn-add-movement').addEventListener('click', openMovementForm);

  $('#form-movement').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await Store.addMovement({
        productId: $('#m-product').value,
        type: $('#m-type').value,
        qty: Number($('#m-qty').value),
        reason: $('#m-reason').value.trim(),
        author: $('#m-author').value.trim()
      });
      closeModals();
      await renderAll();
      toast('Mouvement enregistré');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  /* ---------- Filtres / recherche ---------- */
  $('#search').addEventListener('input', async () => {
    const active = $('.view.active').id;
    if (active === 'view-products') await renderProducts();
    if (active === 'view-movements') await renderMovements();
  });
  $('#filter-category').addEventListener('change', renderProducts);
  $('#filter-status').addEventListener('change', renderProducts);
  $('#filter-type').addEventListener('change', renderMovements);

  /* ---------- Export / reset / logout ---------- */
  $('#btn-export').addEventListener('click', async () => {
    const csv = await Store.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'produits-stock.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Export CSV téléchargé');
  });

  $('#btn-reset').addEventListener('click', () => {
    confirmBox('Réinitialiser', 'Effacer toutes les données et restaurer la démonstration ?', async () => {
      await Store.reset();
      await switchView('dashboard');
      toast('Données réinitialisées');
    });
  });

  $('#btn-logout').addEventListener('click', () => {
    Store.logout();
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    $('#form-login').reset();
    toast('À bientôt !');
  });

  /* ---------- Login ---------- */
  function showApp() {
    const u = Store.getSession();
    if (!u) return;
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    $('#user-name').textContent = u.username;
    $('#user-role').textContent = u.role;
    $('#user-avatar').textContent = u.username.charAt(0).toUpperCase();
    renderAll();
  }

  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await Store.login($('#login-user').value.trim(), $('#login-pass').value);
      showApp();
      toast('Bienvenue !');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  showApp();
})();
