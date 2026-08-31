# Nhật ký thay đổi

Tài liệu này ghi lại các tính năng mới, điều chỉnh hành vi, sửa lỗi và thay đổi tương thích của CardBuilding.

## [Chưa phát hành] — Phase 4 Nghiệm thu và sửa lỗi

### Điều chỉnh

- Đổi nút "Dừng AI" trên thanh tiêu đề thành lối vào "Nhiệm vụ AI", bảng nhiệm vụ sẽ liệt kê loại tạo, nhà cung cấp và mô hình của yêu cầu hiện tại, hỗ trợ dừng từng mục hoặc dừng toàn bộ.

### Sửa lỗi

- Sửa lỗi tham chiếu cấu hình bàn làm việc thanh trạng thái muộn hơn việc khởi tạo computed property và listener tự thực thi, dẫn đến lỗi `Cannot access before initialization` và trắng trang khi mở giao diện.

## [Chưa phát hành] — Phase 4 Sáng tác có cấu trúc & Chế độ dự án

### Thêm mới

- Nhân vật chính có cấu trúc tiếp tục sử dụng 5 nhóm trường và `extensions.cardforge_main_characters`, bổ sung 5 nhóm khóa trường AI: Thân phận, Ngoại hình, Tính cách hành vi, Ngôn ngữ quan hệ, Bối cảnh bí mật.
- Bổ sung tóm tắt bản nháp và xác nhận "Áp dụng và tiêm" trước khi ghi một nhân vật vào Worldbook; liên kết nhân vật đơn lẻ/hàng loạt ban đầu tiếp tục được bảo lưu.
- Toàn bộ các mục được tạo mới hoặc AI áp dụng thông qua `cardStore.addWorldEntry()` đều được chuẩn hóa an toàn các giá trị mặc định: khử trùng lặp từ khóa, vị trí, xác suất, độ sâu, đệ quy, thời gian hồi...
- Bàn làm việc bổ sung giá dự án đa thẻ: Dự án có thể tạo, chuyển đổi, lưu, xóa và lưu trữ snapshot thẻ nhân vật hoàn chỉnh trong cài đặt cục bộ; tương thích hoàn toàn với việc xuất nhập thẻ đơn trước đây.
- AI tạo NPC và Worldbook tiếp tục kế thừa quy trình "Chọn từ danh sách kết quả rồi áp dụng", mã nguồn cốt lõi tạo Worldbook bằng AI được giữ nguyên.

## [Chưa phát hành] — Phase 3 Tối giản hóa giao diện nền

### Điều chỉnh

- Loại bỏ 60 hạt bụi sao rơi, dải sáng lửa bao quanh cửa sổ, hiệu ứng quét sáng lặp của nút bấm và component lửa ở góc chưa sử dụng.
- Nền mặc định chuyển sang dải màu tối mờ độ bão hòa thấp, màu nhấn thống nhất là xanh mòng két tiết chế; thanh tiêu đề và thanh bên tăng cường phân lớp bề mặt ổn định.
- Hình nền tích hợp chuyển sang chế độ mặc định tắt, có thể bật bất kỳ lúc nào tại mục "Hình nền" ở thanh bên, cài đặt được lưu cục bộ.
- Giữ lại các hoạt họa chức năng như đang tải, tiến trình và phản hồi hover nhanh; bổ sung kiểu tiêu điểm bàn phím thống nhất và hạ cấp `prefers-reduced-motion`.

## [Chưa phát hành] — Phase 2 Tăng cường thống nhất tầng dịch vụ AI

### Thêm mới

- Chuyển toàn bộ yêu cầu AI sang tiến trình chính của Electron, tiến trình kết xuất tiếp tục dùng giao diện `apiStore.chat()` ban đầu thông qua bộ chuyển đổi IPC tương thích.
- Hỗ trợ thống nhất thời gian chờ mặc định 90 giây, cấu hình thử lại theo lũy thừa lùi, hủy bằng `AbortSignal` và nút toàn cục "Dừng AI" trên thanh tiêu đề.
- Phản hồi thông thường và stream của OpenAI, Claude, Gemini được phân tích thống nhất tại tiến trình chính, sự kiện stream được cách ly theo ID yêu cầu.
- Chuyển truy vấn danh sách mô hình API sang tiến trình chính; API Key của Gemini chuyển sang truyền qua header yêu cầu, không còn xuất hiện trong URL.
- API Key được mã hóa bằng `safeStorage` của Electron trước khi ghi vào file cài đặt; các cài đặt dạng văn bản thuần sẵn có sẽ tự động chuyển đổi trong lần lưu tiếp theo.
- Trang cài đặt API bổ sung tổng quan sử dụng cục bộ: số lượt yêu cầu/thất bại, ước tính token và thời gian trung bình, có thể xóa sạch bất kỳ lúc nào.
- Bộ điều phối AI tích hợp hàng đợi yêu cầu đồng thời tối đa 3 luồng, các tác vụ đang xếp hàng và đang chạy đều có thể hủy.
- Thống kê sử dụng ưu tiên đọc usage gốc của OpenAI, Claude, Gemini; chỉ khi thiếu mới ước tính theo ký tự và đánh dấu riêng.
- Ngân sách ngữ cảnh thẻ được tính toán linh hoạt theo 12% cửa sổ ngữ cảnh của mô hình (phạm vi bảo vệ 6.000–48.000 ký tự); quy trình tạo Worldbook bằng AI giữ nguyên theo ràng buộc cứng.
- Trình phân tích đối tượng JSON tự kiểm tra ngữ nghĩa NPC được kết nối vào bộ sửa lỗi dung sai thống nhất; loại bỏ 3 bộ triển khai fetch trực tiếp còn sót lại ở tiến trình kết xuất.

