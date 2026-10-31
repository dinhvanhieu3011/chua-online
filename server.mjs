// Chùa Online — máy chủ nối TikTok LIVE với màn hình game
// Chạy:  node server.mjs            (lấy username trong config.json)
//        node server.mjs ten_tiktok (ghi đè username)
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');
// Lần đầu (mới tải code về): chưa có config.json thì tạo từ bản mẫu config.example.json
if (!fs.existsSync(CONFIG_PATH)) fs.copyFileSync(path.join(__dirname, 'config.example.json'), CONFIG_PATH);
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const cleanName = u => String(u || '').replace(/^@/, '').trim();
const usernameOverride = cleanName(process.argv[2] || process.env.TIKTOK_USERNAME);
let username = usernameOverride || cleanName(config.tiktokUsername);
const PORT = Number(process.env.PORT || config.port || 8080);

// ---------- Web + WebSocket ----------
const app = express();
// html/js/css: trình duyệt luôn hỏi lại máy chủ (không dùng bản cũ đã lưu) → sửa code xong, tải lại là có bản mới.
// LIVE Studio / OBS giữ trang rất lâu nên điều này quan trọng. Ảnh vẫn được lưu tạm bình thường.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => { if (/\.(html|js|css)$/i.test(file)) res.setHeader('Cache-Control', 'no-cache'); }
}));
// "Phiên bản" mã trang game = thời điểm sửa gần nhất của các file trong public/. Gửi cho trang khi kết nối;
// trang thấy phiên bản khác lần trước (máy chủ chạy lại sau khi sửa code) thì tự tải lại.
const CODE_VERSION = String(Math.max(...['index.html', 'game.js', 'music.js'].map(f => {
  try { return fs.statSync(path.join(__dirname, 'public', f)).mtimeMs; } catch { return 0; }
})));
// Trang game chỉ cần phần hiển thị → không gửi khoá bí mật ra ngoài
const SECRET_KEYS = ['signApiKey', 'adminPassword'];
function publicConfig() { const c = { ...config }; for (const k of SECRET_KEYS) delete c[k]; return c; }
app.get('/config.json', (_req, res) => res.json(publicConfig()));

// ---------- Trang quản trị: /admin ----------
// Mở trên chính máy chạy server thì không cần mật khẩu.
// Mở từ máy khác (điện thoại cùng wifi) thì phải đặt "adminPassword" trong config.json.
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function requireAdmin(req, res, next) {
  if (isLocal(req)) return next();
  const pw = String(config.adminPassword || '');
  if (pw && req.get('x-admin-password') === pw) return next();
  res.status(401).json({ error: pw ? 'Sai mật khẩu quản trị' : 'Chỉ mở được trên máy chạy server (hoặc đặt adminPassword trong config.json)' });
}
const api = express.Router();
api.use(requireAdmin, express.json({ limit: '1mb' }));

api.get('/config', (_req, res) => res.json(config));

api.post('/config', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  if (body.gifts !== undefined && !Array.isArray(body.gifts)) return res.status(400).json({ error: '"gifts" phải là danh sách' });
  const before = { tiktokUsername: config.tiktokUsername, signApiKey: config.signApiKey, port: config.port };
  for (const k of Object.keys(body)) config[k] = body[k];
  try { saveConfig(); } catch (err) { return res.status(500).json({ error: 'Không ghi được config.json: ' + err.message }); }
  broadcast({ type: 'config' });
  const notes = [];
  if (config.port !== before.port) notes.push('Đổi cổng (port) cần tắt và chạy lại server.');
  if (!usernameOverride && (config.tiktokUsername !== before.tiktokUsername || config.signApiKey !== before.signApiKey)) {
    username = cleanName(config.tiktokUsername);
    reconnectTikTok();
    notes.push('Đang kết nối lại TikTok…');
  }
  console.log('[quản trị] đã lưu config.json');
  res.json({ ok: true, notes });
});

// Lệnh tức thời: điều khiển nhạc, sự kiện thử, xoá bảng công đức
api.post('/cmd', (req, res) => {
  const b = req.body || {};
  if (b.type === 'music') broadcast({ type: 'music', action: String(b.action || ''), value: b.value });
  else if (b.type === 'reset-merit') resetMerit();
  else if (b.type === 'test') {
    const user = mkUser({ uniqueId: b.name || 'khach' + Math.floor(Math.random() * 999), nickname: b.name });
    if (b.event === 'gift') emit({ type: 'gift', user, gift: { name: String(b.gift || 'rose'), count: Number(b.count) || 1, diamonds: Number(b.diamonds) || 1 } });
    else if (b.event === 'chat') emit({ type: 'chat', user, text: String(b.text || 'Nam mô A Di Đà Phật').slice(0, 80) });
    else if (b.event === 'follow') emit({ type: 'follow', user });
    else if (b.event === 'like') emit({ type: 'like', user, count: 15 });
    else emit({ type: 'join', user });
  } else return res.status(400).json({ error: 'Lệnh không hợp lệ' });
  res.json({ ok: true });
});

