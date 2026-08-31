/**
 * Quy tắc viết văn NPC —— Văn bản quy tắc chung và danh sách Regex
 * 4 quy tắc viết văn cốt lõi: Độ không tuyệt đối / Cấm văn mẫu sáo rỗng / Khác biệt hóa đặc trưng / Nguyên tắc tinh giản NPC
 */

// Danh sách Regex từ cấm văn mẫu sáo rỗng —— Dùng cho quét thời gian thực thuần frontend
export const BAGUA_PATTERNS = [
  {
    type: 'Từ ngữ mơ hồ',
    pattern: /dường như|phảng phất|tựa hồ|hình như|giống như|似乎|几乎|仿佛|宛如|好像/g,
    suggest: 'Đổi thành miêu tả cụ thể, không dùng từ mơ hồ'
  },
  {
    type: 'Biểu cảm khuôn mẫu',
    pattern: /khóe miệng (?:khẽ )?nhếch|trong mắt (?:lóe lên|dâng lên) tia|đầu ngón tay (?:khẽ )?(?:trắng bệch|run rẩy)|mày (?:khẽ )?(?:chau lại|nhíu lại)|嘴角(?:微微)?上扬|眼[里中](?:闪过|涌起)一?丝|指尖(?:微微)?(?:泛白|颤抖)|眉头(?:微微)?(?:一皱|蹙起)/g,
    suggest: 'Đổi thành động tác tự nhiên ("cô ấy cười", "cô ấy nhíu mày" là đủ)'
  },
  {
    type: 'Miêu tả giọng điệu',
    pattern: /mang theo (?:khẩu khí|giọng điệu) [a-zA-ZÀ-ỹ\s]{1,15}|với ngữ khí [a-zA-ZÀ-ỹ\s]{1,15}|带着[一-龥]{1,4}的口吻|用[一-龥]{1,4}的语气|充满[一-龥]{1,4}的味道/g,
    suggest: 'Xóa bỏ — Hãy để lời thoại tự bộc lộ, không giải thích giọng điệu'
  },
  {
    type: 'Cảm xúc cực đoan',
    pattern: /rơi vào nỗi sợ tột cùng|vô cùng (?:xấu hổ|sợ hãi|phẫn nộ|bi thương|kinh ngạc)|vạn niệm câu hôi|陷入极大的[一-龥]{1,5}|极度(?:羞耻|恐惧|愤怒|悲伤|震惊)|万念俱灰/g,
    suggest: 'Đổi thành hành vi cụ thể hoặc phản ứng môi trường'
  },
  {
    type: 'Cấu trúc phủ định chuyển hướng',
    pattern: /không phải [a-zA-ZÀ-ỹ\s]{1,30} mà là [a-zA-ZÀ-ỹ\s]{1,30}|不是[一-龥]{1,15}而是[一-龥]{1,15}/g,
    suggest: 'Đổi thành câu trần thuật trực tiếp, không dùng cấu trúc "không phải A mà là B"'
  },
  {
    type: 'Gắn nhãn tính cách',
    pattern: /(?:cô|anh|hắn|nàng) ấy rất (?:dịu dàng|tốt bụng|kiên cường|thông minh|cởi mở|hướng nội|tsundere|bụng dạ đen tối|ấm áp|lạnh lùng|đáng yêu|xinh đẹp)|[她他]很(?:温柔|善良|坚强|聪明|开朗|内向|傲娇|腹黑|温暖|冷漠|可爱|漂亮)/g,
    suggest: 'Đổi thành hành vi cụ thể (VD: "thường mang động vật bị thương về nhà" thay vì "cô ấy rất dịu dàng")'
  },
  {
    type: 'Miêu tả mỹ nhân khuôn mẫu',
    pattern: /gương mặt tinh xảo|làn da trắng nõn|mắt đào hoa|mày lá liễu|miệng chúm chím|da trắng như tuyết|chim sa cá lặn|khuynh quốc khuynh thành|精致的(?:脸蛋|五官|轮廓|下颚)|白皙的(?:皮肤|肌肤)|桃花眼|柳叶眉|樱桃[嘴小]口|肌肤胜雪|沉鱼落雁|倾国倾城/g,
    suggest: 'Chỉ viết đặc trưng lệch khỏi nhận thức mặc định của AI, cấm dùng khuôn mẫu mỹ nhân chung chung'
  },
  {
    type: 'Ẩn dụ sáo mòn',
    pattern: /như (?:con thú nhỏ|chú thỏ con|chim sợ cành cong|con thú nhỏ bị hoảng sợ)|ném đá xuống hồ|mặt hồ lòng dâng sóng|như dao cắt ruột|像(?:小兽|小兔子|惊弓之鸟|受惊的[一-龥]{1,3})|投石入湖|心湖泛起涟漪|心如刀绞/g,
    suggest: 'Đổi thành miêu tả trực tiếp, không dùng ẩn dụ sáo mòn'
  }
];

