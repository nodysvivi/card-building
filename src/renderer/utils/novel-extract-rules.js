/**
 * Trích xuất tiểu thuyết sang Worldbook —— Văn bản quy tắc chung và mẫu prompt
 * 5 bước phân loại: Nhân vật / Tuyến sự kiện / Dòng thời gian / Thiết lập / Quỹ đạo vật phẩm
 */

import { BAGUA_PATTERNS, JSON_QUOTE_RULE } from './npc-rules.js';
export { BAGUA_PATTERNS, JSON_QUOTE_RULE };

// Meta dữ liệu type của 5 loại trích xuất
export const EXTRACTION_TYPES = [
  { key: 'character', label: 'Nhân vật', desc: '5 loại quỹ đạo (Cảnh giới / Vị trí / Vật phẩm / Quan hệ / Mô thức hành vi)' },
  { key: 'eventline', label: 'Tuyến sự kiện', desc: 'Tuyến chính / Tuyến phụ / Tuyến ngầm / Phục bút, gồm nguyên nhân / diễn biến / kết quả' },
  { key: 'timeline', label: 'Dòng thời gian', desc: 'Giai đoạn + Mốc thời gian + Trạng thái cảnh giới' },
  { key: 'setting', label: 'Thiết lập', desc: 'Công pháp / Đan dược / Địa lý / Thế lực / Thường thức thế giới' },
  { key: 'item_trajectory', label: 'Quỹ đạo vật phẩm', desc: 'Chương nhận được + Chương tiêu hao, không lưu ảnh chụp đang sở hữu' }
];

// Giới hạn số lượng chọn lọc
export const FILTER_LIMITS = {
  major_characters: 0,           // 0 = Không giới hạn
  minor_characters: 15,
  main_storylines: 0,            // 0 = Không giới hạn (giữ lại toàn bộ tuyến chính)
  side_storylines_total: 10,     // Tuyến phụ / Tuyến ngầm / Phục bút tổng cộng 10
  techniques: 10,                // Công pháp / Tuyệt kỹ
  pills: 10,                     // Đan dược
  geo_factions: 10,              // Địa lý / Thế lực (tổng cộng)
  worldview_per_subsystem: 1     // Thường thức thế giới mỗi phân hệ 1 mục
};

// Chế độ xử lý nhân vật chính
export const PROTAGONIST_MODES = [
  { value: 'replace', label: 'Thay thế nhân vật chính ({{user}} chính là nhân vật chính của tiểu thuyết)', desc: 'Phù hợp đồng nhân xuyên không — Người chơi nhập vai nhân vật chính' },
  { value: 'npc', label: 'Nhân vật độc lập (Nhân vật chính đóng vai trò NPC, {{user}} là một người khác)', desc: 'Phù hợp trải nghiệm cốt truyện — Người chơi tương tác với nhân vật chính' }
];

