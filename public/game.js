/* Chùa Online — màn hình game cho TikTok LIVE (canvas 720×1280)
 * Phím tắt khi test:  J = người vào · C = chat · 1..8 = quà · D = bật/tắt giả lập · Shift+R = xoá bảng công đức
 *                   M = tắt/bật nhạc nền · N = bài tiếp theo
 * Tham số URL: ?demo=1 (giả lập người xem) · ?q=1.5 (xuất 1080×1920) · ?clean=1 (ẩn dòng trạng thái)
 *              ?music=0 (tắt nhạc nền) · ?yt=<link YouTube> (phát thử 1 link)
 */
(() => {
'use strict';

// ------------------------------------------------------------------ báo lỗi về máy chủ (ghi vào client-log.txt)
// Để dò lỗi trong LIVE Studio / OBS, nơi không mở được console của trình duyệt.
const pendingLogs = [];
let logWs = null;
let lastLogText = '', sameLogCount = 0;
function clientLog(text) {
  text = String(text).slice(0, 600);
  if (text === lastLogText && ++sameLogCount > 3) return;   // lỗi lặp mỗi khung hình → chỉ gửi vài lần
  if (text !== lastLogText) { lastLogText = text; sameLogCount = 0; }
  const ws = logWs;
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'client-log', host: location.host, text }));
  else if (pendingLogs.length < 20) pendingLogs.push(text);
}
addEventListener('error', e => clientLog('lỗi: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno));
addEventListener('unhandledrejection', e => clientLog('lỗi promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));

// ------------------------------------------------------------------ cấu hình
const DEFAULT_CONFIG = {
  title: 'Chùa Online', maxDevotees: 320, sound: true, likeBowEvery: 15, chatBubbles: true,
  gifts: [
    { names: ['rose', 'hoa hồng'], label: 'Hoa hồng', action: 'Thắp nén hương', effect: 'incense', icon: '🌹', merit: 1 },
    { names: ['tiktok'], label: 'TikTok', action: 'Thắp nén hương', effect: 'incense', icon: '🎵', merit: 1, hidden: true },
    { names: ['finger heart', 'tim ngón tay'], label: 'Tim ngón tay', action: 'Thắp nến', effect: 'candle', icon: '🫰', merit: 5 },
    { names: ['rosa', 'bouquet', 'flower', 'bó hoa', 'perfume'], label: 'Bó hoa', action: 'Dâng hoa sen', effect: 'lotus', icon: '💐', merit: 10 },
    { names: ['doughnut', 'donut', 'bánh donut'], label: 'Bánh donut', action: 'Thỉnh chuông', effect: 'bell', icon: '🍩', merit: 10 },
    { names: ['hand hearts', 'tay bắn tim'], label: 'Tay bắn tim', action: 'Dâng mâm ngũ quả', effect: 'fruit', icon: '🫶', merit: 20 },
    { names: ['corgi', 'chó corgi'], label: 'Chó Corgi', action: 'Phóng sinh cá chép', effect: 'koi', icon: '🐕', merit: 49 },
    { names: ['money gun', 'súng tiền'], label: 'Súng tiền', action: 'Thả hoa đăng', effect: 'lantern', icon: '💸', merit: 99 },
    { names: ['lion', 'sư tử'], label: 'Sư tử', action: 'Rồng Vàng hộ pháp', effect: 'dragon', icon: '🦁', merit: 299 }
  ],
  otherGift: { action: 'Dâng lễ', effect: 'incense', meritPerDiamond: 1 },
  // {name} = người tặng · {gift} = biểu tượng + tên quà (+ ×số lượng) · {action} = hành động lễ
  thankYou: '{name} đã {action}',
  tts: true, ttsVolume: 1, ttsMaxQueue: 5, ttsGap: 2, ttsRate: 1.25, ttsPrefix: 'Xin cảm ơn',
  music: { enabled: true, youtube: [], volume: 30, duckVolume: 10, shuffle: false }
};
let CFG = DEFAULT_CONFIG;
const EFFECT_ICON = { incense: '🔥', candle: '🕯️', lotus: '🌸', bell: '🔔', fruit: '🍑', koi: '🐟', lantern: '🏮', dragon: '🐉' };

const params = new URLSearchParams(location.search);
// Độ phân giải vẽ: ?q=1.5 để ép cố định; bỏ trống thì tự khớp kích thước khung hiển thị (không bị mờ khi phóng to)
const Q_FIXED = parseFloat(params.get('q')) || 0;
function autoQ() {
  if (Q_FIXED) return Math.min(3, Math.max(0.5, Q_FIXED));
  const dpr = window.devicePixelRatio || 1;
  const shown = Math.min(innerHeight, innerWidth * 1280 / 720) * dpr;   // chiều cao canvas thực sự hiện ra
  return Math.min(3, Math.max(1, Math.ceil(shown / 1280 * 4) / 4));
}
let Q = autoQ();
const CLEAN = params.has('clean');
let demoOn = params.get('demo') === '1' || window.FORCE_DEMO === true;

// ------------------------------------------------------------------ canvas
const W = 720, H = 1280;
const cvs = document.getElementById('c');
cvs.width = W * Q; cvs.height = H * Q;
const ctx = cvs.getContext('2d');
const FONT = '"Be Vietnam Pro", "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// Sprite phát sáng & khói vẽ sẵn
function radialSprite(size, stops) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
const SMOKE = radialSprite(128, [[0, 'rgba(255,255,255,0.55)'], [0.4, 'rgba(240,235,230,0.25)'], [1, 'rgba(230,225,220,0)']]);
const GLOW = radialSprite(128, [[0, 'rgba(255,240,180,1)'], [0.25, 'rgba(255,190,80,0.6)'], [1, 'rgba(255,140,30,0)']]);
const PINKGLOW = radialSprite(128, [[0, 'rgba(255,230,240,1)'], [0.3, 'rgba(255,150,200,0.5)'], [1, 'rgba(255,120,180,0)']]);

// ------------------------------------------------------------------ không gian phối cảnh
// Hình học khớp với ảnh nền assets/nen_chua_rong.png (941×1672, cùng tỉ lệ canvas 720×1280):
// lư hương ở y≈710–790, thảm đỏ bắt đầu ở y≈790 và rộng dần tới ±254px ở đáy, sàn trống từ y≈800.
const CX = 360;
const FLOOR_TOP = 800, FLOOR_BOT = 1230;
const carpetHalf = y => 32 + (y - 788) * 0.451;
const scaleAt = y => 0.5 + (y - FLOOR_TOP) / (FLOOR_BOT - FLOOR_TOP) * 0.65;
const CENSER = { x: CX, y: 700 };        // chỗ khói nhang bốc lên
const BELL = { x: 532, y: 672 };         // chuông trong ảnh nền (để vẽ sóng âm)

// ------------------------------------------------------------------ ảnh (nền + sprite nhân vật)
const ASSET_DIR = 'assets/';
const CHARACTERS = ['cuba', 'cuong', 'aodaitrang', 'aodaido', 'changtrai', 'suthay', 'suco', 'kinhbac', 'betrai', 'begai', 'phattu'];
const POSES = ['ngoi', 'lay', 'di'];          // ngồi · lạy · đi
const SPRITE_PX = Q > 1.25 ? 512 : 256;       // thu nhỏ sẵn từ 512 khi màn nhỏ để vẽ nhanh, nét hơn khi giảm
const SPR = {};                               // SPR[nhân vật][tư thế] = canvas
let BG = null;
const FX_NAMES = ['cachep_do', 'cachep_trang', 'cachep_vang', 'canhsen', 'hoadang_giay', 'hoadang_sen', 'hoasen_no', 'ngocrong', 'rongvang'];
const FXI = {};                               // FXI[tên] = ảnh hiệu ứng quà
const KOI_IMGS = ['cachep_do', 'cachep_trang', 'cachep_vang'];
const LANTERN_IMGS = ['hoadang_giay', 'hoadang_sen'];

function loadImage(name) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => { console.warn('Không tải được ảnh', name); res(null); };
    im.src = ASSET_DIR + name;
  });
}
function prescale(im, w, h) {
  const c = mkCanvas(w, h), g = c.getContext('2d');
  g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
  return c;
}
let BG_IMG = null;
function buildBG() {
  const c = mkCanvas(W * Q, H * Q), g = c.getContext('2d');
  if (BG_IMG) { g.imageSmoothingQuality = 'high'; g.drawImage(BG_IMG, 0, 0, W * Q, H * Q); }
  else { g.fillStyle = '#3b0f06'; g.fillRect(0, 0, c.width, c.height); }
  BG = c;
}
// khung hiển thị đổi kích thước (vd. đặt Custom resolution trong LIVE Studio) → vẽ lại đúng độ nét
let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const q = autoQ(); if (q === Q) return;
    Q = q; cvs.width = W * Q; cvs.height = H * Q; buildBG();
  }, 200);
});
async function loadAssets() {
  const jobs = [];
  for (const ch of CHARACTERS) {
    SPR[ch] = {};
    for (const po of POSES) jobs.push(loadImage(`${ch}_${po}.png`).then(im => { if (im) SPR[ch][po] = prescale(im, SPRITE_PX, SPRITE_PX); }));
  }
  const bg = loadImage('nen_chua_rong.png').then(im => { BG_IMG = im; buildBG(); });
  // ảnh hiệu ứng quà (assets/fx/)
  const fxJobs = FX_NAMES.map(n => loadImage(`fx/${n}.png`).then(im => { if (im) FXI[n] = im; }));
  await Promise.all([...jobs, bg, ...fxJobs]);
}
// vẽ ảnh căn giữa tại (x, y), chiều rộng w (giữ tỉ lệ ảnh)
function drawImg(g, im, x, y, w) { const h = w * im.height / im.width; g.drawImage(im, x - w / 2, y - h / 2, w, h); }
function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#8a4d0e'); gr.addColorStop(0.3, '#e0a63a'); gr.addColorStop(0.5, '#fff0a8');
  gr.addColorStop(0.7, '#e3a83c'); gr.addColorStop(1, '#7d4209');
  return gr;
}

