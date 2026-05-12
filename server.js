// server.js – Backend ParkedIt
// Express + Socket.IO: recibe datos del ESP32 y los emite a clientes en tiempo real.
// Arrancar: node server.js

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Servir los archivos estáticos del proyecto (HTML, CSS, etc.)
app.use(express.static(path.join(__dirname)));

// ── Estado en memoria ──────────────────────────────────────────────────────
// Mapa: slot_id (string) → { slot_id, status, updated_at }
const slots = new Map();

// ── POST /api/parking ──────────────────────────────────────────────────────
// Body esperado: { "slot_id": "1", "status": "occupied" | "free" }
app.post('/api/parking', (req, res) => {
  const { slot_id, status } = req.body;

  // Validación
  if (!slot_id || !status) {
    return res.status(400).json({ error: 'Faltan campos: slot_id y status son requeridos.' });
  }
  if (!['occupied', 'free'].includes(status)) {
    return res.status(400).json({ error: 'status debe ser "occupied" o "free".' });
  }

  const payload = {
    slot_id:    String(slot_id),
    status,
    updated_at: new Date().toISOString()
  };

  // Guardar en memoria
  slots.set(String(slot_id), payload);

  // Emitir a todos los clientes conectados por Socket.IO
  io.emit('updateSlot', payload);

  console.log(`[parking] slot=${slot_id} → ${status}`);
  return res.status(200).json({ ok: true, ...payload });
});

// ── GET /api/parking ───────────────────────────────────────────────────────
// Devuelve el estado actual de todos los slots (útil al recargar la página)
app.get('/api/parking', (req, res) => {
  res.json(Object.fromEntries(slots));
});

// ── Socket.IO ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);

  // Enviar estado actual al cliente recién conectado
  socket.emit('allSlots', Object.fromEntries(slots));

  socket.on('disconnect', () => {
    console.log(`[socket] cliente desconectado: ${socket.id}`);
  });
});

// ── Arranque ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n✅ ParkedIt backend corriendo en http://localhost:${PORT}`);
  console.log(`   POST http://localhost:${PORT}/api/parking`);
  console.log(`   GET  http://localhost:${PORT}/api/parking\n`);
});