// Thiết lập quy tắc viết văn nền tảng (dùng chung cho cả 5 loại, tiêm vào sysMsg)
export const WRITING_RULES_BASE = `## Quy tắc viết văn nghiêm ngặt (Bắt buộc tuân thủ)

### I. Độ không tuyệt đối + Thủ pháp bạch miêu
- Tường thuật khách quan, không mang phán đoán chủ quan
- Dùng hành vi cụ thể thay thế miêu tả trừu tượng: "Cô ấy rất dịu dàng" ✗ → "Thấy động vật nhỏ bị thương sẽ mang về nhà chăm sóc" ✓
- Dùng ngữ liệu đối thoại thể hiện tính cách, cấm viết "nói một cách dịu dàng", "dùng giọng điệu mất kiên nhẫn"
- Không chồng chất tính từ vô nghĩa

### II. Cấm văn mẫu sáo rỗng
Nghiêm cấm sử dụng:
- Từ ngữ mơ hồ: dường như, phảng phất, tựa hồ, hình như, giống như
- Biểu cảm khuôn mẫu: khóe miệng khẽ nhếch, trong mắt lóe lên tia XX, đầu ngón tay khẽ trắng bệch, mày hơi chau lại
- Miêu tả giọng điệu: mang theo khẩu khí XX, dùng ngữ khí XX
- Cảm xúc cực đoan: rơi vào nỗi sợ tột cùng, vô cùng xấu hổ, vạn niệm câu hôi
- Cấu trúc phủ định chuyển hướng: không phải... mà là...
- Gắn nhãn tính cách: "cô ấy rất dịu dàng", "anh ấy rất tốt bụng"
- Khuôn mẫu mỹ nhân chung chung: gương mặt tinh xảo, làn da trắng nõn, mắt đào hoa, mày lá liễu

### III. Neo số chương (Bắt buộc)
**Mọi sự kiện thực tế đều phải ghi rõ số chương:**
- Trong nguyên tác có "Chương X" / "Hồi X" / "Chapter X" → Dùng số chương tương ứng (thống nhất định dạng "Chương X")
- Không có tiêu đề chương rõ ràng → Ghi "Chưa rõ chương"
- Nghiêm cấm bịa đặt số chương

### IV. Cấm gắn nhãn trong quan hệ / hành vi
Khi miêu tả quan hệ / hành vi **nghiêm cấm dùng nhãn trừu tượng**, bắt buộc dùng "nhân vật này đã làm gì ở chương nào":
- ✗ "Sâu đậm, trung thành, ngoan ngoãn phục tùng"
- ✓ "Chương 10 chủ động cho mượn tiền không yêu cầu hoàn trả, Chương 52 nhân lúc đối phương ngủ truyền linh lực"
- ✗ "Tính tình ôn hòa"
- ✓ "Khi bị khiêu khích dùng khoảng cách tuổi tác để hóa giải thay vì xung đột trực diện (Chương 13)"

### V. Giới hạn loại tuyến sự kiện
Loại tuyến sự kiện chỉ gồm 4 giá trị: **Tuyến chính / Tuyến phụ / Tuyến ngầm / Phục bút**. Nghiêm cấm tự định nghĩa loại khác (như "Tuyến biến đổi quan hệ nhân vật").
`;

// Xây dựng quy tắc nhân vật chính (tiêm vào prompt theo chế độ người dùng chọn)
export function buildProtagonistRule(userMode, protagonistName) {
  const name = protagonistName || '(Chưa chỉ định tên nhân vật chính)';
  if (userMode === 'replace') {
    return `## Xử lý nhân vật chính (Người dùng đã chọn: {{user}} thay thế nhân vật chính)
- "${name}" trong nguyên tác tiểu thuyết = {{user}} (Người chơi nhập vai nhân vật chính)
- Toàn bộ "quan hệ của các nhân vật đối với nhân vật chính" → Viết thành "quan hệ đối với {{user}}"
- Bản thân nhân vật chính không cần tạo thành mục riêng (Người chơi chính là nhân vật chính)
- Trong mục của nhân vật khác ghi rõ "Quan hệ với {{user}}: [Hành vi cụ thể + Số chương]"`;
  } else {
    return `## Xử lý nhân vật chính (Người dùng đã chọn: Nhân vật chính đóng vai trò NPC)
- "${name}" trong nguyên tác tiểu thuyết sẽ đóng vai trò NPC và được tạo mục đầy đủ (bao gồm 5 loại quỹ đạo)
- {{user}} không xuất hiện trong kết quả trích xuất (Người chơi tự định vị thân phận trong SillyTavern)
- Toàn bộ quan hệ nhân vật viết theo nguyên tác (như "Thái độ đối với ${name}"), không tự ý đổi thành "đối với {{user}}"`;
  }
}

// ====================================================================
// Prompt trích xuất cho 5 loại
// ====================================================================

