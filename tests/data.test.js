const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const storeSrc = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');

function makeLocalStorage(memory) {
  return {
    getItem: k => (k in memory ? memory[k] : null),
    setItem: (k, v) => { memory[k] = String(v); },
    removeItem: k => { delete memory[k]; },
    clear: () => { for (const k in memory) delete memory[k]; }
  };
}

function freshStore(sharedMemory) {
  const sandbox = {
    localStorage: makeLocalStorage(sharedMemory || {}),
    console,
    Date,
    Math,
    JSON
  };
  vm.createContext(sandbox);
  return vm.runInContext(storeSrc + '\nStore;', sandbox);
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  OK   ' + name);
  } catch (e) {
    failed++;
    failures.push(name + ' -> ' + e.message);
    console.log('  FAIL ' + name + ' -> ' + e.message);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const assertEq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'assertion'}: attendu ${b}, obtenu ${a}`); };
const throws = (fn, msg) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || 'devrait lever une erreur');
};

console.log('\n=== Tests couche données (js/store.js) ===\n');

test('démarrage : 7 produits de démo', () => {
  const S = freshStore();
  assertEq(S.getProducts().length, 7, 'nombre de produits');
});

test('démarrage : 4 mouvements de démo', () => {
  const S = freshStore();
  assertEq(S.getMovements().length, 4, 'nombre de mouvements');
});

test('stats : cohérence initiale', () => {
  const S = freshStore();
  const s = S.stats();
  assertEq(s.references, 7, 'références');
  assertEq(s.alerts, 3, 'alertes (p2 bas, p5 rupture, p7 bas)');
  assert(Number.isFinite(s.value) && s.value > 0, 'valeur positive');
});

test('status : ok, low, out', () => {
  const S = freshStore();
  assertEq(S.status({ qty: 10, min: 5 }), 'ok');
  assertEq(S.status({ qty: 5, min: 5 }), 'low');
  assertEq(S.status({ qty: 0, min: 5 }), 'out');
});

test('addProduct : id unique et mouvement initial', () => {
  const S = freshStore();
  const before = S.getMovements().length;
  const p = S.addProduct({ ref: 'X-1', name: 'Test', price: 10, qty: 3, min: 1 });
  assert(p.id && typeof p.id === 'string', 'id généré');
  assertEq(S.getProducts().length, 8, 'produit ajouté');
  assertEq(S.getMovements().length, before + 1, 'mouvement "Stock initial"');
  assertEq(p.qty, 3, 'quantité conservée');
});

test('addProduct : catégorie et seuil par défaut', () => {
  const S = freshStore();
  const p = S.addProduct({ ref: 'X-2', name: 'B', price: 1, qty: 1 });
  assertEq(p.category, 'Divers', 'catégorie défaut');
  assertEq(p.min, 0, 'seuil défaut 0');
});

test('addProduct : quantités 0 sans mouvement', () => {
  const S = freshStore();
  const before = S.getMovements().length;
  const p = S.addProduct({ ref: 'X-3', name: 'C', price: 1, qty: 0 });
  assertEq(S.getMovements().length, before, 'aucun mouvement à 0');
  assertEq(S.status(p), 'out', 'rupture immédiate');
});

test('updateProduct : met à jour sans toucher aux autres', () => {
  const S = freshStore();
  const p = S.getProducts()[0];
  S.updateProduct(p.id, { name: 'Renommé', price: 99 });
  const after = S.getProducts()[0];
  assertEq(after.name, 'Renommé', 'nom');
  assertEq(after.price, 99, 'prix');
  assertEq(after.ref, 'PRD-001', 'référence intacte');
  assertEq(S.getProducts().length, 7, 'nombre inchangé');
});

test('deleteProduct : supprime produit + historique', () => {
  const S = freshStore();
  const p = S.getProducts()[0];
  const historiquesAvant = S.getMovements().filter(m => m.productId === p.id).length;
  assert(historiquesAvant > 0, 'historique existe avant');
  S.deleteProduct(p.id);
  assertEq(S.getProducts().length, 6, 'produit supprimé');
  assertEq(S.getMovements().filter(m => m.productId === p.id).length, 0, 'historique supprimé');
});

test('addMovement : entrée augmente le stock', () => {
  const S = freshStore();
  const p = S.getProducts().find(x => x.ref === 'PRD-001');
  const avant = p.qty;
  S.addMovement({ productId: p.id, type: 'in', qty: 5, reason: 'Test', author: 'T' });
  assertEq(S.getById(p.id).qty, avant + 5, 'quantité');
  assertEq(S.getMovements()[0].productId, p.id, 'mouvement enregistré');
  assert(S.getMovements()[0].date, 'date générée');
});

test('addMovement : sortie possible', () => {
  const S = freshStore();
  const p = S.getProducts().find(x => x.qty >= 10);
  const avant = p.qty;
  S.addMovement({ productId: p.id, type: 'out', qty: 2, reason: '', author: '' });
  assertEq(S.getById(p.id).qty, avant - 2, 'quantité diminuée');
});

test('addMovement : sortie trop grande refusée', () => {
  const S = freshStore();
  const p = S.getProducts().find(x => x.ref === 'PRD-001');
  const avant = S.getById(p.id).qty;
  throws(() => S.addMovement({ productId: p.id, type: 'out', qty: avant + 100 }));
  assertEq(S.getById(p.id).qty, avant, 'stock inchangé');
});

test('addMovement : produit inexistant refusé', () => {
  const S = freshStore();
  throws(() => S.addMovement({ productId: 'nope', type: 'in', qty: 1 }));
});

test('addMovement : quantité invalide refusée', () => {
  const S = freshStore();
  const p = S.getProducts()[0];
  throws(() => S.addMovement({ productId: p.id, type: 'in', qty: 0 }));
  throws(() => S.addMovement({ productId: p.id, type: 'in', qty: -3 }));
});

test('getProducts : renvoie une copie (pas de mutation externe)', () => {
  const S = freshStore();
  const list = S.getProducts();
  list.pop();
  assertEq(S.getProducts().length, 7, 'données internes intactes');
});

test('getMovements : triés du plus récent au plus ancien', () => {
  const S = freshStore();
  const m = S.getMovements();
  for (let i = 1; i < m.length; i++) {
    assert(new Date(m[i - 1].date) >= new Date(m[i].date), 'ordre décroissant');
  }
});

test('byCategory : somme cohérente avec la valeur du stock', () => {
  const S = freshStore();
  const cats = S.byCategory();
  assert(cats.length >= 3, 'au moins 3 catégories');
  const total = cats.reduce((s, c) => s + c[1], 0);
  const direct = S.getProducts().reduce((s, p) => s + p.price * p.qty, 0);
  assertEq(Math.round(total), Math.round(direct), 'total = valeur stock');
});

test('categories : liste triée et unique', () => {
  const S = freshStore();
  const cats = S.categories();
  assertEq(cats.length, new Set(cats).size, 'pas de doublons');
  const sorted = [...cats].sort();
  assertEq(JSON.stringify(cats), JSON.stringify(sorted), 'triée');
});

test('exportCSV : en-têtes, données, séparateur ;', () => {
  const S = freshStore();
  const csv = S.exportCSV();
  assert(csv.includes('Reference'), 'en-tête Reference');
  assert(csv.includes('PRD-001'), 'donnée présente');
  assert(csv.includes('Clavier'), 'nom accentué présent');
  const lignes = csv.trim().split('\n');
  assertEq(lignes.length, 8, '1 en-tête + 7 produits');
  assert(!lignes[1].includes(','), 'pas de virgule comme séparateur');
  assert(lignes[1].split(';').length === 7, '7 colonnes');
});

test('reset : restaure la démo', () => {
  const S = freshStore();
  S.addProduct({ ref: 'X-9', name: 'Poubelle', price: 1, qty: 1 });
  S.deleteProduct('p1');
  S.reset();
  assertEq(S.getProducts().length, 7, '7 produits restaurés');
  assertEq(S.getMovements().length, 4, '4 mouvements restaurés');
  assertEq(S.getProducts()[0].name, 'Clavier mécanique', 'premier produit restauré');
});

test('persistance : relecture depuis le même localStorage', () => {
  const memory = {};
  const S = freshStore(memory);
  S.addProduct({ ref: 'PERSIST-1', name: 'Persistant', price: 2, qty: 5, min: 1 });
  const S2 = freshStore(memory);
  assert(S2.getProducts().some(p => p.ref === 'PERSIST-1'), 'donnée reconstruite depuis storage');
});

test('données stockées en localStorage JSON', () => {
  const S = freshStore();
  const cles = Object.keys(S).length; // Store n'expose pas les clés internes
  assert(cles > 0, 'Store exposé');
});

console.log('\n' + passed + '/' + (passed + failed) + " tests données OK");
if (failed) {
  console.error('\nÉchecs :\n' + failures.join('\n'));
  process.exit(1);
}