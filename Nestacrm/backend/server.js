// server.js — Firebase Realtime Database backend
import dotenv from "dotenv";
import os from "os";
import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import {
  ref, get, set, push, update, remove,
  query, orderByChild, limitToLast,
} from "firebase/database";
import {
  connectDB, getDB, getDatabaseState, isDatabaseConnected,
} from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Express + Socket.IO ──────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: true, methods: ["GET","POST","PUT","PATCH","DELETE"], credentials: true },
  transports: ["websocket", "polling"],
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── BASE_PATH: frontend ile aynı yapı ───────────────────────────────────────
// Frontend: restaurants/${restId}/orders  vb.
// SERVER: har bir so'rovda restId talab qilinadi (query yoki body orqali)
// Oddiylashtirish uchun: BASE_PATH ni dynamic helper sifatida ishlatamiz

function basePath(restId) {
  return `restaurants/${restId}`;
}

// ─── Room helpers (Socket.IO) ─────────────────────────────────────────────────
const rooms = {
  clients: new Map(),
  chefs:   new Map(),
  tables:  new Map(),
  orders:  new Map(),
};

function joinTableRooms(socket, table) {
  if (!table) return;
  const key = String(table);
  socket.join(`table-${key}`);
  socket.join(`table_${key}`);
  if (!rooms.tables.has(key)) rooms.tables.set(key, new Set());
  rooms.tables.get(key).add(socket.id);
}

function emitToTable(table, eventName, payload) {
  if (!table) return;
  const key = String(table);
  io.to(`table-${key}`).emit(eventName, payload);
  io.to(`table_${key}`).emit(eventName, payload);
}

function mapStatus(status = "") {
  const map = {
    Yangi:"new", Tasdiqlandi:"approved", Tayyorlanmoqda:"cooking",
    Tayyor:"ready", Yetkazilmoqda:"on_way", Yetkazildi:"delivered",
    Topshirildi:"delivered", Yopildi:"closed",
    new:"new", in_progress:"cooking", ready:"ready",
    delivered:"delivered", closed:"closed",
  };
  return map[status] || String(status).toLowerCase().replace(/\s+/g,"_");
}

function calculateOrderTotal(items = []) {
  return items.reduce((t, i) => t + Number(i?.price||0) * Number(i?.qty||i?.quantity||1), 0);
}

function normalizeItems(items = []) {
  return items.filter(Boolean).map(i => ({
    name:  String(i.name||"").trim(),
    price: Number(i.price||0),
    qty:   Number(i.qty||i.quantity||1),
    image: i.image||i.img||"",
  })).filter(i => i.name);
}

// ─── DB guard ─────────────────────────────────────────────────────────────────
async function ensureDatabase(res) {
  if (isDatabaseConnected()) return true;
  const db = await connectDB();
  if (db) return true;
  res.status(503).json({ error:"Database is unavailable", dbState: getDatabaseState() });
  return false;
}

// restId ni so'rovdan olish
function getRestId(req) {
  return (
    req.query.restId ||
    req.body?.restId ||
    req.headers["x-rest-id"] ||
    process.env.DEFAULT_REST_ID ||
    null
  );
}

function trackOrder(orderId, payload) {
  const key = String(orderId);
  rooms.orders.set(key, { ...(rooms.orders.get(key)||{}), ...payload });
}

function broadcastActiveOrders(chefId) {
  const chefSocketId = rooms.chefs.get(String(chefId));
  if (!chefSocketId) return;
  const active = [];
  for (const [orderId, data] of rooms.orders.entries()) {
    if (!data.chefId && ["Yangi","Tasdiqlandi","new","approved"].includes(data.status)) {
      active.push({ orderId, ...data });
    }
  }
  if (active.length) io.to(chefSocketId).emit("active-orders", active);
}

// ─── REST API ─────────────────────────────────────────────────────────────────

app.get("/api/local-ip", (_req, res) => {
  const ifaces = os.networkInterfaces();
  let localIp = "localhost";
  for (const iface of Object.values(ifaces)) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) { localIp = alias.address; break; }
    }
  }
  res.json({ ip: localIp, port: PORT });
});

app.get("/api/health", async (_req, res) => {
  if (!isDatabaseConnected()) await connectDB();
  res.json({ ok: true, dbState: getDatabaseState() });
});

