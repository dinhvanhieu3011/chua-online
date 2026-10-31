# 🙏 Chùa Online — Hướng dẫn đầy đủ mã nguồn

Tài liệu này dành cho người **vận hành** (cài, chạy, đưa lên TikTok LIVE) và người **sửa code** (hiểu cấu trúc, thêm quà, thay ảnh, thêm hiệu ứng).
Phần 1–5 là vận hành, không cần biết lập trình. Phần 6–10 là kỹ thuật.

**Mục lục**

1. [Game làm gì](#1-game-làm-gì)
2. [Cài đặt lần đầu](#2-cài-đặt-lần-đầu)
3. [Chạy thử trước khi live](#3-chạy-thử-trước-khi-live)
4. [Đưa lên TikTok LIVE (từng bước)](#4-đưa-lên-tiktok-live-từng-bước)
5. [Trang quản trị /admin](#5-trang-quản-trị-admin)
6. [Cấu trúc thư mục](#6-cấu-trúc-thư-mục)
7. [Kiến trúc và luồng dữ liệu](#7-kiến-trúc-và-luồng-dữ-liệu)
8. [Đi qua từng file](#8-đi-qua-từng-file)
9. [Tham chiếu config.json](#9-tham-chiếu-configjson)
10. [Sửa và mở rộng](#10-sửa-và-mở-rộng)
11. [Gỡ lỗi](#11-gỡ-lỗi)
12. [Bảo mật và giới hạn đã biết](#12-bảo-mật-và-giới-hạn-đã-biết)

---

## 1. Game làm gì

Màn hình dọc 9:16 hiển thị nội điện một ngôi chùa Việt. Server nghe sự kiện từ phiên TikTok LIVE và chuyển cho màn hình game:

| Người xem làm gì | Trên màn hình |
|---|---|
| Vào phòng live | Nhân vật chibi của họ đi vào chùa, ngồi lên bồ đoàn. Mỗi người được gán cố định 1 trong 11 nhân vật theo tên |
| Rời phòng | Nhân vật đứng dậy, đi ra rồi mờ dần. TikTok **không báo ai rời phòng**, nên server ước lượng: số nhân vật luôn ≤ số người đang xem, và ai im lặng quá `leaveAfterMinutes` phút thì ra về |
| Bình luận | Bong bóng chat trên đầu nhân vật |
| Thả tim | Nhân vật vái lạy (đủ `likeBowEvery` tim thì chắc chắn lạy) |
| Theo dõi / chia sẻ | Thông báo, cánh hoa rơi |
| Tặng quà | Nhân vật lên trước lư hương lạy 2 lần, hiệu ứng theo quà, giọng đọc cảm ơn, cộng **công đức** lên **Bảng Công Đức** |

Bảng quà mặc định:

| Quà TikTok | Hiệu ứng (`effect`) | Công đức |
|---|---|---|
| Hoa hồng (Rose), TikTok | Thắp nén hương (`incense`) | 1 |
| Tim ngón tay (Finger Heart) | Thắp nến (`candle`) | 5 |
| Bó hoa (Rosa) | Dâng hoa sen (`lotus`) | 10 |
| Bánh donut (Doughnut) | Thỉnh chuông (`bell`) | 10 |
| Tay bắn tim (Hand Hearts) | Dâng mâm ngũ quả (`fruit`) | 20 |
| Chó Corgi | Phóng sinh cá chép (`koi`) | 49 |
| Súng tiền (Money Gun) | Thả hoa đăng (`lantern`) | 99 |
| Sư tử (Lion) | Rồng Vàng hộ pháp + mưa tiền vàng (`dragon`) | 299 |

Quà không có trong bảng vẫn được tính: công đức = số xu × số lượng × `meritPerDiamond`, hiệu ứng tự chọn theo số xu.

Có thêm **nhạc nền / bài giảng từ YouTube** (chỉ phát tiếng) và **giọng đọc tiếng Việt** đọc lời cảm ơn khi có quà.

---

## 2. Cài đặt lần đầu

Không cần cài Node.js: `start-windows.bat` tự tải bản portable vào `node\` nếu máy chưa có (lần đầu cần mạng).

1. Chép cả thư mục dự án vào máy, ví dụ `D:\chua-online`.
2. Mở `config.json` bằng Notepad, sửa:
   ```json
   "tiktokUsername": "ten_tiktok_cua_ban",
   ```
   thành **ID TikTok** (phần sau chữ `@`, không phải tên hiển thị). Ví dụ `"tetdy20"`.
3. Tạo key miễn phí tại https://www.eulerstream.com, dán vào `"signApiKey"`. Gói miễn phí là đủ (xem [mục 11](#lỗi-kết-nối-tiktok)).
4. Bấm đúp **`start-windows.bat`**.
   Mac/Linux: cài Node.js 20+ (https://nodejs.org), mở Terminal trong thư mục, chạy `npm install` rồi `npm start`.

Cửa sổ đen hiện:

```
🙏  Chùa Online đang chạy
➜  Link cho LIVE Studio: http://localtest.me:8080/?clean=1
➜  Chạy thử (giả lập người xem): http://localtest.me:8080/?demo=1
➜  Trang quản trị:  http://localtest.me:8080/admin
```

**Giữ cửa sổ này mở suốt buổi live.** Tắt bằng **Ctrl + C** (để kịp lưu công đức) rồi đóng cửa sổ.

### Chuyển sang máy khác

1. Chạy `start-windows.bat` một lần (để có thư mục `node\`).
2. Nén cả thư mục thành `.zip`, giữ `node\` và `node_modules\`.
3. Máy mới: giải nén → bấm đúp `start-windows.bat`.

Gửi cho người khác thì xoá trước `signApiKey`, `adminPassword` trong `config.json` và file `merit.json`.

---

## 3. Chạy thử trước khi live

Mở **http://localtest.me:8080/?demo=1**: chùa tự có người ảo vào, chat, tặng quà. Người ảo **chỉ hiện trong chính tab demo đó**, không sang màn hình live, không cộng vào Bảng Công Đức thật.

Phím tắt (bấm vào trang trước). **Chỉ hoạt động khi link có `?demo=1`**; màn hình live bỏ qua mọi phím để gõ nhầm không sinh người ảo:

| Phím | Tác dụng |
|---|---|
| `J` | Có người vào |
| `C` | Có người chat |
| `1` … `8` | Quà: hoa hồng, tim ngón tay, bó hoa, donut, tay bắn tim, corgi, súng tiền, sư tử |
| `D` | Bật/tắt giả lập (là công tắc: bấm lần nữa là đảo lại) |
| `Shift + R` | Xoá bảng công đức hiển thị trong tab này (bảng thật: nút trong /admin) |
| `M` / `N` | Tắt/bật nhạc nền · bài tiếp theo |

Hoặc dùng tab **Bảng điều khiển → Thử hiệu ứng** trong `/admin`, hoặc gọi URL:
`http://localtest.me:8080/test?type=gift&name=Lan&gift=lion` (`type` = `join` | `chat` | `gift`).

> ⚠️ **Nút thử trong /admin và URL `/test` thì khác:** chúng đi **qua server**, hiện trên **mọi cửa sổ kể cả màn hình đang live**, và cộng công đức thật vào `merit.json`.
> Thử bằng /admin xong mà muốn chùa sạch trước khi live: **xoá Bảng Công Đức** và **khởi động lại server** (xem [mục 11](#vẫn-thấy-người-ảo)).

---

## 4. Đưa lên TikTok LIVE (từng bước)

### Điều kiện phía TikTok

- Tài khoản phải **công khai**: app TikTok → Hồ sơ → ☰ → *Cài đặt và quyền riêng tư* → *Quyền riêng tư* → tắt **Tài khoản riêng tư**.
  Tài khoản riêng tư thì server không thấy phòng live (lỗi `Failed to retrieve Room ID`).
- Tài khoản đủ điều kiện live trên máy tính (từ 18 tuổi, đủ người theo dõi theo quy định TikTok).
- Đổi sang công khai **khi đang live** thì phải **End LIVE rồi Go LIVE lại**: phòng tạo lúc còn riêng tư vẫn bị khoá.

### Thêm màn hình game vào TikTok LIVE Studio

1. **Add source → Link**.
2. Ô Link **không nhận `localhost`** (báo *Enter correct URL*). Dùng tên miền công khai trỏ về máy mình:
   ```
   http://localtest.me:8080/?clean=1
   ```
   Dự phòng: `http://127.0.0.1.nip.io:8080/?clean=1` hoặc `http://127-0-0-1.sslip.io:8080/?clean=1`.
   Các tên miền này luôn trỏ về `127.0.0.1`, game vẫn chỉ chạy trên máy bạn, chỉ cần có mạng để phân giải tên.
3. Bật **Custom resolution** = **1080 × 1920** (máy yếu: 720 × 1280). Không đặt thì LIVE Studio mở khung ngang → game bị viền đen hai bên.
4. Bật **Turn on sound** (để tiếng chuông, giọng đọc, nhạc ra live) và **Always keep active**.
5. **Add source**, kéo các góc cho phủ kín khung điện thoại.
6. Mỗi khi sửa code hoặc cần xoá người ảo trong cửa sổ: chuột phải nguồn → **Refresh**.

**Nếu nguồn Link không dùng được:** mở `http://localtest.me:8080/?clean=1` bằng Chrome, F11, rồi **Add source → Window capture** chọn cửa sổ Chrome. Không thu nhỏ Chrome khi đang live.

**OBS** (cần stream key TikTok): Sources → `+` → **Browser** → URL `http://localtest.me:8080/?clean=1`, 1080 × 1920, tick *Control audio via OBS*.

### Bắt đầu và kiểm tra

1. Server đang chạy → bấm **Go LIVE** trong LIVE Studio.
2. Trong 15–30 giây, cửa sổ đen hiện:
   ```
   [trạng thái] connected — Đã kết nối phòng 77027...
   ```
   Nếu bỏ `clean=1` khỏi link, góc dưới game hiện `● Đã kết nối LIVE @ten_cua_ban`. Tab Bảng điều khiển ở `/admin` cũng hiện trạng thái và nhật ký sự kiện thật.
3. Link xem live: `https://www.tiktok.com/@<ID>/live`. Mở bằng trình duyệt chưa đăng nhập để chắc người ngoài xem được.

### Dừng

LIVE Studio → nút **End LIVE** (góc dưới phải) → xác nhận. Server tự chuyển sang chờ phiên sau. Công đức đã lưu trong `merit.json`.

### Tham số URL của màn hình game

| Tham số | Tác dụng |
|---|---|
| `?clean=1` | Ẩn dòng trạng thái kết nối ở đáy màn hình (dùng khi live) |
| `?demo=1` | Bật giả lập người xem và phím tắt thử (chỉ trong tab này) |
| `?q=1.5` | Ép độ phân giải vẽ (1 = 720×1280, 1.5 = 1080×1920). Bỏ trống: tự khớp kích thước khung, không bị mờ |
| `?music=0` | Tắt nhạc nền cho riêng cửa sổ này |
| `?yt=<link>` | Phát thử một link YouTube, bỏ qua config |
| `?reset=1` | Xoá công đức lưu trong trình duyệt (chỉ dùng khi chạy không có server) |

---

## 5. Trang quản trị /admin

Mở `http://localtest.me:8080/admin` trong một tab Chrome riêng (không phải trong LIVE Studio/OBS).

- **Bảng điều khiển:** trạng thái TikTok, số người xem, số màn hình game đang mở, điều khiển nhạc (phát/dừng, chuyển bài, âm lượng, tua), nút thử từng quà, **nhật ký sự kiện LIVE** (hiện cả **tên quà TikTok gửi về** và số xu), Bảng Công Đức, nút xoá bảng.
- **Nhạc nền:** dán link YouTube (mỗi dòng một link, nhận cả playlist), đổi thứ tự, phát ngay một bài.
- **Quà tặng:** bảng quà → hiệu ứng → công đức; thêm quà mới; cấu hình quà không có trong bảng.
- **Cài đặt:** ID TikTok và Euler key (lưu xong tự kết nối lại), tên chùa, số người tối đa, câu cảm ơn, giọng đọc, mật khẩu quản trị, cổng.

Bấm **💾 Lưu**: `config.json` được ghi lại, mọi màn hình game áp dụng ngay không cần tải lại. Riêng đổi **cổng** phải chạy lại server.

Mở từ **điện thoại cùng wifi** (`http://<IP máy tính>:8080/admin`): phải đặt mật khẩu quản trị trước. Không có mật khẩu thì trang chỉ mở được trên chính máy chạy server.

---

## 6. Cấu trúc thư mục

```
chua-online/
├── server.mjs              Máy chủ: web tĩnh, WebSocket, kết nối TikTok, API quản trị, giọng đọc, công đức
├── config.json             Cấu hình (tên TikTok, quà, nhạc, giọng đọc…) — sửa tay hoặc qua /admin
├── merit.json              Bảng Công Đức (server tự tạo và ghi 3 giây/lần). Xoá file = xoá bảng
├── package.json            Phụ thuộc: express, ws, tiktok-live-connector
├── start-windows.bat       Chạy nhanh trên Windows (tự tải Node portable + npm install nếu thiếu)
├── node/                   Node.js portable do start-windows.bat tải về (có thể chưa có)
├── README.md               Hướng dẫn ngắn
├── HUONG_DAN.md            Tài liệu này
├── tạo assest.md           Bộ prompt AI để tạo ảnh nền + nhân vật
├── public/                 Mọi thứ trình duyệt tải về
│   ├── index.html          Trang màn hình game (1 canvas)
│   ├── game.js             Toàn bộ game: vẽ, nhân vật, hiệu ứng, xử lý sự kiện, đồng bộ
│   ├── music.js            Trình phát YouTube ẩn (window.BgMusic)
│   ├── admin.html          Trang quản trị (HTML + JS trong 1 file)
│   └── assets/
│       ├── nen_chua_rong.png         Ảnh nền 941×1672 (9:16)
│       ├── <nhânvật>_<tưthế>.png     33 sprite 512×512 nền trong suốt
│       └── fx/                       9 ảnh hiệu ứng quà (cá chép, hoa đăng, hoa sen, rồng…)
├── chua_online_33_sprites_v2/   Bản gốc bộ sprite (đã chép vào public/assets, có thể xoá)
└── hieu_ung_qua_chua_online/    Bản gốc ảnh hiệu ứng (đã chép vào public/assets/fx, có thể xoá)
```

---

## 7. Kiến trúc và luồng dữ liệu

```
 TikTok LIVE ──(tiktok-live-connector + Euler sign)──┐
 /test, /api/cmd (nút thử trong /admin) ─────────────┤
                                                     ▼
                                       server.mjs  emit(ev)
                                       ├─ cập nhật roster (người trong chùa)
                                       ├─ nếu là quà: tính công đức, ghi merit.json
                                       └─ broadcast(ev) qua WebSocket /ws
                                                     │
              ┌──────────────────────┬───────────────┴──────────────┐
              ▼                      ▼                              ▼
   Màn hình game (LIVE Studio)   Màn hình game (Chrome)       /admin (nhật ký)
```

**Server là nguồn gốc dữ liệu.** Mọi cửa sổ game mở cùng lúc đều thấy giống nhau:

- **Bảng Công Đức** do server tính và lưu (`merit.json`). Sự kiện quà gửi kèm `pts` (điểm quà này), `userMerit` (tổng của người đó), `total` (tổng chùa). Trang game dùng đúng các số này, không tự cộng.
- **Danh sách người trong chùa** (`roster`, chỉ trong bộ nhớ, mất khi tắt server). Cửa sổ mới mở nhận `snapshot` và cho những người này ngồi sẵn vào chỗ.
- **Ai rời phòng:** TikTok không có sự kiện rời phòng. Server dùng `roomUser` (vài giây/lần: `total` = số người **đang** xem, `ranks` = vài người xem top). Nếu số nhân vật > `total`, người im lâu nhất ra về (trừ ai vừa hoạt động trong 1 phút). Thêm vào đó, cứ 30 giây server mời ai im lặng quá `leaveAfterMinutes` ra về. Mỗi lần như vậy server gửi `leave` cho mọi cửa sổ.
- **Chỗ ngồi** chọn theo `hash(id người xem)` nên các cửa sổ xếp cùng một người vào cùng một chỗ, miễn là nhận sự kiện theo cùng thứ tự.
- **Demo và phím tắt chỉ chạy tại chỗ** trong tab `?demo=1`, không đi qua server. Muốn thử cho mọi cửa sổ cùng thấy: nút thử trong /admin.
- Chạy trang game **không có server** (mở file trực tiếp): game tự xử lý tại chỗ, công đức lưu trong `localStorage`.

### Tin nhắn WebSocket (`/ws`, JSON)

Server → trang:

| `type` | Nội dung |
|---|---|
| `status` | `state`: `starting` · `no-username` · `connecting` · `connected` · `offline` · `ended`, kèm `message` |
| `snapshot` | Gửi ngay khi kết nối: `merit`, `total`, `roster` |
| `join` · `chat` · `like` · `follow` · `share` | `user: {id, uid, name, avatar}`, `text` (chat), `count` (like) |
| `gift` | `user`, `gift: {id, name, count, diamonds, image}`, `pts`, `userMerit`, `total` |
| `viewers` | Số người đang xem |
| `leave` | `user: {id, name}`: người xem được coi là đã rời phòng → nhân vật đi ra |
| `version` | Phiên bản code (thời điểm sửa file trong `public/`). Khác lần trước → trang tự tải lại |
| `reset-merit` · `merit-sync` | Xoá bảng / thay cả bảng |
| `config` | Config vừa đổi → trang tải lại `/config.json` |
| `music` · `music-state` | Lệnh nhạc từ /admin · trạng thái nhạc từ trang game |

Trang → server:

| `type` | Nội dung |
|---|---|
| `hello` | `role: 'game'` (để /admin đếm số màn hình) |
| `emit`, `reset-merit` | **Bị server bỏ qua** (bản cũ dùng để gửi sự kiện thử; nay chặn để tab cũ hay máy khác không đẩy được người ảo, xoá bảng) |
| `merit-import` | Chuyển công đức cũ từ `localStorage` lên server (chỉ một lần, khi chưa từng có `merit.json`) |
| `music-state` | Trạng thái trình phát nhạc |

### HTTP

| Đường dẫn | Ai dùng | Ghi chú |
|---|---|---|
| `/` , `/assets/*`… | Trang game | File tĩnh trong `public/` |
| `/config.json` | Trang game | Config **đã bỏ** `signApiKey`, `adminPassword` |
| `/admin` | Người vận hành | Trang quản trị |
| `GET/POST /api/config` | /admin | Đọc/ghi config (cần quyền quản trị) |
| `POST /api/cmd` | /admin | `music` · `test` · `reset-merit` |
| `GET /api/state` | /admin | Trạng thái TikTok, nhạc, số người xem, số màn hình game |
| `GET /api/yt-title` | /admin | Lấy tên video YouTube |
| `GET /test` | Thử nhanh | Tạo sự kiện giả (không cần mật khẩu) |
| `GET /tts?text=` | Trang game | Giọng đọc tiếng Việt (mp3 từ Google Translate, có cache) |

---

## 8. Đi qua từng file

### `server.mjs`

Đọc theo thứ tự trong file:

1. **Khởi tạo:** đọc `config.json`, xác định ID TikTok (tham số dòng lệnh `node server.mjs <id>` hoặc biến `TIKTOK_USERNAME` được ưu tiên hơn config), cổng.
2. **Web tĩnh + `/config.json` công khai** (`publicConfig()` bỏ khoá bí mật).
3. **Quản trị:** `requireAdmin` cho qua nếu gọi từ chính máy (`127.0.0.1`), máy khác phải gửi header `x-admin-password`. Router `/api`: `config`, `cmd`, `yt-title`, `state`. `saveConfig()` ghi file qua file tạm rồi đổi tên (không hỏng file khi mất điện giữa chừng).
4. **`/test`, `/tts`.**
5. **Trạng thái chung:** `merit`/`totalMerit` + `saveMerit()` (3 giây/lần và khi Ctrl+C), `roster` + `touchUser()` (giữ tối đa `maxDevotees`, bỏ người ít hoạt động nhất), `findGift()`/`giftPoints()` (cùng công thức với trang game), **`emit(ev)`** (điểm vào duy nhất của mọi sự kiện người xem), `snapshot()`.
6. **WebSocket:** gửi `status` + `snapshot` khi có kết nối mới; xử lý `hello`, `merit-import`, `music-state`; bỏ qua `emit` và `reset-merit`.
7. **`mkUser()`:** chuẩn hoá người dùng TikTok về `{id, uid, name, avatar}`.
8. **Kết nối TikTok:** `connectTikTok()` thử lại sau 15 giây nếu lỗi, 30 giây sau khi live kết thúc, 10 giây khi rớt mạng. `enableExtendedGiftInfo: false` là **cố ý** (xem [mục 11](#lỗi-kết-nối-tiktok)). `wire()` gắn các sự kiện `MEMBER`, `CHAT`, `GIFT`, `LIKE`, `FOLLOW`, `SHARE`, `ROOM_USER`, `STREAM_END`, `DISCONNECTED`.
   `ROOM_USER` cập nhật số người xem từ trường **`total`** (TikTok đã bỏ `viewerCount`; `totalUser` là tổng lượt đã vào, chỉ tăng), làm mới người trong `ranks`, rồi gọi `fitToViewers()`. Các hàm `leave()`, `removeQuietest()`, `fitToViewers()` và vòng quét 30 giây nằm ngay dưới `touchUser()`.
   Quà combo (`giftType === 1`) chỉ tính khi combo kết thúc (`repeatEnd`) để không cộng trùng.

### `public/game.js`

Một IIFE duy nhất, chia khối bằng dòng `// ---- tên khối`:

| Khối | Nội dung chính |
|---|---|
| cấu hình | `DEFAULT_CONFIG` (dùng khi không tải được config), tham số URL, `autoQ()` chọn độ phân giải vẽ |
| canvas | Toạ độ logic luôn là **720 × 1280**; mọi phép vẽ nhân với `Q` qua `setTransform` |
| không gian phối cảnh | `CX`, `FLOOR_TOP/BOT`, `carpetHalf(y)` (nửa bề rộng thảm), `scaleAt(y)` (người ở xa nhỏ hơn), `CENSER`, `BELL`. **Khớp với ảnh nền**, đổi ảnh nền thì phải chỉnh lại |
| ảnh | `CHARACTERS`, `POSES`, `loadAssets()`, `buildBG()`; sprite được thu nhỏ sẵn (`prescale`) cho nhanh; tự vẽ lại nền khi khung đổi cỡ |
| âm thanh | Chuông, chuông nhỏ, mõ tổng hợp bằng WebAudio (không cần file âm thanh); `speak()` hàng chờ giọng đọc, hạ nhỏ nhạc khi đọc, lỗi thì dùng giọng của trình duyệt |
| dữ liệu & lưu trữ | `merit`, `totalMerit`, `serverSync` |
| chỗ ngồi | `addSeatRow()` tạo lưới chỗ theo **tier**: 0 = sàn hai bên thảm, 1 = trên thảm, 2 = chen giữa các hàng. Gần lư hương chừa trống thảm cho người lên dâng lễ |
| phật tử | `class Devotee`: hàng đợi hành động (`go` / `bow` / `call`), `offer()` đi lên lư hương lạy rồi về chỗ, `draw()` chọn sprite `ngoi`/`lay`/`di` và hoà dần ngồi → lạy |
| `freeSeat` / `ensureDevotee` / `seatInstant` | Cấp chỗ, mời người im lâu nhất ra về khi đầy, đặt sẵn chỗ khi nhận snapshot |
| hiệu ứng | `fx` (mảng hạt), `EFFECTS.{incense,candle,lotus,bell,fruit,koi,lantern,dragon}` |
| xử lý sự kiện | `handle(ev)` → `gift()`; `applySnapshot()`; `emitLocal()` chạy sự kiện thử tại chỗ (không gửi server) |
| kết nối máy chủ | `connect()` WebSocket, tự nối lại sau 3 giây |
| phật tử: ra về | `Devotee.exit()`: nhường chỗ, đi ra lối giữa thảm, mờ dần; gọi khi nhận `leave` |
| giả lập | `demoTick()`, phím tắt (chỉ khi `?demo=1`, biến `TEST_KEYS`) |
| vẽ động | `update(dt)` cập nhật vật lý, `render()` vẽ theo lớp: nền → hào quang → bàn thờ động → khói → hoa sen → **người (sắp theo y)** → tên/bong bóng → cá, hoa đăng, tia lửa, cánh hoa, tiền → UI → rồng → thông báo |
| vòng lặp | `requestAnimationFrame`, `dt` tối đa 0,05 giây |

API công khai: `window.ChuaOnline.handle(ev)` để đẩy sự kiện từ console.

### `public/music.js`

Trình phát YouTube IFrame ẩn, xuất ra `window.BgMusic` (`reload(cfg)`, `command(action, value)`, `duck(on)`, `state()`, `onState(fn)`). Nhận link video, `youtu.be`, shorts, playlist. Chuyển âm lượng mượt, hạ nhỏ khi đọc cảm ơn, báo trạng thái cho /admin. Trình duyệt chặn tự phát tiếng thì hiện nhắc "Bấm vào màn hình để bật nhạc nền".

### `public/admin.html`

Một file gồm CSS + HTML 4 tab + JS. Các ô nhập gắn `data-k="đường.dẫn.trong.config"` để đọc/ghi tự động. Gọi `/api/*`, nghe `/ws` để hiện nhật ký sự kiện.

---

## 9. Tham chiếu `config.json`

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `tiktokUsername` | | ID TikTok (sau `@`) |
| `signApiKey` | `""` | Key Euler Stream (bí mật, không gửi ra trang game) |
| `adminPassword` | (không có) | Mật khẩu /admin khi mở từ máy khác |
| `port` | `8080` | Cổng web. Đổi xong phải chạy lại server và sửa link trong LIVE Studio |
| `title` | `Chùa Online` | Tên trên đầu màn hình |
| `maxDevotees` | `320` | Số người ngồi tối đa |
| `leaveAfterMinutes` | `10` | Im lặng (không chat, thả tim, tặng quà…) bao nhiêu phút thì nhân vật ra về. `0` = không bao giờ |
| `sound` | `true` | Tắt toàn bộ âm thanh (chuông, mõ, giọng đọc) |
| `likeBowEvery` | `15` | Số tim để chắc chắn vái lạy |
| `chatBubbles` | `true` | Hiện bong bóng chat |
| `gifts[]` | 9 quà | Mỗi quà: `names` (tên TikTok, viết thường), `ids` (tuỳ chọn: id quà), `label`, `action`, `icon`, `effect`, `merit`, `hidden` |
| `otherGift` | | Quà ngoài bảng: `action`, `meritPerDiamond` (hiệu ứng luôn tự chọn theo số xu) |
| `thankYou` | `{name} đã {action}` | Câu cảm ơn. `{name}` người tặng · `{action}` hành động · `{gift}` biểu tượng + tên quà |
| `tts` | `true` | Đọc to lời cảm ơn |
| `ttsPrefix` | `Xin cảm ơn` | Câu mở đầu khi đọc |
| `ttsVolume` / `ttsRate` / `ttsGap` / `ttsMaxQueue` | 1 / 1.25 / 2 / 5 | Âm lượng, tốc độ, nghỉ giữa 2 câu (giây), số câu chờ tối đa (quá thì bỏ câu cũ) |
| `music.enabled` | `true` | Bật nhạc nền |
| `music.youtube[]` | `[]` | Danh sách link |
| `music.volume` / `music.duckVolume` | 30 / 10 | Âm lượng thường / khi đang đọc cảm ơn (0–100) |
| `music.shuffle` | `false` | Phát ngẫu nhiên |

Sửa tay khi server đang chạy thì phải **chạy lại server**. Sửa qua /admin thì áp dụng ngay.

---

## 10. Sửa và mở rộng

### Thêm hoặc sửa quà

Dễ nhất: /admin → tab **Quà tặng**. Tên quà TikTok gửi về xem trong **nhật ký sự kiện LIVE** ở Bảng điều khiển (dòng `🎁 … tặng <tên quà>`). Thêm tên đó (viết thường) vào `names`.

### Thay ảnh nền

1. Ảnh mới phải đúng tỉ lệ **9:16**, nên từ **1080 × 1920** trở lên để không mờ. Đặt tên `nen_chua_rong.png` trong `public/assets/`.
2. Đo lại trên ảnh mới (quy về khung 720 × 1280) rồi sửa trong khối *không gian phối cảnh* của `game.js`:
   - `CENSER` (miệng lư hương), `BELL` (chuông),
   - `FLOOR_TOP` / `FLOOR_BOT` (vùng sàn để ngồi),
   - `carpetHalf(y)` (nửa bề rộng thảm theo chiều cao),
   - `CANDLE_SLOTS`, `FRUIT_SLOTS` (chỗ nến, mâm quả trên bàn thờ).
3. Mở `?demo=1`, chụp màn hình, kiểm tra khói ra đúng lư hương và người ngồi đúng trên sàn.

### Thay hoặc thêm nhân vật

- Mỗi nhân vật cần 3 file PNG nền trong suốt, vuông, khuyên dùng 512 × 512: `<tên>_ngoi.png`, `<tên>_lay.png`, `<tên>_di.png`. Nhân vật **quay lưng**, chân/đệm chạm **mép dưới** ảnh, căn giữa ngang.
- Chép vào `public/assets/` và thêm `<tên>` vào mảng `CHARACTERS` trong `game.js`.
- Thêm nhân vật sẽ làm nhân vật của người xem cũ đổi, vì nhân vật chọn theo `hash(id + tên) % số nhân vật`.
- Prompt tạo ảnh đồng bộ phong cách: xem `tạo assest.md`.
- Đổi cỡ nhân vật: hằng số `80 * s` trong `Devotee.draw()`.

### Thêm hiệu ứng mới

1. Thêm hàm vào `EFFECTS` trong `game.js`, ví dụ `rain(n) { … }`, tạo hạt trong `fx`.
2. Nếu cần trạng thái riêng: thêm mảng vào `fx`, cập nhật trong `update(dt)`, vẽ bằng một hàm `drawXxx(g)` gọi trong `render()`.
3. Thêm biểu tượng vào `EFFECT_ICON`, thêm lựa chọn vào danh sách hiệu ứng trong `admin.html`.
4. Gán `"effect": "rain"` cho quà trong config.

### Đổi bố cục chỗ ngồi

Khối *chỗ ngồi*: `ROW_GAP` (khoảng cách hàng), `LANE` (lối đi giữa thảm), `OFFER_ZONE_Y` (vùng trống trước lư hương), vòng `for (let r = 0; r < 11; r++)` (số hàng), `step = 52 * s` (khoảng cách người trong hàng).

### Quy ước code

- Không có bước build: sửa file trong `public/` rồi Refresh trình duyệt là thấy. Sửa `server.mjs` thì phải chạy lại server.
- Kiểm tra cú pháp nhanh: `node --check server.mjs` và `node --check public/game.js`.
- Chú thích và chữ hiển thị bằng tiếng Việt.

---

## 11. Gỡ lỗi

Mọi trạng thái kết nối in trong **cửa sổ đen** dạng `[trạng thái] …` và hiện ở /admin.

### Lỗi kết nối TikTok

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| `no-username` | Chưa điền `tiktokUsername` | Điền ID TikTok |
| `Failed to retrieve Room ID from all sources` | Chưa live, sai ID, **tài khoản riêng tư**, hoặc phòng tạo lúc còn riêng tư | Kiểm tra ID; chuyển công khai; End LIVE rồi Go LIVE lại |
| `The requested user isn't online :(` | TikTok thấy tài khoản nhưng phiên live **đã kết thúc** hoặc chưa bắt đầu | Bấm Go LIVE; mở `tiktok.com/@ID/live` để chắc đang phát |
| `This endpoint requires a Business plan` | Một chức năng cần gói Euler trả phí đang được bật | Giữ `enableExtendedGiftInfo: false` trong `server.mjs`. Gói miễn phí đủ cho game |
| `lack of permission … Euler Stream` | Key không có quyền tra mã phòng qua Euler | Thường không ảnh hưởng nếu tài khoản công khai và đang live (TikTok trả mã phòng trực tiếp) |
| `429` / `rate limit` / `Signature` | Hết lượt ký của gói miễn phí | Đợi, hạn chế khởi động lại server nhiều lần; nếu lặp lại thường xuyên mới tính nâng gói |
| `Please wait…`, `you might be blocked by TikTok` | TikTok chặn tạm thời truy cập tự động | Thư viện tự thử cách khác; chỉ cần quan tâm nếu kèm lỗi không kết nối |

Thư viện `tiktok-live-connector` không chính thức. TikTok đổi hệ thống thì chạy `npm update` để lấy bản mới.

### Màn hình

| Hiện tượng | Cách xử lý |
|---|---|
| LIVE Studio báo *Enter correct URL* | Dùng `http://localtest.me:8080/?clean=1` (xem mục 4) |
| `localtest.me` không mở được / LIVE Studio hiện chùa trống (máy khác thì được) | Router hoặc nhà mạng chặn tên miền trỏ về 127.0.0.1. Chạy lại `start-windows.bat` và bấm **Yes** khi Windows hỏi quyền Admin: nó ghi `127.0.0.1 localtest.me` vào file `hosts` (một lần), sau đó không cần mạng, không bị chặn nữa. Tự làm tay: mở Notepad bằng *Run as administrator*, mở `C:\Windows\System32\drivers\etc\hosts`, thêm dòng `127.0.0.1 localtest.me`, lưu lại. |
| Game nằm giữa, viền đen hai bên | Bật **Custom resolution** 1080 × 1920 trong nguồn Link |
| Hình mờ | Bỏ `q=` khỏi link để game tự khớp độ phân giải; Refresh nguồn. Ảnh nền gốc 941×1672 nên ở 1080p nền hơi mềm hơn nhân vật |
| Các cửa sổ hiển thị khác nhau | Refresh cửa sổ lệch. Kiểm tra cửa sổ có kết nối server (không mở bằng file trực tiếp) |
| Sửa code nhưng không thấy đổi | Chạy lại server: màn hình game tự tải lại khi thấy code đổi (server gửi `version`). Server cũng dặn trình duyệt không lưu tạm file html/js/css. Màn hình đang chạy bản cũ (trước khi có tính năng này) thì Refresh nguồn một lần |

### Vẫn thấy người ảo

Người ảo có tên dạng `Minh Anh 42`, `Thu Hà`, `bé Na` (id bắt đầu bằng `demo-`).

Bản hiện tại không để demo hay phím gõ nhầm lọt sang màn hình live. Nếu vẫn thấy người ảo trên màn hình live:

1. **Refresh** nguồn trong LIVE Studio: cửa sổ đang chạy code cũ (trước khi chặn phím) hoặc vẫn giữ người ảo cũ trong bộ nhớ.
2. Kiểm tra link nguồn **không có** `demo=1`.
3. Người ảo cũ còn trong danh sách của server (từ bản cũ hoặc từ nút thử /admin): **chạy lại server** để xoá danh sách người trong chùa, rồi Refresh nguồn.
4. Công đức ảo đã cộng: /admin → **Xoá Bảng Công Đức** (xoá cả công đức thật).

### Khác

| Hiện tượng | Cách xử lý |
|---|---|
| Ít người tự vào chùa | TikTok chỉ báo "vào phòng" cho một phần người xem. Ai chat, thả tim, tặng quà đều được thêm vào |
| Người đã rời live vẫn ngồi trong chùa | Bình thường trong vài phút: TikTok không báo ai rời phòng. Họ sẽ ra về khi số người xem giảm, hoặc sau `leaveAfterMinutes` phút im lặng. Muốn ra nhanh hơn: giảm số phút trong /admin → Cài đặt |
| Người đang xem mà im lặng bị mời ra | Tăng `leaveAfterMinutes` (hoặc đặt 0). Họ quay lại ngay khi chat, thả tim hay tặng quà |
| Quà không nhận | Xem tên quà trong nhật ký /admin, thêm vào `names` |
| Không có nhạc / "Bấm vào màn hình để bật nhạc nền" | Chrome chặn tự phát tiếng: bấm vào trang. Video bị bỏ qua (mã lỗi 101/150 trong F12 → Console): chủ kênh không cho nhúng, chọn video khác |
| Không có giọng đọc | Cần mạng (lấy giọng từ Google Translate); không được thì dùng giọng của trình duyệt. Kiểm tra `tts` và `sound` đang bật |
| Cổng 8080 bị chiếm | Đổi `port`, sửa link theo |
| Tắt server không có cửa sổ đen | Task Manager → tắt tiến trình **Node.js** |
| "Tai Node that bai" | Kiểm tra mạng, hoặc chép thư mục `node\` từ máy khác sang. Thư mục `node\` hỏng thì xoá đi rồi chạy lại |

---

## 12. Bảo mật và giới hạn đã biết

- **Khoá bí mật:** `signApiKey` và `adminPassword` nằm trong `config.json`. Không gửi file này cho người khác, không đưa lên GitHub công khai. Trang game chỉ nhận bản đã bỏ khoá.
- **Sự kiện thử không cần mật khẩu:** URL `/test` nhận từ bất kỳ máy nào truy cập được cổng 8080 (WebSocket `emit` / `reset-merit` đã bị chặn). Trong mạng nhà thì ổn; **không mở cổng 8080 ra internet** và không đưa game lên link công khai (ngrok, cloudflared…) khi chưa chặn các đường này.
- **Danh sách người trong chùa** chỉ nằm trong bộ nhớ server: tắt server là mất (công đức thì còn trong `merit.json`).
- **Đồng bộ là đồng bộ trạng thái, không phải từng khung hình:** hai cửa sổ cùng có đúng người, đúng chỗ, đúng công đức, nhưng chuyển động, khói, hạt hiệu ứng là ngẫu nhiên riêng mỗi cửa sổ.
- **Chất lượng ảnh:** theo README của bộ sprite v2, 24/33 sprite được cắt và phóng từ ảnh tổng hợp nên kém nét hơn (rõ nhất ở tư thế lạy); một số chi tiết trang phục chưa đúng. Ảnh nền 941×1672 thấp hơn 1080×1920.
- **Chuông** trong ảnh nền là ảnh tĩnh: quà "Thỉnh chuông" có tiếng và sóng âm nhưng chuông không đung đưa.
