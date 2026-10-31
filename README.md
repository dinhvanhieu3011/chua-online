# 🙏 Chùa Online — game tương tác cho TikTok LIVE

Người xem vào live → nhân vật của họ đi vào chùa, ngồi lễ.
Bình luận → hiện bong bóng chat trên đầu nhân vật.
Tặng quà → nhân vật lên trước lư hương vái lạy, kèm hiệu ứng và điểm **công đức** trên **Bảng Công Đức**.

| Quà TikTok | Hiệu ứng | Công đức |
|---|---|---|
| Hoa hồng (Rose), TikTok | Thắp nén hương (khói bốc lên) | 1 |
| Tim ngón tay (Finger Heart) | Thắp nến trước bàn thờ | 5 |
| Bó hoa (Rosa) | Dâng hoa sen (sen nở, cánh hoa rơi) | 10 |
| Bánh donut (Doughnut) | Thỉnh chuông (sóng âm lan từ chuông + tiếng chuông) | 10 |
| Tay bắn tim (Hand Hearts) | Dâng mâm ngũ quả | 20 |
| Chó Corgi | Phóng sinh cá chép | 49 |
| Súng tiền (Money Gun) | Thả hoa đăng | 99 |
| Sư tử (Lion) | Rồng Vàng hộ pháp + mưa tiền vàng + "ĐẠI CÔNG ĐỨC" | 299 |

Quà khác không có trong bảng vẫn được tính: công đức = số xu × số lượng, hiệu ứng tự chọn theo giá trị quà.
Thích (tim) → nhân vật vái lạy. Theo dõi / chia sẻ → hiện thông báo.

> 📘 Hướng dẫn đầy đủ (đưa lên TikTok LIVE Studio từng bước, kiến trúc, từng file, cách mở rộng, gỡ lỗi): **[HUONG_DAN.md](HUONG_DAN.md)**

---

## 1. Cài đặt (làm 1 lần)

**Windows không cần cài Node.js**: nếu máy chưa có, `start-windows.bat` tự tải bản portable vào thư mục `node\` (lần đầu cần mạng).

1. Giải nén thư mục `chua-online` ra máy (ví dụ `D:\chua-online`).
2. Mở file `config.json` bằng Notepad (tải code từ GitHub thì chưa có file này: copy `config.example.json` thành `config.json`, hoặc chạy server một lần là tự tạo), sửa dòng:
   ```json
   "tiktokUsername": "ten_tiktok_cua_ban",
   ```
   thành tên TikTok của bạn (phần sau chữ @, ví dụ `"chuaonline.official"`).
3. **Windows:** bấm đúp `start-windows.bat` (tự tải Node và cài thư viện nếu thiếu).
   **Mac/Linux:** cài Node.js 20+ (https://nodejs.org), mở Terminal trong thư mục, chạy `npm install` rồi `npm start`.

**Chuyển máy:** chạy `start-windows.bat` một lần → nén cả thư mục → giải nén ở máy mới → bấm đúp `start-windows.bat`.

Cửa sổ đen hiện:
```
🙏  Chùa Online đang chạy
➜  Link cho LIVE Studio: http://localtest.me:8080/?clean=1
```
Giữ cửa sổ này mở trong suốt buổi live.

## 2. Chạy thử trước khi live

Mở trình duyệt vào **http://localtest.me:8080/?demo=1** — chùa sẽ tự có người ảo vào, chat, tặng quà.
Phím tắt để thử từng hiệu ứng (bấm vào trang trước):

- `J` có người vào · `C` có người chat
- `1`…`8` lần lượt: hoa hồng, tim ngón tay, bó hoa, donut, tay bắn tim, corgi, súng tiền, sư tử
- `D` bật/tắt giả lập · `Shift + R` xoá bảng công đức hiển thị trong tab thử

Phím tắt chỉ chạy khi link có `?demo=1`, và người ảo chỉ hiện trong chính tab đó (không sang màn hình live).
- `M` tắt/bật nhạc nền · `N` chuyển bài giảng tiếp theo

Thử nhanh một bài giảng YouTube mà không cần sửa config: `http://localtest.me:8080/?demo=1&yt=<link YouTube>`.

