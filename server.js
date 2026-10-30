// Cầu nối TikTok Live -> Overlay (WebSocket cục bộ)
// Chạy: npm i tiktok-live-connector ws   rồi   node server.js <tiktok_username>
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection } = require('tiktok-live-connector'); // bản 2.x
const user = process.argv[2] || process.env.TIKTOK_USERNAME;
if (!user) { console.error('Dùng: node server.js <tiktok_username> (hoặc đặt biến môi trường TIKTOK_USERNAME)'); process.exit(1); }

const PORT = process.env.PORT || 8765;            // Render cấp PORT qua biến môi trường
const srv = http.createServer((q, r) => { r.writeHead(200); r.end('ok'); }); // để Render kiểm tra sống
const wss = new WebSocketServer({ server: srv });
srv.listen(PORT);
const send = (o) => wss.clients.forEach((c) => c.readyState === 1 && c.send(JSON.stringify(o)));
const who = (d) => ({ uid: String((d.user && (d.user.userId || d.user.uniqueId)) || ''), name: (d.user && (d.user.nickname || d.user.uniqueId)) || 'Ẩn danh' });

// EULER_API_KEY: khóa API tạo tại eulerstream.com (bản 2.x cần để ký yêu cầu, tránh lỗi 403)
const live = new TikTokLiveConnection(user, { signApiKey: process.env.EULER_API_KEY });
const connect = () => live.connect()
  .then(() => console.log('Đã kết nối phòng', user))
  .catch((e) => { console.error('Lỗi kết nối, thử lại sau 10s:', String((e && e.message) || e).slice(0, 300)); setTimeout(connect, 10000); });

live.on('chat', (d) => send({ type: 'chat', ...who(d), text: d.comment }));
live.on('member', (d) => send({ type: 'join', ...who(d) }));
live.on('gift', (d) => {
  const gd = d.giftDetails || {};
  if (gd.giftType === 1 && !d.repeatEnd) return;           // quà liên tiếp: chỉ tính khi kết thúc chuỗi
  send({ type: 'gift', ...who(d), gold: (gd.diamondCount || 0) * (d.repeatCount || 1) });
});
live.on('disconnected', () => setTimeout(connect, 5000));
connect();
console.log('Overlay WebSocket đang chạy ở cổng', PORT);
