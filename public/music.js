/* Chùa Online — phát nhạc nền / bài giảng từ YouTube (chỉ phát tiếng, video được giấu đi)
 * Cấu hình trong config.json → "music": { enabled, youtube: [link...], volume, duckVolume, shuffle }
 * Điều khiển từ trang quản trị (/admin) hoặc phím tắt: M = tắt/bật tiếng · N = bài tiếp theo
 * Tham số URL: ?music=0 (tắt nhạc) · ?yt=<link hoặc id YouTube> (phát thử 1 link, bỏ qua config)
 */
(() => {
'use strict';

const params = new URLSearchParams(location.search);
const ST = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
const DEFAULTS = { enabled: true, youtube: [], volume: 30, duckVolume: 10, shuffle: false };

let cfg = Object.assign({}, DEFAULTS);
let player = null;
let creating = false;
let ready = false;
let videos = [];        // danh sách id video theo thứ tự phát
let order = [];         // vị trí trong config tương ứng với từng video (để trang quản trị biết bài nào)
let index = 0;
let usingList = null;   // id playlist YouTube nếu đang phát playlist
let sourceKey = '';     // để biết danh sách có thay đổi khi nạp lại cấu hình
let muted = false;
let ducked = false;
let paused = false;     // người điều khiển bấm dừng
let curVol = 0;
let fadeTimer = null;
let blocked = false;    // trình duyệt chặn tự phát → cần bấm vào trang
let lastTitle = '';
let lastError = '';
let listeners = [];

// ---------- đọc link YouTube ----------
function parseSource(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return { video: s };
  if (/^(PL|UU|LL|FL|OL|RD)[\w-]{10,}$/.test(s)) return { list: s };
  let u;
  try { u = new URL(s.includes('://') ? s : 'https://' + s); } catch (e) { return null; }
  const list = u.searchParams.get('list');
  let video = u.searchParams.get('v');
  if (!video && /youtu\.be$/.test(u.hostname)) video = u.pathname.slice(1, 12);
  if (!video) { const m = u.pathname.match(/\/(?:shorts|live|embed|v)\/([\w-]{11})/); if (m) video = m[1]; }
  if (list && !video) return { list };
  if (video && /^[\w-]{11}$/.test(video)) return list ? { video, list } : { video };
  return list ? { list } : null;
}

function shuffleOrder() {
  for (let i = videos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [videos[i], videos[j]] = [videos[j], videos[i]];
    [order[i], order[j]] = [order[j], order[i]];
  }
}

// ---------- âm lượng ----------
function targetVol() {
  if (muted) return 0;
  const v = ducked ? Math.min(cfg.duckVolume ?? 10, cfg.volume ?? 30) : (cfg.volume ?? 30);
  return Math.max(0, Math.min(100, Number(v) || 0));
}
function applyVolume(instant) {
  if (!ready) return;
  clearInterval(fadeTimer);
  const to = targetVol();
  const step = () => {
    curVol = instant ? to : curVol + Math.sign(to - curVol) * Math.min(Math.abs(to - curVol), 3);
    player.setVolume(Math.round(curVol));
    if (curVol > 0 && !blocked) player.unMute();
    if (curVol === to) clearInterval(fadeTimer);
  };
  step();
  if (curVol !== to) fadeTimer = setInterval(step, 40);
}

// ---------- phát ----------
function startSources() {
  if (!ready) return;
  paused = false;
  lastError = '';
  if (usingList) {
    player.loadPlaylist({ listType: 'playlist', list: usingList, index: 0 });
    player.setLoop(true);
    if (cfg.shuffle) setTimeout(() => { player.setShuffle(true); player.playVideoAt(0); }, 1500);
  } else if (videos.length) {
    index = 0;
    player.loadVideoById(videos[0]);
  } else {
    player.stopVideo();
  }
  setTimeout(checkBlocked, 3000);
  emit();
}
function next(dir = 1) {
  if (!ready) return;
  paused = false;
  if (usingList) { dir > 0 ? player.nextVideo() : player.previousVideo(); return; }
  if (!videos.length) return;
  index = (index + dir + videos.length) % videos.length;
  if (index === 0 && dir > 0 && cfg.shuffle) shuffleOrder();
  player.loadVideoById(videos[index]);
}
function playConfigIndex(i) {
  if (!ready || usingList) return;
  const k = order.indexOf(Number(i));
  if (k < 0) return;
  index = k; paused = false;
  player.loadVideoById(videos[index]);
}

function checkBlocked() {
  if (!ready || paused || (!videos.length && !usingList)) { blocked = false; return; }
  const s = player.getPlayerState();
  blocked = !(s === ST.PLAYING || s === ST.BUFFERING);
  emit();
}
function unlock() {
  if (!ready || !blocked) return;
  blocked = false;
  player.unMute();
  player.playVideo();
  applyVolume(true);
  setTimeout(checkBlocked, 2500);
}

function onReady() {
  ready = true;
  curVol = targetVol();
  player.setVolume(curVol);
  startSources();
}
function onStateChange(e) {
  if (e.data === ST.PLAYING) {
    blocked = false;
    const t = player.getVideoData?.().title || '';
    if (t && t !== lastTitle) { lastTitle = t; console.log('[nhạc nền] đang phát:', t); }
  }
  if (e.data === ST.ENDED && !usingList) next(1);
  emit();
}
function onError(e) {
  // 2 = id sai · 5 = lỗi HTML5 · 100 = video không còn · 101/150 = chủ kênh không cho nhúng
  const msg = { 2: 'link sai', 5: 'lỗi trình phát', 100: 'video đã bị xoá/riêng tư', 101: 'chủ kênh không cho phát nhúng', 150: 'chủ kênh không cho phát nhúng' }[e.data] || 'lỗi ' + e.data;
  lastError = msg;
  console.warn('[nhạc nền] không phát được video (' + msg + ') — chuyển bài khác');
  if (usingList) setTimeout(() => player.nextVideo(), 1000);
  else if (videos.length > 1) setTimeout(() => next(1), 1000);
  emit();
}

function loadApi() {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('không tải được YouTube API (kiểm tra mạng)'));
    document.head.appendChild(s);
  });
}
async function createPlayer() {
  if (player || creating) return;
  creating = true;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:180px;pointer-events:none;opacity:0;';
  const host = document.createElement('div');
  host.id = 'yt-music';
  box.appendChild(host);
  document.body.appendChild(box);
  try { await loadApi(); } catch (err) { lastError = err.message; console.warn('[nhạc nền]', err.message); creating = false; emit(); return; }
  player = new YT.Player('yt-music', {
    width: 320, height: 180,
    playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, origin: location.origin },
    events: { onReady, onStateChange, onError }
  });
}