// ── Categories ────────────────────────────────────────────────────────────────
app.get("/api/categories", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const snap = await get(ref(getDB(), `${basePath(restId)}/categories`));
  const data = snap.val() || {};
  const list = Object.entries(data)
    .map(([id, cat]) => ({ _id: id, name: cat.name, icon: cat.icon||"" }))
    .sort((a,b) => a.name?.localeCompare(b.name));
  res.json(list);
});

app.post("/api/categories", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const name = String(req.body?.name||"").trim();
  if (!name) return res.status(400).json({ error: "Category name is required" });

  const newRef = push(ref(getDB(), `${basePath(restId)}/categories`));
  const catData = { name, icon: req.body?.icon||"", createdAt: Date.now() };
  await set(newRef, catData);

  const payload = { _id: newRef.key, name, icon: catData.icon };
  io.emit("category:created", payload);
  res.status(201).json(payload);
});

// ── Foods / Menu ──────────────────────────────────────────────────────────────
app.get("/api/foods", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const [menuSnap, catSnap] = await Promise.all([
    get(ref(getDB(), `${basePath(restId)}/menu`)),
    get(ref(getDB(), `${basePath(restId)}/categories`)),
  ]);

  const menuData = menuSnap.val() || {};
  const catData  = catSnap.val()  || {};

  const list = Object.entries(menuData)
    .map(([id, item]) => {
      const cat = item.categoryId ? catData[item.categoryId] : null;
      return {
        _id:        id,
        name:       item.name,
        price:      Number(item.price||0),
        image:      item.imgUrl || item.image || "",
        available:  item.active !== false,
        categoryId: item.categoryId || item.category || "",
        category:   cat ? { _id: item.categoryId, name: cat.name, icon: cat.icon||"" } : null,
      };
    })
    .sort((a,b) => b.createdAt - a.createdAt);
  res.json(list);
});

app.post("/api/foods", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const name = String(req.body?.name||"").trim();
  if (!name) return res.status(400).json({ error: "Food name is required" });

  const categoryId = req.body?.categoryId || req.body?.category || "";
  const newRef = push(ref(getDB(), `${basePath(restId)}/menu`));
  const foodData = {
    name:       { uz: name },
    price:      Number(req.body?.price||0),
    imgUrl:     req.body?.image || "",
    active:     req.body?.available !== false,
    categoryId,
    category:   categoryId,
    createdAt:  Date.now(),
  };
  await set(newRef, foodData);

  let category = null;
  if (categoryId) {
    const catSnap = await get(ref(getDB(), `${basePath(restId)}/categories/${categoryId}`));
    if (catSnap.exists()) {
      const c = catSnap.val();
      category = { _id: categoryId, name: c.name, icon: c.icon||"" };
    }
  }

  const payload = {
    _id: newRef.key, name, price: foodData.price,
    image: foodData.imgUrl, available: foodData.active, categoryId, category,
  };
  io.emit("food:created", payload);
  res.status(201).json(payload);
});

// ── Orders ────────────────────────────────────────────────────────────────────
app.get("/api/orders", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const q    = query(ref(getDB(), `${basePath(restId)}/orders`), orderByChild("createdAt"), limitToLast(300));
  const snap = await get(q);
  const data = snap.val() || {};

  const list = Object.entries(data)
    .map(([id, o]) => normalizeOrder(id, o))
    .sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  res.json(list);
});

app.post("/api/orders", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const table = Number(req.body?.table||0);
  const items = normalizeItems(req.body?.items||(req.body?.item ? [req.body.item] : []));
  if (!table || !items.length) return res.status(400).json({ error:"Order table and items are required" });

  const newRef   = push(ref(getDB(), `${basePath(restId)}/orders`));
  const orderNum = `#${Date.now().toString().slice(-6)}`;
  const orderData = {
    table,
    items,
    total:       Number(req.body?.total || calculateOrderTotal(items)),
    status:      req.body?.status || "new",
    statusKey:   "new",
    statusLabel: "Yangi",
    chefId:      req.body?.chefId || null,
    orderNumber: req.body?.orderNumber || orderNum,
    createdAt:   Date.now(),
    updatedAt:   Date.now(),
  };
  await set(newRef, orderData);

  const payload = normalizeOrder(newRef.key, orderData);
  io.emit("order:created", payload);
  trackOrder(newRef.key, { table: payload.table, status: payload.status, chefId: payload.chefId });
  res.status(201).json(payload);
});