function drawFruitPile(g, x, y, s) {
  const fr = [['#f5a623', -16, 0, 9], ['#7cbf3a', 0, -2, 10], ['#e8442a', 15, 0, 9], ['#f7d23e', -8, -12, 8], ['#f08a24', 8, -13, 8], ['#9bd04a', 0, -22, 7]];
  fr.forEach(([col, dx, dy, r]) => {
    const gr = g.createRadialGradient(x + dx * s - r * s * 0.3, y + dy * s - r * s * 0.3, 1, x + dx * s, y + dy * s, r * s);
    gr.addColorStop(0, '#fff6d8'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gr; g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
  });
}

// ------------------------------------------------------------------ âm thanh
let AC = null;
function audio() {
  if (!CFG.sound) return null;
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; }
  return AC;
}
function bellSound(base = 196, vol = 0.35, dur = 5) {
  const a = audio(); if (!a) return;
  const t = a.currentTime, out = a.createGain(); out.gain.value = vol; out.connect(a.destination);
  [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12], [1.5, 0.3]].forEach(([m, v]) => {
    const o = a.createOscillator(), gn = a.createGain();
    o.type = 'sine'; o.frequency.value = base * m;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(v, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur / (m * 0.6 + 0.4));
    o.connect(gn); gn.connect(out); o.start(t); o.stop(t + dur);
  });
}
function chime() { bellSound(880, 0.08, 1.6); }
function woodBlock() {
  const a = audio(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), gn = a.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.08);
  gn.gain.setValueAtTime(0.12, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(gn); gn.connect(a.destination); o.start(t); o.stop(t + 0.15);
}
addEventListener('pointerdown', () => audio());

// Giọng đọc: phát mp3 từ máy chủ (/tts), nếu lỗi thì dùng giọng có sẵn của trình duyệt
const ttsQueue = [];
let ttsBusy = false;
function speak(text) {
  if (!CFG.tts || !CFG.sound) return;
  text = String(text).replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return;
  ttsQueue.push(text);
  while (ttsQueue.length > (CFG.ttsMaxQueue || 5)) ttsQueue.shift();
  if (!ttsBusy) nextSpeech();
}
function nextSpeech() {
  const text = ttsQueue.shift();
  if (!text) { ttsBusy = false; window.BgMusic?.duck(false); return; }
  ttsBusy = true;
  window.BgMusic?.duck(true);   // hạ nhỏ nhạc nền khi đọc lời cảm ơn
  let done = false;
  const finish = () => { if (done) return; done = true; setTimeout(nextSpeech, (CFG.ttsGap ?? 2) * 1000); };
  const guard = setTimeout(finish, 15000);
  const end = () => { clearTimeout(guard); finish(); };
  let fellBack = false;
  const browserVoice = () => {
    if (fellBack || done) return; fellBack = true;
    if (!window.speechSynthesis) return end();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN'; u.volume = CFG.ttsVolume ?? 1; u.rate = CFG.ttsRate ?? 1.25;
    const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith('vi'));
    if (v) u.voice = v;
    u.onend = u.onerror = end;
    speechSynthesis.speak(u);
  };
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return browserVoice();
  const el = new Audio('/tts?text=' + encodeURIComponent(text));
  el.volume = Math.max(0, Math.min(1, CFG.ttsVolume ?? 1));
  el.preservesPitch = true; el.playbackRate = CFG.ttsRate ?? 1.25;
  el.onended = end;
  el.onerror = browserVoice;
  el.play().catch(browserVoice);
}

// ------------------------------------------------------------------ dữ liệu & lưu trữ
const STORE_KEY = 'chua-online-v1';
let merit = {};        // id -> {name, v}
let totalMerit = 0;
function loadStore() {
  try {
    if (params.has('reset')) localStorage.removeItem(STORE_KEY);
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s) { merit = s.merit || {}; totalMerit = s.total || 0; }
  } catch (e) { /* bỏ qua */ }
}
// Có máy chủ thì máy chủ giữ Bảng Công Đức (merit.json) cho mọi cửa sổ; localStorage chỉ dùng khi chạy không có máy chủ
let serverSync = false;
function saveStore() { if (serverSync) return; try { localStorage.setItem(STORE_KEY, JSON.stringify({ merit, total: totalMerit })); } catch (e) { /* bỏ qua */ } }
setInterval(saveStore, 5000);
function topMerit(n = 5) { return Object.values(merit).sort((a, b) => b.v - a.v).slice(0, n); }

// ------------------------------------------------------------------ chỗ ngồi
const seats = [];
// Thứ tự lấp chỗ (tier): 0 = sàn hai bên thảm → 1 = trên thảm → 2 = chỗ chen giữa các hàng (ngồi chồng lên nhau).
// Chỗ tier 0/1 giãn đủ để không chồng nhau; tier 2 nằm giữa hai hàng, chỉ dùng khi đã kín hết.
// Trên thảm chừa lối đi hẹp ở giữa (±LANE·s); gần lư hương (y < OFFER_ZONE_Y) để trống thảm cho người lên dâng lễ.
const OFFER_ZONE_Y = 875, ROW_GAP = 43, LANE = 30;
function addSeatRow(y, tier, shift) {
  const s = scaleAt(y), step = 52 * s, edge = carpetHalf(y) + 30 * s;
  for (const side of [-1, 1]) {
    for (let k = 0; ; k++) {                       // sàn: từ mép thảm ra tường
      const x = CX + side * (edge + (k + shift) * step);
      if (x < 14 || x > W - 14) break;
      seats.push({ x, y, side, k, tier, taken: null });
    }
    if (y < OFFER_ZONE_Y) continue;
    for (let k = 0; ; k++) {                       // thảm: từ mép thảm vào lối đi giữa
      const off = edge - (k + 1 - shift) * step;
      if (off < LANE * s) break;
      seats.push({ x: CX + side * off, y, side, k, tier: tier === 0 ? 1 : 2, taken: null });
    }
  }
}
for (let r = 0; r < 11; r++) {
  addSeatRow(FLOOR_TOP + r * ROW_GAP, 0, r % 2 ? 0.35 : 0);
  if (r < 10) addSeatRow(FLOOR_TOP + (r + 0.5) * ROW_GAP, 2, r % 2 ? 0.85 : 0.5);
}

// ------------------------------------------------------------------ phật tử (nhân vật)
const devotees = new Map();
let seq = 0;