// Lấy tên video YouTube để hiện trong danh sách nhạc
const titleCache = new Map();
api.get('/yt-title', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.status(400).json({});
  if (titleCache.has(url)) return res.json(titleCache.get(url));
  try {
    const full = /^[\w-]{11}$/.test(url) ? 'https://www.youtube.com/watch?v=' + url : url;
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(full), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const info = { title: j.title || '', author: j.author_name || '', thumb: j.thumbnail_url || '' };
    titleCache.set(url, info);
    res.json(info);
  } catch {
    res.json({ title: '', error: 'Không lấy được tên video (link sai, video riêng tư hoặc không có mạng)' });
  }
});

api.get('/state', (_req, res) => res.json({ status: lastStatus, music: lastMusic, viewers: lastViewers, games: gameCount() }));
app.use('/api', api);

// Ghi config.json, giữ mỗi quà trên một dòng cho dễ đọc khi mở bằng Notepad
function saveConfig() {
  const lines = Object.entries(config).map(([k, v]) => {
    if (k === 'gifts' && Array.isArray(v)) return `  "gifts": [\n${v.map(g => '    ' + JSON.stringify(g)).join(',\n')}\n  ]`;
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')}`;
  });
  const text = '{\n' + lines.join(',\n') + '\n}\n';
  JSON.parse(text); // chắc chắn hợp lệ trước khi ghi
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

// Gửi sự kiện thử từ trình duyệt/điện thoại: /test?type=gift&name=Lan&gift=lion
app.get('/test', (req, res) => {
  const q = req.query;
  const user = mkUser({ uniqueId: q.name || 'khach' + Math.floor(Math.random() * 999), nickname: q.name });
  if (q.type === 'gift') emit({ type: 'gift', user, gift: { name: q.gift || 'rose', count: Number(q.count || 1), diamonds: 1 } });
  else if (q.type === 'chat') emit({ type: 'chat', user, text: q.text || 'Nam mô A Di Đà Phật' });
  else emit({ type: 'join', user });
  res.send('ok');
});

// Đọc tiếng Việt: /tts?text=... → mp3 (lấy từ Google Translate, có cache trong bộ nhớ)
const ttsCache = new Map();
app.get('/tts', async (req, res) => {
  const text = String(req.query.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) return res.status(400).end();
  let buf = ttsCache.get(text);
  if (!buf) {
    try {
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=' + encodeURIComponent(text);
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      buf = Buffer.from(await r.arrayBuffer());
      ttsCache.set(text, buf);
      if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
    } catch (err) {
      console.warn('[tts] không lấy được giọng đọc:', err?.message || err);
      return res.status(502).end();
    }
  }
  res.set('Content-Type', 'audio/mpeg').set('Cache-Control', 'public, max-age=86400').send(buf);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
let lastStatus = { type: 'status', state: 'starting', username };
let lastMusic = null;      // trạng thái nhạc nền do trang game báo về
let lastViewers = 0;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) if (c.readyState === 1) c.send(data);
}

// ---------- Trạng thái chung cho mọi cửa sổ game ----------
// Máy chủ giữ Bảng Công Đức và danh sách phật tử trong chùa, để mọi cửa sổ (Chrome, LIVE Studio, OBS…) hiện giống nhau.
const MERIT_PATH = path.join(__dirname, 'merit.json');
let merit = {};              // id -> { name, v }
let totalMerit = 0;
let meritImportable = !fs.existsSync(MERIT_PATH);   // chỉ nhận dữ liệu cũ từ trình duyệt khi chưa từng có merit.json
try { const s = JSON.parse(fs.readFileSync(MERIT_PATH, 'utf8')); merit = s.merit || {}; totalMerit = Number(s.total) || 0; } catch { /* chưa có */ }
let meritDirty = false;
function saveMerit() {
  if (!meritDirty) return;
  meritDirty = false;
  try {
    const tmp = MERIT_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ merit, total: totalMerit }), 'utf8');
    fs.renameSync(tmp, MERIT_PATH);
  } catch (err) { console.warn('[công đức] không ghi được merit.json:', err.message); }
}
setInterval(saveMerit, 3000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveMerit(); process.exit(0); });