// Trích xuất nhân vật
export const EXTRACT_CHARACTER_PROMPT = `## Nhiệm vụ: Trích xuất nhân vật trong tiểu thuyết

Xuất từng nhân vật theo "5 loại quỹ đạo". Phân định:
- **Nhân vật quan trọng** (major): Xuất hiện ≥ 5 chương + Có tương tác cụ thể với nhân vật chính + Xuất hiện trong các điểm nút diễn biến sự kiện
- **Nhân vật thứ yếu** (minor): Xuất hiện ≥ 3 chương HOẶC xuất hiện trong điểm nút sự kiện HOẶC từng có tương tác cụ thể với nhân vật chính —— Giới hạn ${FILTER_LIMITS.minor_characters} mục (Lấy top theo mức độ quan trọng)
- **Nhân vật quần chúng / qua đường**: Không thu thập

## Định dạng đầu ra (Mảng JSON, mỗi phần tử là một nhân vật)

\`\`\`json
[
  {
    "name": "Tên nhân vật",
    "role": "major" hoặc "minor",
    "first_chapter": "Chương X",
    "last_chapter": "Chương Y",
    "basic": {
      "Thân phận": "VD: Đệ tử ngoại môn tông phái",
      "Tuổi": "VD: 16 tuổi",
      "Giới tính": "Nam/Nữ/Khác"
    },
    "appearance": "Đặc trưng ngoại hình (chỉ viết nét lệch khỏi nhận thức mặc định của AI, cấm miêu tả mỹ nhân khuôn mẫu)",
    "tracks": {
      "Cảnh giới": [
        { "chapter": "Chương X", "state": "Cấp bậc nhất giai (điền theo hệ thống cấp bậc của nguyên tác)", "evidence": "Trích dẫn câu then chốt trong nguyên tác" }
      ],
      "Vị trí": [
        { "chapter": "Chương X", "location": "Tàng Kinh Các tông môn" }
      ],
      "Vật phẩm": [
        { "chapter": "Chương X", "action": "Nhận được", "item": "Bảo kiếm gia truyền (Ví dụ)", "source": "Tông môn ban thưởng" }
      ],
      "Quan hệ": [
        { "target": "Tên nhân vật đối phương",
          "behaviors": [
            { "chapter": "Chương X", "behavior": "Hành vi cụ thể (trích từ nguyên tác)", "context": "[Ngữ cảnh ngắn gọn]" }
          ],
          "summary": "Đặc trưng tương tác (tổng kết dựa trên hành vi, không dùng nhãn trừu tượng)",
          "boundary": "Mức độ nguyên tác nói rõ chưa phát triển tới"
        }
      ],
      "Mô thức hành vi": [
        { "stage": "Tên giai đoạn (VD: Mới nhập môn)",
          "range": "Chương 1-10",
          "dialogues": ["Câu thoại nguyên tác 1 (kèm số chương)", "Câu thoại nguyên tác 2"],
          "decisions": "Mô thức hành vi cụ thể khi đứng trước lựa chọn (dùng sự kiện cụ thể, cấm khái quát trừu tượng)"
        }
      ]
    }
  }
]
\`\`\`

${JSON_QUOTE_RULE}

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// Trích xuất tuyến sự kiện
export const EXTRACT_EVENTLINE_PROMPT = `## Nhiệm vụ: Trích xuất tuyến sự kiện trong tiểu thuyết

Sắp xếp cốt truyện theo tuyến sự kiện. **Loại tuyến sự kiện chỉ gồm 4 giá trị**: Tuyến chính / Tuyến phụ / Tuyến ngầm / Phục bút.

Giới hạn số lượng:
- **Tuyến chính**: Không giới hạn (giữ lại toàn bộ)
- **Tuyến phụ + Tuyến ngầm + Phục bút**: Tổng cộng ${FILTER_LIMITS.side_storylines_total} mục (Lấy top theo mức độ quan trọng)
- Tiêu chuẩn "quan trọng": Điểm nút diễn biến ≥ 2 + Liên quan đến ít nhất 1 nhân vật quan trọng + Có "ảnh hưởng tiếp theo"

## Định dạng đầu ra

\`\`\`json
[
  {
    "name": "Tên tuyến sự kiện (VD: Nhân vật chính lần đầu gặp bạn đồng hành)",
    "type": "Tuyến chính" hoặc "Tuyến phụ" hoặc "Tuyến ngầm" hoặc "Phục bút",
    "cause": {
      "chapter": "Chương X",
      "summary": "Tóm tắt nguyên nhân trong một câu",
      "dialogue": "Câu thoại tiêu biểu (nguyên tác) —— [Ngữ cảnh ngắn]"
    },
    "passages": [
      {
        "chapter": "Chương X",
        "node": "Mô tả điểm nút (VD: Bạn đồng hành chủ động ra tay giúp đỡ)",
        "location": "Địa điểm",
        "key_characters": ["Nhân vật 1", "Nhân vật 2"],
        "dialogue": "Câu thoại tiêu biểu (nguyên tác) —— [Ngữ cảnh ngắn]"
      }
    ],
    "result": {
      "chapter": "Chương X",
      "summary": "Tóm tắt kết quả trong một câu",
      "dialogue": "Câu thoại tiêu biểu (nguyên tác) —— [Ngữ cảnh ngắn]"
    },
    "follow_up": "Phục bút / ảnh hưởng đối với phần sau (nếu không có thì để chuỗi rỗng)"
  }
]
\`\`\`

${JSON_QUOTE_RULE}

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// Trích xuất dòng thời gian
export const EXTRACT_TIMELINE_PROMPT = `## Nhiệm vụ: Trích xuất trục dòng thời gian của tiểu thuyết

