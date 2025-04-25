const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map(); // userid -> WebSocket
const matches = new Map(); // userid -> matchedUserId
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

            // 🔗 Enregistre le match
            matches.set(currentUserId, waitingUser);
            matches.set(waitingUser, currentUserId);

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

    // 🔔 Notifie uniquement le partenaire matché
    const partnerId = matches.get(currentUserId);
    if (partnerId && clients.has(partnerId)) {
      const partnerSocket = clients.get(partnerId);
      if (partnerSocket.readyState === WebSocket.OPEN) {
        partnerSocket.send(JSON.stringify({
          type: "partner-left",
          peerId: currentUserId
        }));
      }
    }

    // ❌ Supprime les deux entrées du match
    matches.delete(currentUserId);
    matches.delete(partnerId);
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket Server en écoute sur le port ${PORT}`);
});
