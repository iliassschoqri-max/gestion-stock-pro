const { startServer, stopServer, api } = require('./helper');

let passed = 0, failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) { passed++; console.log('  OK   ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL ' + name); }
}

async function run() {
  const server = await startServer();
  console.log('\n=== Tests API (server.js + SQLite) ===\n');

  await api('/api/reset', { method: 'POST' });

  /* --- Démarrage --- */
  let res = await api('/api/products');
  check('démarrage : 7 produits de démo', res.status === 200 && res.data.length === 7);
  const products = res.data;

  res = await api('/api/movements');
  check('démarrage : 4 mouvements de démo', res.status === 200 && res.data.length === 4);

  res = await api('/api/stats/dashboard');
  const s = res.data;
  check('stats : champs présents', s && 'totalRef' in s && 'totalUnits' in s && 'totalValue' in s);
  check('stats : cohérence initiale', s.totalRef === 7 && s.totalUnits === 231 && s.outOfStock === 1);

  /* --- Règles métier --- */
  res = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ ref: 'TST-001', name: 'Produit test', category: 'Test', price: 10, qty: 4, min: 2, desc: '' })
  });
  check('addProduct : création OK + id', res.status === 201 && res.data.id);
  const newId = res.data.id;

  res = await api('/api/movements');
  const initMov = res.data.find(m => m.productId === newId);
  check('addProduct : mouvement "Stock initial" créé', !!initMov && initMov.type === 'in' && initMov.qty === 4);

  res = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ ref: 'TST-001', name: 'Doublon', price: 1, qty: 1, min: 1 })
  });
  check('addProduct : référence dupliquée refusée', res.status === 400);

  res = await api(`/api/products/${newId}`, {
    method: 'PUT',
    body: JSON.stringify({ ref: 'TST-001', name: 'Modifié', category: 'Test', price: 12, qty: 4, min: 2, desc: 'x' })
  });
  check('updateProduct : mise à jour appliquée', res.status === 200 && res.data.name === 'Modifié' && res.data.price === 12);

  res = await api('/api/products');
  const others = res.data.filter(p => p.id !== newId && p.ref === 'PRD-001');
  check('updateProduct : les autres produits intacts', others.length === 1 && others[0].name === 'Clavier mécanique');

  /* --- Mouvements : règles de stock --- */
  res = await api('/api/movements', {
    method: 'POST',
    body: JSON.stringify({ productId: newId, type: 'in', qty: 6, reason: 'Réception', author: 'Test' })
  });
  res = await api('/api/products');
  let p = res.data.find(x => x.id === newId);
  check('addMovement : entrée augmente le stock', res.status === 200 && p.qty === 10);

  res = await api('/api/movements', {
    method: 'POST',
    body: JSON.stringify({ productId: newId, type: 'out', qty: 3, reason: 'Vente', author: 'Test' })
  });
  res = await api('/api/products');
  p = res.data.find(x => x.id === newId);
  check('addMovement : sortie possible', p.qty === 7);

  const outRes = await api('/api/movements', {
    method: 'POST',
    body: JSON.stringify({ productId: newId, type: 'out', qty: 9999, reason: 'Trop', author: 'Test' })
  });
  res = await api('/api/products');
  p = res.data.find(x => x.id === newId);
  check('addMovement : sortie trop grande refusée (400)', outRes.status === 400 && p.qty === 7);

  res = await api('/api/movements', {
    method: 'POST',
    body: JSON.stringify({ productId: 'inexistant', type: 'in', qty: 1 })
  });
  check('addMovement : produit inexistant refusé (404)', res.status === 404);

  res = await api('/api/movements', {
    method: 'POST',
    body: JSON.stringify({ productId: newId, type: 'out', qty: 0 })
  });
  check('addMovement : quantité 0 refusée', res.status === 400);

  /* --- Mouvements enrichis (JOIN) --- */
  res = await api('/api/movements');
  check('getMovements : triés du plus récent au plus ancien',
    new Date(res.data[0].date) >= new Date(res.data[res.data.length - 1].date));
  check('getMovements : nom du produit joint', res.data.every(m => 'productName' in m));

  /* --- Authentification --- */
  res = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin' }) });
  check('login : admin/admin accepté', res.status === 200 && res.data.success && res.data.user.role === 'admin');

  res = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  check('login : mauvais mot de passe refusé (401)', res.status === 401);

  /* --- Reset --- */
  res = await api('/api/reset', { method: 'POST' });
  res = await api('/api/products');
  check('reset : restaure 7 produits', res.status === 200 && res.data.length === 7);

  res = await api('/api/movements');
  check('reset : restaure 4 mouvements', res.data.length === 4);

  /* --- Persistance (deux lectures identiques) --- */
  const a = await api('/api/products');
  const b = await api('/api/products');
  check('persistance : deux lectures identiques', JSON.stringify(a.data) === JSON.stringify(b.data));

  console.log('\n' + passed + '/' + (passed + failed) + ' tests API OK');
  stopServer(server);
  if (failed) {
    console.error('\nÉchecs :\n' + failures.join('\n'));
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