app.put("/api/orders/:id/status", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const status = String(req.body?.status||"").trim();
  if (!status) return res.status(400).json({ error:"Status is required" });

  const orderRef  = ref(getDB(), `${basePath(restId)}/orders/${req.params.id}`);
  const orderSnap = await get(orderRef);
  if (!orderSnap.exists()) return res.status(404).json({ error:"Order not found" });

  const updates = {
    status,
    statusKey:   mapStatus(status),
    statusLabel: status,
    chefId:      req.body?.chefId || null,
    updatedAt:   Date.now(),
  };
  await update(orderRef, updates);

  const payload = normalizeOrder(req.params.id, { ...orderSnap.val(), ...updates });
  io.emit("order:updated", payload);
  io.to("admins").emit("order-status-changed", payload);
  trackOrder(req.params.id, { table: payload.table, status: payload.status, chefId: payload.chefId });
  res.json(payload);
});

// ── Staff / Users ─────────────────────────────────────────────────────────────
app.get("/api/staff", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const snap = await get(ref(getDB(), `${basePath(restId)}/users`));
  const data = snap.val() || {};
  const list = Object.entries(data)
    .filter(([, u]) => u.role === "chef" || u.role === "waiter")
    .map(([id, u]) => normalizeStaff(id, u))
    .sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  res.json(list);
});