class Devotee {
  constructor(user) {
    this.id = user.id; this.name = user.name;
    this.char = CHARACTERS[hash(user.id + user.name) % CHARACTERS.length];
    this.seat = null; this.x = CX + rand(-30, 30); this.y = H + 40;
    this.actions = []; this.pose = 'stand'; this.walkPh = 0;
    this.bow = 0; this.bowT = 0; this.nextIdleBow = rand(5, 20);
    this.bubble = null; this.alpha = 0; this.leaving = false; this.lastActive = performance.now(); this.order = seq++;
    this.likes = 0; this.busy = false;
  }
  get s() { return scaleAt(this.y); }
  // đi theo lối hẹp giữa thảm (giữa hai dãy ngồi trên thảm)
  aisleX() { return CX + (this.seat ? this.seat.side : 1) * 9 * scaleAt(this.seat ? this.seat.y : this.y); }
  goSeat() {
    const ax = this.aisleX();
    this.actions.push({ t: 'go', x: ax, y: this.seat.y + 2 }, { t: 'go', x: this.seat.x, y: this.seat.y });
  }
  offer(onArrive) {
    if (this.busy || this.leaving) { onArrive && onArrive(); return; }
    this.busy = true;
    const ax = this.aisleX();
    const startedAtSeat = this.actions.length === 0;
    if (startedAtSeat) this.actions.push({ t: 'go', x: ax, y: this.y });
    this.actions.push({ t: 'go', x: CX + rand(-30, 30), y: 822 + rand(0, 20) }, { t: 'call', fn: onArrive }, { t: 'bow', d: 1.3 }, { t: 'bow', d: 1.3 });
    this.actions.push({ t: 'call', fn: () => { this.busy = false; } });
    this.goSeat();
  }
  // Người xem đã rời phòng: đứng dậy, bước ra lối giữa thảm, đi xuống rồi mờ dần. Nhường chỗ ngay.
  exit() {
    if (this.exiting || this.leaving) return;
    this.exiting = true; this.busy = true; this.bubble = null;
    if (this.seat) { this.seat.taken = null; this.seat = null; }
    const ax = CX + (this.x < CX ? -9 : 9) * this.s;
    this.actions = [
      { t: 'go', x: ax, y: this.y },
      { t: 'call', fn: () => { this.leaving = true; } },
      { t: 'go', x: ax, y: Math.min(H + 40, this.y + 160) }
    ];
  }
  doBow() { if (this.bowT <= 0) this.bowT = 1.3; }
  say(text) { this.bubble = { text, t: 6 }; this.lastActive = performance.now(); }
  update(dt) {
    this.alpha = clamp(this.alpha + (this.leaving ? -dt * 1.5 : dt * 2), 0, 1);
    if (this.bubble && (this.bubble.t -= dt) <= 0) this.bubble = null;
    const a = this.actions[0];
    if (a) {
      if (a.t === 'go') {
        const dx = a.x - this.x, dy = a.y - this.y, d = Math.hypot(dx, dy), sp = 150 * Math.max(0.55, this.s) * dt;
        this.pose = 'stand'; this.walkPh += dt * 9;
        if (d <= sp) { this.x = a.x; this.y = a.y; this.actions.shift(); } else { this.x += dx / d * sp; this.y += dy / d * sp; }
      } else if (a.t === 'bow') {
        this.pose = 'sit';
        a.e = (a.e || 0) + dt; this.bow = Math.sin(clamp(a.e / a.d, 0, 1) * Math.PI);
        if (a.e >= a.d) { this.bow = 0; this.actions.shift(); if (Math.random() < 0.5) woodBlock(); }
      } else if (a.t === 'call') { this.actions.shift(); a.fn && a.fn(); }
    } else {
      this.pose = 'sit';
      this.nextIdleBow -= dt;
      if (this.nextIdleBow <= 0) { this.doBow(); this.nextIdleBow = rand(8, 26); }
      if (this.bowT > 0) { this.bowT -= dt; this.bow = Math.sin(clamp(1 - this.bowT / 1.3, 0, 1) * Math.PI); } else this.bow = 0;
    }
    if (this.exiting && !this.actions.length) this.leaving = true;
    if (this.leaving && this.alpha <= 0) {
      if (this.seat) this.seat.taken = null;
      if (devotees.get(this.id) === this) devotees.delete(this.id);   // người đó có thể đã quay lại (nhân vật mới cùng id)
    }
  }
  draw(g) {
    const s = this.s, x = this.x, y = this.y, b = this.bow, spr = SPR[this.char] || {};
    const F = 80 * s;                          // cạnh khung sprite 512 khi vẽ lên canvas
    g.save(); g.globalAlpha = this.alpha;
    if (this.pose === 'sit') {
      const blend = clamp((b - 0.3) / 0.25, 0, 1);   // ngồi → lạy mượt khi đang cúi
      const dx = x - F / 2, dy = y + 4 * s - F;
      if (blend < 1 && spr.ngoi) g.drawImage(spr.ngoi, dx, dy, F, F);
      if (blend > 0 && spr.lay) { g.globalAlpha = this.alpha * blend; g.drawImage(spr.lay, dx, dy, F, F); }
      this.headTop = dy + F * lerp(0.03, 0.12, blend);
    } else {
      const bob = Math.abs(Math.sin(this.walkPh)) * 2.5 * s;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y, 15 * s, 4.5 * s, 0, 0, Math.PI * 2); g.fill();
      g.translate(x, y); g.rotate(Math.sin(this.walkPh) * 0.04);
      if (spr.di) g.drawImage(spr.di, -F / 2, 2 * s - F - bob, F, F);
      this.headTop = y + 2 * s - F - bob + F * 0.03;
    }
    g.restore();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function freeSeat(id = '') {
  const free = seats.filter(s => !s.taken);
  if (!free.length) return null;
  // lấp hết tier thấp rồi mới sang tier cao (hai bên → thảm → chen); trong cùng tier ưu tiên gần mép thảm.
  // Phần "ngẫu nhiên" tính từ id người xem → mọi cửa sổ xếp cùng một người vào cùng một chỗ.
  let best = null, bs = 1e9;
  for (const s of free) { const sc = s.tier * 1000 + s.k + (hash(id + '@' + Math.round(s.x) + ',' + Math.round(s.y)) % 800) / 100; if (sc < bs) { bs = sc; best = s; } }
  return best;
}
// Cửa sổ mới mở / vừa kết nối lại: cho những người đã có trong chùa ngồi sẵn vào chỗ (không đi bộ, không thông báo)
function seatInstant(user) {
  const cur = devotees.get(user.id);
  if (cur && !cur.leaving && !cur.exiting) return;
  const { d } = ensureDevotee(user);
  if (!d || !d.seat) return;
  d.actions = []; d.x = d.seat.x; d.y = d.seat.y; d.pose = 'sit'; d.alpha = 1;
}
function ensureDevotee(user) {
  let d = devotees.get(user.id);
  if (d && !d.leaving && !d.exiting) { d.name = user.name || d.name; d.lastActive = performance.now(); return { d, isNew: false }; }
  // quá đông: mời người ít hoạt động nhất ra về
  const active = [...devotees.values()].filter(v => !v.leaving);
  if (active.length >= CFG.maxDevotees || !freeSeat(user.id)) {
    const old = active.filter(v => !v.busy).sort((a, b) => a.lastActive - b.lastActive)[0];
    if (old) { old.leaving = true; if (old.seat) { old.seat.taken = null; old.seat = null; } }
  }
  const seat = freeSeat(user.id);
  if (!seat) return { d: null, isNew: false };
  d = new Devotee(user); d.seat = seat; seat.taken = d; d.goSeat();
  devotees.set(user.id, d);
  return { d, isNew: true };
}

// ------------------------------------------------------------------ hiệu ứng
const fx = {
  smoke: [], flames: [], petals: [], coins: [], koi: [], lanterns: [], floats: [], rings: [], sparks: [],
  candles: [], fruits: [], lotus: null, dragon: null, bellA: 0, bellV: 0, glow: 0, shake: 0, bigText: null
};
const CANDLE_SLOTS = Array.from({ length: 12 }, (_, i) => ({ x: 270 + i * 16.4, y: 706 }));
const FRUIT_SLOTS = [[282, 694], [438, 694], [246, 742], [474, 742], [205, 778], [515, 778], [160, 806], [560, 806]];

function smokeBurst(n) {
  for (let i = 0; i < n; i++) fx.smoke.push({ x: CX + rand(-26, 26), y: CENSER.y + rand(-6, 6), vx: rand(-8, 8), vy: rand(-70, -40), r: rand(10, 20), life: 0, max: rand(3, 5.5), a: rand(0.5, 0.9) });
}
const EFFECTS = {
  incense(n) { smokeBurst(30 * Math.min(n, 6)); fx.glow = Math.max(fx.glow, 0.25); for (let i = 0; i < 20; i++) fx.sparks.push(spark(CX + rand(-30, 30), CENSER.y, '#ffb347')); },
  candle(n) {
    for (let i = 0; i < Math.min(n, 10) * 2; i++) {
      const slot = CANDLE_SLOTS.find(s => !fx.candles.some(c => c.slot === s));
      if (slot) fx.candles.push({ slot, life: 120, h: rand(10, 16) }); else fx.candles.sort((a, b) => a.life - b.life)[0].life = 120;
    }
    for (let i = 0; i < 40; i++) fx.sparks.push(spark(rand(270, 450), 700, '#ffd27a'));
    fx.glow = Math.max(fx.glow, 0.35);
  },
  lotus(n) { fx.lotus = { t: 0, dur: 4 + Math.min(n, 5) }; for (let i = 0; i < 40 + n * 10; i++) fx.petals.push(petal()); chime(); },
  bell(n) { fx.bellV += 2.6; bellSound(); fx.rings.push({ x: BELL.x, y: BELL.y, t: 0 }, { x: BELL.x, y: BELL.y, t: -0.35 }, { x: BELL.x, y: BELL.y, t: -0.7 }); if (n > 1) setTimeout(() => { fx.bellV -= 2.2; bellSound(); }, 1600); },
  fruit(n) {
    for (let i = 0; i < Math.min(n, 4); i++) {
      const slot = FRUIT_SLOTS.find(s => !fx.fruits.some(f => f.slot === s));
      if (slot) fx.fruits.push({ slot, life: 180, t: 0 }); else { const o = fx.fruits.sort((a, b) => a.life - b.life)[0]; o.life = 180; o.t = 0; }
    }
    fx.glow = Math.max(fx.glow, 0.4); chime();
  },
  koi(n) { for (let i = 0; i < 4 + Math.min(n, 4) * 2; i++) fx.koi.push(koi(i * 0.35)); chime(); },
  lantern(n) { for (let i = 0; i < 30 + Math.min(n, 5) * 10; i++) fx.lanterns.push(lantern(i * 0.12)); fx.glow = Math.max(fx.glow, 0.5); bellSound(392, 0.12, 3); },
  dragon() {
    fx.dragon = { t: 0, trail: [] }; fx.glow = 1.2; fx.shake = 0.6;
    for (let i = 0; i < 90; i++) fx.coins.push(coin(i * 0.04));
    fx.bigText = { text: '✦ ĐẠI CÔNG ĐỨC ✦', t: 0 };
    bellSound(130, 0.45, 7); setTimeout(() => bellSound(196, 0.3, 5), 900);
  }
};
function spark(x, y, col) { return { x, y, vx: rand(-60, 60), vy: rand(-160, -40), life: 0, max: rand(0.6, 1.4), col }; }
function petal() { return { x: rand(-20, W + 20), y: rand(-200, -10), vx: rand(-20, 20), vy: rand(60, 130), rot: rand(0, 6), vr: rand(-3, 3), s: rand(5, 10), life: 0, max: 9, col: pick(['#ffb3cc', '#ff8fb3', '#ffd1e0', '#ffe6ef', '#f7a1c4']) }; }
function coin(delay) { return { x: rand(40, W - 40), y: rand(-300, -20), vy: rand(150, 260), vx: rand(-20, 20), spin: rand(0, 6), vs: rand(4, 9), r: rand(8, 13), delay, life: 0 }; }
function koi(delay) {
  const sx = rand(80, W - 80);
  return { x: sx, y: H + rand(20, 120), tx: CX + rand(-140, 140), ty: rand(860, 1000), ph: rand(0, 6), delay, life: 0, max: rand(6, 8), col: pick(['#ff7a1a', '#ffb02e', '#ffd84a', '#ff5a2a', '#fff3e0']), s: rand(0.8, 1.25), img: pick(KOI_IMGS) };
}
function lantern(delay) { return { x: rand(20, W - 20), y: H + rand(10, 260), vy: rand(45, 85), sway: rand(0, 6), s: rand(0.7, 1.3), delay, life: 0, img: pick(LANTERN_IMGS) }; }

// ------------------------------------------------------------------ thông báo
const banners = [];
function banner(text, kind = 'join') {
  if (kind === 'join') {
    const joins = banners.filter(b => b.kind === 'join' && b.t < 2.5);
    if (joins.length >= 2) { joins[0].text = text; joins[0].t = 0.3; return; }
  }
  banners.push({ text, kind, t: 0, dur: kind === 'join' ? 3.2 : kind === 'big' ? 6 : 4.8 });
  while (banners.length > 4) banners.shift();
}
function floatText(x, y, text, col = '#ffe08a') { fx.floats.push({ x, y, text, col, t: 0 }); }

// ------------------------------------------------------------------ xử lý sự kiện
function findGift(g) {
  const n = String(g.name || '').toLowerCase().trim(), id = String(g.id || '');
  return CFG.gifts.find(c => (c.names || []).some(x => x.toLowerCase() === n) || (c.ids || []).map(String).includes(id));
}
function fallbackEffect(diamonds) {
  return diamonds >= 1000 ? 'dragon' : diamonds >= 500 ? 'lantern' : diamonds >= 200 ? 'koi' : diamonds >= 99 ? 'fruit' : diamonds >= 30 ? 'bell' : diamonds >= 10 ? 'lotus' : diamonds >= 5 ? 'candle' : 'incense';
}

function handle(ev) {
  if (!ev || !ev.type) return;
  if (ev.type === 'status') { status = ev; statusT = 0; return; }
  // máy chủ chạy lại với code mới → tự tải lại trang (LIVE Studio / OBS không cần bấm Refresh)
  if (ev.type === 'version') { if (codeVersion && ev.v !== codeVersion) location.reload(); codeVersion = ev.v; return; }
  // lệnh từ trang quản trị (/admin)
  if (ev.type === 'config') { loadConfig().then(() => window.BgMusic?.reload(CFG)); return; }
  if (ev.type === 'music') { window.BgMusic?.command(ev.action, ev.value); return; }
  if (ev.type === 'reset-merit') { merit = {}; totalMerit = 0; saveStore(); return; }
  if (ev.type === 'music-state') return;
  // trạng thái chung từ máy chủ (gửi khi vừa kết nối) → mọi cửa sổ giống nhau
  if (ev.type === 'snapshot') { applySnapshot(ev); return; }
  // máy chủ báo người xem đã rời phòng (ước lượng theo số người xem / im lặng lâu)
  if (ev.type === 'leave') { devotees.get(ev.user?.id)?.exit(); return; }
  if (ev.type === 'merit-sync') { merit = ev.merit || {}; totalMerit = ev.total || 0; return; }
  const user = ev.user;
  if (ev.type === 'join') {
    const { isNew } = ensureDevotee(user);
    if (isNew) banner(`${user.name} vừa vào chùa`, 'join');
  } else if (ev.type === 'chat') {
    const { d, isNew } = ensureDevotee(user);
    if (isNew) banner(`${user.name} vừa vào chùa`, 'join');
    if (d && CFG.chatBubbles) d.say(ev.text);
  } else if (ev.type === 'like') {
    const { d } = ensureDevotee(user);
    if (d) { d.likes += ev.count || 1; if (d.likes >= (CFG.likeBowEvery || 15)) { d.likes = 0; d.doBow(); } else if (Math.random() < 0.3) d.doBow(); }
  } else if (ev.type === 'follow') {
    ensureDevotee(user); banner(`${user.name} đã theo dõi chùa 🙏`, 'follow');
    for (let i = 0; i < 20; i++) fx.petals.push(petal());
  } else if (ev.type === 'share') {
    ensureDevotee(user); banner(`${user.name} đã chia sẻ chùa`, 'follow');
  } else if (ev.type === 'gift') {
    gift(user, ev.gift || {}, ev);
  }
}

function applySnapshot(s) {
  // Bảng Công Đức cũ còn trong trình duyệt (bản trước lưu ở localStorage) → chuyển lên máy chủ một lần
  if (!serverSync && !(s.total > 0) && totalMerit > 0 && gameWs && gameWs.readyState === 1) {
    gameWs.send(JSON.stringify({ type: 'merit-import', merit, total: totalMerit }));
  }
  serverSync = true;
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* bỏ qua */ }
  merit = s.merit || {}; totalMerit = s.total || 0;
  // máy chủ là nguồn gốc: ai không còn trong danh sách của máy chủ (đã ra về lúc cửa sổ mất kết nối,
  // hoặc máy chủ vừa khởi động lại) thì cho ra về; ai có trong danh sách mà cửa sổ chưa có thì ngồi sẵn
  const ids = new Set((s.roster || []).map(u => u.id));
  if (!demoOn) for (const d of devotees.values()) if (!ids.has(d.id)) d.exit();
  for (const u of s.roster || []) seatInstant(u);
}