## [Chưa phát hành] — Phase 1 Bàn làm việc thanh trạng thái (Thay thế 3 trang + Thu gom tính năng nâng cao)

### Thêm mới

- **Bàn làm việc thanh trạng thái** (Lối vào cấp 1 ở thanh bên, `/workbench`): Trang đơn 3 cột hoàn thành toàn bộ quy trình "Định nghĩa biến → Xem trước thời gian thực → Tiêm".
  - Cột trái Kho biến: Quản lý nhóm, sắp xếp kéo thả, 6 preset nhanh + preset tùy chỉnh (liên thông lưu trữ với trang MVU cũ).
  - Cột giữa Chỉnh sửa biến có kiểu dữ liệu và cấu hình chung; huy hiệu kiểm tra thời gian thực (lỗi sẽ chặn việc tiêm).
  - Cột phải Xem trước thời gian thực (Đường ống mock iframe): Chuyển đổi tức thì 5 chủ đề × 3 bố cục; **Khu vực thử nghiệm biến** (Sửa biến thủ công để xem phản hồi giao diện + Ảnh chụp ngữ cảnh, tích hợp năng lực sandbox cũ); Mã nguồn có thể mở rộng sửa thủ công và quay lại bản sinh tự động 1 chạm.
  - 3 lối vào AI: AI thiết kế phương án biến / Tạo trọn bộ 1 chạm (Phương án + HTML cơ bản) / AI làm đẹp HTML hiện tại (Bảo lưu cơ chế viết tiếp khi bị ngắt quãng). Phân tích JSON thống nhất qua json-repair.
- **Trình tạo mã HTML tự động** (statusbar-compiler.js): Biến có cấu trúc → Mã HTML thanh trạng thái và toàn bộ sản phẩm bộ MVU hoàn chỉnh, xem trước chính là sản phẩm cuối, không rủi ro ngắt quãng.
- **Modal xem trước tiêm**: Danh sách hành động từng mục + Chiến lược "Thay thế / Gộp bổ sung" khi xung đột + Xem sản phẩm chính.
- **Chế độ thuần văn bản tích hợp vào bàn làm việc**: Nguồn trạng thái có thể chọn biến MVU hoặc thuần văn bản (AI xuất `<StatusData>` ở cuối phản hồi), chế độ sau tiêm 1 mục chỉ lệnh + 2 Regex, không cần môi trường MVU.
- **Gỡ bỏ bộ đã tiêm**: Gỡ bỏ 1 chạm bộ MVU / Regex thanh trạng thái / Placeholder lời mở đầu (tích hợp năng lực dọn sạch của trang MVU cũ).

### Loại bỏ

- 3 trang "Hệ thống biến MVU", "Thanh trạng thái frontend", "Sandbox thanh trạng thái" cùng các route tương ứng —— Toàn bộ năng lực được chuyển giao cho Bàn làm việc thanh trạng thái tiếp quản. Các mục MVU sẵn có trên thẻ cũ khi mở bàn làm việc có thể tiếp tục chỉnh sửa và tiêm lại, tương thích không tổn hao.
- Phân vùng "Nâng cao · Tính năng chuyên sâu" ở thanh bên: "Script Regex", "Script Tavern Helper", "Mẫu EJS" được nâng cấp thành phân vùng cấp cao nhất "Mở rộng thẻ" (bản thân trang không đổi).

### Sửa lỗi

- Sửa lỗi phán định Zod Schema của nhóm record toàn phần (như từ điển NPC) ở bản gốc bị mất hiệu lực.
- Hai vị trí phân tích JSON trả về từ AI trong EjsEditor được quy về bộ phân tích dung sai thống nhất.

## [0.0.4] - 2026-08-27

Xây dựng mốc cơ sở mới dựa trên mã nguồn sillytavern-cardforge v7.6.0 (GPL-3.0-or-later), tính năng đồng nhất với bản gốc, điều chỉnh thương hiệu và cấu hình kỹ thuật như sau.

### Thay đổi

- Dự án đổi tên thành CardBuilding (appId `app.cardbuilding.desktop`, tên bộ cài đặt `CardBuilding-Setup-<version>-x64.exe`).
- Ngắt nguồn cập nhật tự động GitHub của CardForge cũ: Tạm ngừng toàn bộ cập nhật tự động (`ENABLE_AUTO_UPDATE = false`), chờ khôi phục sau khi cấu hình nguồn cập nhật mới; loại bỏ mục tiêu publish cũ trong cấu hình đóng gói.
- Thêm `.gitattributes` thống nhất ký tự xuống dòng là LF, sửa lỗi khác biệt giả hơn 40.000 dòng do xung đột CRLF/LF của kho lưu trữ gốc.
- Loại bỏ tài liệu bàn giao chú thích dữ liệu không liên quan đến công cụ này.

### Kế hoạch tiếp theo (Xem tài liệu phương án tái cấu trúc)

- Phase 1: Bàn làm việc trang đơn cho thanh trạng thái (Tích hợp 3 trang MvuEditor + StatusBarEditor + Sandbox, bộ MVU tự động lắp ráp ngầm).
- Phase 2: Tăng cường thống nhất tầng dịch vụ AI (Stream, Hủy, Thử lại, Thống kê sử dụng, Mã hóa Key).
- Phase 3: Tối giản hóa giao diện nền, loại bỏ hiệu ứng rườm rà nhưng giữ nguyên bầu không khí.
- Phase 4: Di chuyển bảng nhân vật có cấu trúc, liên kết nhân vật - Worldbook, cơ chế AI áp dụng an toàn... từ dự án nguyên mẫu CardBuilding (Lưu ý: Logic AI tạo mục Worldbook giữ nguyên theo bản gốc).