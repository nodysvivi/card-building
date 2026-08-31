# Tài liệu kỹ thuật dự án SillyTavern CardForge

> v7.6.0 | GPL-3.0-or-later | Tác giả: Anastasia2372

---

## 1. Tổng quan dự án

**CardForge (Lò rèn thẻ nhân vật)** là một công cụ tạo thẻ nhân vật trên desktop dành cho người dùng SillyTavern, tích hợp toàn bộ các khâu tạo thẻ bao gồm "Chỉnh sửa thông tin cơ bản, thiết kế Worldbook, hệ thống biến MVU, script Regex, script Tavern Helper, mẫu EJS, thanh trạng thái frontend, đóng gói PNG" vào trong một giao diện thống nhất.

Dự án bao gồm 2 phiên bản phát hành độc lập:

| Phiên bản | Môi trường chạy | Điểm vào |
|---|---|---|
| **Bản desktop** | Electron 41 + Node.js | `src/main/main.js` |
| **Bản web** | Trình duyệt (GitHub Pages) | `web/src/main.js` |

---

## 2. Ngăn xếp công nghệ

| Tầng | Công nghệ | Phiên bản |
|---|---|---|
| Framework desktop | Electron | ^41.1.1 |
| Framework frontend | Vue 3 (Composition API) | ^3.5.32 |
| Quản lý trạng thái | Pinia | ^3.0.4 |
| Định tuyến | Vue Router (Hash mode) | ^4.6.4 |
| Build tool | Vite | ^8.0.3 |
| Kiểu dáng | Sass | ^1.99.0 |
| Trình soạn thảo mã | CodeMirror 6 | ^6.0.2 |
| Kết xuất Live2D | pixi.js v6 + pixi-live2d-display | ^6.5.10 / ^0.4.0 |
| Thao tác PNG chunk | png-chunks-extract / encode / png-chunk-text | ^1.0.0 |
| Cập nhật tự động | electron-updater | ^6.8.3 |
| Đóng gói ứng dụng | electron-builder | ^26.8.1 |
| An toàn tiến trình desktop | contextIsolation: true, nodeIntegration: false | — |

---

## 3. Cấu trúc thư mục dự án

```
sillytavern-cardforge/
├── src/
│   ├── main/                     # Tiến trình chính (Electron Main)
│   │   ├── main.js               #   Điểm vào: Tạo cửa sổ / IPC / Cập nhật tự động / Thao tác PNG
│   │   ├── preload.js            #   Phơi bày API contextBridge
│   │   └── logger.js             #   Ghi log lỗi (xoay vòng 5MB)
│   └── renderer/                 # Tiến trình kết xuất (Ứng dụng Vue 3)
│       ├── main.js               #   Điểm vào ứng dụng Vue
│       ├── App.vue               #   Component gốc: Thanh bên / Thanh tiêu đề / Hiệu ứng
│       ├── index.html            #   Mẫu HTML
│       ├── wallpaper-data.js     #   Hình nền base64 nhúng sẵn
│       ├── styles/
│       │   └── main.scss         #   Kiểu dáng toàn cục
│       ├── views/                #   21 giao diện trang
│       ├── components/           #   7 component tái sử dụng
│       ├── stores/               #   4 Pinia store
│       └── utils/                #   12 module tiện ích
├── web/                          # Dự án con độc lập cho bản web
│   ├── package.json              #   cardforge-web v1.0.0
│   ├── vite.config.js            #   base: /sillytavern-cardforge/
│   └── src/                      #   Bản tương thích trình duyệt cùng cấu trúc với desktop
├── public/
│   ├── icon.ico / icon.png       #   Icon ứng dụng
│   └── live2d/                   #   Runtime Live2D + Mô hình người dùng (không đưa vào kho mã nguồn)
├── scripts/
│   └── dev.js                    #   Script khởi chạy môi trường dev (Vite + Electron song song)
├── dist/                         #   Sản phẩm build của tiến trình kết xuất
├── dist_electron/                #   Sản phẩm đóng gói của electron-builder
├── docs/
│   └── screenshot.png            #   Ảnh chụp màn hình phần mềm
├── vite.config.js                #   Cấu hình Vite
├── package.json                  #   Cấu hình dự án bản desktop
├── README.md                     #   Tài liệu hướng dẫn người dùng
└── LICENSE                       #   GPL-3.0
```

