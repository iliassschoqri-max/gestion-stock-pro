const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { startServer, stopServer, BASE } = require('./helper');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const storeSrc = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

let passed = 0, failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) { passed++; console.log('  OK   ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL ' + name); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(50);
  }
  return false;
}

async function run() {
  const server = await startServer();
  console.log('\n=== Tests interface (js/app.js + index.html) ===\n');

  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: BASE + '/',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push(e.message));
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/')) url = BASE + url;
    if (init.body instanceof window.FormData) {
      const fd = new FormData();
      for (const [k, v] of init.body.entries()) {
        if (typeof v === 'string') fd.append(k, v);
        else fd.append(k, new Blob([await v.arrayBuffer()], { type: v.type }), v.name);
      }
      init = { ...init, body: fd };
    }
    return fetch(url, init);
  };

  window.eval(storeSrc + '\n' + appSrc + '\nwindow.__Store = Store;');

  const doc = window.document;
  const $ = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const submit = el => el.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const change = el => el.dispatchEvent(new window.Event('change', { bubbles: true }));
  const input = el => el.dispatchEvent(new window.Event('input', { bubbles: true }));
  const Store = () => window.__Store;

  /* --- Chargement / login --- */
  check('chargement sans erreur JS', errors.length === 0);
  check('écran de connexion affiché', $('#login-screen').hidden === false);
  check('application masquée avant login', $('#app').hidden === true);

  $('#login-user').value = 'admin';
  $('#login-pass').value = 'wrong';
  submit($('#form-login'));
  await waitFor(() => !!doc.querySelector('.toast.error'));
  check('mauvais mot de passe : refusé', $('#app').hidden === true && !!doc.querySelector('.toast.error'));

  $('#login-user').value = 'admin';
  $('#login-pass').value = 'admin';
  submit($('#form-login'));
  check('login admin/admin : app affichée', await waitFor(() => $('#app').hidden === false));
  check('nom d\'utilisateur affiché', $('#user-name').textContent === 'admin');

  /* --- Rendu initial --- */
  check('4 cartes de stats rendues', await waitFor(() => $$('.stat').length === 4));
  check('7 lignes produits rendues', await waitFor(() => $$('#products-body tr').length === 7));
  check('4 lignes mouvements rendues', await waitFor(() => $$('#movements-body tr').length === 4));
  check('compteur nav produits = 7', $('#count-products').textContent === '7');
  check('compteur nav alertes > 0', /[1-9]/.test($('#count-dashboard').textContent));

  /* --- Bouton : nouveau produit --- */
  click($('#btn-add-product'));
  check('bouton "+ Nouveau produit" ouvre la modale', await waitFor(() => $('#modal-product').hidden === false));
  check('titre de modale "Nouveau produit"', $('#product-modal-title').textContent === 'Nouveau produit');
  check('champ image présent dans le formulaire', !!$('#p-image') && !!$('#p-preview'));
  click($('#modal-product [data-close]'));
  check('bouton Annuler ferme la modale', await waitFor(() => $('#modal-product').hidden === true));

  /* --- Création produit --- */
  click($('#btn-add-product'));
  await waitFor(() => $('#modal-product').hidden === false);
  $('#p-ref').value = 'TST-001';
  $('#p-name').value = 'Produit test';
  $('#p-price').value = '10';
  $('#p-qty').value = '4';
  $('#p-min').value = '2';
  submit($('#form-product'));
  check('créer un produit : visible dans la table', await waitFor(() =>
    $$('#products-body tr').some(tr => tr.textContent.includes('TST-001'))));
  check('compteur passe à 8', $('#count-products').textContent === '8');
  check('modale fermée après enregistrement', $('#modal-product').hidden === true);

  /* --- Doublon de référence --- */
  click($('#btn-add-product'));
  await waitFor(() => $('#modal-product').hidden === false);
  $('#p-ref').value = 'TST-001';
  $('#p-name').value = 'Doublon';
  $('#p-price').value = '1';
  $('#p-qty').value = '1';
  submit($('#form-product'));
  check('doublon de référence : refusé, modale reste ouverte', await waitFor(() =>
    $('#modal-product').hidden === false && $('#count-products').textContent === '8'));
  click($('#modal-product [data-close]'));
  await waitFor(() => $('#modal-product').hidden === true);

  const rowWith = text => $$('#products-body tr').find(tr => tr.textContent.includes(text));

  /* --- Modification --- */
  click(rowWith('TST-001').querySelector('[data-edit]'));
  check('bouton Modifier : modale pré-remplie', await waitFor(() =>
    $('#modal-product').hidden === false && $('#p-ref').value === 'TST-001' && $('#p-name').value === 'Produit test'));
  click($('#modal-product [data-close]'));
  await waitFor(() => $('#modal-product').hidden === true);

  /* --- Suppression avec confirmation --- */
  click(rowWith('TST-001').querySelector('[data-del]'));
  check('bouton Suppr : demande confirmation', await waitFor(() => $('#modal-confirm').hidden === false));
  check('titre de confirmation correct', $('#confirm-title').textContent === 'Supprimer le produit');
  click($('#modal-confirm [data-close]'));
  await waitFor(() => $('#modal-confirm').hidden === true);
  check('bouton Annuler : rien supprimé', !!rowWith('TST-001'));

  click(rowWith('TST-001').querySelector('[data-del]'));
  await waitFor(() => $('#modal-confirm').hidden === false);
  click($('#confirm-ok'));
  check('confirmer la suppression : produit retiré', await waitFor(() => !rowWith('TST-001')));
  check('compteur redescend à 7', await waitFor(() => $('#count-products').textContent === '7'));

  /* --- Export CSV --- */
  const calls = [];
  window.URL.createObjectURL = () => 'blob:x';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { calls.push(this.download); };
  click($('#btn-export'));
  check('bouton "Exporter" télécharge un CSV', await waitFor(() => calls[0] === 'produits-stock.csv'));

  /* --- Mouvements --- */
  click(doc.querySelector('[data-view="movements"]'));
  await waitFor(() => $('#view-movements').classList.contains('active'));
  click($('#btn-add-movement'));
  check('bouton "+ Nouveau mouvement" ouvre la modale', await waitFor(() => $('#modal-movement').hidden === false));
  check('liste produits remplie dans le select', await waitFor(() => $('#m-product').options.length === 7));
  click($('#modal-movement [data-close]'));
  await waitFor(() => $('#modal-movement').hidden === true);

  const prod = (await apiJson('/api/products')).find(p => p.qty > 0);
  const avant = prod.qty;
  click($('#btn-add-movement'));
  await waitFor(() => $('#modal-movement').hidden === false);
  $('#m-product').value = prod.id;
  $('#m-type').value = 'in';
  $('#m-qty').value = '5';
  submit($('#form-movement'));
  check('entrée de stock : quantité augmentée', await waitFor(async () =>
    (await apiJson('/api/products')).find(p => p.id === prod.id).qty === avant + 5));

  click($('#btn-add-movement'));
  await waitFor(() => $('#modal-movement').hidden === false);
  $('#m-product').value = prod.id;
  $('#m-type').value = 'out';
  $('#m-qty').value = String(avant + 1000);
  submit($('#form-movement'));
  check('sortie > stock : refusée + modale ouverte', await waitFor(() =>
    $('#modal-movement').hidden === false));
  click($('#modal-movement [data-close]'));
  await waitFor(() => $('#modal-movement').hidden === true);

  /* --- Recherche et filtres --- */
  click(doc.querySelector('[data-view="products"]'));
  await waitFor(() => $('#view-products').classList.contains('active'));
  $('#search').value = 'clavier';
  input($('#search'));
  check('recherche filtre les produits', await waitFor(() => $$('#products-body tr').length === 1));
  $('#search').value = '';
  input($('#search'));
  await waitFor(() => $$('#products-body tr').length === 7);

  $('#filter-category').value = 'Fournitures';
  change($('#filter-category'));
  check('filtre catégorie', await waitFor(() => $$('#products-body tr').length === 2));
  $('#filter-category').value = '';
  change($('#filter-category'));
  await waitFor(() => $$('#products-body tr').length === 7);

  $('#filter-status').value = 'out';
  change($('#filter-status'));
  check('filtre état = rupture (au moins 1)', await waitFor(() => $$('#products-body tr').length >= 1));
  $('#filter-status').value = '';
  change($('#filter-status'));
  await waitFor(() => $$('#products-body tr').length === 7);

  click(doc.querySelector('[data-view="movements"]'));
  await waitFor(() => $('#view-movements').classList.contains('active'));
  $('#filter-type').value = 'in';
  change($('#filter-type'));
  check('filtre mouvements : entrées seulement', await waitFor(() => {
    const rows = $$('#movements-body tr');
    return rows.length > 0 && rows.every(tr => tr.textContent.includes('Entrée'));
  }));
  $('#filter-type').value = '';
  change($('#filter-type'));
  await sleep(200);

  /* --- Navigation --- */
  for (const v of ['dashboard', 'products', 'movements', 'help']) {
    click(doc.querySelector(`[data-view="${v}"]`));
    const ok = await waitFor(() => doc.getElementById('view-' + v).classList.contains('active'));
    check('navigation vers la vue "' + v + '"', ok);
  }
  check('titre de page mis à jour', $('#page-title').textContent === 'Aide du projet');

  click(doc.querySelector('[data-view="dashboard"]'));
  await waitFor(() => $('#view-dashboard').classList.contains('active'));
  click(doc.querySelector('[data-go]'));
  check('bouton "Tout voir" mène aux mouvements', await waitFor(() => $('#view-movements').classList.contains('active')));

  /* --- Réinitialisation --- */
  click($('#btn-reset'));
  await waitFor(() => $('#modal-confirm').hidden === false);
  click($('#confirm-ok'));
  check('bouton Réinitialiser : restaure 7 produits', await waitFor(() => $('#count-products').textContent === '7'));

  /* --- Échap --- */
  click($('#btn-add-product'));
  await waitFor(() => $('#modal-product').hidden === false);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Échap ferme la modale ouverte', await waitFor(() => $('#modal-product').hidden === true));

  /* --- Déconnexion --- */
  click($('#btn-logout'));
  check('déconnexion : retour à l\'écran login', await waitFor(() => $('#app').hidden === true));

  /* --- Robustesse : réponses serveur désynchronisées --- */
  // Un rendu lent (lancé par le changement de vue) ne doit pas écraser un rendu
  // plus récent : sinon le filtre "entrées seulement" semble ne pas fonctionner.
  await checkLateRender();

  console.log('\n' + passed + '/' + (passed + failed) + ' tests interface OK');
  stopServer(server);
  if (failed) {
    console.error('\nÉchecs :\n' + failures.join('\n'));
    process.exit(1);
  }
}