Chia theo "giai đoạn", mỗi giai đoạn gồm mốc thời gian + phạm vi chương + trạng thái cảnh giới nhân vật chính.

## Định dạng đầu ra

\`\`\`json
[
  {
    "stage_name": "Tên giai đoạn (VD: Giai đoạn đầu bái sư)",
    "chapter_range": "Chương 1-15",
    "time_markers": [
      { "chapter": "Chương X", "raw": "Diễn đạt thời gian trong nguyên tác (VD: Sau khi bế quan 3 tháng)", "annotation": "Ghi chú suy tính (VD: Khoảng 3 tháng sau)" }
    ],
    "summary": "Tóm tắt giai đoạn này dưới 100 từ",
    "protagonist_status": "Trạng thái cấp bậc nhân vật chính khi kết thúc giai đoạn này"
  }
]
\`\`\`

Quy tắc mốc thời gian:
- Có con số cụ thể (X năm / X tháng / X ngày / X tuổi) + miêu tả "khoảng cách sự kiện đã xảy ra" hoặc "tuổi hiện tại của nhân vật chính" mới thu thập
- **Không thu thập**: Dự đoán tương lai, ước hẹn, lịch sử thuần thế giới quan, hồi tưởng lý lịch nhân vật, suy đoán tuổi người khác

${JSON_QUOTE_RULE}

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// Trích xuất thiết lập
export const EXTRACT_SETTING_PROMPT = `## Nhiệm vụ: Trích xuất thiết lập thế giới quan trong tiểu thuyết

Xuất theo phân loại con. **Sàng lọc nghiêm ngặt, không trích xuất tràn lan**:
- **Công pháp / Tuyệt kỹ**: Tối đa ${FILTER_LIMITS.techniques} mục (Nhân vật chính phải sử dụng ≥ 2 lần HOẶC là đạo cụ then chốt của tuyến chính/tuyến phụ)
- **Đan dược**: Tối đa ${FILTER_LIMITS.pills} mục (Cùng tiêu chuẩn trên)
- **Địa lý / Thế lực**: Tối đa ${FILTER_LIMITS.geo_factions} mục (Tổng cộng, nguyên tác nhắc lại nhiều lần ≥ 3 lần)
- **Thường thức thế giới**: Mỗi phân hệ làm rõ 1 mục (Hệ thống cảnh giới / Hệ thống tiền tệ / Hệ thống nghề nghiệp...)

## Định dạng đầu ra

\`\`\`json
[
  {
    "subtype": "Công pháp",
    "name": "Phá Vân Kiếm (Ví dụ)",
    "level": "Huyền giai hạ phẩm",
    "user": "Nhân vật chính",
    "first_chapter": "Chương X",
    "effect": "Mô tả hiệu quả (trích câu then chốt trong nguyên tác)"
  },
  {
    "subtype": "Đan dược",
    "name": "Ngưng Nguyên Đan (Ví dụ)",
    "grade": "Tam phẩm",
    "refiner": "Luyện dược sư",
    "first_chapter": "Chương X",
    "effect": "..."
  },
  {
    "subtype": "Địa lý",
    "name": "Thanh Phong Thành (Ví dụ)",
    "first_chapter": "Chương X",
    "description": "Mô tả thành trì"
  },
  {
    "subtype": "Thế lực",
    "name": "Huyền Dương Tông (Ví dụ)",
    "first_chapter": "Chương X",
    "description": "Mô tả thế lực + Quan hệ với nhân vật chính"
  },
  {
    "subtype": "Thường thức thế giới",
    "name": "Hệ thống cấp bậc",
    "description": "Điền giải thích đầy đủ theo hệ thống cấp bậc nguyên tác (tiên hiệp như Luyện Khí → Trúc Cơ; đô thị như Hạng D → Hạng C; game như Giai 1 → Giai 2...)"
  }
]
\`\`\`

subtype nghiêm ngặt 5 giá trị: Công pháp / Đan dược / Địa lý / Thế lực / Thường thức thế giới

${JSON_QUOTE_RULE}

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// Trích xuất quỹ đạo vật phẩm
export const EXTRACT_ITEM_TRAJECTORY_PROMPT = `## Nhiệm vụ: Trích xuất quỹ đạo lưu chuyển vật phẩm trong tiểu thuyết