---

## 4. Thiết kế kiến trúc

### 4.1 Mô hình tiến trình

```
┌──────────────────────────────────────────────────┐
│                   Electron Main                   │
│  main.js: Cửa sổ / IPC / Tệp tin / Cập nhật / PNG │
│  logger.js: Xoay vòng log lỗi                     │
└───────────────┬──────────────────────────────────┘
                │  IPC (contextBridge)
    ┌───────────▼───────────┐
    │      preload.js       │
    │  window.cardForgeAPI  │
    └───────────┬───────────┘
                │
┌───────────────▼──────────────────────────────────┐
│              Electron Renderer                    │
│  Vue 3 + Pinia + Vue Router (Hash)               │
│  21 trang / 7 component / 4 store / 12 tiện ích  │
└──────────────────────────────────────────────────┘
```

Chiến lược bảo mật: `contextIsolation: true` + `nodeIntegration: false`, mọi khả năng của Node.js đều được phơi bày an toàn thông qua preload.

### 4.2 Cấu trúc định tuyến (21 route)

| Đường dẫn | Trang | Phân vùng | Chức năng cốt lõi |
|---|---|---|---|
| `/` | Dashboard | Tổng quan | Lối vào bàn làm việc, tổng quan thẻ |
| `/basic` | BasicInfo | Bắt buộc | Chỉnh sửa thông tin cơ bản V2 |
| `/charsetting` | CharSetting | Bắt buộc | Thiết lập nhân vật (nét vẽ/độ sâu...) |
| `/worldbook` | WorldBookEditor | Bắt buộc | Trình chỉnh sửa Worldbook |
| `/greeting` | GreetingEditor | Bắt buộc | Trình chỉnh sửa lời mở đầu |
| `/npc` | NpcGenerator | Tùy chọn | Trình tạo NPC |
| `/novel-extract` | NovelExtractor | Tùy chọn | Trích xuất tiểu thuyết sang Worldbook |
| `/player` | PlayerChar | Tùy chọn | Thiết lập nhân vật người chơi |
| `/dialogue` | DialogueSample | Tùy chọn | Chỉnh sửa mẫu đối thoại |
| `/extra` | ExtraRules | Tùy chọn | Quy tắc bổ sung (depth prompt...) |
| `/mvu` | MvuEditor | Nâng cao | Hệ thống biến MVU |
| `/regex` | RegexEditor | Nâng cao | Trình chỉnh sửa script Regex |
| `/scripts` | ScriptEditor | Nâng cao | Script Tavern Helper |
| `/ejs` | EjsEditor | Nâng cao | Trình chỉnh sửa mẫu EJS |
| `/statusbar` | StatusBarEditor | Nâng cao | Chỉnh sửa thanh trạng thái frontend |
| `/sandbox` | StatusBarSandbox | Công cụ | Xem trước sandbox thanh trạng thái |
| `/package` | PackageExport | Xuất thẻ | Xuất thẻ PNG/JSON |
| `/diagnostic` | CardDiagnostic | Công cụ | Chẩn đoán thẻ nhân vật |
| `/assistant` | AiAssistant | Công cụ | Trợ lý AI (Live2D) |
| `/statistics` | Statistics | Công cụ | Thống kê thẻ |
| `/api` | ApiSettings | Cài đặt | Cấu hình nhà cung cấp API |

### 4.3 Quản lý trạng thái (4 Store)

| Store | File | Trách nhiệm |
|---|---|---|
| `useCardStore` | `stores/card.js` | Dữ liệu cốt lõi thẻ nhân vật: Quản lý chuẩn V2, CRUD Worldbook/Regex/Script, Nhập xuất |
| `useApiStore` | `stores/api.js` | Quản lý nhà cung cấp API: Gọi stream/non-stream OpenAI/Claude/Gemini, Danh sách mô hình |
| `useAppStore` | `stores/app.js` | UI ứng dụng: Chủ đề, Thanh bên, Toast, Hộp thoại xác nhận |
| `useAiniangStore` | `stores/ainiang.js` | Cấu hình trợ lý AI: Thiết lập nhân vật Live2D, Đường dẫn mô hình |

---

