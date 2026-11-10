// Tiny event bus used to push live updates to the admin dashboard (SSE).
const { EventEmitter } = require('events');
const bus = new EventEmitter();
bus.setMaxListeners(100);
module.exports = bus;
