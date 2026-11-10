// Database layer backed by Firebase Firestore.
const { db } = require('./firebase');
const menuCol = db.collection('menuItems');
const orderCol = db.collection('orders');
const toObj = (d) => ({ id: d.id, ...d.data() });

module.exports = {
  mode: 'firestore',

  async listMenu() {
    const snap = await menuCol.get();
    return snap.docs.map(toObj);
  },
  async getMenuItem(id) {
    const d = await menuCol.doc(id).get();
    return d.exists ? toObj(d) : null;
  },
  async createMenuItem(data) {
    const ref = await menuCol.add(data);
    return { id: ref.id, ...data };
  },
  async updateMenuItem(id, data) {
    const ref = menuCol.doc(id);
    const d = await ref.get();
    if (!d.exists) return null;
    await ref.update(data);
    return { id, ...d.data(), ...data };
  },
  async deleteMenuItem(id) {
    const ref = menuCol.doc(id);
    const d = await ref.get();
    if (!d.exists) return false;
    await ref.delete();
    return true;
  },

  async createOrder(order) {
    try {
      await orderCol.doc(order.orderId).create(order); // fails if ID already exists
    } catch (err) {
      if (err.code === 6 || /already exists/i.test(err.message)) {
        const e = new Error('Order ID exists');
        e.code = 'EXISTS';
        throw e;
      }
      throw err;
    }
    return order;
  },
  async getOrder(orderId) {
    const d = await orderCol.doc(orderId).get();
    return d.exists ? { ...d.data() } : null;
  },
  async listOrders() {
    const snap = await orderCol.orderBy('createdAt', 'desc').limit(500).get();
    return snap.docs.map((d) => ({ ...d.data() }));
  },
  async updateOrder(orderId, patch) {
    const ref = orderCol.doc(orderId);
    const d = await ref.get();
    if (!d.exists) return null;
    await ref.update(patch);
    return { ...d.data(), ...patch };
  },
  async countMenu() {
    const snap = await menuCol.limit(1).get();
    return snap.size;
  },
  async clearMenu() {
    const snap = await menuCol.get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },
};
