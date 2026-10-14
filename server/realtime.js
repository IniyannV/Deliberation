// Shared handle to the socket.io server so REST routes can push live updates.
let io = null;

export const setIo = (server) => { io = server; };

/** Room names: 'jurors', 'bailiffs', 'display', and `user:<id>` for one person. */
export function emit(rooms, event, payload) {
  if (!io) return;
  io.to(rooms).emit(event, payload);
}

export function disconnectUser(userId) {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

export const getIo = () => io;