Chỉ theo dõi **vật phẩm có ý nghĩa đối với nhân vật chính hoặc cốt truyện cốt lõi** —— Đạo cụ then chốt nhân vật chính nắm giữ, bảo vật gia truyền, vật phẩm kích hoạt tình tiết.
**Không theo dõi**: Vật phẩm tiêu hao thông thường (đan dược cơ bản), vật phẩm giá trị thấp (tiền lẻ), bản thân công pháp.

## Quy tắc then chốt
**Chỉ lưu "Chương nhận được" và "Chương tiêu hao", không lưu ảnh chụp "Đang sở hữu"** ——
Khi RP sẽ phán đoán động theo chương hiện tại N: Chương nhận được ≤ N và không có ghi nhận tiêu hao → Đang sở hữu.

## Định dạng đầu ra

\`\`\`json
[
  {
    "item_name": "Huyền Thiết Kiếm (Ví dụ)",
    "owner": "Nhân vật chính",
    "events": [
      { "chapter": "Chương X", "action": "Nhận được", "source": "Mua tại đấu giá hội", "evidence": "Trích dẫn nguyên tác" },
      { "chapter": "Chương Y", "action": "Tiêu hao", "destination": "Luyện chế thành đan", "evidence": "Trích dẫn nguyên tác" }
    ]
  }
]
\`\`\`

action nghiêm ngặt 3 giá trị: **Nhận được / Tiêu hao / Chuyển tặng**

${JSON_QUOTE_RULE}

Chỉ xuất ra mảng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// ====================================================================
// Prompt tự kiểm tra + R2 + Tóm tắt liên kết
// ====================================================================

// Prompt AI tự kiểm tra (gọi một lần sau khi tạo xong một loại)
export const SELF_CHECK_PROMPT = `## Nhiệm vụ: Tự kiểm tra kết quả trích xuất ở bước trước

Kiểm tra và sửa đổi từng mục:

1. **Neo số chương**: Mỗi sự kiện có gắn số chương chưa? Nguyên tác không có tiêu đề chương rõ ràng phải ghi "Chưa rõ chương", nghiêm cấm bịa đặt số chương
2. **Gắn nhãn quan hệ / hành vi**: Có chứa các nhãn trừu tượng như "ngoan ngoãn phục tùng", "tin cậy chân thành", "đố kỵ" không? Có → Đổi thành hành vi cụ thể + Số chương
3. **Văn mẫu sáo rỗng**: Có chứa "dường như / phảng phất / khóe miệng khẽ nhếch / cô ấy rất dịu dàng" không? Có → Đổi sang văn phong bạch miêu cụ thể
4. **Miêu tả mỹ nhân khuôn mẫu**: Ngoại hình có chứa "gương mặt tinh xảo / làn da trắng nõn" không? Có → Đổi thành đặc trưng độc đáo hoặc xóa đi
5. **Loại tuyến sự kiện**: Có chứa loại không thuộc 4 giá trị chuẩn không? Có → Bắt buộc quy về 1 trong 4 giá trị chuẩn
6. **Thuộc tính câu thoại tiêu biểu**: Người nói trong mỗi câu thoại có đúng là bản thân nhân vật đó không?

Xuất ra mảng JSON hoàn chỉnh đã sửa đổi (cùng cấu trúc trường), không xuất quá trình sửa đổi.

${JSON_QUOTE_RULE}
`;

// Chỉ lệnh lệch góc nhìn R2 (đính kèm sau prompt chính khi bật chế độ chạy kép)
export const R2_OFFSET_PROMPT = `## Chỉ lệnh lệch góc nhìn R2 (Bổ sung cho nhiệm vụ chính)

Lượt trích xuất này là "Chạy kép R2" —— Bổ sung những nội dung R1 có thể bỏ sót:
1. **Câu thoại mô thức hành vi thiên về 50% số chương phía sau** (chỉ chọn 50% phía trước khi thiếu mẫu tiêu biểu)
2. **Đặc biệt chú ý mô thức tương tác tiến triển dần giữa nhân vật thứ yếu và nhân vật chính** (như thái độ từ lạnh nhạt sang nhiệt tình)
3. **Bổ sung các tuyến sự kiện dễ bị bỏ sót như cạnh tranh thương nghiệp / đấu đá thế lực / tương tác tiến triển qua nhiều chương**