function resetMerit() {
  merit = {}; totalMerit = 0; meritDirty = true; meritImportable = false; saveMerit();
  broadcast({ type: 'reset-merit' });
}

const roster = new Map();    // id -> { id, name, t } theo thứ tự vào chùa; t = lần hoạt động gần nhất
function touchUser(u) {
  const r = roster.get(u.id);
  if (r) { r.name = u.name; r.t = Date.now(); return; }
  roster.set(u.id, { id: u.id, name: u.name, t: Date.now() });
  const max = Number(config.maxDevotees) || 320;
  while (roster.size > max) removeQuietest(0);   // quá đông: người ít hoạt động nhất ra về
}

// ---------- Người xem rời phòng ----------
// TikTok KHÔNG báo ai rời phòng. Ước lượng bằng 2 luật, máy chủ quyết định rồi báo mọi cửa sổ ("leave"):
//   1. Số nhân vật trong chùa không vượt quá số người đang xem (roomUser.total) → thừa thì người im lâu nhất ra về.
//   2. Im lặng (không vào, chat, thả tim, tặng quà…) quá "leaveAfterMinutes" phút (mặc định 10, 0 = tắt) → ra về.
const RECENT_MS = 60 * 1000;  // người vừa hoạt động trong 1 phút chắc chắn còn trong phòng → không mời ra
function leave(id) {
  const r = roster.get(id);
  if (!r) return;
  roster.delete(id);
  broadcast({ type: 'leave', user: { id: r.id, name: r.name } });
}
function removeQuietest(protectMs) {
  let old = null;
  for (const v of roster.values()) if (!old || v.t < old.t) old = v;
  if (!old || (protectMs && Date.now() - old.t < protectMs)) return false;
  leave(old.id);
  return true;
}
function fitToViewers(viewers) {
  if (!(viewers > 0)) return;   // 0 / thiếu số liệu: không đoán, để luật im lặng xử lý
  while (roster.size > viewers && removeQuietest(RECENT_MS)) { /* tiếp tục */ }
}
setInterval(() => {
  const min = Number(config.leaveAfterMinutes ?? 10);
  if (!(min > 0)) return;
  const cutoff = Date.now() - min * 60 * 1000;
  for (const v of [...roster.values()]) if (v.t < cutoff) leave(v.id);
}, 30 * 1000);

function findGift(g) {
  const n = String(g.name || '').toLowerCase().trim(), id = String(g.id || '');
  return (config.gifts || []).find(c => (c.names || []).some(x => String(x).toLowerCase() === n) || (c.ids || []).map(String).includes(id));
}
function giftPoints(g) {
  const count = Math.max(1, Number(g.count) || 1);
  const conf = findGift(g);
  if (conf) return (Number(conf.merit) || 0) * count;
  return Math.max(1, Math.round((Number(g.diamonds) || 1) * count * (Number(config.otherGift?.meritPerDiamond) || 1)));
}

// Mọi sự kiện người xem đi qua đây: cập nhật trạng thái chung rồi gửi cho tất cả cửa sổ
function emit(ev) {
  if (ev.user) touchUser(ev.user);
  if (ev.type === 'gift') {
    const pts = giftPoints(ev.gift || {});
    const m = merit[ev.user.id] || (merit[ev.user.id] = { name: ev.user.name, v: 0 });
    m.name = ev.user.name; m.v += pts; totalMerit += pts; meritDirty = true;
    ev.pts = pts; ev.userMerit = m.v; ev.total = totalMerit;
  }
  broadcast(ev);
}
function snapshot() {
  return { type: 'snapshot', merit, total: totalMerit, roster: [...roster.values()].map(({ id, name }) => ({ id, name })) };
}

