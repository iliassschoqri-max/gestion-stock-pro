const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const multer = require('multer');

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

// Middleware de sécurité et performance
app.use(helmet({ contentSecurityPolicy: false })); // Désactivé pour simplifier le chargement des polices/images externes en dev
app.use(compression());
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname)));

// Configuration de l'upload d'images
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

let db;

async function setupDb() {
  db = await open({
    filename: path.join(dataDir, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Schéma de base de données professionnel
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      ref TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Divers',
      price REAL DEFAULT 0,
      qty INTEGER DEFAULT 0,
      min INTEGER DEFAULT 5,
      image_url TEXT,
      desc TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      productId TEXT,
      type TEXT CHECK(type IN ('in', 'out')),
      qty INTEGER NOT NULL,
      reason TEXT,
      author TEXT,
      date TEXT,
      FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // Migration : ajoute les colonnes manquantes sur une base existante
  const cols = await db.all("PRAGMA table_info(products)");
  const names = cols.map(c => c.name);
  if (!names.includes('image_url')) await db.run('ALTER TABLE products ADD COLUMN image_url TEXT');
  if (!names.includes('created_at')) await db.run('ALTER TABLE products ADD COLUMN created_at TEXT');

  // Utilisateur par défaut : admin / admin
  const admin = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
  if (!admin) {
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'admin', 'admin']);
  }

  // Jeu de démonstration si la base est vide
  const { count } = await db.get('SELECT COUNT(*) as count FROM products');
  if (count === 0) await seedDemo();
}

async function seedDemo() {
  const seedProducts = [
    ['p1', 'PRD-001', 'Clavier mécanique', 'Électronique', 79.9, 24, 5, 'Switches bleus, rétroéclairage RGB'],
    ['p2', 'PRD-002', 'Souris sans fil', 'Électronique', 34.5, 3, 8, 'Rechargeable USB-C'],
    ['p3', 'PRD-003', 'Écran 24"', 'Électronique', 149, 12, 4, 'Full HD 75Hz'],
    ['p4', 'PRD-004', 'Ramette A4', 'Fournitures', 5.9, 120, 20, '500 feuilles, 80g'],
    ['p5', 'PRD-005', 'Stylo bille noir', 'Fournitures', 1.2, 0, 30, 'Pointe 0.7mm'],
    ['p6', 'PRD-006', 'Carton expédition M', 'Emballage', 2.4, 65, 15, '40x30x30 cm'],
    ['p7', 'PRD-007', 'Ruban adhésif', 'Emballage', 1.8, 7, 10, 'Transparent 50m']
  ];
  for (const p of seedProducts) {
    await db.run(
      'INSERT INTO products (id, ref, name, category, price, qty, min, desc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...p, new Date().toISOString()]
    );
  }
  const seedMovements = [
    ['m1', 'p1', 'in', 30, 'Réception fournisseur', 'Alice', '2026-10-01T09:20:00'],
    ['m2', 'p2', 'out', 12, 'Vente client', 'Bob', '2026-10-03T14:05:00'],
    ['m3', 'p5', 'out', 40, 'Vente en gros', 'Alice', '2026-10-05T11:40:00'],
    ['m4', 'p4', 'in', 100, 'Réception fournisseur', 'Carol', '2026-10-06T08:15:00']
  ];
  for (const m of seedMovements) {
    await db.run('INSERT INTO movements (id, productId, type, qty, reason, author, date) VALUES (?, ?, ?, ?, ?, ?, ?)', m);
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- API ROUTES ---------- */

// Auth (Simplifié pour l'exemple)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (user) {
    res.json({ success: true, user: { username: user.username, role: user.role } });
  } else {
    res.status(401).json({ error: 'Identifiants invalides' });
  }
});

// Produits
app.get('/api/products', async (req, res) => {
  const products = await db.all('SELECT * FROM products ORDER BY name ASC');
  res.json(products);
});

app.post('/api/products', upload.single('image'), async (req, res) => {
  const { ref, name, category, price, qty, min, desc } = req.body;
  const id = uid();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  try {
    await db.run(
      'INSERT INTO products (id, ref, name, category, price, qty, min, image_url, desc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, ref, name, category, price, qty, min, imageUrl, desc, new Date().toISOString()]
    );
    
    if (qty > 0) {
      await db.run(
        'INSERT INTO movements (id, productId, type, qty, reason, author, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uid(), id, 'in', qty, 'Stock initial', 'Admin', new Date().toISOString()]
      );
    }
    res.status(201).json({ success: true, id });
  } catch (e) {
    res.status(400).json({ error: 'Référence déjà utilisée' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { ref, name, category, price, qty, min, desc } = req.body;
  const existing = await db.get('SELECT id FROM products WHERE id = ?', id);
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });
  try {
    await db.run(
      'UPDATE products SET ref=?, name=?, category=?, price=?, qty=?, min=?, desc=? WHERE id=?',
      [ref, name, category, Number(price) || 0, Number(qty) || 0, Number(min) || 0, desc || '', id]
    );
  } catch (e) {
    return res.status(400).json({ error: 'Référence déjà utilisée' });
  }
  const product = await db.get('SELECT * FROM products WHERE id = ?', id);
  res.json(product);
});

app.delete('/api/products/:id', async (req, res) => {
  await db.run('DELETE FROM products WHERE id = ?', req.params.id);
  res.status(204).end();
});

// Mouvements
app.get('/api/movements', async (req, res) => {
  const movements = await db.all(`
    SELECT m.*, p.name as productName, p.ref as productRef 
    FROM movements m 
    LEFT JOIN products p ON m.productId = p.id 
    ORDER BY date DESC
  `);
  res.json(movements);
});

app.post('/api/movements', async (req, res) => {
  const { productId, type, qty, reason, author } = req.body;
  const n = Number(qty);

  if (type !== 'in' && type !== 'out') return res.status(400).json({ error: 'Type invalide' });
  if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Quantité invalide' });

  const p = await db.get('SELECT qty FROM products WHERE id = ?', productId);
  if (!p) return res.status(404).json({ error: 'Produit introuvable' });
  if (type === 'out' && n > p.qty) {
    return res.status(400).json({ error: `Stock insuffisant (disponible : ${p.qty})` });
  }

  const newQty = type === 'in' ? p.qty + n : p.qty - n;
  await db.exec('BEGIN');
  try {
    await db.run('UPDATE products SET qty = ? WHERE id = ?', [newQty, productId]);
    await db.run(
      'INSERT INTO movements (id, productId, type, qty, reason, author, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uid(), productId, type, n, reason || '', author || '', new Date().toISOString()]
    );
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }

  res.status(201).json({ success: true });
});

// Stats avancées
app.get('/api/stats/dashboard', async (req, res) => {
  const stats = await db.get(`
    SELECT 
      COUNT(*) as totalRef,
      SUM(qty) as totalUnits,
      SUM(qty * price) as totalValue,
      COUNT(CASE WHEN qty <= min AND qty > 0 THEN 1 END) as lowStock,
      COUNT(CASE WHEN qty <= 0 THEN 1 END) as outOfStock
    FROM products
  `);
  res.json(stats);
});

// Réinitialisation de la démo
app.post('/api/reset', async (req, res) => {
  await db.run('DELETE FROM movements');
  await db.run('DELETE FROM products');
  await seedDemo();
  res.json({ success: true });
});

// Démarrage
const fs = require('fs');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

setupDb().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`Professionnel StockFlow lancé sur http://localhost:${port}`));
});