Cấu trúc trường của nhiệm vụ chính giữ nguyên, chỉ thay đổi góc độ chọn lọc dữ liệu.
`;

// Prompt tạo tóm tắt liên kết giữa các phần
export const CONTINUATION_SUMMARY_PROMPT = `## Nhiệm vụ: Tạo tóm tắt liên kết giữa các phần

Chắt lọc trạng thái then chốt "chuyển giao sang phần tiếp theo" từ kết quả trích xuất của phần này.

## Định dạng đầu ra (Đối tượng JSON)

\`\`\`json
{
  "previous_chapter_name": "Tên phần hiện tại",
  "protagonist_end_state": {
    "Cảnh giới": "Cảnh giới nhân vật chính khi kết thúc phần này",
    "Vật phẩm sở hữu": ["Danh sách vật phẩm vẫn đang sở hữu"],
    "Số dư tiền": "Số dư",
    "Vị trí": "Vị trí khi kết thúc phần này"
  },
  "time_position": "Định vị thời gian (VD: Nhân vật chính 17 tuổi, 3 tháng sau sự kiện XX)",
  "unfinished_event_lines": [
    { "name": "Tên tuyến sự kiện", "type": "Tuyến chính/Tuyến phụ", "follow_up": "Ảnh hưởng chưa kết thúc" }
  ],
  "important_characters": [
    { "name": "Tên nhân vật", "end_state": "Trạng thái khi kết thúc phần này (Cảnh giới/Vị trí/Nơi đến)", "items_held": ["Vật phẩm vẫn đang sở hữu"] }
  ],
  "key_relationships": [
    { "from": "Nhân vật A", "to": "Nhân vật B", "current_state": "Đặc trưng tương tác ở cuối phần này" }
  ],
  "established_settings": {
    "Hệ thống cảnh giới": "Mô tả ngắn gọn",
    "Hệ thống tiền tệ": "Mô tả ngắn gọn",
    "Các thiết lập thường trực khác": ["..."]
  }
}
\`\`\`

Quy tắc:
- Vật phẩm chỉ liệt kê trạng thái "vẫn đang sở hữu", đã tiêu hao / chuyển tặng không liệt kê
- Không khái quát lại, trích xuất từng trường từ kết quả trích xuất
- Thông tin chưa đầy đủ thì ghi "Phần này chưa nêu rõ"
${JSON_QUOTE_RULE}

Chỉ xuất ra đối tượng JSON bằng tiếng Việt, không kèm bất kỳ giải thích nào.
`;

// ====================================================================
// Regex phân đoạn chương (Hỗ trợ đa ngôn ngữ Trung / Nhật / Anh / Việt)
// ====================================================================

export const CHAPTER_REGEXES = [
  // Tiếng Việt: Chương / Hồi / Tiết / Quyển / Tập / Phần
  /^[\s]*(?:Chương|Hồi|Tiết|Quyển|Tập|Phần)\s*(?:\d+|[IVXLCDM]+|[一二三四五六七八九十百千]+)[\s\S]*?$/im,
  // Tiếng Trung: 第X章/话/节/卷
  /^[\s]*第[一二三四五六七八九十百千零\d]+[章话节卷][\s\S]*?$/m,
  // Tiếng Nhật: 第X話/章/節
  /^[\s]*第[一二三四五六七八九十百千零\d]+[話章節][\s\S]*?$/m,
  // Tiếng Anh: Chapter / Episode / Part / Scene
  /^[\s]*(?:Chapter|Episode|Part|Scene)\s+\d+/im,
  // Mở đầu / Kết thúc / Đặc biệt
  /^[\s]*(?:序章|プロローグ|Prologue|Epilogue|尾声|Mở đầu|Kết thúc)/im
];

/**
 * Kiểm tra xem nguyên tác có nhận diện được tiêu đề chương hay không
 * @returns {Array<{regex, count}>} Regex trúng khớp và số lượng khớp
 */
export function detectChapterPattern(text) {
  if (!text) return [];
  const hits = [];
  for (const r of CHAPTER_REGEXES) {
    const matches = text.match(new RegExp(r.source, r.flags + 'g'));
    if (matches && matches.length > 0) {
      hits.push({ regex: r, count: matches.length });
    }
  }
  return hits;
}