function setStatus(state, extra = {}) {
  lastStatus = { type: 'status', state, username, ...extra };
  broadcast(lastStatus);
  console.log(`[trạng thái] ${state}${extra.message ? ' — ' + extra.message : ''}`);
}
function gameCount() { let n = 0; for (const c of wss.clients) if (c.role === 'game' && c.readyState === 1) n++; return n; }
wss.on('connection', ws => {
  ws.send(JSON.stringify(lastStatus));
  if (lastMusic) ws.send(JSON.stringify({ type: 'music-state', state: lastMusic }));
  ws.send(JSON.stringify({ type: 'version', v: CODE_VERSION }));
  ws.send(JSON.stringify(snapshot()));
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'hello' && m.role === 'game') ws.role = 'game';
    // trang game báo lỗi / thông tin trình duyệt (để dò lỗi trong LIVE Studio, OBS… nơi không mở được console)
    else if (m.type === 'client-log') {
      const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${String(m.host || '').slice(0, 60)} | ${String(m.text || '').slice(0, 600)}`;
      console.log('[trang game]', line);
      try { fs.appendFileSync(path.join(__dirname, 'client-log.txt'), line + '\n', 'utf8'); } catch { /* bỏ qua */ }
    }
    // 'emit' / 'reset-merit' qua WebSocket bị bỏ qua: trang game bản mới không gửi nữa (demo, phím tắt chỉ chạy tại chỗ).
    // Chặn ở đây để tab cũ chưa tải lại, hoặc máy khác trong mạng, không đẩy được người ảo / xoá bảng công đức.
    // Thử cho mọi cửa sổ cùng thấy: nút "Thử hiệu ứng" trong /admin (đi qua /api/cmd, có kiểm tra quyền).
    else if (m.type === 'emit' || m.type === 'reset-merit') { /* bỏ qua */ }
    else if (m.type === 'merit-import' && meritImportable && totalMerit === 0 && m.merit && typeof m.merit === 'object') {
      // chuyển Bảng Công Đức cũ (lưu trong trình duyệt) lên máy chủ — chỉ một lần
      meritImportable = false;
      for (const [id, v] of Object.entries(m.merit)) if (v && Number(v.v) > 0) merit[String(id).slice(0, 64)] = { name: String(v.name || 'Phật tử').slice(0, 24), v: Number(v.v) };
      totalMerit = Math.max(Number(m.total) || 0, Object.values(merit).reduce((a, x) => a + x.v, 0));
      meritDirty = true; saveMerit();
      broadcast({ type: 'merit-sync', merit, total: totalMerit });
      console.log('[công đức] đã chuyển Bảng Công Đức cũ từ trình duyệt lên máy chủ');
    }
    else if (m.type === 'music-state' && m.state && typeof m.state === 'object') {
      ws.role = 'game';
      lastMusic = m.state;
      broadcast({ type: 'music-state', state: lastMusic });
    }
  });
});

// ---------- Chuẩn hoá dữ liệu TikTok ----------
function mkUser(u = {}) {
  // tiktok-live-connector 2.x dùng proto v3: id / displayId / avatarThumb.urlList (bản cũ: userId / uniqueId / profilePicture)
  const pic = u.avatarThumb?.urlList?.[0] || u.profilePicture?.url?.[0] || u.profilePicture?.urls?.[0] || u.profilePictureUrl || '';
  const uid = u.displayId || u.uniqueId || '';
  return {
    id: String(u.id || u.userId || uid || u.nickname || Math.random()),
    uid,
    name: (u.nickname || uid || 'Phật tử').slice(0, 24),
    avatar: pic
  };
}

// ---------- Kết nối TikTok LIVE ----------
let conn = null;
let retryTimer = null;

async function connectTikTok() {
  clearTimeout(retryTimer);
  if (!username || username === 'ten_tiktok_cua_ban') {
    setStatus('no-username', { message: 'Chưa điền tiktokUsername trong config.json — đang chạy chế độ thử.' });
    return;
  }
  // Không tải danh sách quà lúc kết nối: bước này cần ký request qua gói Business của Euler Stream,
  // key miễn phí sẽ báo lỗi và chặn cả kết nối. Sự kiện quà đã có sẵn tên + số xu (giftDetails).
  const options = { enableExtendedGiftInfo: false };
  if (config.signApiKey) options.signApiKey = config.signApiKey;
  conn = new TikTokLiveConnection(username, options);
  wire(conn);
  setStatus('connecting', { message: `Đang kết nối @${username}…` });
  const mine = conn;
  try {
    const state = await mine.connect();
    if (mine !== conn) return; // đã đổi tên TikTok trong lúc đang kết nối
    setStatus('connected', { message: `Đã kết nối phòng ${state.roomId}` });
  } catch (err) {
    if (mine !== conn) return;
    setStatus('offline', { message: (err?.message || String(err)).slice(0, 200) + ' — thử lại sau 15 giây' });
    retryTimer = setTimeout(connectTikTok, 15000);
  }
}

// Đổi tên TikTok trong trang quản trị → bỏ kết nối cũ, kết nối lại
function reconnectTikTok() {
  clearTimeout(retryTimer);
  const old = conn;
  conn = null;
  if (old) { try { old.disconnect(); } catch { /* bỏ qua */ } }
  connectTikTok();
}

function wire(c) {
  c.on(WebcastEvent.MEMBER, d => emit({ type: 'join', user: mkUser(d.user) }));

  c.on(WebcastEvent.CHAT, d => emit({ type: 'chat', user: mkUser(d.user), text: String(d.content ?? d.comment ?? '').slice(0, 80) }));

  c.on(WebcastEvent.GIFT, d => {
    // proto v3: d.gift = { id, name, type, diamondCount, image.urlList } (bản cũ: d.giftDetails)
    const g = d.gift || d.giftDetails || {};
    const ext = d.extendedGiftInfo || {};
    const giftType = g.type ?? g.giftType;
    // Quà có combo (type 1): chỉ tính khi combo kết thúc để không cộng trùng
    if (giftType === 1 && !d.repeatEnd) return;
    emit({
      type: 'gift',
      user: mkUser(d.user),
      gift: {
        id: String(d.giftId || g.id || ''),
        name: g.name || g.giftName || ext.name || '',
        count: Number(d.repeatCount) || 1,
        diamonds: Number(g.diamondCount || ext.diamond_count) || 1,
        image: g.image?.urlList?.[0] || g.giftImage?.url?.[0] || ''
      }
    });
  });

  c.on(WebcastEvent.LIKE, d => emit({ type: 'like', user: mkUser(d.user), count: Number(d.count ?? d.likeCount) || 1 }));
  c.on(WebcastEvent.FOLLOW, d => emit({ type: 'follow', user: mkUser(d.user) }));
  c.on(WebcastEvent.SHARE, d => emit({ type: 'share', user: mkUser(d.user) }));
  // roomUser (vài giây/lần): "total" = số người ĐANG xem (TikTok bỏ "viewerCount"), "totalUser" = tổng lượt đã vào.
  // "ranks" = vài người xem top đang có mặt → coi như vẫn còn trong phòng.
  c.on(WebcastEvent.ROOM_USER, d => {
    lastViewers = Number(d.total ?? d.viewerCount) || 0;
    broadcast({ type: 'viewers', count: lastViewers });
    for (const r of d.ranks || []) { const v = roster.get(String(r.user?.id || '')); if (v) v.t = Date.now(); }
    fitToViewers(lastViewers);
  });

  c.on(WebcastEvent.STREAM_END, () => {
    if (c !== conn) return;
    setStatus('ended', { message: 'Live đã kết thúc — chờ live lại…' });
    retryTimer = setTimeout(connectTikTok, 30000);
  });
  c.on(ControlEvent.DISCONNECTED, () => {
    if (c !== conn) return;
    if (lastStatus.state === 'connected') {
      setStatus('offline', { message: 'Mất kết nối — thử lại sau 10 giây' });
      retryTimer = setTimeout(connectTikTok, 10000);
    }
  });
  c.on(ControlEvent.ERROR, e => console.error('[lỗi]', e?.info || e?.message || e));
}

// Cổng đã bị chiếm (thường do cửa sổ Chùa Online cũ vẫn đang chạy) → báo dễ hiểu thay vì lỗi dài
function onListenError(err) {
  if (err?.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  ⚠️  Cổng ${PORT} đang được dùng — Chùa Online (hoặc chương trình khác) ĐANG CHẠY ở một cửa sổ khác.`);
    console.error('      • Nếu đã có cửa sổ đen Chùa Online khác: dùng luôn cửa sổ đó, hoặc đóng nó rồi chạy lại file này.');
    console.error('      • Không thấy cửa sổ nào: mở Task Manager → tab Details → tắt "node.exe", rồi chạy lại.');
    console.error(`      • Hoặc đổi "port" trong config.json (ví dụ 8081) và dùng link http://localtest.me:8081/?clean=1`);
    console.error('');
  } else {
    console.error('[lỗi máy chủ]', err?.message || err);
  }
  process.exit(1);
}
server.on('error', onListenError);
wss.on('error', onListenError);   // WebSocketServer phát lại lỗi của server; không bắt thì Node in lỗi dài và thoát

server.listen(PORT, () => {
  console.log('');
  console.log('  🙏  Chùa Online đang chạy');
  console.log(`  ➜  Link cho LIVE Studio: http://localtest.me:${PORT}/?clean=1`);
  console.log(`  ➜  Chạy thử (giả lập người xem): http://localtest.me:${PORT}/?demo=1`);
  console.log(`  ➜  Trang quản trị:  http://localtest.me:${PORT}/admin`);
  console.log('');
  connectTikTok();
});
