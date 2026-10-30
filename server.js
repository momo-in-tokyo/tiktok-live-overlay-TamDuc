// Cầu nối TikTok Live -> Overlay (WebSocket cục bộ)
// Chạy: npm i tiktok-live-connector ws   rồi   node server.js <tiktok_username>
const { WebSocketServer } = require('ws');
const L = require('tiktok-live-connector');
const Conn = L.WebcastPushConnection || L.TikTokLiveConnection;
const user = process.argv[2];
if (!user) { console.error('Dùng: node server.js <tiktok_username>'); process.exit(1); }

const wss = new WebSocketServer({ port: 8765 });
const send = (o) => wss.clients.forEach((c) => c.readyState === 1 && c.send(JSON.stringify(o)));
const who = (d) => ({ uid: String(d.userId || d.uniqueId), name: d.nickname || d.uniqueId });

const live = new Conn(user);
const connect = () => live.connect()
  .then((s) => console.log('Đã kết nối phòng', s.roomId))
  .catch((e) => { console.error('Lỗi kết nối, thử lại sau 10s:', e.message || e); setTimeout(connect, 10000); });

live.on('chat',   (d) => send({ type: 'chat', ...who(d), text: d.comment }));
live.on('member', (d) => send({ type: 'join', ...who(d) }));
live.on('gift',   (d) => {
  if (d.giftType === 1 && !d.repeatEnd) return;           // quà liên tiếp: chỉ tính khi kết thúc chuỗi
  send({ type: 'gift', ...who(d), gold: (d.diamondCount || 0) * (d.repeatCount || 1) });
});
live.on('disconnected', () => setTimeout(connect, 5000));
connect();
console.log('Overlay WebSocket: ws://localhost:8765');