/* Simule une réponse serveur tardive : le rendu déclenché par le changement de
   vue arrive après le rendu déclenché par le filtre. */
async function checkLateRender() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: BASE + '/', pretendToBeVisual: true });
  const { window } = dom;
  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/')) url = BASE + url;
    return fetch(url, init);
  };
  const lateApp = appSrc.replace(
    'const movements = await Store.getMovements();',
    "const movements = await Store.getMovements(); if (window.__late) { window.__late = false; window.__lateUsed = true; await new Promise(r => setTimeout(r, 800)); }"
  );
  window.eval(storeSrc + '\n' + lateApp + '\nwindow.__Store = Store;');

  const doc = window.document;
  const $ = s => doc.querySelector(s);
  const $$ = s => [...doc.querySelectorAll(s)];
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const change = el => el.dispatchEvent(new window.Event('change', { bubbles: true }));

  $('#login-user').value = 'admin';
  $('#login-pass').value = 'admin';
  $('#form-login').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => $('#app').hidden === false);
  await waitFor(() => $$('#movements-body tr').length > 0);

  window.__late = true;
  click(doc.querySelector('[data-view="movements"]'));
  await sleep(50);
  $('#filter-type').value = 'in';
  change($('#filter-type'));
  await sleep(1200);

  check('rendu lent : le filtre reste appliqué', !!window.__lateUsed && await waitFor(() => {
    const rows = $$('#movements-body tr');
    return rows.length > 0 && rows.every(tr => tr.textContent.includes('Entrée'));
  }));
  window.close();
}

async function apiJson(p) {
  const res = await fetch(BASE + p);
  return res.json();
}

run().catch(e => { console.error(e); process.exit(1); });
