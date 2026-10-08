const Store = (() => {
  const API = '/api';
  let session = null;

  async function call(path, options = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  }

  function status(p) {
    if (p.qty <= 0) return 'out';
    if (p.qty <= p.min) return 'low';
    return 'ok';
  }

  return {
    status,

    async login(username, password) {
      const data = await call('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      session = data.user;
      localStorage.setItem('stockflow.session', JSON.stringify(session));
      return session;
    },
    logout() {
      session = null;
      localStorage.removeItem('stockflow.session');
    },
    getSession() {
      if (session) return session;
      try { session = JSON.parse(localStorage.getItem('stockflow.session')); } catch { session = null; }
      return session;
    },

    getProducts: () => call('/products'),
    getMovements: () => call('/movements'),
    getById: async id => (await call('/products')).find(p => p.id === id),

    async addProduct(data, imageFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);
      return call('/products', { method: 'POST', body: fd });
    },
    updateProduct(id, data) {
      return call(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteProduct(id) {
      return call(`/products/${id}`, { method: 'DELETE' });
    },

    addMovement(data) {
      return call('/movements', { method: 'POST', body: JSON.stringify(data) });
    },

    stats: () => call('/stats/dashboard'),
    getMovementsFull: () => call('/movements'),

    async byCategory() {
      const products = await call('/products');
      const map = {};
      products.forEach(p => {
        const cat = p.category || 'Divers';
        map[cat] = (map[cat] || 0) + p.price * p.qty;
      });
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    },

    async categories() {
      const products = await call('/products');
      return [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    },

    async exportCSV() {
      const products = await call('/products');
      const head = ['Reference', 'Nom', 'Categorie', 'Prix', 'Quantite', 'Seuil', 'Etat'];
      const rows = products.map(p => [p.ref, p.name, p.category, p.price, p.qty, p.min, status(p)]);
      const csv = [head, ...rows].map(r => r.map(c => `"${String(c).split('"').join('""')}"`).join(';')).join('\n');
      return '\uFEFF' + csv;
    },

    reset: () => call('/reset', { method: 'POST' })
  };
})();