// Sự kiện tạo trong trang (phím tắt, giả lập): CHỈ chạy trong chính cửa sổ này, không gửi lên máy chủ.
// Nhờ vậy cửa sổ demo/thử không bao giờ đẩy người ảo sang màn hình đang live, cũng không cộng vào merit.json.
// Muốn thử cho mọi cửa sổ cùng thấy: dùng nút "Thử hiệu ứng" trong /admin.
function emitLocal(ev) { handle(ev); }
// Shift+R trong cửa sổ thử: chỉ xoá bảng hiển thị ở cửa sổ này. Xoá Bảng Công Đức thật: nút trong /admin.
function resetMeritAll() { merit = {}; totalMerit = 0; saveStore(); }

function gift(user, g, ev = {}) {
  const count = Math.max(1, g.count || 1);
  const conf = findGift(g);
  const label = conf ? conf.label : (g.name || 'quà');
  const action = conf ? conf.action : CFG.otherGift.action;
  const effect = conf ? conf.effect : (CFG.otherGift.effect === 'auto' ? fallbackEffect(g.diamonds || 1) : fallbackEffect(g.diamonds || 1));
  const icon = conf ? conf.icon : '🎁';
  const fromServer = typeof ev.pts === 'number';
  const pts = fromServer ? ev.pts : conf ? conf.merit * count : Math.max(1, Math.round((g.diamonds || 1) * count * (CFG.otherGift.meritPerDiamond || 1)));

  const m = merit[user.id] || (merit[user.id] = { name: user.name, v: 0 });
  m.name = user.name;
  if (fromServer) { m.v = ev.userMerit; totalMerit = ev.total; }   // máy chủ đã cộng sẵn → các cửa sổ không lệch nhau
  else { m.v += pts; totalMerit += pts; }

  const giftTxt = `${icon} ${label}${count > 1 ? ' ×' + count : ''}`;
  const txt = String(CFG.thankYou || DEFAULT_CONFIG.thankYou)
    .replaceAll('{name}', user.name).replaceAll('{gift}', giftTxt).replaceAll('{action}', action.toLowerCase());
  if (effect === 'dragon') banner(`✦ ĐẠI CÔNG ĐỨC ✦ ${txt}`, 'big'); else banner(txt, 'gift');
  speak(`${CFG.ttsPrefix ?? ''} ${txt}`);

  (EFFECTS[effect] || EFFECTS.incense)(count);
  const { d, isNew } = ensureDevotee(user);
  if (isNew) banner(`${user.name} vừa vào chùa`, 'join');
  if (d) {
    d.lastActive = performance.now();
    d.offer(() => floatText(d.x, d.y - 95 * d.s, `+${pts} công đức`));
  }
}