## 5. Chi tiết các module chức năng cốt lõi

### 5.1 Chuẩn thẻ nhân vật V2

- Định nghĩa cốt lõi nằm trong hàm `createEmptyCard()` của `stores/card.js`
- Hỗ trợ đầy đủ quy cách SillyTavern V2 (`spec: 'chara_card_v2'`, `spec_version: '2.0'`)
- Tự động chuyển đổi V1→V2 khi nhập thẻ, khi xuất thẻ đồng thời xuất cả khối data lẫn các trường legacy cấp cao nhất để đảm bảo tính tương thích
- Mục Worldbook chứa đầy đủ extensions (position / exclude_recursion / display_index / probability / depth / selectiveLogic / group / sticky / cooldown / delay / triggers...)
- Sử dụng trường sắp xếp độc lập `cfSortKey`, không xung đột với `insertion_order` hoặc `display_index` gốc của ST

### 5.2 Trình chỉnh sửa Worldbook

- Giao diện: `views/WorldBookEditor.vue` + Component: `components/WorldEntryCard.vue`
- Chỉnh sửa toàn diện các trường: keys / secondary_keys / comment / content / constant / selective / insertion_order / position / use_regex + toàn bộ extensions
- AI tạo hàng loạt: 6 mức mục tiêu số lượng (từ tối giản đến cực hạn), 4 phong cách mô tả, tạo dạng stream
- Hỗ trợ tính năng tiểu thuyết tham khảo, nhập JSON Worldbook gốc từ ST
- Bật/tắt/xóa hàng loạt, sắp xếp 2 chiều bằng ô số + kéo thả, lọc và tìm kiếm

### 5.3 Hệ thống biến MVU

- Thiết kế 3 bước có hướng dẫn: Thiết kế biến → Cấu hình tiêm → Hoàn tất
- Hỗ trợ các kiểu string / number / boolean / select, đường dẫn lồng nhau phân tách bằng dấu chấm
- Tiền tố `_` = Biến chỉ đọc (AI nhìn thấy nhưng không được sửa), tiền tố `$` = Biến ẩn (AI không nhìn thấy)
- Quản lý nhóm + sắp xếp kéo thả, mẫu preset nhanh
- Tự động tạo Zod Schema + trọn bộ 13 thành phần
- Liên kết đồng bộ với thanh trạng thái frontend

### 5.4 Trình chỉnh sửa script Regex

- Chỉnh sửa đầy đủ các trường Regex (findRegex / replaceString / trimStrings / placement / disabled / markdownOnly / promptOnly / runOnEdit / substituteRegex / minDepth / maxDepth)
- Thêm nhanh bộ 3 cơ bản 1 chạm (Thu gọn biến lớp hiển thị + Làm sạch biến lớp AI + Ẩn chuỗi tư duy)
- Trọn bộ 6 script MVU tiêu chuẩn, thư viện mẫu, AI tạo tự động hoàn toàn
- Bật/tắt/xóa hàng loạt, sắp xếp kéo thả

### 5.5 Tích hợp dịch vụ AI (3 nền tảng)

Hỗ trợ tương thích OpenAI / Claude (Anthropic) / Gemini (Google), mỗi nền tảng đều hỗ trợ cả hai phương thức gọi stream và non-stream:

| Nhà cung cấp | Endpoint | Xác thực | Phân tích stream |
|---|---|---|---|
| Tương thích OpenAI | `{baseUrl}/chat/completions` | Bearer token | SSE `data:` + `[DONE]` |
| Claude | `{baseUrl}/v1/messages` | x-api-key | `content_block_delta` + `text_delta` |
| Gemini | `{baseUrl}/v1beta/models/{model}:streamGenerateContent` | x-goog-api-key | Regex trích xuất trường `"text":` |

- `getModelMaxTokens(model)` tự động suy đoán max_tokens dựa theo tên mô hình
- `fetchModels(provider)` lấy danh sách mô hình khả dụng
- Cấu hình API tự động lưu vào `settings.json` với debounce 300ms

### 5.6 Đóng gói và nhập thẻ PNG/JSON

