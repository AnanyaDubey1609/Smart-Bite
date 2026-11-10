// Demo-mode database: keeps everything in memory (resets when server restarts).
// Same functions as firestoreDb.js so the rest of the code does not care which is used.
const crypto = require('crypto');
const menu = new Map();
const orders = new Map();

module.exports = {
  mode: 'memory',

  async listMenu() { return [...menu.values()].map((m) => ({ ...m })); },
  async getMenuItem(id) { return menu.has(id) ? { ...menu.get(id) } : null; },
  async createMenuItem(data) {
    const id = crypto.randomBytes(8).toString('hex');
    const item = { id, ...data };
    menu.set(id, item);
    return { ...item };
  },
  async updateMenuItem(id, data) {
    if (!menu.has(id)) return null;
    const item = { ...menu.get(id), ...data };
    menu.set(id, item);
    return { ...item };
  },
  async deleteMenuItem(id) { return menu.delete(id); },

  async createOrder(order) {
    if (orders.has(order.orderId)) {
      const e = new Error('Order ID exists');
      e.code = 'EXISTS';
      throw e;
    }
    orders.set(order.orderId, { ...order });
    return order;
  },
  async getOrder(orderId) { return orders.has(orderId) ? { ...orders.get(orderId) } : null; },
  async listOrders() {
    return [...orders.values()].map((o) => ({ ...o })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async updateOrder(orderId, patch) {
    if (!orders.has(orderId)) return null;
    const o = { ...orders.get(orderId), ...patch };
    orders.set(orderId, o);
    return { ...o };
  },
  async countMenu() { return menu.size; },
  async clearMenu() { menu.clear(); },
};