// ------------------------------------------------------------------ kết nối máy chủ
let status = { state: demoOn ? 'demo' : 'starting' };
let statusT = 0;
let gameWs = null;
let codeVersion = null;   // phiên bản code máy chủ báo lần đầu kết nối
// báo trạng thái nhạc nền về máy chủ để trang quản trị hiển thị
function sendMusicState(s) { if (gameWs && gameWs.readyState === 1) gameWs.send(JSON.stringify({ type: 'music-state', state: s })); }
window.BgMusic?.onState(sendMusicState);
function connect() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (window.FORCE_DEMO) return;
  let ws;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return; }
  gameWs = ws; logWs = ws;
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'hello', role: 'game' }));
    if (window.BgMusic) sendMusicState(window.BgMusic.state());
    clientLog('mở trang: ' + navigator.userAgent + ' | ' + innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio);
    for (const t of pendingLogs.splice(0)) clientLog(t);
    setTimeout(() => clientLog('sau 8s: ' + devotees.size + ' người trong chùa'), 8000);
  };
  ws.onmessage = e => { try { handle(JSON.parse(e.data)); } catch (err) { console.warn(err); clientLog('lỗi xử lý sự kiện: ' + (err && err.stack || err)); } };
  ws.onclose = () => { if (!demoOn) status = { state: 'server-off', message: 'Không thấy máy chủ — hãy chạy: node server.mjs' }; setTimeout(connect, 3000); };
}
async function loadConfig() {
  if (window.FORCE_DEMO) return;
  try { const r = await fetch('config.json', { cache: 'no-store' }); if (r.ok) CFG = Object.assign({}, DEFAULT_CONFIG, await r.json()); } catch (e) { /* dùng mặc định */ }
}

// ------------------------------------------------------------------ giả lập (demo)
const HO = ['Minh Anh', 'Thu Hà', 'Quang Huy', 'Ngọc Trâm', 'Lan Phương', 'Hoàng Long', 'Bảo Ngọc', 'Đức Thịnh', 'Kim Ngân', 'Mai Chi', 'Thanh Tâm', 'Khánh Vy', 'An Nhiên', 'Gia Hân', 'Văn Toàn', 'Trung Kiên', 'Hải Đăng', 'Phúc An', 'Yến Nhi', 'Diệu Linh', 'Tuấn Kiệt', 'Hồng Nhung', 'bé Na', 'Tâm An', 'Ngọc Trinh', 'Minh Khôi'];
const PRAYERS = ['Nam mô A Di Đà Phật', 'Mô Phật 🙏', 'Cầu gia đình khỏe mạnh', 'Con xin cầu bình an', 'Chúc mọi người an lạc', 'Cầu siêu cho ông bà', 'Tâm an vạn sự an', 'Mong thi đỗ ạ', 'Cầu cho mẹ mau khỏe', 'A Di Đà Phật', 'Con cảm ơn Phật', 'Cầu công việc thuận lợi'];
let demoPool = [];
function demoUser() {
  if (demoPool.length < 60 || Math.random() < 0.35) {
    const name = pick(HO) + (Math.random() < 0.6 ? ' ' + Math.floor(rand(10, 99)) : '');
    const u = { id: 'demo-' + name, name };
    if (!demoPool.find(p => p.id === u.id)) demoPool.push(u);
    return u;
  }
  return pick(demoPool);
}
let demoTimers = { join: 0, chat: 2, gift: 3, like: 1 };
function demoTick(dt) {
  if (!demoOn) return;
  const active = [...devotees.values()].filter(d => !d.leaving);
  if ((demoTimers.join -= dt) <= 0) { emitLocal({ type: 'join', user: demoUser() }); demoTimers.join = active.length < 30 ? rand(0.2, 0.6) : rand(1, 2.5); }
  if ((demoTimers.chat -= dt) <= 0 && active.length) { const d = pick(active); emitLocal({ type: 'chat', user: { id: d.id, name: d.name }, text: pick(PRAYERS) }); demoTimers.chat = rand(0.8, 2.2); }
  if ((demoTimers.like -= dt) <= 0 && active.length) { const d = pick(active); emitLocal({ type: 'like', user: { id: d.id, name: d.name }, count: 5 }); demoTimers.like = rand(0.5, 1.5); }
  if ((demoTimers.gift -= dt) <= 0 && active.length > 5) {
    const d = pick(active), r = Math.random();
    const name = r < 0.35 ? 'rose' : r < 0.52 ? 'finger heart' : r < 0.64 ? 'rosa' : r < 0.76 ? 'doughnut' : r < 0.86 ? 'hand hearts' : r < 0.93 ? 'corgi' : r < 0.98 ? 'money gun' : 'lion';
    emitLocal({ type: 'gift', user: { id: d.id, name: d.name }, gift: { name, count: name === 'rose' ? Math.ceil(rand(0, 5)) : 1 } });
    demoTimers.gift = rand(2.5, 5.5);
  }
}

// phím tắt test — chỉ bật khi mở bằng ?demo=1. Màn hình live (?clean=1 trong LIVE Studio/OBS) bỏ qua mọi phím,
// vì khi bấm vào nguồn rồi gõ chữ ở chỗ khác trong LIVE Studio, các phím J/C/D/1–8 sẽ lọt vào trang và sinh người ảo.
const TEST_KEYS = params.get('demo') === '1';
const GIFT_KEYS = ['rose', 'finger heart', 'rosa', 'doughnut', 'hand hearts', 'corgi', 'money gun', 'lion'];
addEventListener('keydown', e => {
  if (!TEST_KEYS) return;
  const k = e.key.toLowerCase();
  const active = [...devotees.values()].filter(d => !d.leaving);
  const someone = () => active.length && Math.random() < 0.7 ? { id: pick(active).id, name: pick(active).name } : demoUser();
  if (k === 'j') emitLocal({ type: 'join', user: demoUser() });
  else if (k === 'c' && active.length) { const d = pick(active); emitLocal({ type: 'chat', user: { id: d.id, name: d.name }, text: pick(PRAYERS) }); }
  else if (k >= '1' && k <= '8') { const d = active.length ? pick(active) : demoUser(); emitLocal({ type: 'gift', user: { id: d.id, name: d.name }, gift: { name: GIFT_KEYS[+k - 1], count: 1 } }); }
  else if (k === 'd') { demoOn = !demoOn; status = { state: demoOn ? 'demo' : 'starting' }; }
  else if (k === 'r' && e.shiftKey) resetMeritAll();
  void someone;
});