## 3. Đưa lên live

Bạn phải **đang live** thì máy chủ mới kết nối được (nó tự thử lại 15 giây/lần, nên có thể bật trước).

**Cách A — TikTok LIVE Studio (máy tính):**
1. Thêm nguồn (Add source) → **Link / Browser** (nếu có) → dán `http://localtest.me:8080/?clean=1`, kích thước **720 × 1280**.
2. Nếu bản LIVE Studio của bạn không có nguồn Link: mở `http://localtest.me:8080/?clean=1` bằng Chrome, nhấn F11 cho toàn màn hình, rồi thêm nguồn **Window capture / Chụp cửa sổ** chọn cửa sổ Chrome.
3. Để màn hình dọc (portrait).

**Cách B — OBS Studio (cần có stream key TikTok):**
Sources → `+` → **Browser** → URL `http://localtest.me:8080/?clean=1`, Width `720`, Height `1280`.
Tick "Control audio via OBS" nếu muốn tiếng chuông, giọng đọc và nhạc nền ra live.
Muốn nét hơn: dùng `http://localtest.me:8080/?clean=1&q=1.5` với kích thước 1080 × 1920.

Khi kết nối thành công, góc dưới màn hình hiện `● Đã kết nối LIVE @ten_cua_ban` trong vài giây
(tham số `?clean=1` ẩn dòng này; bỏ `clean=1` khi cần kiểm tra lỗi).

## 4. Trang quản trị — http://localtest.me:8080/admin

Mở trong một tab Chrome riêng (không phải trong OBS) để điều khiển trong lúc live:

- **Bảng điều khiển:** trạng thái kết nối TikTok, số người xem, nhạc đang phát (phát/dừng, chuyển bài, tắt tiếng,
  kéo âm lượng, bấm thanh tiến trình để tua), nút thử từng quà, nhật ký sự kiện LIVE, xoá Bảng Công Đức.
- **Nhạc nền:** dán link YouTube (nhiều link mỗi dòng một link), xem tên video, đổi thứ tự, xoá, bấm ▶ để phát ngay bài đó.
- **Quà tặng:** sửa bảng quà → hiệu ứng → công đức, thêm quà mới.
- **Cài đặt:** tên TikTok (lưu xong tự kết nối lại), tên chùa, giọng đọc cảm ơn, mật khẩu quản trị.

Bấm **💾 Lưu** ở cuối trang: `config.json` được ghi lại và màn hình game tự áp dụng ngay, không cần tải lại.
Nhạc phát trên **màn hình game** (OBS / LIVE Studio / Chrome), trang quản trị chỉ điều khiển.

Mở trang quản trị từ **điện thoại cùng wifi** (`http://<IP máy tính>:8080/admin`): phải đặt mật khẩu ở tab Cài đặt trước.
Không có mật khẩu thì trang chỉ mở được trên chính máy chạy server.

## 5. Tuỳ chỉnh (`config.json`)

Có thể sửa mọi thứ trong trang quản trị; hoặc sửa tay bằng Notepad rồi chạy lại server:

- `title` — tên hiển thị trên đầu (mặc định "Chùa Online").
- `maxDevotees` — số người ngồi tối đa (người im lâu nhất sẽ nhường chỗ).
- `sound` — `true`/`false` bật tắt tiếng chuông, mõ.
- `gifts` — danh sách quà. Mỗi quà gồm:
  - `names`: tên quà TikTok trả về (viết thường, tiếng Anh). Nếu quà không nhận, xem tên quà trong nhật ký sự kiện LIVE ở trang `/admin` và thêm vào đây.
  - `label`, `action`, `icon`: chữ hiển thị.
  - `effect`: một trong `incense`, `candle`, `lotus`, `bell`, `fruit`, `koi`, `lantern`, `dragon`.
  - `merit`: công đức cho mỗi quà.
  - `hidden: true` để không hiện trong bảng "Tặng quà để...".
