# HƯỚNG DẪN HỆ THỐNG BẢN QUYỀN THƯƠNG MẠI RECORDLY
*(Hỗ trợ Kích hoạt theo Mã Máy Offline & Bán tự động qua Payhip)*

---

## 1. Cơ chế hoạt động của Bản quyền (Dual License)

Hệ thống được thiết kế tối ưu cho cả **Thị trường Việt Nam** và **Quốc tế**:

1. **Kích hoạt theo Mã Máy (Machine ID - Offline):**
   - Mỗi máy tính Windows khi cài Recordly sẽ tự động sinh một mã máy phần cứng duy nhất (VD: `REC-8F92-4A1C-9B3D`). Mã này tổng hợp từ CPU ID, tên máy tính, phiên bản hệ thống và MAC address, chống giả mạo.
   - Khách hàng gửi Mã Máy qua Email hoặc Zalo cho bạn kèm biên nhận thanh toán.
   - Bạn chỉ cần chạy 1 lệnh để tạo **License Key** độc nhất chỉ dùng được trên máy tính đó. Nếu copy key mang sang máy khác sẽ bị từ chối kích hoạt ngay lập tức.
   - Khách hàng không cần có internet vẫn kích hoạt thành công (Offline 100%).

2. **Kích hoạt tự động qua Payhip (Online - Quốc tế):**
   - Đưa Recordly lên **Payhip.com** dưới dạng Software Product và bật tính năng **"Generate license keys"**.
   - Khách quốc tế thanh toán qua Visa / Mastercard / PayPal.
   - Payhip tự động gửi License Key qua email cho khách.
   - Khách nhập key đó vào Recordly, phần mềm gọi API Payhip để kích hoạt bản quyền PRO ngay tức thì.

---

## 2. Cách Tạo Mã Kích Hoạt (Dành riêng cho Bạn - Tác giả)

Bạn có một công cụ Keygen bí mật nằm tại: `scripts/keygen.mjs`.

### Cú pháp lệnh:
```bash
node scripts/keygen.mjs <MÃ_MÁY> <THỜI_HẠN>
```

### Các ví dụ cụ thể:

- **Cấp bản quyền Vĩnh viễn (Lifetime):**
  ```bash
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D lifetime
  ```
  *Kết quả xuất ra License Key vĩnh viễn:*
  `REC-8F924A1C9B3D-0-6C2A7FB94D81E57A`

- **Cấp bản quyền 1 Năm (365 ngày):**
  ```bash
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D 365d
  ```

- **Cấp bản quyền 1 Tháng (30 ngày):**
  ```bash
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D 30d
  ```

- **Cấp dùng thử 7 Ngày (7 ngày):**
  ```bash
  node scripts/keygen.mjs REC-8F92-4A1C-9B3D 7d
  ```

👉 **Bạn chỉ cần copy chuỗi License Key xuất ra và gửi lại cho khách hàng.**

---

## 3. Quy trình Trải nghiệm của Khách hàng

1. **Khách mở Recordly:**
   - Trên thanh công cụ trên cùng có nút cam nổi bật: **⚡ KÍCH HOẠT PRO**.
   - Hoặc trong menu `...` có mục **👑 Bản quyền PRO**.
   - Hoặc khi khách nhấn **Export** xuất video, nếu chưa có PRO app sẽ mở cửa sổ kích hoạt.

2. **Cửa sổ Kích hoạt hiển thị:**
   - **Mã máy của bạn:** `REC-XXXX-XXXX-XXXX` cùng nút **[Sao chép]**.
   - Ô nhập **Mã kích hoạt (License Key)**.
   - Nút **[Kích hoạt bản quyền]**.
   - Hướng dẫn chuyển khoản / gửi email cấp key + nút **[Mua qua Payhip]**.

3. **Sau khi nhập Key:**
   - App thông báo: *"Chúc mừng! Bản quyền PRO đã được kích hoạt thành công!"*.
   - Nút trên thanh Header tự động đổi thành icon vương miện xanh ngọc: **✨ PRO ACTIVE**.
   - Toàn bộ tính năng xuất video chất lượng cao được mở khóa hoàn toàn vĩnh viễn.

---

## 4. Bảo mật Secret Key (Tùy biến bí mật của riêng bạn)

Mã bí mật dùng để mã hóa HMAC nằm ở:
- File `electron/ipc/license/licenseService.ts`
- File `scripts/keygen.mjs`

Biến `LICENSE_SECRET_KEY`:
```typescript
const LICENSE_SECRET_KEY = "RECORDLY_PRO_MASTER_SECRET_2026_COMMERCIAL";
```
*Bạn có thể đổi chuỗi này thành bất kỳ mật khẩu nào của riêng bạn. Lưu ý: Khi đổi, phải đổi giống nhau ở cả 2 file trên!*
