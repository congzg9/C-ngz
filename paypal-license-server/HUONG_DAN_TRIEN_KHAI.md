# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG THANH TOÁN TỰ ĐỘNG PAYPAL (0% PHÍ SÀN)

Hệ thống này giúp bạn:
- **Tự động 100%:** Khách trả tiền ➔ Màn hình hiện mã kích hoạt ngay ➔ Đồng thời tự động gửi email cho khách.
- **Tiền về thẳng 100% PayPal của bạn**, không mất 5% phí của Payhip hay bất kỳ bên thứ 3 nào.
- **Chi phí duy trì server:** 0 đồng/tháng (Chạy miễn phí trên Vercel).

---

## BƯỚC 1: Lấy PayPal Client ID & Secret (Mất 2 phút)

1. Truy cập trang nhà phát triển của PayPal: **https://developer.paypal.com**
2. Đăng nhập bằng tài khoản PayPal của bạn.
3. Vào mục **Dashboard** (góc trên bên phải) ➔ Chọn **Apps & Credentials**.
4. Chọn tab **Live** (để nhận tiền thật) hoặc **Sandbox** (để thử nghiệm):
   - Bấm **Create App**.
   - Đặt App Name: `Recordly Store`.
   - Bấm **Create App**.
5. Bạn sẽ thấy:
   - **Client ID** (Một chuỗi ký tự dài).
   - **Secret** (Bấm chữ *Show* để copy).

---

## BƯỚC 2: Triển Khai Lên Vercel Miễn Phí (Mất 1 phút)

1. Đăng ký tài khoản miễn phí tại **https://vercel.com** (Đăng nhập bằng tài khoản GitHub của bạn).
2. Tạo 1 repository mới trên GitHub và tải thư mục `paypal-license-server/` lên.
3. Trên Vercel, bấm **Add New...** ➔ **Project** ➔ Chọn repo vừa tạo.
4. Tại mục **Environment Variables** (Biến môi trường), thêm các biến sau:
   - `PAYPAL_MODE`: `live`
   - `PAYPAL_CLIENT_ID`: *(Dán Client ID ở Bước 1 vào)*
   - `PAYPAL_CLIENT_SECRET`: *(Dán Secret ở Bước 1 vào)*
   - `LICENSE_SECRET_KEY`: `RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL`
   - *(Tùy chọn nếu muốn gửi mail tự động qua Gmail của bạn):*
     - `GMAIL_USER`: `email_cua_ban@gmail.com`
     - `GMAIL_APP_PASSWORD`: `mat_khau_ung_dung_google_16_chu_cai`
5. Bấm **Deploy**.
6. Sau 30 giây, Vercel sẽ cấp cho bạn một tên miền miễn phí dạng:  
   👉 `https://recordly-license-xxx.vercel.app`

---

## BƯỚC 3: Cập Nhật Client ID Vào Trang Thanh Toán

Mở file `paypal-license-server/public/index.html`:
Tại dòng 163:
```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&currency=USD"></script>
```
Thay `YOUR_PAYPAL_CLIENT_ID` bằng **Client ID** thật của bạn ở Bước 1.

---

## BƯỚC 4: Hoàn Tất

Bây giờ khi khách mở ứng dụng Recordly:
1. Bấm *"Mua bản quyền tự động qua PayPal ($29)"*.
2. Trình duyệt tự mở trang thanh toán với Mã máy được điền sẵn.
3. Khách thanh toán qua PayPal/Thẻ ➔ Tiền vào ví bạn ➔ Khách có mã ngay trên màn hình và trong email!