- `music` — nhạc nền / bài giảng phát từ YouTube (chỉ phát tiếng, không hiện video):
  - `youtube`: danh sách link, ví dụ
    ```json
    "youtube": [
      "https://www.youtube.com/watch?v=xxxxxxxxxxx",
      "https://youtu.be/yyyyyyyyyyy"
    ]
    ```
    Phát lần lượt, hết danh sách thì quay lại từ đầu (1 link thì lặp lại mãi). Cũng dán được link **playlist**
    (`https://www.youtube.com/playlist?list=...`) — khi đó chỉ phát playlist đó.
    Để trống `[]` là không có nhạc.
  - `volume`: âm lượng 0–100 (mặc định 30).
  - `duckVolume`: âm lượng khi đang đọc lời cảm ơn (mặc định 10), đọc xong nhạc to lại.
  - `shuffle`: `true` để phát ngẫu nhiên.
  - `enabled`: `false` để tắt hẳn. Tắt tạm cho một nguồn: thêm `&music=0` vào URL.

Bảng công đức do máy chủ giữ (file `merit.json`), mọi cửa sổ game đều thấy giống nhau và được lưu giữa các buổi live. Muốn xoá: nút **Xoá Bảng Công Đức** trong `/admin`.

## 6. Gỡ lỗi thường gặp

- **"Failed to retrieve Room ID"** / **"UserOfflineError"**: bạn chưa live, sai tên TikTok, hoặc mạng chặn. Kiểm tra lại tên, bắt đầu live rồi đợi 15 giây.
- **Bị giới hạn / lỗi sign (429, rate limit)**: thư viện kết nối dùng máy chủ ký của Euler Stream. Tạo key miễn phí tại https://www.eulerstream.com rồi dán vào `"signApiKey"` trong `config.json`. Gói miễn phí là đủ; lỗi "requires a Business plan" xem HUONG_DAN.md mục 11.
- **Tài khoản riêng tư**: server không thấy phòng live. Chuyển tài khoản sang công khai rồi End LIVE → Go LIVE lại.
- **LIVE Studio báo "Enter correct URL"**: dùng `http://localtest.me:8080/?clean=1` thay cho `localhost`, bật Custom resolution 1080 × 1920.
- **Không có người vào**: TikTok chỉ gửi sự kiện "vào phòng" cho một phần người xem; người chat, thả tim hoặc tặng quà luôn được thêm vào chùa.
- **Port 8080 bị chiếm**: đổi `"port"` trong `config.json`, nhớ đổi URL theo.
- **Không có nhạc nền / hiện "♪ Bấm vào màn hình để bật nhạc nền"**: Chrome chặn tự phát tiếng — bấm vào trang một lần.
  OBS / LIVE Studio (nguồn Browser) thường tự phát được. Nếu một video bị bỏ qua, mở cửa sổ F12 → Console:
  mã lỗi `101`/`150` nghĩa là chủ kênh không cho phát nhúng, hãy chọn video khác. Máy cần có mạng để tải YouTube.

> Kết nối dùng thư viện không chính thức `tiktok-live-connector` (không thuộc TikTok). TikTok có thể thay đổi hệ thống bất cứ lúc nào; khi đó chạy `npm update` để lấy bản mới.

## Cấu trúc

```
server.mjs        máy chủ: nhận sự kiện TikTok LIVE → gửi cho trang game qua WebSocket
config.json       cấu hình (tên TikTok, quà, công đức)
public/index.html trang game
public/game.js    logic game, hiệu ứng (canvas 720×1280)
public/music.js   nhạc nền / bài giảng YouTube (trình phát ẩn)
public/admin.html trang quản trị (/admin)
public/assets/    ảnh nền chùa + 33 sprite nhân vật (11 nhân vật × ngồi/lạy/đi) + fx/ ảnh hiệu ứng quà
merit.json        Bảng Công Đức (máy chủ tự tạo)
HUONG_DAN.md      hướng dẫn đầy đủ
```