// ---------- nạp cấu hình (lần đầu và mỗi khi trang quản trị lưu) ----------
function configure(config) {
  cfg = Object.assign({}, DEFAULTS, (config && config.music) || {});
  const override = params.get('yt');
  const off = params.get('music') === '0' || (!override && cfg.enabled === false);
  const list = off ? [] : override ? [override] : [].concat(cfg.youtube || []);
  const parsed = list.map((raw, i) => ({ s: parseSource(raw), i })).filter(x => x.s);
  if (list.length && !parsed.length) console.warn('[nhạc nền] không đọc được link YouTube nào trong config.json → music.youtube');

  const pl = parsed.find(x => x.s.list && !x.s.video) || (parsed.length === 1 && parsed[0].s.list ? parsed[0] : null);
  const key = JSON.stringify([pl ? pl.s.list : parsed.map(x => x.s.video), !!cfg.shuffle]);
  const changed = key !== sourceKey;
  sourceKey = key;

  if (changed) {
    usingList = pl ? pl.s.list : null;
    if (pl && parsed.length > 1) console.warn('[nhạc nền] có playlist → chỉ phát playlist này, bỏ qua các link khác');
    videos = pl ? [] : parsed.map(x => x.s.video);
    order = pl ? [] : parsed.map(x => x.i);
    if (cfg.shuffle && !pl) shuffleOrder();
    if (!player && (videos.length || usingList)) createPlayer();
    else startSources();
  }
  applyVolume(false);
  emit();
}

// ---------- điều khiển ----------
function command(action, value) {
  if (action === 'mute') muted = value === undefined ? !muted : !!value;
  else if (action === 'volume') cfg.volume = Math.max(0, Math.min(100, Number(value) || 0));
  else if (!ready) return;
  else if (action === 'play') { paused = false; blocked ? unlock() : player.playVideo(); }
  else if (action === 'pause') { paused = true; player.pauseVideo(); }
  else if (action === 'toggle') return command(paused ? 'play' : 'pause');
  else if (action === 'next') next(1);
  else if (action === 'prev') next(-1);
  else if (action === 'playIndex') playConfigIndex(value);
  else if (action === 'seek') player.seekTo(Number(value) || 0, true);
  else if (action === 'restart') startSources();
  applyVolume(false);
  emit();
}

function state() {
  const s = ready ? player.getPlayerState() : null;
  return {
    ready, blocked, muted, paused, ducked,
    playing: s === ST.PLAYING || s === ST.BUFFERING,
    title: lastTitle,
    error: lastError,
    playlist: usingList,
    current: usingList ? (ready ? player.getPlaylistIndex() : -1) : (order[index] ?? -1),
    count: usingList ? (ready ? (player.getPlaylist() || []).length : 0) : videos.length,
    volume: cfg.volume ?? 30,
    time: ready ? Math.floor(player.getCurrentTime() || 0) : 0,
    duration: ready ? Math.floor(player.getDuration() || 0) : 0
  };
}
let emitTimer = null;
function emit() {
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => { const s = state(); for (const fn of listeners) fn(s); }, 50);
}
setInterval(() => { if (ready) emit(); }, 2000);

addEventListener('pointerdown', unlock);
addEventListener('keydown', e => {
  unlock();
  if (params.get('demo') !== '1') return;   // màn hình live: bỏ qua phím (tránh gõ nhầm chữ M/N làm tắt nhạc); điều khiển nhạc ở /admin
  const k = e.key.toLowerCase();
  if (k === 'm') command('mute');
  else if (k === 'n') command('next');
});

window.BgMusic = {
  init: configure,
  reload: configure,
  command,
  state,
  onState(fn) { listeners.push(fn); },
  duck(on) { if (ducked === !!on) return; ducked = !!on; applyVolume(false); emit(); },
  get blocked() { return blocked; },
  get title() { return lastTitle; },
  get active() { return ready; }
};
})();
