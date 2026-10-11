# Hướng dẫn Triển Khai Recordly: Chrome Extension & Cloudflare Pages

Dự án đã được kiến trúc và đóng gói thành 2 phần độc lập, phối hợp nhịp nhàng với nhau:
1. **Chrome Extension (Manifest V3)**: Chuyên trách quay màn hình, cửa sổ, tab, thu âm micro và ghi nhận telemetry chuyển động chuột (phục vụ tính năng Auto-Zoom).
2. **Web Video Editor (Cloudflare Pages)**: Chạy 100% Client-Side trên trình duyệt bằng WebCodecs và PixiJS WebGL, lưu trữ qua IndexedDB, render và xuất video MP4/WebM/GIF miễn phí không tốn tài nguyên server.

---

## 1. Cài đặt và sử dụng Chrome Extension

Thư mục tiện ích nằm tại: `c:\Users\cong\Downloads\Recordly-main - Copy\extension`

### Các bước cài đặt:
1. Mở trình duyệt Google Chrome (hoặc Brave, Edge, Cốc Cốc, v.v.).
2. Truy cập vào trang quản lý tiện ích: `chrome://extensions/`
3. Bật công tắc **Developer mode (Chế độ cho nhà phát triển)** ở góc trên bên phải.
4. Bấm nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên bên trái.
5. Điều hướng và chọn thư mục: `extension` trong thư mục dự án của bạn.
6. Ghim biểu tượng **Recordly** lên thanh công cụ trình duyệt để tiện sử dụng.

### Cách sử dụng Extension:
- Bấm vào icon Recordly trên thanh công cụ để mở Popup.
- Bật/tắt Micro, chọn số khung hình (30/60 FPS).
- Tùy chỉnh URL Editor (Mặc định local: `http://localhost:5173` hoặc điền domain Cloudflare Pages của bạn).
- Bấm **Start Recording** -> Chọn Toàn màn hình hoặc Cửa sổ / Tab bạn muốn quay.
- Khi quay xong, bấm **Stop Recording** trong popup (hoặc thanh Stop sharing của Chrome).
- Extension sẽ **tự động mở tab Web Video Editor** và nạp video cùng dữ liệu chuột vào Timeline để bạn chỉnh sửa ngay lập tức!

---

## 2. Kiểm tra chạy thử Web Video Editor tại Local

Để kiểm tra Web Editor chạy độc lập không cần Electron:
```bash
# Chạy dev server chế độ Web
npm run dev:web

# Hoặc preview bản build đã tối ưu
npm run preview:web
```
Mở trình duyệt truy cập: `http://localhost:5173`

---

## 3. Triển khai Web Video Editor lên Cloudflare Pages (Miễn phí 100%)

Thư mục build tĩnh đã tạo sẵn: `dist-web`

### Cách 1: Deploy bằng dòng lệnh Wrangler (Khuyên dùng - Nhanh nhất)
Chỉ cần chạy lệnh sau trong terminal:
```bash
npx wrangler pages deploy dist-web --project-name recordly
```
*(Nếu là lần đầu, Wrangler sẽ mở trình duyệt để bạn đăng nhập vào tài khoản Cloudflare miễn phí. Sau khi hoàn tất bạn sẽ nhận được 1 link dạng: `https://recordly-xxx.pages.dev`)*.

---

### Cách 2: Kết nối tự động qua GitHub Repo trên Cloudflare Dashboard
Nếu bạn đã đẩy code lên GitHub:
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) -> Chọn mục **Workers & Pages**.
2. Bấm **Create application** -> Chọn tab **Pages** -> **Connect to Git**.
3. Chọn Repository GitHub của bạn.
4. Tại phần **Build configuration**:
   - **Framework preset**: `Vite` (hoặc `None`)
   - **Build command**: `npm run build:web`
   - **Build output directory**: `dist-web`
5. Bấm **Save and Deploy**. Cloudflare sẽ tự động build và cấp domain HTTPS miễn phí.

---

## 4. Kết nối Extension với Cloudflare Pages của bạn
Sau khi deploy xong lên Cloudflare Pages:
1. Bấm vào icon **Recordly Extension** trên Chrome.
2. Bấm vào mục **Editor Target URL**.
3. Dán link Cloudflare Pages của bạn vào (ví dụ: `https://recordly-editor.pages.dev`).
4. Từ nay mỗi khi bạn quay màn hình xong bằng Extension, video sẽ tự động bay sang trang Cloudflare của bạn để cắt ghép, zoom và export!
