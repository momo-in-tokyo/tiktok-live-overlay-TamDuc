// Cầu nối TikTok Live -> Overlay (WebSocket)
// Chạy máy: npm i && node server.js <tiktok_username>   |   Render: đặt TIKTOK_USERNAME, EULER_API_KEY
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection } = require('tiktok-live-connector'); // bản 2.x

const user = process.argv[2] || process.env.TIKTOK_USERNAME;
if (!user) { console.error('Dùng: node server.js <tiktok_username> (hoặc biến môi trường TIKTOK_USERNAME)'); process.exit(1); }

const PORT = process.env.PORT || 8765;
const srv = http.createServer((q, r) => { r.writeHead(200); r.end('ok'); });
const wss = new WebSocketServer({ server: srv });
srv.listen(PORT);
const send = (o) => wss.clients.forEach((c) => c.readyState === 1 && c.send(JSON.stringify(o)));

// Dữ liệu người dùng: thư viện 2.x trả theo cấu trúc proto (id/idStr, displayId, nickname, avatarThumb.urlList)
// nên đọc nhiều tên trường để chắc chắn mỗi người có 1 uid RIÊNG.
const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== '' && x !== '0' && x !== 0);
const firstUrl = (img) => (img && (img.urlList || img.url || [])[0]) || '';
function who(d) {
  const u = d.user || {};
  const uid = String(pick(u.idStr, u.id, u.userId, u.secUid, u.displayId, u.uniqueId, u.nickname) || 'unknown');
  const name = pick(u.nickname, u.displayId, u.uniqueId) || 'Ẩn danh';
  const avatar = firstUrl(u.avatarThumb) || firstUrl(u.avatarMedium) || firstUrl(u.profilePicture) || u.profilePictureUrl || '';
  return { uid: uid.toString(), name: String(name), avatar };
}

const live = new TikTokLiveConnection(user, { signApiKey: process.env.EULER_API_KEY });
const connect = () => live.connect()
  .then(() => console.log('Đã kết nối phòng', user))
  .catch((e) => { console.error('Lỗi kết nối, thử lại sau 10s:', String((e && e.message) || e).slice(0, 300)); setTimeout(connect, 10000); });

let dbg = 0;
live.on('chat', (d) => {
  const w = who(d), text = d.content || d.comment || '';
  if (dbg++ < 5) console.log('DEBUG user:', JSON.stringify({ keys: Object.keys(d.user || {}).slice(0, 12), id: (d.user || {}).id, idStr: (d.user || {}).idStr, displayId: (d.user || {}).displayId, nickname: (d.user || {}).nickname }), '| uid dùng:', w.uid, '| keys tin nhắn:', Object.keys(d).slice(0, 10).join(','));
  console.log('CHAT:', w.uid, w.name, '-', text);
  send({ type: 'chat', ...w, text });
});
live.on('gift', (d) => {
  const g = d.gift || d.giftDetails || {};
  if (g.type === 1 && !d.repeatEnd) return;                // quà liên tiếp: chỉ tính khi kết thúc chuỗi
  const gold = (g.diamondCount || 0) * (d.repeatCount || 1);
  const w = who(d);
  console.log('GIFT:', w.uid, w.name, '-', gold, 'vàng');
  send({ type: 'gift', ...w, gold });
});
live.on('like', (d) => {                                   // thả tim
  const w = who(d), n = d.count || d.likeCount || 1;
  console.log('LIKE:', w.uid, w.name, '+', n);
  send({ type: 'like', ...w, count: n });
});
live.on('disconnected', () => setTimeout(connect, 5000));
connect();
console.log('Overlay WebSocket đang chạy ở cổng', PORT);