**Bản desktop** (Tiến trình chính):
- Sử dụng `png-chunks-extract` / `png-chunks-encode` / `png-chunk-text`
- Trích xuất: Tìm chunk `ccv3` trước, sau đó tìm chunk `chara` → giải mã base64 → JSON.parse
- Nhúng dữ liệu: Xóa chunk chara/ccv3 cũ → JSON → base64 → chunk tEXt → chèn vào trước IEND
- Có xác thực chữ ký PNG hợp lệ

**Bản web** (`web/src/utils/png-utils.js`):
- Thuần trình duyệt, phân tích thủ công cấu trúc chunk PNG
- Tính toán CRC32 thủ công
- Sử dụng `atob`/`btoa` + `TextDecoder`/`TextEncoder`

### 5.7 Trình tạo NPC

Hệ thống kiểm tra chất lượng 3 lớp:

| Tầng | Module | Trách nhiệm |
|---|---|---|
| Quét thuần frontend | `npc-checker.js` → `scanBagua()` | Regex so khớp 8 mẫu văn mẫu sáo rỗng, làm nổi bật thời gian thực |
| AI tự kiểm tra từng trường | `npc-checker.js` → `aiCheckField()` | Kiểm tra ngữ nghĩa từng trường |
| AI tự kiểm tra toàn diện | `npc-checker.js` → `aiCheckFullNpc()` | Đánh giá tính nhất quán tổng thể |

Module định dạng NPC (npc-format.js) hỗ trợ chuyển đổi 2 chiều giữa cấu trúc 6 khối ↔ YAML, kèm xác thực chuẩn hóa.

### 5.8 Trích xuất tiểu thuyết sang Worldbook

- `novel-extract-rules.js`: 5 loại trích xuất (Nhân vật / Tuyến sự kiện / Dòng thời gian / Thiết lập / Quỹ đạo vật phẩm), quy tắc viết văn nghiêm ngặt, regex phân đoạn chương (Trung/Nhật/Anh/Việt)
- `novel-extract-format.js`: Phân đoạn chương thông minh, chuyển đổi kết quả trích xuất → mục Worldbook, tự động phân loại thường trực / kích hoạt
- `novel-extract-checker.js`: Quét văn mẫu, phát hiện thiếu neo số chương, gộp chạy kép R1+R2, gộp các mục trùng tên giữa các đoạn, đánh giá điểm chất lượng tổng thể

### 5.9 Trình chỉnh sửa mẫu EJS

- Trình soạn thảo mã CodeMirror (Làm nổi bật cú pháp HTML/CSS/JS)
- Chèn đoạn mã mẫu EJS (điều kiện if/else, getvar, @@preprocessing)
- AI tạo tự động hoàn toàn + AI nhúng điều kiện
- Quản lý công tắc nhóm (Gộp nhóm mục Worldbook → tự động tạo công tắc `getwi()`)
- Xem trước biến giả lập + kiểm tra kết xuất

### 5.10 Thanh trạng thái frontend

- Giao diện: `StatusBarEditor.vue` + Sandbox: `StatusBarSandbox.vue`
- Thiết kế có hướng dẫn: Mô tả yêu cầu → AI tạo HTML → Tiêm vào thẻ
- Chế độ biến MVU (Đọc từ `getAllVariables().stat_data`) / Chế độ thuần văn bản (Tag `<StatusData>` ở cuối phản hồi AI)
- Tự động tạo script Regex + tự động tạo/bù đắp biến MVU
- Xem trước thời gian thực qua iframe, sandbox hỗ trợ sửa giá trị biến thủ công + ảnh chụp ngữ cảnh

### 5.11 Hệ thống chẩn đoán thẻ nhân vật

**7 kiểm tra thuần frontend** (`diagnostic-checks.js`):
- Kiểm tra thông tin cơ bản, chẩn đoán cấu trúc Worldbook, phân tích xung đột từ khóa, thống kê chiếm dụng token, kiểm tra rủi ro đệ quy, đánh giá chất lượng hành văn (quét văn mẫu), kiểm tra script Regex

**3 kiểm tra AI** (`diagnostic-ai-checks.js`):
- Chẩn đoán tính nhất quán nhân vật, chẩn đoán biến MVU, đánh giá thực hành tốt nhất
- Hỗ trợ AI viết lại trường thông tin + áp dụng 1 chạm