// ------------------------------------------------------------------ vẽ động
let T = 0;
function update(dt) {
  T += dt;
  demoTick(dt);
  for (const d of devotees.values()) d.update(dt);

  // khói thường trực
  if (Math.random() < dt * 6) smokeBurst(1);
  for (const p of fx.smoke) { p.life += dt; p.x += (p.vx + Math.sin(T * 1.3 + p.y * 0.02) * 14) * dt; p.y += p.vy * dt; p.r += 14 * dt; }
  fx.smoke = fx.smoke.filter(p => p.life < p.max);
  if (fx.smoke.length > 400) fx.smoke.splice(0, fx.smoke.length - 400);

  for (const p of fx.sparks) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
  fx.sparks = fx.sparks.filter(p => p.life < p.max);
  for (const p of fx.petals) { p.life += dt; p.x += (p.vx + Math.sin(T * 2 + p.rot) * 25) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  fx.petals = fx.petals.filter(p => p.y < H + 20 && p.life < p.max);
  for (const c of fx.coins) { if ((c.delay -= dt) > 0) continue; c.life += dt; c.y += c.vy * dt; c.x += c.vx * dt; c.spin += c.vs * dt; c.vy += 120 * dt; }
  fx.coins = fx.coins.filter(c => c.y < H + 30);
  for (const k of fx.koi) { if ((k.delay -= dt) > 0) continue; k.life += dt; k.ph += dt * 8; const dx = k.tx - k.x, dy = k.ty - k.y, d = Math.hypot(dx, dy) || 1; const sp = 120 * dt; k.x += dx / d * sp + Math.cos(k.ph * 0.4) * 30 * dt; k.y += dy / d * sp; k.ang = Math.atan2(dy, dx); }
  fx.koi = fx.koi.filter(k => k.life < k.max);
  for (const l of fx.lanterns) { if ((l.delay -= dt) > 0) continue; l.life += dt; l.y -= l.vy * dt; l.x += Math.sin(T + l.sway) * 10 * dt; }
  fx.lanterns = fx.lanterns.filter(l => l.y > 520);
  for (const f of fx.floats) f.t += dt;
  fx.floats = fx.floats.filter(f => f.t < 2.2);
  for (const r of fx.rings) r.t += dt;
  fx.rings = fx.rings.filter(r => r.t < 1.8);
  for (const c of fx.candles) c.life -= dt;
  fx.candles = fx.candles.filter(c => c.life > 0);
  for (const f of fx.fruits) { f.life -= dt; f.t += dt; }
  fx.fruits = fx.fruits.filter(f => f.life > 0);
  if (fx.lotus && (fx.lotus.t += dt) > fx.lotus.dur) fx.lotus = null;
  if (fx.dragon) { fx.dragon.t += dt; if (fx.dragon.t > 8) fx.dragon = null; }
  if (fx.bigText && (fx.bigText.t += dt) > 3.5) fx.bigText = null;
  // chuông: dao động tắt dần
  fx.bellV += (-fx.bellA * 18 - fx.bellV * 1.2) * dt; fx.bellA += fx.bellV * dt;
  fx.glow = Math.max(0, fx.glow - dt * 0.25);
  fx.shake = Math.max(0, fx.shake - dt);
  for (const b of banners) b.t += dt;
  for (let i = banners.length - 1; i >= 0; i--) if (banners[i].t > banners[i].dur) banners.splice(i, 1);
  statusT += dt;
}

function render() {
  const g = ctx;
  g.setTransform(Q, 0, 0, Q, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  if (fx.shake > 0) g.translate(rand(-4, 4) * fx.shake, rand(-4, 4) * fx.shake);
  g.drawImage(BG, 0, 0, W, H);

  // hào quang nhấp nháy + khi có quà lớn
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.08 + Math.sin(T * 1.2) * 0.03 + fx.glow * 0.5;
  g.drawImage(GLOW, CX - 190, 300, 380, 380);
  g.restore();

  drawAltarDynamic(g);

  // khói
  for (const p of fx.smoke) {
    const k = p.life / p.max;
    g.globalAlpha = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.55;
    g.drawImage(SMOKE, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  g.globalAlpha = 1;
  // đầu nhang đỏ
  for (let i = 0; i < 11; i++) { g.globalAlpha = 0.6 + Math.sin(T * 5 + i) * 0.4; g.fillStyle = '#ff6a2a'; g.beginPath(); g.arc(CX - 30 + i * 6, CENSER.y + 6 - (i % 3) * 3, 1.6, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;

  drawLotus(g);

  // phật tử theo chiều sâu
  const list = [...devotees.values()].sort((a, b) => a.y - b.y);
  for (const d of list) d.draw(g);
  drawLabels(g, list);

  drawKoi(g);
  drawFloatingLanterns(g);
  drawSparks(g);
  drawPetals(g);
  drawCoins(g);
  drawRings(g);

  drawUI(g);
  drawDragon(g);
  drawBanners(g);
  drawFloats(g);
  drawBigText(g);
  drawStatus(g);
}

function flame(g, x, y, s = 1) {
  const f = 1 + Math.sin(T * 18 + x) * 0.12;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55; g.drawImage(GLOW, x - 18 * s, y - 20 * s, 36 * s, 36 * s);
  g.restore();
  g.fillStyle = '#ffb02e'; g.beginPath(); g.ellipse(x, y - 3 * s * f, 3 * s, 6 * s * f, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff6c0'; g.beginPath(); g.ellipse(x, y - 2 * s, 1.4 * s, 3 * s, 0, 0, Math.PI * 2); g.fill();
}

function drawAltarDynamic(g) {
  // nến được thắp
  for (const c of fx.candles) {
    const { x, y } = c.slot, a = Math.min(1, c.life / 3);
    g.globalAlpha = a;
    g.fillStyle = '#f4eadb'; g.fillRect(x - 2.5, y - c.h, 5, c.h);
    g.fillStyle = '#c0392b'; g.fillRect(x - 2.5, y - 3, 5, 3);
    flame(g, x, y - c.h, 0.75);
    g.globalAlpha = 1;
  }
  // mâm ngũ quả
  for (const f of fx.fruits) {
    const [x, y] = f.slot, sc = easeOutBack(clamp(f.t / 0.6, 0, 1)) * 0.85, a = Math.min(1, f.life / 3);
    g.globalAlpha = a;
    if (f.t < 2) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * (1 - f.t / 2); g.drawImage(GLOW, x - 50, y - 60, 100, 100); g.restore(); g.globalAlpha = a; }
    g.fillStyle = goldGrad(g, x - 30, 0, x + 30, 0);
    g.beginPath(); g.ellipse(x, y, 28 * sc, 7 * sc, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x - 6 * sc, y, 12 * sc, 8 * sc);
    drawFruitPile(g, x, y - 4 * sc, sc);
    g.globalAlpha = 1;
  }
}

function drawLotus(g) {
  const L = fx.lotus; if (!L) return;
  const t = L.t, grow = easeOutBack(clamp(t / 1.1, 0, 1)), fade = clamp((L.dur - t) / 0.8, 0, 1);
  const x = CX, y = 680 - Math.min(t, 1.5) * 20, s = grow * 1.25;
  g.save(); g.globalAlpha = fade;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade * 0.8; g.drawImage(PINKGLOW, x - 140 * s, y - 150 * s, 280 * s, 280 * s); g.restore();
  // tia sáng xoay
  g.save(); g.translate(x, y - 20 * s); g.rotate(T * 0.3); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = 'rgba(255,200,230,0.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-10 * s, -150 * s); g.lineTo(10 * s, -150 * s); g.fill(); }
  g.restore();
  if (FXI.hoasen_no) { drawImg(g, FXI.hoasen_no, x, y - 30 * s, 190 * s); g.restore(); return; }
  const layers = [[9, 62, 0.9, '#e8507f', '#ffd6e4'], [7, 54, 0.55, '#f06b96', '#ffe6ef'], [5, 42, 0.25, '#ff8fb3', '#fff4f8']];
  layers.forEach(([n, len, spread, c1, c2]) => {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * (spread * 2 / (n - 1 || 1)) * 1.4;
      g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
      const gr = g.createLinearGradient(0, 0, 0, -len * s);
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.strokeStyle = 'rgba(180,40,90,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-18 * s, -len * s * 0.5, 0, -len * s); g.quadraticCurveTo(18 * s, -len * s * 0.5, 0, 0); g.fill(); g.stroke();
      g.restore();
    }
  });
  g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(x, y - 10 * s, 8 * s, 0, Math.PI * 2); g.fill();
  // lá sen
  g.fillStyle = '#3f8f4a'; g.beginPath(); g.ellipse(x, y + 6 * s, 70 * s, 12 * s, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawLabels(g, list) {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const d of list) {
    if (d.alpha <= 0.05 || d.headTop == null) continue;
    const s = d.s, fs = Math.max(9, Math.round(13 * s + 2));
    g.globalAlpha = d.alpha;
    g.font = `600 ${fs}px ${FONT}`;
    g.lineWidth = 3; g.strokeStyle = 'rgba(30,8,2,0.85)'; g.lineJoin = 'round';
    const y = d.headTop - 3;
    g.strokeText(d.name, d.x, y); g.fillStyle = '#fff6e6'; g.fillText(d.name, d.x, y);
    if (d.bubble) {
      const bf = Math.max(10, Math.round(12 * s + 3));
      g.font = `600 ${bf}px ${FONT}`;
      let txt = d.bubble.text; if (txt.length > 30) txt = txt.slice(0, 29) + '…';
      const tw = g.measureText(txt).width, bw = tw + 14, bh = bf + 10, bx = clamp(d.x - bw / 2, 4, W - bw - 4), by = y - fs - bh - 2;
      const a = Math.min(1, d.bubble.t * 2, (6 - d.bubble.t) * 4);
      g.globalAlpha = d.alpha * a;
      g.fillStyle = 'rgba(255,250,240,0.95)'; rr(g, bx, by, bw, bh, bh / 2); g.fill();
      g.beginPath(); g.moveTo(clamp(d.x, bx + 10, bx + bw - 10) - 5, by + bh - 1); g.lineTo(clamp(d.x, bx + 10, bx + bw - 10), by + bh + 6); g.lineTo(clamp(d.x, bx + 10, bx + bw - 10) + 5, by + bh - 1); g.fill();
      g.fillStyle = '#5a2a0c'; g.fillText(txt, bx + bw / 2, by + bh - 6);
    }
  }
  g.globalAlpha = 1;
}

function drawKoi(g) {
  for (const k of fx.koi) {
    if (k.delay > 0) continue;
    const a = Math.min(1, k.life * 2, (k.max - k.life) * 1.2), s = k.s;
    g.save(); g.globalAlpha = a; g.translate(k.x, k.y); g.rotate((k.ang || -Math.PI / 2) + Math.PI / 2);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.5; g.drawImage(GLOW, -40 * s, -40 * s, 80 * s, 80 * s); g.restore();
    const w = Math.sin(k.ph) * 0.35;
    const kim = FXI[k.img];
    if (kim) { g.rotate(w * 0.25); drawImg(g, kim, 0, 6 * s, 46 * s); g.restore(); continue; }
    // đuôi
    g.save(); g.translate(0, 18 * s); g.rotate(w);
    g.fillStyle = k.col; g.globalAlpha = a * 0.85;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14 * s, 14 * s, -12 * s, 24 * s); g.quadraticCurveTo(0, 16 * s, 12 * s, 24 * s); g.quadraticCurveTo(14 * s, 14 * s, 0, 0); g.fill();
    g.restore();
    // thân
    const gr = g.createLinearGradient(-9 * s, 0, 9 * s, 0);
    gr.addColorStop(0, shade(k.col.length === 7 ? k.col : '#ff7a1a', -0.25)); gr.addColorStop(0.5, '#fff1c8'); gr.addColorStop(1, shade(k.col.length === 7 ? k.col : '#ff7a1a', -0.25));
    g.fillStyle = gr; g.globalAlpha = a;
    g.beginPath(); g.ellipse(0, 0, 9 * s, 22 * s, w * 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = k.col; g.globalAlpha = a * 0.75;
    g.beginPath(); g.ellipse(-9 * s, -2 * s, 7 * s, 3 * s, -0.6 + w, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(9 * s, -2 * s, 7 * s, 3 * s, 0.6 - w, 0, Math.PI * 2); g.fill();
    g.globalAlpha = a; g.fillStyle = '#1a0a04';
    g.beginPath(); g.arc(-4 * s, -15 * s, 1.5 * s, 0, Math.PI * 2); g.arc(4 * s, -15 * s, 1.5 * s, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

function drawFloatingLanterns(g) {
  for (const l of fx.lanterns) {
    if (l.delay > 0) continue;
    const s = l.s, a = Math.min(1, l.life, (l.y - 520) / 160);
    g.globalAlpha = clamp(a, 0, 1);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(a, 0, 1) * 0.6;
    g.drawImage(GLOW, l.x - 30 * s, l.y - 30 * s, 60 * s, 60 * s); g.restore();
    g.globalAlpha = clamp(a, 0, 1);
    const lim = FXI[l.img];
    if (lim) { drawImg(g, lim, l.x, l.y, 34 * s); continue; }
    const gr = g.createLinearGradient(0, l.y - 12 * s, 0, l.y + 12 * s);
    gr.addColorStop(0, '#ff3b2a'); gr.addColorStop(0.6, '#ffb347'); gr.addColorStop(1, '#ffe08a');
    g.fillStyle = gr; rr(g, l.x - 8 * s, l.y - 12 * s, 16 * s, 22 * s, 5 * s); g.fill();
    g.fillStyle = '#ffd34a'; g.fillRect(l.x - 6 * s, l.y + 9 * s, 12 * s, 3 * s);
  }
  g.globalAlpha = 1;
}

function drawSparks(g) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const p of fx.sparks) { g.globalAlpha = 1 - p.life / p.max; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 2, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function drawPetals(g) {
  for (const p of fx.petals) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, (p.max - p.life));
    if (FXI.canhsen) { drawImg(g, FXI.canhsen, 0, 0, p.s * 2.2); g.restore(); continue; }
    g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}

function drawCoins(g) {
  for (const c of fx.coins) {
    if (c.delay > 0) continue;
    const sx = Math.abs(Math.cos(c.spin));
    g.save(); g.translate(c.x, c.y); g.scale(Math.max(0.15, sx), 1);
    const gr = g.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 1, 0, 0, c.r);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#f2c14e'); gr.addColorStop(1, '#a66a12');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, c.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a4a0a'; g.fillRect(-c.r * 0.25, -c.r * 0.25, c.r * 0.5, c.r * 0.5);
    g.restore();
  }
}

function drawRings(g) {
  for (const r of fx.rings) {
    if (r.t < 0) continue;
    g.strokeStyle = `rgba(255,220,140,${(1 - r.t / 1.8) * 0.8})`; g.lineWidth = 3;
    g.beginPath(); g.arc(r.x, r.y, 20 + r.t * 140, 0, Math.PI * 2); g.stroke();
  }
}

function drawDragon(g) {
  const D = fx.dragon; if (!D) return;
  const t = D.t, k = t / 7;
  const DW = 520, img = FXI.rongvang;                       // chiều rộng ảnh rồng trên canvas
  const hx = img ? -60 + k * (W + DW + 60) : -160 + k * 1040, hy = 330 + Math.sin(k * Math.PI * 3) * 110 + Math.sin(k * Math.PI * 7) * 20;
  D.trail.unshift({ x: hx, y: hy }); if (D.trail.length > 260) D.trail.pop();
  const a = Math.min(1, t * 2, (8 - t));
  g.save(); g.globalAlpha = clamp(a, 0, 1);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(a, 0, 1) * 0.6;
  for (let i = 0; i < D.trail.length; i += 12) { const p = D.trail[i]; g.drawImage(GLOW, p.x - 60, p.y - 60, 120, 120); }
  g.restore();
  if (img) {
    // ảnh rồng: đầu (mép phải ảnh) bám theo (hx, hy), nghiêng theo hướng bay
    const p2 = D.trail[Math.min(20, D.trail.length - 1)];
    const ang = clamp(Math.atan2(hy - p2.y, hx - p2.x), -0.35, 0.35);
    g.save(); g.translate(hx, hy); g.rotate(ang);
    drawImg(g, img, -DW / 2 + 30, 0, DW);
    g.restore();
    const pearl = { x: hx + 60, y: hy - 6 + Math.sin(t * 6) * 6 };
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(GLOW, pearl.x - 45, pearl.y - 45, 90, 90); g.restore();
    if (FXI.ngocrong) { g.save(); g.translate(pearl.x, pearl.y); g.rotate(t * 1.5); drawImg(g, FXI.ngocrong, 0, 0, 62); g.restore(); }
    else { g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(pearl.x, pearl.y, 9, 0, Math.PI * 2); g.fill(); }
    g.restore(); return;
  }
  const N = 42;
  for (let i = N - 1; i >= 0; i--) {
    const p = D.trail[Math.min(D.trail.length - 1, i * 5)]; if (!p) continue;
    const r = 26 - i * 0.5;
    const gr = g.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
    gr.addColorStop(0, '#fff7c4'); gr.addColorStop(0.5, '#f0b93a'); gr.addColorStop(1, '#9a5a0c');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    // vảy & vây lưng
    g.strokeStyle = 'rgba(140,80,10,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y + r * 0.2, r * 0.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    if (i % 2 === 0) { g.fillStyle = '#d9361e'; g.beginPath(); g.moveTo(p.x - 5, p.y - r + 2); g.lineTo(p.x, p.y - r - 10); g.lineTo(p.x + 5, p.y - r + 2); g.fill(); }
    if (i === 10 || i === 26) { g.strokeStyle = '#e8a93a'; g.lineWidth = 4; g.beginPath(); g.moveTo(p.x, p.y + r * 0.6); g.lineTo(p.x - 10, p.y + r + 14); g.lineTo(p.x - 16, p.y + r + 14); g.stroke(); }
  }
  // đầu rồng
  const p1 = D.trail[0], p2 = D.trail[Math.min(6, D.trail.length - 1)];
  const ang = Math.atan2(p1.y - p2.y, p1.x - p2.x);
  g.save(); g.translate(p1.x, p1.y); g.rotate(ang);
  const gr = g.createLinearGradient(-30, 0, 50, 0); gr.addColorStop(0, '#c98a1e'); gr.addColorStop(0.5, '#ffe58a'); gr.addColorStop(1, '#d99a2a');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-24, -24); g.quadraticCurveTo(30, -30, 52, -8); g.lineTo(54, 6); g.quadraticCurveTo(30, 26, -24, 24); g.closePath(); g.fill();
  g.fillStyle = '#d9361e'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-26 + i * 4, -18); g.lineTo(-44 + i * 2, -36 + i * 3); g.lineTo(-18 + i * 4, -10); g.fill(); }
  g.strokeStyle = '#f7d36a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(10, -22); g.quadraticCurveTo(-10, -50, -30, -54); g.stroke();
  g.beginPath(); g.moveTo(52, 2); g.quadraticCurveTo(70, 20, 90, 14); g.stroke();
  g.beginPath(); g.moveTo(52, -4); g.quadraticCurveTo(72, -24, 92, -16); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(24, -10, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c0141a'; g.beginPath(); g.arc(25, -10, 3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a1a08'; g.beginPath(); g.moveTo(54, 6); g.lineTo(30, 12); g.lineTo(52, 14); g.fill();
  g.restore();
  // ngọc
  const pearl = { x: hx + 70, y: hy - 10 + Math.sin(t * 6) * 6 };
  g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(GLOW, pearl.x - 40, pearl.y - 40, 80, 80); g.restore();
  g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(pearl.x, pearl.y, 9, 0, Math.PI * 2); g.fill();
  g.restore();
}

function panel(g, x, y, w, h) {
  g.fillStyle = 'rgba(28,10,4,0.82)'; rr(g, x, y, w, h, 14); g.fill();
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, 'rgba(240,195,110,0.9)'); gr.addColorStop(0.5, 'rgba(160,100,40,0.6)'); gr.addColorStop(1, 'rgba(240,195,110,0.9)');
  g.strokeStyle = gr; g.lineWidth = 1.5; rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 14); g.stroke();
}
function goldText(g, text, x, y, size) {
  g.font = `800 ${size}px ${SERIF}`;
  const gr = g.createLinearGradient(0, y - size, 0, y);
  gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.55, '#f2c260'); gr.addColorStop(1, '#c8862c');
  g.fillStyle = gr; g.fillText(text, x, y);
}
function fitText(g, text, maxW) { if (g.measureText(text).width <= maxW) return text; while (text.length > 1 && g.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }

function drawUI(g) {
  const present = [...devotees.values()].filter(d => !d.leaving).length;
  // tiêu đề
  panel(g, 26, 46, 668, 86);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  goldText(g, CFG.title || 'Chùa Online', CX, 87, 34);
  g.font = `600 17px ${FONT}`; g.fillStyle = '#f6e6c8';
  g.fillText(`🙏 ${present} phật tử đang lễ   ✦   Công đức: ${totalMerit.toLocaleString('vi-VN')}`, CX, 118);

  // bảng quà
  const gifts = CFG.gifts.filter(x => !x.hidden);
  const lh = 39, lx = 28, ly = 148, lw = 198, lhgt = 50 + gifts.length * lh;
  panel(g, lx, ly, lw, lhgt);
  goldText(g, 'Tặng quà để...', lx + lw / 2, ly + 30, 19);
  g.textAlign = 'left';
  gifts.forEach((gf, i) => {
    const y = ly + 44 + i * lh;
    g.fillStyle = 'rgba(255,220,160,0.07)'; rr(g, lx + 8, y, lw - 16, lh - 5, 6); g.fill();
    g.font = `700 13px ${FONT}`; g.fillStyle = '#ffd98a'; g.fillText(fitText(g, gf.label, lw - 30), lx + 16, y + 15);
    g.font = `500 11.5px ${FONT}`; g.fillStyle = '#f2e3cc';
    g.fillText(fitText(g, `${EFFECT_ICON[gf.effect] || '✦'} ${gf.action}`, lw - 30), lx + 16, y + 30);
  });

  // bảng công đức
  const top = topMerit(5), rx = 476, ry = 148, rw = 216, rh = 54 + Math.max(1, top.length) * 31;
  panel(g, rx, ry, rw, rh);
  g.textAlign = 'center'; goldText(g, 'Bảng Công Đức', rx + rw / 2, ry + 30, 19);
  if (!top.length) { g.font = `500 13px ${FONT}`; g.fillStyle = '#e8d6b8'; g.fillText('Hãy là người đầu tiên', rx + rw / 2, ry + 64); }
  const medal = ['#e9b93a', '#b9c0c8', '#c47a3c', '#6a4a36', '#6a4a36'];
  top.forEach((m, i) => {
    const y = ry + 60 + i * 31;
    g.fillStyle = medal[i]; g.beginPath(); g.arc(rx + 22, y - 5, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = i < 3 ? '#3a1a04' : '#f6e6c8'; g.font = `800 12px ${FONT}`; g.textAlign = 'center'; g.fillText(i + 1, rx + 22, y - 1);
    g.textAlign = 'left'; g.font = `600 15px ${FONT}`; g.fillStyle = '#fff3dc'; g.fillText(fitText(g, m.name, 120), rx + 40, y);
    g.textAlign = 'right'; g.font = `700 15px ${FONT}`; g.fillStyle = '#ffd98a'; g.fillText(m.v.toLocaleString('vi-VN'), rx + rw - 14, y);
  });
}

function drawBanners(g) {
  const base = 1030;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  banners.forEach((b, i) => {
    const idx = banners.length - 1 - i;
    const y = base - idx * 42;
    const inA = clamp(b.t / 0.35, 0, 1), outA = clamp((b.dur - b.t) / 0.5, 0, 1), a = Math.min(inA, outA);
    const slide = (1 - inA) * 40;
    const big = b.kind === 'big', gift = b.kind === 'gift' || big;
    g.font = `${gift ? 800 : 700} ${big ? 19 : 17}px ${FONT}`;
    const txt = fitText(g, b.text, 660);
    const tw = g.measureText(txt).width + 70;
    g.globalAlpha = a;
    const gr = g.createLinearGradient(CX - tw / 2, 0, CX + tw / 2, 0);
    const mid = big ? 'rgba(120,30,0,0.92)' : gift ? 'rgba(70,20,4,0.85)' : 'rgba(40,12,4,0.72)';
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.18, mid); gr.addColorStop(0.82, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(CX - tw / 2 + slide, y - 17, tw, 34);
    if (gift) { g.fillStyle = 'rgba(255,210,120,0.55)'; g.fillRect(CX - tw / 2 + tw * 0.15 + slide, y - 17, tw * 0.7, 1); g.fillRect(CX - tw / 2 + tw * 0.15 + slide, y + 16, tw * 0.7, 1); }
    g.lineWidth = 3; g.strokeStyle = 'rgba(20,5,0,0.7)'; g.strokeText(txt, CX + slide, y + 1);
    g.fillStyle = big ? '#ffe680' : gift ? '#ffd27a' : b.kind === 'follow' ? '#ffc8dc' : '#fff4e2';
    g.fillText(txt, CX + slide, y + 1);
  });
  g.globalAlpha = 1; g.textBaseline = 'alphabetic';
}

function drawFloats(g) {
  g.textAlign = 'center';
  for (const f of fx.floats) {
    g.globalAlpha = Math.min(1, (2.2 - f.t) * 1.5);
    g.font = `800 18px ${FONT}`; g.lineWidth = 3; g.strokeStyle = 'rgba(40,10,0,0.85)';
    const y = f.y - f.t * 40;
    g.strokeText(f.text, f.x, y); g.fillStyle = f.col; g.fillText(f.text, f.x, y);
  }
  g.globalAlpha = 1;
}

function drawBigText(g) {
  const b = fx.bigText; if (!b) return;
  const s = easeOutBack(clamp(b.t / 0.6, 0, 1)), a = clamp((3.5 - b.t) / 0.6, 0, 1);
  g.save(); g.globalAlpha = a;
  const band = g.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, 'rgba(60,10,0,0)'); band.addColorStop(0.2, 'rgba(60,10,0,0.8)'); band.addColorStop(0.8, 'rgba(60,10,0,0.8)'); band.addColorStop(1, 'rgba(60,10,0,0)');
  g.fillStyle = band; g.fillRect(0, 560, W, 64);
  g.translate(CX, 608); g.scale(s, s);
  g.textAlign = 'center';
  g.shadowColor = 'rgba(255,190,60,0.9)'; g.shadowBlur = 30;
  goldText(g, b.text, 0, 0, 44);
  g.restore();
}

function drawStatus(g) {
  let text = null, col = '#ffcf6a';
  // trình duyệt chặn tự phát nhạc → nhắc bấm vào trang (hiện cả khi ?clean=1, vì không bấm thì không có nhạc)
  if (window.BgMusic?.blocked) text = '♪ Bấm vào màn hình để bật nhạc nền';
  else if (CLEAN) return;
  else if (demoOn) return;
  else if (status.state === 'connected') { if (statusT < 6) { text = `● Đã kết nối LIVE @${status.username}`; col = '#7dff9a'; } }
  else if (status.message) text = '● ' + status.message;
  if (!text) return;
  g.font = `600 12px ${FONT}`; g.textAlign = 'left';
  const w = Math.min(690, g.measureText(text).width + 16);
  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, 10, H - 30, w, 22, 6); g.fill();
  g.fillStyle = col; g.fillText(fitText(g, text, 680), 18, H - 15);
}

// ------------------------------------------------------------------ vòng lặp
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(frame);
}

(async function start() {
  loadStore();
  await loadConfig();
  window.BgMusic?.init(CFG);
  await loadAssets();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {});
  connect();
  requestAnimationFrame(frame);
})();

window.ChuaOnline = { handle };
})();
