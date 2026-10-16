// Instancia compartida de Socket.IO (se setea en index.js al arrancar).
// Rooms:
//   chat:<sessionId>   -> el navegador del cliente que tiene esa sesión web
//   vendedores         -> todos los vendedores logueados (para avisos en vivo)
let io = null;

function setIO(instance) { io = instance; }
function getIO() { return io; }

// Emite sin reventar si el socket aún no está listo.
function emitirChat(sessionId, evento, data) {
  try { if (io) io.to('chat:' + sessionId).emit(evento, data); } catch (e) { /* no-op */ }
}
function emitirVendedores(evento, data) {
  try { if (io) io.to('vendedores').emit(evento, data); } catch (e) { /* no-op */ }
}

module.exports = { setIO, getIO, emitirChat, emitirVendedores };