// Quy tắc dấu ngoặc kép JSON —— Chống việc AI dùng dấu nháy kép chưa escape làm hỏng JSON
export const JSON_QUOTE_RULE = 'Quan trọng: Tất cả chuỗi JSON bên trong nếu muốn trích dẫn biệt danh, danh hiệu hoặc lời nói trực tiếp, bắt buộc dùng dấu ngoặc kép dạng đóng mở «» hoặc ngoặc vuông [], tuyệt đối không dùng dấu nháy kép trần " (sẽ làm hỏng cú pháp JSON dẫn đến lỗi).';

// Quy tắc viết văn NPC (Dùng tiêm vào sysMsg / user prompt)
export const NPC_RULES_PROMPT = `## Quy tắc viết văn NPC (Bắt buộc tuân thủ)

### I. Độ không tuyệt đối + Thủ pháp bạch miêu
- Tường thuật khách quan, không mang phán đoán chủ quan (Cấm những lời đánh giá của tác giả như "cô ấy thật sự rất dễ thương", "anh ấy quá đẹp trai")
- Dùng hành vi cụ thể thay thế miêu tả trừu tượng: "Cô ấy rất dịu dàng" ✗ → "Thấy động vật nhỏ bị thương sẽ mang về nhà chăm sóc" ✓
- Dùng ngữ liệu đối thoại thể hiện tính cách: Hãy để lời thoại tự lên tiếng, cấm viết "nói một cách dịu dàng", "mang giọng điệu mất kiên nhẫn"
- Không chồng chất tính từ vô nghĩa

### II. Cấm văn mẫu sáo rỗng (Phát hiện một lỗi xem như không đạt)
Nghiêm cấm sử dụng:
- Từ ngữ mơ hồ: dường như, phảng phất, tựa hồ, hình như, giống như
- Ẩn dụ sáo mòn: như con thú nhỏ, như chú thỏ con, ném đá xuống hồ, mặt hồ lòng dâng sóng
- Biểu cảm khuôn mẫu: khóe miệng khẽ nhếch, trong mắt lóe lên tia XX, đầu ngón tay khẽ trắng bệch, mày hơi chau lại
- Miêu tả giọng điệu: mang theo khẩu khí XX, dùng ngữ khí XX, tràn ngập mùi vị XX
- Cảm xúc cực đoan: rơi vào nỗi sợ tột cùng, vô cùng xấu hổ, vạn niệm câu hôi
- Cấu trúc phủ định chuyển hướng: không phải... mà là...
- Gắn nhãn tính cách: "cô ấy rất dịu dàng", "anh ấy rất tốt bụng", "cô ấy rất dễ thương"

### III. Nguyên tắc khác biệt hóa đặc trưng ngoại hình
**Chỉ viết đặc trưng "lệch khỏi nhận thức mặc định của cơ sở dữ liệu AI":**
- Nhân vật phương Đông không viết "tóc đen mắt đen" (mặc định đã là vậy)
- 18 tuổi không viết "trẻ trung" (mặc định đã là vậy)
- Tinh linh không viết "tai nhọn" (mặc định đã là vậy)
**Cấm miêu tả mỹ nhân khuôn mẫu:** Gương mặt tinh xảo, làn da trắng nõn, mắt đào hoa, mày lá liễu, miệng chúm chím
**Tiêu chuẩn kiểm tra:** Che tên lại chỉ nhìn đặc trưng bạn viết, có nhận ra được nhân vật này không — nhận ra được là đạt chuẩn

### IV. Nguyên tắc tinh giản NPC (Dành riêng cho NPC)
NPC là nhân vật mang tính chức năng, khác với nhân vật chính:
- Không cần biên niên sử cuộc đời hoàn chỉnh
- Không cần câu chuyện bối cảnh quá dài dòng
- Không cần thế giới nội tâm quá chi tiết
- **Định vị quan hệ là phần quan trọng nhất của NPC** —— Tập trung viết xoay quanh "Quan hệ / Phương thức tương tác / Tác dụng của NPC đối với nhân vật chính"
`;