**6 loại sửa lỗi** (`diagnostic-fix.js`):
- Thống nhất order=100, chuyển mục cô lập thành thường trực, xóa mục trống, lọc keys rỗng, sửa đệ quy mục thường trực, sửa đệ quy mục kích hoạt
- Sửa lỗi 1 chạm + ngăn xếp hoàn tác 5 bước

### 5.12 Kết xuất Live2D

- pixi.js v6 + pixi-live2d-display v0.4 + Live2D Cubism SDK
- Yêu cầu mô hình chuẩn Cubism 4 (.model3.json / .moc3 / texture .png)
- File mô hình do người dùng tự cung cấp, không lưu trong kho mã nguồn
- Bản desktop khi đóng gói sẽ sao chép vào `resources/live2d/` thông qua `extraResources`
- Để hỗ trợ nạp tài nguyên qua giao thức file://, thiết lập `webSecurity: false`

---

## 6. Danh mục giao tiếp IPC

Toàn bộ được phơi bày qua `contextBridge.exposeInMainWorld('cardForgeAPI', {...})` của preload.js.

### Điều khiển cửa sổ

| Phương thức | Kênh | Loại |
|---|---|---|
| `minimize()` | `window:minimize` | send |
| `maximize()` | `window:maximize` | send |
| `close()` | `window:close` | send |
| `isMaximized()` | `window:isMaximized` | invoke |

### Hộp thoại tệp tin

| Phương thức | Kênh | Loại |
|---|---|---|
| `openFile(options)` | `dialog:openFile` | invoke |
| `openImage()` | `dialog:openImage` | invoke |
| `saveFile(options)` | `dialog:saveFile` | invoke |
| `selectDirectory()` | `dialog:selectDirectory` | invoke |

### Thao tác tệp tin

| Phương thức | Kênh | Loại |
|---|---|---|
| `readFile(path)` | `fs:readFile` | invoke |
| `readTextFile(path)` | `fs:readTextFile` | invoke |
| `writeFile(path, data, encoding)` | `fs:writeFile` | invoke |
| `fileExists(path)` | `fs:exists` | invoke |

### Thao tác thẻ nhân vật PNG

| Phương thức | Kênh | Giá trị trả về |
|---|---|---|
| `extractCharaData(path)` | `png:extractCharaData` | Chuỗi JSON |
| `embedCharaData(pngPath, cardJson, outputPath)` | `png:embedCharaData` | void |

### Cài đặt / Shell / Cập nhật / Log

| Phương thức | Kênh | Loại |
|---|---|---|
| `loadSettings()` | `settings:load` | invoke |
| `saveSettings(settings)` | `settings:save` | invoke |
| `openExternal(url)` | `shell:openExternal` | send |
| `getResourcePath()` | `app:getResourcePath` | invoke |
| `checkForUpdates()` | `update:check` | invoke |
| `getAppVersion()` | `update:getVersion` | invoke |
| `readErrorLog()` | `log:read` | invoke |
| `appendErrorLog(entry)` | `log:append` | invoke |
| `clearErrorLog()` | `log:clear` | invoke |
| `openLogFolder()` | `log:openFolder` | invoke |

---

## 7. Khác biệt giữa bản desktop và bản web

| Khía cạnh | Bản desktop (`src/`) | Bản web (`web/`) |
|---|---|---|
| I/O Tệp tin | Electron IPC (fs:*) | File API của trình duyệt |
| Đọc ghi PNG | Thư viện Node.js ở tiến trình chính | Thuần trình duyệt (CRC32 thủ công) |
| Lưu trữ cài đặt | IPC → settings.json | localStorage |
| Live2D | Có hỗ trợ | Không hỗ trợ |
| Cập nhật tự động | electron-updater | Không áp dụng |
| Thanh tiêu đề tùy biến | Có (`frame: false`) | Không (Thanh đỉnh di động) |
| Log lỗi | IPC → File ở tiến trình chính | Bộ đệm vòng cục bộ |
| Tải định tuyến | Import tĩnh | Lazy loading (import động) |
| Kiểu dáng | main.scss | global.css |
| Trợ lý AI Live2D | Có (store ainiang.js) | Không |
| Đường dẫn build base | `./` (Đường dẫn tương đối) | `/sillytavern-cardforge/` (GitHub Pages) |
| Cổng phát triển | 5173 | 5174 |

