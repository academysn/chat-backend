// server.js

const http = require('http');
const WebSocket = require('ws');

// 📌 Render utilise une variable d'environnement PORT
const PORT = process.env.PORT || 3000;

// Crée un serveur HTTP (même si on n’a pas de frontend ici)
const server = http.createServer();

// Initialise le WebSocket Server en attachant au serveur HTTP
const wss = new WebSocket.Server({ server });

const clients = new Map(); // userid -> WebSocket
let waitingUser = null;

console.log('🔌 WebSocket Server démarrage...');

wss.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // 🔐 Enregistrement utilisateur
      if (data.type === 'register') {
        currentUserId = data.userid;
        clients.set(currentUserId, socket);
        console.log(`👤 ${currentUserId} connecté`);

        // 🔁 Matchmaking
        if (waitingUser && waitingUser !== currentUserId) {
          const peerSocket = clients.get(waitingUser);
          if (peerSocket && peerSocket.readyState === WebSocket.OPEN) {
            peerSocket.send(JSON.stringify({
              type: 'match',
              peerId: currentUserId,
              caller: true
            }));

            socket.send(JSON.stringify({
              type: 'match',
              peerId: waitingUser,
              caller: false
            }));

            console.log(`🔁 Match: ${waitingUser} ↔ ${currentUserId}`);
            waitingUser = null;
          }
        } else {
          waitingUser = currentUserId;
          console.log(`⌛ ${currentUserId} en attente d’un pair`);
        }
      }

      // 🔄 Transmission de signal WebRTC
      if (data.type === 'signal' && data.to && clients.has(data.to)) {
        const targetSocket = clients.get(data.to);
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify({
            type: 'signal',
            from: currentUserId,
            signalData: data.signalData
          }));
        }
      }

    } catch (err) {
      console.error('❌ Erreur message:', err);
    }
  });

  socket.on('close', () => {
    console.log(`❌ ${currentUserId} déconnecté`);
    clients.delete(currentUserId);
    if (waitingUser === currentUserId) waitingUser = null;
  });
});

// 🚀 Lancer le serveur sur le port Render
server.listen(PORT, () => {
  console.log(`✅ WebSocket Server en écoute sur le port ${PORT}`);
});