app.post("/api/staff", async (req, res) => {
  if (!(await ensureDatabase(res))) return;
  const restId = getRestId(req);
  if (!restId) return res.status(400).json({ error: "restId required" });

  const name = String(req.body?.name||"").trim();
  if (!name) return res.status(400).json({ error:"Staff name is required" });

  const role      = req.body?.role || "waiter";
  const staffId   = `${role}_${Date.now()}`;
  const staffData = {
    name,
    role,
    active:    req.body?.active !== false,
    password:  req.body?.password || String(Math.floor(1000 + Math.random()*9000)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await set(ref(getDB(), `${basePath(restId)}/users/${staffId}`), staffData);
  res.status(201).json(normalizeStaff(staffId, staffData));
});

// ─── Normalizers ──────────────────────────────────────────────────────────────
function normalizeOrder(id, data) {
  const items = Array.isArray(data.items)
    ? data.items
    : Object.values(data.items||{});
  return {
    _id:         id,
    table:       Number(data.table||0),
    items:       items.map(i => ({
      name:  i.name,
      price: Number(i.price||0),
      qty:   Number(i.qty||1),
      image: i.image||i.img||"",
    })),
    total:       Number(data.total || calculateOrderTotal(items)),
    status:      data.status || "new",
    statusKey:   data.statusKey || mapStatus(data.status),
    statusLabel: data.statusLabel || data.status || "Yangi",
    chefId:      data.chefId || null,
    orderNumber: data.orderNumber || "",
    createdAt:   data.createdAt,
    updatedAt:   data.updatedAt,
  };
}

function normalizeStaff(id, data) {
  return {
    _id:       id,
    name:      data.name,
    role:      data.role,
    active:    data.active !== false,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("client-connect", (data={}) => {
    const clientId = String(data.clientId||socket.id);
    socket.clientId = clientId; socket.table = data.table||""; socket.role = "client";
    rooms.clients.set(clientId, socket.id);
    joinTableRooms(socket, data.table);
  });

  const handleChefConnect = (data={}) => {
    const chefId = String(data.chefId||data.id||"");
    if (!chefId) return;
    socket.chefId = chefId; socket.chefName = data.name||data.chefName||"Chef"; socket.role = "chef";
    rooms.chefs.set(chefId, socket.id);
    socket.join("chefs");
    broadcastActiveOrders(chefId);
  };
  socket.on("chef-connect",  handleChefConnect);
  socket.on("chef:join",     handleChefConnect);

  socket.on("admin-connect", () => { socket.role = "admin"; socket.join("admins"); });

  socket.on("new-order", (data={}) => {
    const orderId = String(data.orderId||"");
    if (!orderId) return;
    trackOrder(orderId, { chefId:null, table:data.order?.table, status:data.order?.status||"new", clientId:socket.clientId||null });
    io.to("chefs").emit("new-order", { orderId, order: data.order, timestamp: Date.now() });
    socket.emit("order-created", { orderId, status:"created" });
  });

  socket.on("chef:new-order", (data={}) => {
    if (!data.orderId) return;
    trackOrder(data.orderId, { chefId: data.chefId||null, table: data.table||null, status:"approved" });
    const payload = { ...data, timestamp: Date.now() };
    if (data.chefId) {
      const s = rooms.chefs.get(String(data.chefId));
      if (s) io.to(s).emit("chef:new-order", payload);
    }
    io.to("chefs").emit("chef:new-order", payload);
  });

  socket.on("order-assigned", (data={}) => {
    const { orderId, chefId, table } = data;
    if (!orderId) return;
    trackOrder(orderId, { chefId:chefId||null, table:table||null, status:"Tasdiqlandi" });
    const s = rooms.chefs.get(String(chefId||""));
    if (s) {
      io.to(s).emit("order-assigned", data);
      io.to(s).emit("chef:new-order", { orderId, chefId, table, orderNumber: data.orderNumber||orderId, timestamp: Date.now() });
    }
    emitToTable(table, "order-accepted", { orderId, status:"Tasdiqlandi", chefId });
  });

  socket.on("chef-status-update", (data={}) => {
    const { orderId, status, chefId, table, orderNumber } = data;
    if (!orderId) return;
    trackOrder(orderId, { chefId: chefId||socket.chefId||null, table:table||null, status });
    const payload = {
      orderId, status,
      statusKey:   mapStatus(status),
      statusLabel: status,
      chefId:      chefId||socket.chefId||null,
      chefName:    socket.chefName||data.chefName||"Chef",
      orderNumber: orderNumber||"",
      table:       table||null,
      timestamp:   Date.now(),
    };
    emitToTable(table, "order-status-update", payload);
    socket.to("chefs").emit("other-chef-status", payload);
    io.to("chefs").emit("chef:status-updated", payload);
    io.to("admins").emit("order-status-changed", payload);
    io.emit("order:updated", payload);
  });

  socket.on("payment-request", (data={}) => {
    io.to("admins").emit("payment-request", { ...data, clientId: socket.clientId||null, timestamp: Date.now() });
  });

  socket.on("payment-approved", (data={}) => {
    const { orderId, table, clientId } = data;
    const s = rooms.clients.get(String(clientId||""));
    if (s) io.to(s).emit("payment-approved", { orderId, approved:true, timestamp: Date.now() });
    emitToTable(table, "payment-approved", { ...data, approved:true, timestamp: Date.now() });
  });

  socket.on("chef-message", (data={}) => {
    const payload = { ...data, chefName: data.chefName||socket.chefName||"Chef", timestamp: Date.now() };
    emitToTable(data.table, "chef-message", payload);
    io.to("chefs").emit("chef:chat-message", payload);
  });

  socket.on("chef:chat-message", (data={}) => {
    io.to("chefs").emit("chef:chat-message", { ...data, timestamp: Date.now() });
  });

  socket.on("table-force-closed", (data={}) => {
    const payload = { table: data.table, reason: data.reason||"Admin closed the table", timestamp: Date.now() };
    emitToTable(data.table, "table-force-closed", payload);
    io.to("chefs").emit("table-closed", payload);
    io.to("chefs").emit("chef:table-update", { ...payload, status:"closed" });
    rooms.tables.delete(String(data.table||""));
  });

  socket.on("session-reset", (data={}) => {
    for (const [orderId, od] of rooms.orders.entries()) {
      if (od.clientId === data.clientId) rooms.orders.delete(orderId);
    }
  });

  socket.on("menu-updated", () => { io.emit("menu-updated", { timestamp: Date.now() }); });

  socket.on("disconnect", () => {
    if (socket.role === "client" && socket.clientId) rooms.clients.delete(socket.clientId);
    if (socket.role === "chef"   && socket.chefId)   rooms.chefs.delete(socket.chefId);
    if (socket.table && rooms.tables.has(String(socket.table))) {
      rooms.tables.get(String(socket.table)).delete(socket.id);
    }
  });
});

// ─── Static + Listen ──────────────────────────────────────────────────────────
const staticPath = path.join(__dirname, "../admin-frontend/public");
app.use(express.static(staticPath));

const PORT = Number(process.env.PORT || 4000);
connectDB();

server.listen(PORT, "0.0.0.0", () => {
  const ifaces = os.networkInterfaces();
  let localIp = "localhost";
  for (const iface of Object.values(ifaces)) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) { localIp = alias.address; break; }
    }
  }
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${localIp}:${PORT}`);
  console.log(`📱 QR: http://${localIp}:${PORT}/table/1`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
});