---

## 8. Build và đóng gói

### Chế độ phát triển

```bash
# Phát triển bản desktop (Khởi chạy song song Vite + Electron)
npm run electron:dev

# Phát triển thuần frontend (Gỡ lỗi trên trình duyệt, một số tính năng desktop không khả dụng)
npm run dev
```

### Build sản xuất

```bash
# Build tiến trình kết xuất → dist/
npm run build

# Đóng gói hoàn chỉnh (Tiến trình kết xuất + electron-builder) → dist_electron/
npm run dist
```

### Sản phẩm build

- **Bộ cài đặt NSIS**: `dist_electron/CardBuilding-Setup.exe`
- **Bản không cần cài đặt (Portable)**: `dist_electron/win-unpacked/CardBuilding.exe`
- **Bản web**: `web/dist/` (Triển khai lên GitHub Pages)

---

## 9. Tra cứu nhanh module tiện ích

| Module | File | Năng lực cốt lõi |
|---|---|---|
| Xây dựng ngữ cảnh AI | `card-context.js` | Ghép nối trạng thái thẻ hiện tại thành prompt AI (giới hạn 12000 ký tự) |
| Bắt lỗi | `error-logger.js` | Chặn bắt lỗi frontend + IPC ghi log vào tiến trình chính |
| Sửa lỗi JSON | `json-repair.js` | Bộ sửa lỗi JSON do AI trả về (bọc markdown/chú thích/ngoặc kép/máy trạng thái) |
| Kiểm tra chẩn đoán | `diagnostic-checks.js` | 7 kiểm tra thuần frontend |
| Chẩn đoán AI | `diagnostic-ai-checks.js` | 3 kiểm tra AI + AI sửa lỗi |
| Sửa lỗi chẩn đoán | `diagnostic-fix.js` | 6 phương án sửa lỗi + Ngăn xếp hoàn tác |
| Quy tắc NPC | `npc-rules.js` | Mẫu phát hiện văn mẫu sáo rỗng + Prompt quy tắc viết văn |
| Định dạng NPC | `npc-format.js` | Chuyển đổi qua lại NPC ↔ YAML |
| Tự kiểm tra NPC | `npc-checker.js` | 3 tầng kiểm tra chất lượng (Quét/Trường AI/AI toàn diện) |
| Quy tắc trích xuất tiểu thuyết | `novel-extract-rules.js` | 5 loại trích xuất + Regex phân đoạn chương |
| Định dạng trích xuất tiểu thuyết | `novel-extract-format.js` | Chuyển đổi trích xuất → Worldbook + Chạy kép R2 |
| Chất lượng trích xuất tiểu thuyết | `novel-extract-checker.js` | Gộp trùng tên + Đánh giá điểm chất lượng |
| Nhập Worldbook ST | `st-worldbook-import.js` | Chuyển đổi định dạng gốc ST → V2 |
| Thao tác PNG trình duyệt | `png-utils.js` (chỉ web) | Đọc ghi PNG chunk phía trình duyệt |

---

## 10. Tra cứu nhanh component

| Component | File | Trách nhiệm |
|---|---|---|
| `FloatingTools` | `components/FloatingTools.vue` | Quả cầu nổi kéo thả → Bảng công cụ AI tiện ích |
| `WorldEntryCard` | `components/WorldEntryCard.vue` | Thẻ chỉnh sửa đầy đủ mục Worldbook (Kéo thả/Mở rộng/Hàng loạt) |
| `AssetImportModal` | `components/AssetImportModal.vue` | Nhập Worldbook/MVU/Regex/Script từ thẻ khác |
| `AiFixPreviewModal` | `components/AiFixPreviewModal.vue` | Xem trước so sánh trước và sau khi AI viết lại |
| `DiagnosticIssue` | `components/DiagnosticIssue.vue` | Hiển thị vấn đề chẩn đoán (Mức độ nghiêm trọng + Sửa lỗi 1 chạm) |
| `ErrorLogModal` | `components/ErrorLogModal.vue` | Xem/Tìm kiếm/Xuất log lỗi |
| `FlameCorners` | `components/FlameCorners.vue` | Trang trí viền góc |

---

*Tài liệu kỹ thuật cập nhật: 2026-07-31*