// Prompt tự kiểm tra toàn diện —— Gọi một lần sau khi tạo xong để AI thẩm định toàn bộ và sửa đổi
export const NPC_SELF_CHECK_PROMPT = `Hãy đóng vai chuyên gia thẩm định thẻ nhân vật SillyTavern, tiến hành kiểm tra từng mục và sửa đổi thiết lập NPC sau:

【Hạng mục kiểm tra】
1. **Kiểm tra văn mẫu sáo rỗng**: Có chứa biểu đạt sáo rỗng như "dường như / phảng phất / khóe miệng khẽ nhếch / cô ấy rất dịu dàng" không? Có → Đổi sang văn phong bạch miêu
2. **Kiểm tra mỹ nhân khuôn mẫu**: Ngoại hình có chứa miêu tả chung chung như "gương mặt tinh xảo / làn da trắng nõn / mắt đào hoa" không? Có → Đổi thành đặc trưng độc đáo (mắt dị sắc / vết sẹo / chi giả / màu tóc đặc biệt...)
3. **Kiểm tra gắn nhãn tính cách**: Có viết trực tiếp "cô ấy rất dịu dàng / anh ấy rất tốt bụng" không? Có → Đổi thành hành vi cụ thể
4. **Kiểm tra ngữ liệu**: Ngữ liệu tham khảo có bị lẫn miêu tả động tác biểu cảm không? Có → Xóa bỏ chỉ giữ lại lời đối thoại thuần túy
5. **Kiểm tra định vị quan hệ**: Quan hệ với {{user}} có cụ thể rõ ràng không? Hay miêu tả mập mờ?
6. **Kiểm tra khác biệt hóa đặc trưng**: Che tên đi chỉ dựa vào ngoại hình có nhận ra NPC này không? Không → Xóa bỏ miêu tả khuôn mẫu, bổ sung đặc trưng độc đáo

【Yêu cầu đầu ra】
Xuất ra JSON NPC hoàn chỉnh sau khi đã sửa đổi (giữ nguyên cấu trúc 6 trường: basic / appearance / personality / relationship / language / sample_dialogues) bằng tiếng Việt, không kèm bất kỳ giải thích nào.
${JSON_QUOTE_RULE}
`;

// Schema cấu trúc 6 khối của NPC (Dùng trong prompt để hướng dẫn định dạng AI xuất ra)
export const NPC_SCHEMA_PROMPT = `## Cấu trúc JSON NPC (Xuất nghiêm ngặt theo 6 khối, không được thiếu)

\`\`\`json
{
  "name": "Họ tên NPC",
  "keys": ["Từ khóa 1", "Từ khóa 2", "Danh hiệu / Biệt danh"],
  "basic": {
    "Họ tên": "...",
    "Tuổi": "...",
    "Giới tính": "...",
    "Thân phận": "..."
  },
  "appearance": {
    "Tổng quan ấn tượng": "Một câu khái quát (Chiều cao / Thể hình / Cảm giác mang lại)",
    "Đặc trưng then chốt": "1-2 nét nổi bật nhất (Mắt dị sắc / Vết sẹo / Chi giả / Màu tóc đặc biệt...)",
    "Phong cách ăn mặc": "Trang phục thường ngày"
  },
  "personality": {
    "Đặc chất cốt lõi": "2-3 từ khóa",
    "Mô thức hành vi": "Hành vi điển hình (Làm gì trong tình huống cụ thể, không phải định nghĩa tính cách)"
  },
  "relationship": {
    "Quan hệ với user": "Quan hệ cụ thể với {{user}}",
    "Thái độ": "Thái độ đối với {{user}}",
    "Phương thức tương tác": "Tương tác như thế nào"
  },
  "language": {
    "Phong cách nói chuyện": "Mô tả đơn giản",
    "Câu cửa miệng": "Nếu có"
  },
  "sample_dialogues": [
    "5-10 câu thoại điển hình",
    "Thuần đối thoại, không thêm miêu tả động tác biểu cảm",
    "Thể hiện tính cách và cách nói chuyện"
  ]
}
\`\`\`
`;