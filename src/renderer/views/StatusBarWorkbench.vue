<template>
  <div class="page page--workbench">
    <div class="page__header flex-between">
      <div>
        <h1>Bàn làm việc thanh trạng thái</h1>
        <p>Định nghĩa biến → Xem trước thời gian thực → Tiêm 1 chạm bộ MVU & thanh trạng thái</p>
      </div>
      <div class="flex-row wb-actions">
        <span class="badge" :class="errors.length ? 'badge--danger' : 'badge--success'">
          {{ errors.length ? `${errors.length} vấn đề` : '✓ Cấu hình sẵn sàng' }}
        </span>
        <button class="btn btn--danger btn--sm" @click="onClearAll">Xóa đặt lại</button>
        <button class="btn btn--warning-icon btn--sm" @click="onRemoveInjected" title="Gỡ bộ MVU và thanh trạng thái đã tiêm khỏi thẻ hiện tại">Gỡ bộ đã tiêm</button>
        <button class="btn btn--primary" @click="openInjectPreview" :disabled="!canInject">
          {{ statusMode === 'text' ? 'Tiêm thanh trạng thái thuần văn bản' : 'Tiêm bộ MVU' }}
        </button>
      </div>
    </div>

    <!-- Bảng kiểm tra lỗi -->
    <div v-if="issues.length" class="card mb-md wb-issues-card">
      <div class="card__body wb-issues">
        <span v-for="(it, i) in issues" :key="i"
          class="wb-issue" :class="'wb-issue--' + it.level">{{ it.message }}</span>
      </div>
    </div>

    <div class="wb-grid">
      <!-- ============ Cột trái · Kho biến ============ -->
      <aside class="wb-col wb-col--left">
        <div class="card">
          <div class="card__header"><h3>Kho biến</h3></div>
          <div class="card__body wb-left-body">
            <button class="btn btn--secondary btn--sm wb-add-btn" @click="addGroup">+ Thêm nhóm</button>

            <div v-for="(group, gi) in varGroups" :key="'g' + gi"
              class="wb-group"
              :class="{ 'wb-dragging': groupDragSrcIdx === gi, 'wb-dragover': groupDragOverIdx === gi }"
              :draggable="groupDragEnabledIdx === gi"
              @dragstart="onGroupDragStart($event, gi)"
              @dragover.prevent="onGroupDragOver($event, gi)"
              @dragleave="onGroupDragLeave(gi)"
              @drop.prevent="onGroupDrop($event, gi)"
              @dragend="onGroupDragEnd">
              <div class="wb-group__head">
                <span class="wb-drag-handle"
                  @mousedown="groupDragEnabledIdx = gi"
                  @mouseup="groupDragEnabledIdx = null"
                  @mouseleave="groupDragEnabledIdx = null"
                  title="Kéo thả để sắp xếp">&#x22EE;&#x22EE;</span>
                <strong class="wb-group__name">{{ group.name || '(Chưa đặt tên)' }}</strong>
                <span class="wb-group__count">{{ group.fields.filter(f => f.name).length }}</span>
                <button class="btn btn--ghost btn--sm" style="padding:2px 6px" title="Đổi tên nhóm"
                  @click="startEditGroupName(group)">&#9998;</button>
                <button class="btn btn--ghost btn--sm" style="padding:2px 6px" title="Thêm biến"
                  @click="addField(group)">+</button>
                <button class="btn btn--danger btn--sm" style="padding:2px 6px" title="Xóa nhóm"
                  @click="appStore.confirmAction(`Xóa nhóm “${group.name || 'Chưa đặt tên'}” và các biến thuộc nhóm?`, () => removeGroup(gi))">×</button>
              </div>
              <div v-if="editingGroupName === group" class="wb-group-rename">
                <input class="input" v-model="groupNameDraft" placeholder="Tên nhóm"
                  @keyup.enter="confirmEditGroupName" @keyup.escape="cancelEditGroupName" v-focus />
              </div>
              <button v-for="(field, fi) in group.fields" :key="'f' + gi + '-' + fi"
                v-show="field.name || true"
                class="wb-var"
                :class="{ active: isFieldSelected(gi, fi), 'wb-var--empty': !field.name }"
                :draggable="fieldDragEnabled?.gi === gi && fieldDragEnabled?.fi === fi"
                @dragstart="onFieldDragStart($event, gi, fi)"
                @dragover.prevent="onFieldDragOver($event, gi, fi)"
                @dragleave="onFieldDragLeave(gi, fi)"
                @drop.prevent="onFieldDrop($event, gi, fi)"
                @dragend="onFieldDragEnd"
                @click="selectField(gi, fi)">
                <span class="wb-type-dot" :data-type="field.type"></span>
                <span class="wb-var__label">{{ field.name || '(Nhấp để đặt tên)' }}</span>
                <span class="wb-var__init">{{ fieldInitText(field) }}</span>
                <span v-if="field.name.startsWith('_')" class="wb-var__tag">Chỉ đọc</span>
              </button>
            </div>

            <!-- Preset nhanh -->
            <div class="wb-preset-block">
              <div class="wb-subtitle">Preset nhanh</div>
              <div class="wb-preset-row">
                <button v-for="p in presetKeys" :key="p.key" class="btn btn--ghost btn--sm"
                  @click="loadPreset(p.key)">{{ p.label }}</button>
              </div>
            </div>

            <!-- Preset tùy chỉnh -->
            <div class="wb-preset-block">
              <div class="wb-subtitle">Preset của tôi
                <template v-if="!savingNewPreset">
                  <button class="btn btn--ghost btn--sm" style="margin-left:4px" @click="startSaveNewPreset">+ Lưu hiện tại</button>
                </template>
              </div>
              <div v-if="savingNewPreset" class="wb-inline-edit">
                <input class="input" v-model="newPresetName" placeholder="Tên preset" @keyup.enter="confirmSaveNewPreset" @keyup.escape="cancelSaveNewPreset" v-focus />
                <button class="btn btn--primary btn--sm" @click="confirmSaveNewPreset">Lưu</button>
              </div>
              <div class="wb-preset-row" v-if="customPresets.length">
                <span v-for="preset in customPresets" :key="preset.id" style="display:inline-flex;align-items:center">
                  <template v-if="editingPresetId === preset.id">
                    <input class="input" style="width:100px;padding:2px 6px;font-size:11px" v-model="editingPresetName"
                      @keyup.enter="confirmRenamePreset" @blur="confirmRenamePreset" v-focus />
                  </template>
                  <template v-else>
                    <button class="btn btn--ghost btn--sm" @click="loadCustomPreset(preset)"
                      @dblclick="startRenamePreset(preset)" title="Nhấp để tải / Nhấp đúp để đổi tên">{{ preset.name }}</button>
                    <button class="btn btn--danger btn--sm" style="padding:1px 5px;font-size:10px"
                      @click="deleteCustomPreset(preset.id)" title="Xóa">×</button>
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ============ Cột giữa · Chỉnh sửa biến ============ -->
      <section class="wb-col wb-col--mid">
        <div class="card" v-if="selected">
          <div class="card__header flex-between">
            <h3>Biến · {{ selected.field.name || 'Chưa đặt tên' }}</h3>
            <button class="btn btn--danger btn--sm" @click="deleteSelected">Xóa biến này</button>
          </div>
          <div class="card__body">
            <div class="grid-2">
              <div class="form-group">
                <label>Nhóm trực thuộc</label>
                <input class="input" :value="selectedGroup.name" disabled />
              </div>
              <div class="form-group">
                <label>Tên hiển thị (để trống sẽ dùng tên biến)</label>
                <input class="input" v-model.trim="selected.field.label" placeholder="VD: Máu / HP">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>Tên biến (phân cấp bằng dấu ., bắt đầu bằng _ = AI chỉ đọc)</label>
                <input class="input" v-model.trim="selected.field.name" placeholder="VD: HP, Độ hảo cảm, Tiền tệ.Linh thạch">
              </div>
              <div class="form-group">
                <label>Kiểu dữ liệu</label>
                <select class="select" v-model="selected.field.type">
                  <option value="number">Số (number)</option>
                  <option value="string">Văn bản (string)</option>
                  <option value="boolean">Boolean (boolean)</option>
                  <option value="enum">Enum (enum)</option>
                  <option value="record">Record / Từ điển (record)</option>
                  <option value="array">Mảng (array)</option>
                </select>
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>Giá trị mặc định</label>
                <input class="input" v-model="selected.field.defaultValue"
                  :placeholder="defaultPlaceholder(selected.field.type)">
              </div>
              <div class="form-group" v-if="selected.field.type === 'boolean'">
                <label>&nbsp;</label>
              </div>
            </div>
            <div class="grid-3" v-if="selected.field.type === 'number'">
              <div class="form-group">
                <label>Giá trị tối thiểu (min)</label>
                <input class="input" type="number" v-model.number="selected.field.min" placeholder="Không giới hạn">
              </div>
              <div class="form-group">
                <label>Giá trị tối đa (max)</label>
                <input class="input" type="number" v-model.number="selected.field.max" placeholder="Không giới hạn">
              </div>
              <div class="form-group">
                <label>Tự động kẹp giá trị (Clamp)</label>
                <select class="select" v-model="selected.field.clamp">
                  <option :value="true">Có (Tự động cắt nếu vượt phạm vi)</option>
                  <option :value="false">Không</option>
                </select>
              </div>
            </div>
            <div class="form-group" v-if="selected.field.type === 'enum'">
              <label>Các tùy chọn Enum (phân tách bằng dấu phẩy)</label>
              <input class="input" v-model="selected.field.enumValues" placeholder="VD: Bình tĩnh, Căng thẳng, Tức giận">
            </div>
            <div class="form-group" v-if="selected.field.type === 'record'">
              <label>Cấu trúc trường con (phân tách bằng dấu phẩy: Tên trường:Kiểu)</label>
              <input class="input" v-model="selected.field.recordFields" placeholder="VD: Độ hảo cảm:number, Quan hệ:string">
            </div>
            <div class="form-group">
              <label>Căn cứ cập nhật (Điều kiện kích hoạt AI cập nhật biến này, mỗi dòng một mục)</label>
              <textarea class="textarea" v-model="selected.field.description" rows="3"
                placeholder="Mô tả bằng tiếng Việt, khi biên dịch sẽ chuyển thành quy tắc check.&#10;VD: Dựa theo biến động thái độ nhân vật ±3~6"></textarea>
            </div>
          </div>
        </div>
        <div class="card" v-else>
          <div class="card__body hint" style="text-align:center;padding:32px">
            Chọn một biến từ cột bên trái để bắt đầu chỉnh sửa, hoặc nhấp '+ Thêm nhóm' / Preset nhanh để bắt đầu
          </div>
        </div>

        <!-- Cấu hình chung -->
        <div class="card mt-md">
          <div class="card__header"><h3>Cấu hình chung</h3></div>
          <div class="card__body">
            <div class="form-group">
              <label>Nguồn dữ liệu thanh trạng thái</label>
              <select class="select" v-model="statusMode">
                <option value="mvu">Chế độ biến MVU — Đọc dữ liệu thời gian thực từ hệ thống biến (Khuyên dùng)</option>
                <option value="text">Chế độ thuần văn bản — AI xuất văn bản trạng thái mỗi lần trả lời, không cần MVU</option>
              </select>
              <div class="hint" style="margin-top:4px" v-if="statusMode === 'text'">
                Ở chế độ thuần văn bản sẽ không tiêm bộ MVU; chỉ tạo mục chỉ lệnh xuất + 2 Regex, biến kiểu lồng nhau/record sẽ không hiển thị trên giao diện.
              </div>
            </div>
            <template v-if="statusMode === 'mvu'">
              <div class="grid-2">
                <div class="form-group">
                  <label>Phương thức tiêm biến</label>
                  <select class="select" v-model="injectMode">
                    <option value="single">Tiêm toàn bộ — Tiêm tất cả biến vào 1 mục Worldbook</option>
                    <option value="split">Tách theo nhóm — Mỗi nhóm là 1 mục độc lập, có thể kích hoạt bằng từ khóa cho NPC...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Giữ cập nhật biến của bao nhiêu tin nhắn gần nhất gửi cho AI</label>
                  <select class="select" v-model.number="keepFloors">
                    <option :value="3">3 tin nhắn gần nhất (Khuyên dùng, chống trùng lặp)</option>
                    <option :value="2">2 tin nhắn gần nhất</option>
                    <option :value="1">1 tin nhắn gần nhất</option>
                    <option :value="0">Không gửi toàn bộ</option>
                  </select>
                </div>
              </div>
              <label class="toggle-label">
                <input type="checkbox" v-model="trackPresentChars"> Bật theo dõi nhân vật hiện diện
              </label>
              <div class="hint" style="margin-top:4px">
                Tự động thêm biến "Nhân vật hiện diện", AI sẽ cập nhật danh sách nhân vật có mặt mỗi lần phản hồi.
              </div>
            </template>
          </div>
        </div>

        <!-- Kiểm tra đường dẫn 3 chiều -->
        <details class="card mt-md">
          <summary class="card__header" style="cursor:pointer"><h3>Kiểm tra đường dẫn 3 chiều (Định nghĩa vs Sử dụng trong HTML)</h3></summary>
          <div class="card__body">
            <template v-if="!statusHtmlSource">
              <p class="hint">Chưa tạo mã HTML thanh trạng thái.</p>
            </template>
            <template v-else-if="pathDiff && pathDiff.onlyDefined.length === 0 && pathDiff.onlyUsed.length === 0">
              <span class="badge badge--success">✓ Hoàn toàn khớp ({{ pathDiff.definedPaths.length }} đường dẫn)</span>
            </template>
            <template v-else-if="pathDiff">
              <div v-if="pathDiff.onlyDefined.length" class="mb-sm">
                <div style="color:var(--cf-warning);font-size:12px;margin-bottom:4px">
                  Đã định nghĩa nhưng thanh trạng thái chưa dùng ({{ pathDiff.onlyDefined.length }})
                </div>
                <span v-for="p in pathDiff.onlyDefined" :key="p" class="badge badge--warning" style="margin:0 4px 4px 0">{{ p }}</span>
              </div>
              <div v-if="pathDiff.onlyUsed.length" class="mb-sm">
                <div style="color:#f87171;font-size:12px;margin-bottom:4px">
                  Thanh trạng thái có dùng nhưng chưa định nghĩa ({{ pathDiff.onlyUsed.length }})
                </div>
                <span v-for="p in pathDiff.onlyUsed" :key="p" class="badge badge--danger" style="margin:0 4px 4px 0">{{ p }}</span>
              </div>
            </template>
          </div>
        </details>
      </section>

      <!-- ============ Cột phải · Xem trước + AI ============ -->
      <aside class="wb-col wb-col--right">
        <div class="card">
          <div class="card__header flex-between">
            <h3>Xem trước thời gian thực</h3>
            <div class="flex-row" style="gap:4px">
              <select class="select select--sm" v-model="theme">
                <option v-for="(t, k) in themes" :key="k" :value="k">{{ t.label }}</option>
              </select>
              <select class="select select--sm" v-model="layout">
                <option v-for="(l, k) in layouts" :key="k" :value="k">{{ l.label.split('（')[0] }}</option>
              </select>
            </div>
          </div>
          <div class="card__body" style="padding:0">
            <iframe ref="previewIframeRef" :srcdoc="previewDoc" class="wb-preview-frame"
              sandbox="allow-scripts allow-same-origin" @load="onPreviewLoad"></iframe>
          </div>
          <div class="card__body wb-src-row" v-if="statusHtmlSource">
            <details>
              <summary class="hint" style="cursor:pointer">Xem/Sửa mã nguồn thanh trạng thái ({{ htmlOriginLabel }})</summary>
              <textarea class="wb-src-editor" :value="editedTextareaValue"
                @input="onEditSource" spellcheck="false"></textarea>
              <div class="flex-row" style="margin-top:6px;gap:6px" v-if="htmlEditedByUser">
                <button class="btn btn--ghost btn--sm" @click="revertToGenerated">Quay lại bản sinh tự động</button>
                <span class="hint">Bản xem trước & tiêm hiện dùng bản chỉnh sửa thủ công/AI</span>
              </div>
            </details>
          </div>
        </div>

        <!-- Thử nghiệm biến -->
        <div class="card mt-md">
          <div class="card__header flex-between">
            <h3>Thử nghiệm biến</h3>
            <div class="flex-row" style="gap:4px" v-if="hasStatusBinding">
              <button class="btn btn--secondary btn--sm" @click="resetPlayground">Đặt lại biến</button>
              <button class="btn btn--secondary btn--sm" @click="saveSnapshot">+ Lưu ngữ cảnh</button>
            </div>
          </div>
          <div class="card__body wb-play-body">
            <template v-if="!hasAnyVariables">
              <p class="hint" style="text-align:center;padding:12px">Sau khi thêm biến ở cột trái, bạn có thể chỉnh giá trị tại đây để kiểm tra phản hồi của thanh trạng thái theo thời gian thực.</p>
            </template>
            <template v-else-if="statusMode === 'text'">
              <div class="form-group">
                <label>Giả lập nội dung &lt;StatusData&gt; AI trả về (Mỗi dòng: Tên trường:Giá trị)</label>
                <textarea class="textarea wb-play-mono" v-model="textModeMockInput" rows="5"></textarea>
                <div class="flex-row" style="margin-top:6px;gap:6px">
                  <button class="btn btn--primary btn--sm" @click="pushTextModeUpdate">Đẩy vào bản xem trước</button>
                  <span class="hint">Kiểm tra phân tích và kết xuất chế độ thuần văn bản</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div v-for="(group, gi) in varGroups" :key="'pg' + gi" class="mb-sm" v-show="group.name && group.fields.some(f => f.name && !f.name.startsWith('_'))">
                <div class="wb-subtitle" style="margin-bottom:3px">{{ group.name }}</div>
                <div v-for="(field, fi) in group.fields" :key="'pgf' + gi + '-' + fi" v-show="field.name && !field.name.startsWith('_')"
                  class="wb-play-field">
                  <label :title="`${group.name}.${field.name}`">{{ field.label || field.name }}</label>
                  <template v-if="isPlaygroundPathEditable(group.name, field.name)">
                    <select v-if="field.type === 'boolean'" class="select select--sm wb-play-ctl"
                      :value="String(getPlayValue(group.name, field.name))"
                      @change="setPlayValue(group.name, field.name, $event.target.value === 'true')">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                    <select v-else-if="field.type === 'enum' && (field.enumValues || '').trim()" class="select select--sm wb-play-ctl"
                      :value="String(getPlayValue(group.name, field.name) ?? '')"
                      @change="setPlayValue(group.name, field.name, $event.target.value)">
                      <option v-for="opt in field.enumValues.split(',').map(v => v.trim()).filter(Boolean)" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <input v-else-if="field.type === 'number'" class="input input--sm wb-play-ctl" type="number"
                      :value="Number(getPlayValue(group.name, field.name) ?? 0)"
                      @input="setPlayValue(group.name, field.name, Number($event.target.value))" />
                    <input v-else-if="field.type !== 'record' && field.type !== 'array'" class="input input--sm wb-play-ctl"
                      :value="String(getPlayValue(group.name, field.name) ?? '')"
                      @input="setPlayValue(group.name, field.name, $event.target.value)" />
                    <textarea v-else class="wb-play-json" rows="2" spellcheck="false"
                      placeholder='JSON, VD: {"Độ hảo cảm": 50}'
                      :value="playJsonTexts[`${group.name}.${field.name}`] ?? JSON.stringify(getPlayValue(group.name, field.name) ?? {})"
                      @change="setPlayJson(group.name, field.name, $event.target.value)"></textarea>
                  </template>
                  <input v-else class="input input--sm wb-play-ctl" disabled
                    :value="String(getPlayValue(group.name, field.name) ?? '')"
                    title="Đường dẫn này không xuất hiện trong HTML thanh trạng thái hiện tại, chỉ mang tính hiển thị" />
                </div>
              </div>
            </template>

            <!-- Ảnh chụp ngữ cảnh -->
            <div v-if="snapshots.length" class="wb-snapshots">
              <div class="wb-subtitle">Ảnh chụp ngữ cảnh</div>
              <div class="wb-preset-row">
                <span v-for="s in snapshots" :key="s.id" style="display:inline-flex;align-items:center">
                  <template v-if="editingSnapshotId === s.id">
                    <input class="input" style="width:100px;padding:2px 6px;font-size:11px" v-model="editingSnapshotName"
                      @keyup.enter="confirmRenameSnapshot" @blur="confirmRenameSnapshot" v-focus />
                  </template>
                  <template v-else>
                    <button class="btn btn--ghost btn--sm" @click="loadSnapshot(s)"
                      @dblclick="startRenameSnapshot(s)" title="Nhấp để tải / Nhấp đúp để đổi tên">{{ s.name }}</button>
                    <button class="btn btn--danger btn--sm" style="padding:1px 5px;font-size:10px"
                      @click="deleteSnapshot(s.id)" title="Xóa">×</button>
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Khối AI -->
        <div class="card mt-md">
          <div class="card__header"><h3>Trợ lý AI</h3></div>
          <div class="card__body">
            <div class="form-group">
              <label>Mô tả yêu cầu</label>
              <textarea class="textarea" v-model="aiDirection" rows="3"
                placeholder="Mô tả thanh trạng thái bạn muốn, ví dụ: Thẻ tu tiên, hệ thống đột phá cảnh giới, có túi đồ và phân trang độ hảo cảm NPC..."></textarea>
            </div>
            <div class="flex-row wb-ai-buttons">
              <button class="btn btn--primary btn--sm" @click="aiDesignPlan" :disabled="aiBusy || !apiStore.isConfigured"
                :title="apiStore.isConfigured ? '' : 'Vui lòng cấu hình API Key trong cài đặt trước'">
                {{ aiBusy ? 'Đang tạo...' : 'AI thiết kế phương án biến' }}
              </button>
              <button class="btn btn--accent btn--sm" @click="aiOneShot" :disabled="aiBusy || !apiStore.isConfigured"
                :title="apiStore.isConfigured ? '' : 'Vui lòng cấu hình API Key trong cài đặt trước'">
                Tạo trọn bộ 1 chạm
              </button>
              <button class="btn btn--secondary btn--sm" @click="beautifyHtml" :disabled="aiBusy || !apiStore.isConfigured || !groupsReadyForHtml"
                :title="groupsReadyForHtml ? '' : 'Vui lòng định nghĩa biến trước khi làm đẹp'">
                AI làm đẹp HTML hiện tại
              </button>
            </div>
            <p class="hint" style="margin-top:8px;line-height:1.7">
              "Thiết kế phương án biến" chỉ tạo cấu trúc biến để bạn tùy chỉnh; "Tạo trọn bộ 1 chạm" = Phương án + HTML cơ bản;
              "AI làm đẹp" sẽ tùy biến giao diện dựa trên bản tự sinh hiện tại, có thể hoàn tác nếu không vừa ý.
            </p>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modal xem trước tiêm -->
    <InjectPreviewModal
      :visible="injectModalVisible"
      :kit="pendingKit"
      :status-html="htmlToInject"
      :conflict="injectConflict"
      :busy="injecting"
      :error="injectError"
      v-model:strategy="injectStrategy"
      @confirm="doInject"
      @cancel="injectModalVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useCardStore } from '../stores/card.js';
import { useApiStore } from '../stores/api.js';
import { useAppStore } from '../stores/app.js';
import { buildCardContext } from '../utils/card-context.js';
import { chatForJsonArray } from '../utils/json-repair.js';
import InjectPreviewModal from '../components/InjectPreviewModal.vue';
import {
  validateVariables, buildMvuKit, applyMvuKit, mergeMvuKitIntoCard,
  detectExistingMvu, detectExistingStatusRegex,
  aiPlanToVarGroups, generateStatusHtml, buildPreviewStatData,
  generateTextModeHtml, generateTextModeRuleEntry, buildTextModeRegexes,
  TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT,
  diffVariableUsagePaths, mkField, extractStatusBarPaths,
  OUTPUT_FORMAT_TEXT, OUTPUT_EMPHASIS_TEXT,
  WORKBENCH_THEMES, WORKBENCH_LAYOUTS, STATUSBAR_REGEX_OLD_NAMES,
  MVU_KEYWORDS, REGEX_KEYWORDS
} from '../utils/statusbar-compiler.js';
import { wrapWithMock } from '../utils/statusbar-mock.js';

const cardStore = useCardStore();
const apiStore = useApiStore();
const appStore = useAppStore();

/* Cấu hình khởi tạo */
const injectMode = ref('single');
const keepFloors = ref(3);
const trackPresentChars = ref(false);
/* Nguồn dữ liệu thanh trạng thái: mvu (mặc định) | text (thuần văn bản, không phụ thuộc MVU) */
const statusMode = ref('mvu');

/* ========================================================================
 * Dữ liệu: cfMvuVarGroups là nguồn duy nhất (nếu không có thì đọc từ initvar trong Worldbook)
 * ======================================================================== */

const varGroups = reactive([]);
let _skipSave = false;

function loadFromCard() {
  _skipSave = true;
  varGroups.length = 0;
  const saved = cardStore.cardData.extensions?.cfMvuVarGroups;
  if (saved && saved.length > 0) {
    for (const g of saved) {
      const groupsClone = JSON.parse(JSON.stringify(g));
      for (const f of groupsClone.fields) f.showAdvanced = false;
      varGroups.push(groupsClone);
    }
  } else {
    /* Tương thích thẻ cũ: thử phân tích từ mục [initvar] trong Worldbook */
    for (const g of parseGroupsFromWorldBook()) varGroups.push(g);
  }
  selected.value = null;
  _skipSave = false;
}

function parseGroupsFromWorldBook() {
  const groups = [];
  for (const e of cardStore.worldEntries) {
    const c = (e.comment || '').toLowerCase();
    if (!c.includes('initvar') && !c.includes('变量初始化') && !c.includes('khởi tạo biến')) continue;
    const lines = (e.content || '').split('\n');
    let cur = null;
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('<') || t.startsWith('{')) continue;
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        const m = line.match(/^(\S+)\s*[:：]/);
        if (m) { cur = { name: m[1].replace(/['"]/g, ''), fields: [] }; groups.push(cur); }
        continue;
      }
      if (cur) {
        const fm = t.match(/^(\S+)\s*[:：]\s*(.*)/);
        if (fm) {
          const n = fm[1].replace(/['"]/g, '');
          if (n === '__children') continue;
          const v = (fm[2] || '').replace(/['"]/g, '').trim();
          if (!cur.fields.find(f => f.name === n))
            cur.fields.push(mkField(n, v !== '' && !isNaN(v) ? 'number' : 'string', v));
        }
      }
    }
    break;
  }
  return groups;
}

watch(() => cardStore.cardData.name, () => { loadFromCard(); });
watch(varGroups, () => {
  if (_skipSave) return;
  if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
  const slim = JSON.parse(JSON.stringify(varGroups));
  for (const g of slim) delete g.collapsed;
  for (const g of slim) for (const f of g.fields) delete f.showAdvanced;
  cardStore.cardData.extensions.cfMvuVarGroups = slim;
  cardStore.markDirty();
}, { deep: true });

/* ========================================================================
 * Lựa chọn / Chỉnh sửa
 * ======================================================================== */

const selected = ref(null); /* { gi, fi, field } */
function selectField(gi, fi) {
  const field = varGroups[gi]?.fields[fi];
  if (!field) return;
  selected.value = { gi, fi, field };
}
function isFieldSelected(gi, fi) {
  return selected.value && selected.value.gi === gi && selected.value.fi === fi;
}
function addGroup() {
  varGroups.push({ name: '', fields: [] });
  appStore.toastInfo('Đã thêm nhóm, nhấp vào ✎ cạnh tên nhóm để đặt tên');
}
function startEditGroupName(group) {
  editingGroupName.value = group;
  groupNameDraft.value = group.name;
}
function confirmEditGroupName() {
  if (editingGroupName.value) editingGroupName.value.name = groupNameDraft.value.trim();
  editingGroupName.value = null;
}
function cancelEditGroupName() { editingGroupName.value = null; }
function removeGroup(gi) {
  if (selected.value?.gi === gi) selected.value = null;
  varGroups.splice(gi, 1);
}
function addField(group) {
  const f = mkField('', 'number', '');
  group.fields.push(f);
  const gi = varGroups.indexOf(group);
  selectField(gi, group.fields.length - 1);
}
function deleteSelected() {
  if (!selected.value) return;
  const { gi, fi } = selected.value;
  appStore.confirmAction(`Xóa biến \"${varGroups[gi]?.fields[fi]?.name || 'Chưa đặt tên'}\"?`, () => {
    varGroups[gi].fields.splice(fi, 1);
    selected.value = null;
  });
}
function defaultPlaceholder(type) {
  return { number: 'VD: 100', string: 'VD: Không rõ', boolean: 'true / false', enum: 'Giá trị enum đầu tiên', record: '{}', array: '[]' }[type] || '';
}
function fieldInitText(field) {
  switch (field.type) {
    case 'record': return '{}'; case 'array': return '[]';
    case 'boolean': return (field.defaultValue === true || field.defaultValue === 'true') ? 'true' : 'false';
    default: return String(field.defaultValue ?? '') || '—';
  }
}

const editingGroupName = ref(null);
const groupNameDraft = ref('');
const vFocus = { mounted: (el) => el.focus() };

/* Hiển thị "Nhóm trực thuộc" ở cột giữa */
const selectedGroup = computed(() => {
  if (!selected.value) return { name: '' };
  return varGroups[selected.value.gi] || { name: '' };
});

/* Khởi tạo dữ liệu biến của thẻ */
loadFromCard();

/* ========================================================================
 * Kéo thả sắp xếp
 * ======================================================================== */

const groupDragSrcIdx = ref(null);
const groupDragOverIdx = ref(null);
const groupDragEnabledIdx = ref(null);

function onGroupDragStart(e, gi) { groupDragSrcIdx.value = gi; e.dataTransfer.effectAllowed = 'move'; }
function onGroupDragOver(e, gi) {
  if (gi === groupDragSrcIdx.value) return;
  groupDragOverIdx.value = gi;
  e.dataTransfer.dropEffect = 'move';
}
function onGroupDragLeave(gi) { if (groupDragOverIdx.value === gi) groupDragOverIdx.value = null; }
function onGroupDrop(e, gi) {
  const src = groupDragSrcIdx.value;
  if (src !== null && src !== gi) {
    const [item] = varGroups.splice(src, 1);
    varGroups.splice(gi, 0, item);
  }
  groupDragSrcIdx.value = null; groupDragOverIdx.value = null; groupDragEnabledIdx.value = null;
}
function onGroupDragEnd() { groupDragSrcIdx.value = null; groupDragOverIdx.value = null; groupDragEnabledIdx.value = null; }

const fieldDragSrc = ref(null);
const fieldDragOver = ref(null);
const fieldDragEnabled = ref(null);

function onFieldDragStart(e, gi, fi) {
  fieldDragSrc.value = { gi, fi };
  e.dataTransfer.effectAllowed = 'move';
}
function onFieldDragOver(e, gi, fi) {
  if (fieldDragSrc.value?.gi !== gi) return;
  if (fieldDragSrc.value?.fi === fi) return;
  fieldDragOver.value = { gi, fi };
  e.dataTransfer.dropEffect = 'move';
}
function onFieldDragLeave(gi, fi) {
  if (fieldDragOver.value?.gi === gi && fieldDragOver.value?.fi === fi) fieldDragOver.value = null;
}
function onFieldDrop(e, gi, fi) {
  const src = fieldDragSrc.value;
  if (src && src.gi === gi && src.fi !== fi) {
    const [item] = varGroups[gi].fields.splice(src.fi, 1);
    varGroups[gi].fields.splice(fi, 0, item);
  }
  fieldDragSrc.value = null; fieldDragOver.value = null; fieldDragEnabled.value = null;
}
function onFieldDragEnd() { fieldDragSrc.value = null; fieldDragOver.value = null; fieldDragEnabled.value = null; }

/* ========================================================================
 * Kiểm tra tính hợp lệ
 * ======================================================================== */

const allIssues = computed(() => validateVariables(varGroups, { trackPresentChars: trackPresentChars.value }));
const errors = computed(() => allIssues.value.filter(i => i.level === 'error'));
const warnings = computed(() => allIssues.value.filter(i => i.level === 'warn'));
const issues = computed(() => [...errors.value, ...warnings.value]);
const canInject = computed(() => errors.value.length === 0 && varGroups.some(g => g.name && g.fields.some(f => f.name)));

/* ========================================================================
 * Xem trước tự động
 * ======================================================================== */

const theme = ref('modern');
const layout = ref('grouped');
const editedHtml = ref('');
const htmlEditedByUser = ref(false);
const previewIframeRef = ref(null);
const themes = WORKBENCH_THEMES;
const layouts = WORKBENCH_LAYOUTS;

const generatedHtml = computed(() => {
  if (statusMode.value === 'text') {
    return generateTextModeHtml(varGroups, { theme: theme.value, layout: layout.value });
  }
  return generateStatusHtml(varGroups, { theme: theme.value, layout: layout.value });
});
const statusHtmlSource = computed(() => htmlEditedByUser.value ? (editedHtml.value || '') : generatedHtml.value);
const htmlOriginLabel = computed(() => htmlEditedByUser.value ? 'Bản sửa thủ công/AI' : 'Sinh tự động');
const htmlToInject = computed(() => statusHtmlSource.value);

const editedTextareaValue = computed(() =>
  htmlEditedByUser.value ? editedHtml.value : generatedHtml.value);

function onEditSource(e) {
  editedHtml.value = e.target.value;
  htmlEditedByUser.value = true;
}
function revertToGenerated() {
  htmlEditedByUser.value = false;
  editedHtml.value = '';
}

const initialMockData = computed(() => buildPreviewStatData(varGroups, { trackPresentChars: trackPresentChars.value }));

const previewDoc = computed(() => wrapWithMock(statusHtmlSource.value, initialMockData.value));

function pushMockUpdate() {
  const win = previewIframeRef.value?.contentWindow;
  if (win) win.postMessage({ type: 'mockStatData:update', data: JSON.parse(JSON.stringify(initialMockData.value)) }, '*');
}
function onPreviewLoad() { setTimeout(pushMockUpdate, 80); }

const pathDiff = computed(() =>
  statusHtmlSource.value ? diffVariableUsagePaths(varGroups, statusHtmlSource.value) : null);

const groupsReadyForHtml = computed(() => canInject.value);

/* ========================================================================
 * Khu vực thử nghiệm biến
 * ======================================================================== */

const playData = ref({});

const hasAnyVariables = computed(() =>
  varGroups.some(g => g.name && g.fields.some(f => f.name)));

function setPath(obj, pathParts, value) {
  let node = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!node[pathParts[i]] || typeof node[pathParts[i]] !== 'object') node[pathParts[i]] = {};
    node = node[pathParts[i]];
  }
  node[pathParts[pathParts.length - 1]] = value;
}
function getPath(obj, pathParts) {
  let node = obj;
  for (const p of pathParts) {
    if (node == null) return undefined;
    node = node[p];
  }
  return node;
}

function resetPlayground() {
  playData.value = JSON.parse(JSON.stringify(initialMockData.value));
  textModeMockInput.value = buildTextModeDefaultInput();
  pushPlayUpdate();
}

function isPlaygroundPathEditable(groupName, fieldName) {
  const full = `${groupName}.${fieldName}`;
  if (!statusHtmlSource.value) return false;
  return extractStatusBarPaths(statusHtmlSource.value).has(full);
}

function getPlayValue(groupName, fieldName) {
  return getPath(playData.value, [groupName, ...fieldName.split('.')]);
}
function setPlayValue(groupName, fieldName, value) {
  const next = JSON.parse(JSON.stringify(playData.value));
  setPath(next, [groupName, ...fieldName.split('.')], value);
  playData.value = next;
  pushPlayUpdate();
}
function setPlayJson(groupName, fieldName, text) {
  try {
    const parsed = JSON.parse(text || '{}');
    const next = JSON.parse(JSON.stringify(playData.value));
    setPath(next, [groupName, ...fieldName.split('.')], parsed);
    playData.value = next;
    playJsonTexts[`${groupName}.${fieldName}`] = undefined;
    pushPlayUpdate();
  } catch {
    appStore.toastWarning('Định dạng JSON không hợp lệ, chưa áp dụng');
  }
}
const playJsonTexts = reactive({});

function pushPlayUpdate() {
  const win = previewIframeRef.value?.contentWindow;
  if (win && statusMode.value === 'mvu') {
    win.postMessage({ type: 'mockStatData:update', data: JSON.parse(JSON.stringify(playData.value)) }, '*');
  }
}

watch([initialMockData], () => { playData.value = JSON.parse(JSON.stringify(initialMockData.value)); });
watch(varGroups, () => {
  playData.value = JSON.parse(JSON.stringify(initialMockData.value));
}, { deep: true });

/* —— Thử nghiệm chế độ thuần văn bản: Giả lập nội dung <StatusData> AI trả về —— */

const textModeMockInput = ref('');

function buildTextModeDefaultInput() {
  const lines = [];
  for (const g of varGroups) {
    if (!g.name) continue;
    for (const f of g.fields) {
      if (!f.name || f.name.startsWith('_') || f.name.includes('.')) continue;
      lines.push(`${fieldLabelOf(f)}:${f.defaultValue ?? ''}`);
      if (lines.length >= 8) return lines.join('\n');
    }
  }
  return lines.length ? lines.join('\n') : 'Vị trí:Một nơi nào đó\nTrạng thái:Bình thường';
}
function fieldLabelOf(f) { return f.label || f.name; }

function pushTextModeUpdate() {
  const win = previewIframeRef.value?.contentWindow;
  if (win) win.postMessage({ type: 'textModeMock', raw: textModeMockInput.value }, '*');
}

watch(statusMode, () => {
  htmlEditedByUser.value = false;
  editedHtml.value = '';
  if (statusMode.value === 'text') {
    if (!textModeMockInput.value.trim()) textModeMockInput.value = buildTextModeDefaultInput();
  } else {
    resetPlayground();
  }
});
watch(textModeMockInput, () => {});

/* —— Ảnh chụp ngữ cảnh —— */

const snapshotKey = computed(() => 'cf_workbench_snapshots_' + (cardStore.cardData?.name || 'unnamed'));
const snapshots = ref([]);
const editingSnapshotId = ref(null);
const editingSnapshotName = ref('');

function loadSnapshots() {
  try {
    snapshots.value = JSON.parse(localStorage.getItem(snapshotKey.value) || '[]');
  } catch { snapshots.value = []; }
}
function persistSnapshots() {
  try { localStorage.setItem(snapshotKey.value, JSON.stringify(snapshots.value)); } catch {}
}
function saveSnapshot() {
  if (!snapshotsEnabled()) return;
  const snap = {
    id: 'snap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: 'Ngữ cảnh ' + (snapshots.value.length + 1),
    data: statusMode.value === 'mvu'
      ? JSON.parse(JSON.stringify(playData.value))
      : String(textModeMockInput.value),
    kind: statusMode.value,
    createdAt: new Date().toISOString()
  };
  snapshots.value.push(snap);
  persistSnapshots();
  appStore.toastSuccess('Đã lưu "' + snap.name + '" (Nhấp đúp để đổi tên)');
}
function loadSnapshot(snap) {
  if (snap.kind === 'text') {
    statusMode.value = 'text';
    textModeMockInput.value = String(snap.data ?? '');
    setTimeout(pushTextModeUpdate, 60);
  } else {
    statusMode.value = 'mvu';
    playData.value = JSON.parse(JSON.stringify(snap.data));
    setTimeout(pushPlayUpdate, 60);
  }
  appStore.toastSuccess('Đã tải "' + snap.name + '"');
}
function startRenameSnapshot(s) { editingSnapshotId.value = s.id; editingSnapshotName.value = s.name; }
function confirmRenameSnapshot() {
  const s = snapshots.value.find(x => x.id === editingSnapshotId.value);
  if (s) {
    const n = editingSnapshotName.value.trim();
    if (n) s.name = n;
    persistSnapshots();
  }
  editingSnapshotId.value = null; editingSnapshotName.value = '';
}
function deleteSnapshot(id) {
  appStore.confirmAction('Xóa ảnh chụp ngữ cảnh này?', () => {
    snapshots.value = snapshots.value.filter(x => x.id !== id);
    persistSnapshots();
    appStore.toastSuccess('Đã xóa');
  });
}
onMounted(loadSnapshots);
watch(snapshotKey, loadSnapshots);
watch(statusMode, () => {});

function snapshotsEnabled() { return true; }

const hasStatusBinding = computed(() => !!statusHtmlSource.value);

/* ========================================================================
 * 3 lối vào AI
 * ======================================================================== */

const aiDirection = ref('');
const aiBusy = ref(false);

async function requestAiVarPlan() {
  if (!apiStore.isConfigured) { appStore.toastError('Vui lòng cấu hình API Key trước'); return null; }
  const cardContext = buildCardContext(cardStore, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
  const result = await chatForJsonArray(apiStore, [
    { role: 'system', content: 'Bạn là chuyên gia thiết kế hệ thống biến cho thẻ nhân vật. Hãy thiết kế các đường dẫn biến cần thiết cho thanh trạng thái dựa trên thông tin thẻ và yêu cầu của người dùng. Chỉ xuất ra JSON, không kèm giải thích.' },
    { role: 'user', content: buildVarPlanPrompt(cardContext) }
  ], { temperature: 0.7, maxTokens: apiStore.getModelMaxTokens(apiStore.activeProvider?.model) });
  if (!Array.isArray(result) || result.length === 0) throw new Error('AI không trả về mảng biến hợp lệ');
  return result;
}

function buildVarPlanPrompt(cardContext) {
  return `Bạn là chuyên gia thiết kế hệ thống biến cho thẻ nhân vật. Hãy thiết kế các đường dẫn biến cần hiển thị trên thanh trạng thái cho thẻ nhân vật này.

【Thông tin thẻ nhân vật】
${cardContext}

${aiDirection.value ? '【Yêu cầu của người dùng】\n' + aiDirection.value + '\n\n' : ''}【Quy trình thiết kế — Suy nghĩ theo thứ tự sau】

Bước 1 - Khảo sát dữ liệu: Đọc toàn bộ nội dung thẻ, xác định "dữ liệu động sẽ thay đổi theo cốt truyện".
- Thẻ này nhấn mạnh hệ thống độc đáo nào? (Tu luyện? Kinh tế? Hảo cảm? Nhiệm vụ? Trang bị?)
- Những nhân vật nào cần theo dõi trạng thái? (Nhân vật chính, NPC cố định, NPC động?)
- Thế giới cần ghi nhận điều gì? (Thời gian, địa điểm, thời tiết, sự kiện?)
- Không áp dụng khuôn mẫu rập khuôn. Thẻ học đường không cần HP/MP, thẻ tu tiên thì cảnh giới và linh căn quan trọng hơn HP.

Bước 2 - Quy hoạch cấu trúc: Tổ chức dữ liệu thành các nhóm (top-level key), cân nhắc xem nhóm nào phù hợp để hiển thị theo phân trang/tab.

Bước 3 - Thiết kế đường dẫn: Xác định group (tên nhóm), field (tên trường, phân cấp bằng dấu .), type, default cho từng biến; kiểu số cần có min/max; kiểu enum cần mảng options; mỗi biến cần một câu description giải thích thời điểm cập nhật.

【Định dạng đầu ra】
Chỉ xuất ra mảng JSON:
[
  { "group": "Nhân vật chính", "field": "HP", "type": "number", "default": "100", "min": 0, "max": 100 },
  { "group": "Nhân vật chính", "field": "Cảnh giới", "type": "enum", "options": ["Luyện Khí", "Trúc Cơ"], "default": "Luyện Khí", "description": "Chỉ cập nhật khi có tình tiết đột phá" },
  { "group": "NPC", "field": "Độ hảo cảm", "type": "number", "default": "0" }
]

Chỉ xuất ra JSON, không có bất kỳ văn bản giải thích nào khác.`;
}

function mergePlanIntoGroups(planGroups) {
  for (const ng of planGroups) {
    if (!ng.name) continue;
    let existing = varGroups.find(g => g.name === ng.name);
    if (!existing) {
      existing = { name: ng.name, fields: [] };
      varGroups.push(existing);
    }
    for (const nf of ng.fields) {
      if (nf.name && !existing.fields.find(ef => ef.name === nf.name)) {
        existing.fields.push(nf);
      }
    }
  }
}

async function aiDesignPlan() {
  aiBusy.value = true;
  try {
    const plan = await requestAiVarPlan();
    const planGroups = aiPlanToVarGroups(plan);
    mergePlanIntoGroups(planGroups);
    const n = planGroups.reduce((s, g) => s + g.fields.length, 0);
    appStore.toastSuccess(`Đã gộp phương án biến (${planGroups.length} nhóm, ${n} biến), có thể tiếp tục chỉnh sửa ở cột trái`);
  } catch (e) {
    appStore.toastError('Tạo thất bại: ' + e.message);
  } finally { aiBusy.value = false; }
}

async function aiOneShot() {
  aiBusy.value = true;
  try {
    const plan = await requestAiVarPlan();
    const planGroups = aiPlanToVarGroups(plan);
    if (varGroups.length === 0 || varGroups.every(g => !g.name)) {
      varGroups.length = 0;
      for (const g of planGroups) varGroups.push(g);
    } else {
      mergePlanIntoGroups(planGroups);
    }
    await nextTickish();
    editedHtml.value = '';
    htmlEditedByUser.value = false;
    appStore.toastSuccess(`Đã tạo ${planGroups.length} nhóm biến và thanh trạng thái cơ bản theo phương án AI, có thể tiêm ngay hoặc tiếp tục làm đẹp`);
  } catch (e) {
    appStore.toastError('Tạo trọn bộ thất bại: ' + e.message);
  } finally { aiBusy.value = false; }
}

function nextTickish() { return new Promise(r => setTimeout(r, 30)); }

/* —— AI làm đẹp —— */

function extractHtml(result) {
  const text = result.trim();
  const m = text.match(/```html\s*\n([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text.replace(/```[\w]*\s*\n?/g, '').replace(/```/g, '').trim();
}

function findMissingTabs(html) {
  const targets = [];
  const re = /data-target=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) targets.push(m[1]);
  return targets.filter(t => !html.includes('id="' + t + '"') && !html.includes("id='" + t + "'"));
}

function isHtmlComplete(html) {
  if (!html.includes('</html>') && !html.includes('</body>')) return false;
  const targets = [];
  const re = /data-target=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) targets.push(m[1]);
  for (const t of targets) {
    if (!html.includes('id="' + t + '"') && !html.includes("id='" + t + "'")) return false;
  }
  return true;
}

function cleanHtmlComments(html) {
  const bodyMatch = html.match(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i);
  if (!bodyMatch) return html;
  const before = html.substring(0, html.indexOf(bodyMatch[0]));
  let bodyContent = bodyMatch[2];
  bodyContent = bodyContent.replace(/\/\*[\s\S]*?\*\//g, '');
  bodyContent = bodyContent.replace(/\n{3,}/g, '\n\n');
  return before + bodyMatch[1] + bodyContent + bodyMatch[3] + html.substring(html.indexOf(bodyMatch[0]) + bodyMatch[0].length);
}

async function beautifyHtml() {
  aiBusy.value = true;
  try {
    const cardContext = buildCardContext(cardStore, '', { modelContextTokens: apiStore.getModelContextTokens(apiStore.activeProvider?.model) });
    const baseHtml = statusHtmlSource.value;
    const prompt = buildBeautifyPrompt(cardContext, baseHtml);
    const maxTokens = apiStore.getModelMaxTokens(apiStore.activeProvider?.model);

    let html = extractHtml(await apiStore.chat([
      { role: 'system', content: 'Bạn là chuyên gia phát triển thanh trạng thái frontend. Hãy xuất ra mã HTML hoàn chỉnh và chính xác theo yêu cầu, không kèm văn bản giải thích.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.8, maxTokens }));

    const MAX_CONTINUE = 3;
    for (let i = 0; i < MAX_CONTINUE; i++) {
      if (isHtmlComplete(html)) break;
      const missingTabs = findMissingTabs(html);
      const issue = missingTabs.length > 0
        ? `Thiếu thẻ div nội dung cho các tab sau: ${missingTabs.join('、')}. `
        : 'HTML thiếu thẻ đóng </body></html>. ';
      appStore.toastWarning(`${issue}Đang tự động viết tiếp (${i + 1}/${MAX_CONTINUE})...`);

      let htmlForContinue = html;
      if (html.includes('</html>') && missingTabs.length > 0) {
        htmlForContinue = html.replace(/<\/body>\s*<\/html>\s*$/, '').replace(/<\/html>\s*$/, '');
      }
      const tail = htmlForContinue.slice(-400);
      const contPrompt = missingTabs.length > 0
        ? `Đoạn mã HTML thanh trạng thái sau bị thiếu các thẻ div nội dung tab này: ${missingTabs.join('、')}.\nVui lòng chỉ xuất ra các thẻ div nội dung tab bị thiếu, bắt đầu ngay sau thẻ div cuối cùng hiện có. Không lặp lại nội dung cũ, không xuất <head> và <style>, xuất trực tiếp div bị thiếu và kết thúc bằng </div></body></html>.\n\nĐoạn cuối mã hiện có:\n...${tail}`
        : `Mã HTML sau bị ngắt quãng, vui lòng viết tiếp phần mã còn lại từ điểm ngắt, không lặp lại nội dung đã có.\n\n...${tail}`;
      const contResult = await apiStore.chat([
        { role: 'system', content: 'Bạn là chuyên gia phát triển thanh trạng thái frontend. Tiếp tục xuất ra mã HTML bị thiếu, không kèm văn bản giải thích. Chú thích chỉ dùng /* */.' },
        { role: 'user', content: contPrompt }
      ], { temperature: 0.3, maxTokens });
      const continued = extractHtml(contResult);
      if (!continued) break;
      html = (html.includes('</html>') && missingTabs.length > 0)
        ? htmlForContinue + '\n' + continued
        : html + '\n' + continued;
    }

    html = cleanHtmlComments(html);
    if (!isHtmlComplete(html)) {
      appStore.toastWarning('Kết quả AI làm đẹp chưa hoàn chỉnh, đã giữ lại để chỉnh sửa thủ công (có thể quay lại bản tự sinh bất kỳ lúc nào)');
    }
    editedHtml.value = html;
    htmlEditedByUser.value = true;
    appStore.toastSuccess('AI làm đẹp hoàn tất, có thể kiểm tra hiệu ứng trong phần xem trước');
  } catch (e) {
    appStore.toastError('AI làm đẹp thất bại: ' + e.message);
  } finally { aiBusy.value = false; }
}

function buildBeautifyPrompt(cardContext, baseHtml) {
  const themeDesc = WORKBENCH_THEME_DESC[theme.value] || 'Tự do sáng tạo theo phong cách thẻ';
  const pathLines = [];
  for (const g of varGroups) {
    if (!g.name) continue;
    for (const f of g.fields) {
      if (!f.name) continue;
      const idHint = '';
      pathLines.push({ g, f, idHint });
    }
  }
  return `Dựa trên mã HTML thanh trạng thái tự sinh sẵn có sau đây, hãy viết lại phiên bản giao diện phong cách, trau chuốt và độc đáo hơn theo yêu cầu của người dùng.

【Thông tin thẻ nhân vật】
${cardContext}

【Định hướng thị giác】
${themeDesc}
${aiDirection.value ? '\n【Yêu cầu bổ sung của người dùng】\n' + aiDirection.value : ''}

【BẮT BUỘC TUÂN THỦ】
- Phải sử dụng ĐÚNG và CHỈ các đường dẫn biến sau đây (stat_data.<group>.<field>), tuyệt đối không tự ý thêm hoặc bớt:
${JSON.stringify(pathLines.map(p => ({ group: p.g.name, field: p.f.name, type: p.f.type, label: p.f.label || p.f.name })), null, 2)}
- Có thể dùng trực tiếp jquery/$, lodash/_, toastr mà không cần import
- Cách đọc biến: _.get(all_variables, 'stat_data.Nhóm.Tên biến', 'Giá trị mặc định') hoặc stat_data['Nhóm']['Tên biến']; populate sau khi waitGlobalInitialized('Mvu'); lắng nghe eventOn(Mvu.events.VARIABLE_UPDATE_ENDED) để làm mới
- Giữ nguyên cấu trúc chức năng ban đầu: tất cả các vị trí hiển thị dữ liệu đều phải có mặt; nếu có tab thì data-target của nút bấm phải khớp với id của div nội dung
- Trong <style> và <script> chỉ dùng chú thích /* */; không dùng đơn vị vh; tránh min-height và overflow:auto làm hỏng iframe; giao diện phải tự co giãn theo chiều rộng khung chứa không bị cuộn ngang

【Mã HTML cơ sở hiện tại (cải tiến hoặc tái cấu trúc hoàn toàn lớp giao diện dựa trên mã này)】
\`\`\`html
${baseHtml.slice(0, 6000)}
\`\`\`

Bọc mã trong khối \`\`\`html để xuất ra toàn bộ tài liệu hoàn chỉnh (từ <!doctype html> đến </html>), chỉ xuất mã nguồn.`;
}

const WORKBENCH_THEME_DESC = {
  modern: 'Phong cách tối giản hiện đại: Tông xanh dương, thẻ bo góc, nền bán trong suốt, hiệu ứng kính mờ',
  xiuxian: 'Phong cách cổ phong tiên hiệp: Tông vàng kim chủ đạo, font có chân, nền tím đen trầm mặc',
  cyber: 'Phong cách Cyberpunk: Xanh neon phát sáng, font monospace, giao diện HUD công nghệ',
  dark: 'Phong cách kỳ ảo tăm tối (Dark Fantasy): Tông đỏ đen, phong cách Gothic cổ điển, chất liệu giấy da cũ',
  school: 'Phong cách học đường tươi sáng: Tông xanh phấn dịu mắt, font bo tròn mềm mại'
};

/* ========================================================================
 * Preset nhanh & preset tùy chỉnh
 * ======================================================================== */

const presetKeys = [
  { key: 'rpg', label: 'RPG' }, { key: 'xiuxian', label: 'Tu tiên' },
  { key: 'school', label: 'Học đường' }, { key: 'simulation', label: 'Mô phỏng' },
  { key: 'dating', label: 'Hẹn hò' }, { key: 'survival', label: 'Sinh tồn' }
];
const presets = {
  rpg: [
    { name: 'Thế giới', fields: ['Ngày:string:', 'Thời gian:string:', 'Vị trí:string:', 'Thời tiết:string:'] },
    { name: 'Nhân vật chính', fields: ['HP:number:100', 'MP:number:50', 'Cấp độ:number:1'] },
    { name: 'NPC', fields: ['::record:{}'] },
    { name: 'Túi đồ', fields: ['::record:{}'] }
  ],
  xiuxian: [
    { name: 'Thế giới', fields: ['Ngày:string:', 'Vị trí:string:'] },
    { name: 'Nhân vật chính', fields: ['Cảnh giới tu vi:enum:Phàm nhân', 'Tiến độ tu luyện:number:0', 'Linh lực:number:100', 'Linh thạch:number:100'] },
    { name: 'NPC', fields: ['::record:{}'] },
    { name: 'Túi đồ', fields: ['::record:{}'] }
  ],
  school: [
    { name: 'Hệ thống', fields: ['Ngày:string:', 'Thời gian:string:', 'Thứ:string:', 'Vị trí:string:'] },
    { name: 'Nhân vật chính', fields: ['Thể lực:number:100', 'Tâm trạng:number:80', 'Tiền:number:5000'] },
    { name: 'NPC', fields: ['::record:{}'] }
  ],
  simulation: [
    { name: 'Hệ thống', fields: ['Ngày:string:', 'Số lượt:number:1', 'Điểm hành động:number:5'] },
    { name: 'Tài nguyên', fields: ['Tiền vàng:number:10000', 'Danh tiếng:number:0', 'Dân số:number:10'] }
  ],
  dating: [
    { name: 'Hệ thống', fields: ['Ngày:string:', 'Thời gian:string:', 'Vị trí:string:'] },
    { name: 'Nhân vật chính', fields: ['Mức độ cuốn hút:number:50', 'Tiền:number:3000', 'Thể lực:number:100'] },
    { name: 'NPC', fields: ['::record:{}'] }
  ],
  survival: [
    { name: 'Môi trường', fields: ['Số ngày:number:1', 'Thời tiết:string:', 'Nhiệt độ:number:25', 'Vị trí:string:'] },
    { name: 'Sinh tồn', fields: ['HP:number:100', 'Độ đói:number:100', 'Độ khát:number:100', 'Thể lực:number:100'] },
    { name: 'Vật tư', fields: ['::record:{}'] }
  ]
};

function presetField(spec) {
  const idx1 = spec.indexOf(':');
  const idx2 = idx1 === -1 ? -1 : spec.indexOf(':', idx1 + 1);
  const name = idx1 === -1 ? spec : spec.slice(0, idx1);
  const type = idx2 === -1 ? 'string' : spec.slice(idx1 + 1, idx2);
  const def = idx2 === -1 ? '' : spec.slice(idx2 + 1);
  const f = mkField(name, type || 'string', def || '');
  if (name === 'HP' || name === 'MP' || name === 'Thể lực' || name === 'Độ đói' || name === 'Độ khát' || name === '体力' || name === '饥饿' || name === '口渴') { f.min = 0; f.max = 100; f.clamp = true; }
  if ((name === 'Cảnh giới tu vi' || name === '修为境界') && type === 'enum') { f.enumValues = 'Phàm nhân, Luyện Khí, Trúc Cơ, Kim Đan, Nguyên Anh, Hóa Thần'; }
  return f;
}
function loadPreset(key) {
  const p = presets[key]; if (!p) return;
  varGroups.length = 0;
  selected.value = null;
  for (const g of p) {
    varGroups.push({ name: g.name, fields: g.fields.map(presetField) });
  }
  appStore.toastSuccess('Đã tải preset, có thể tiếp tục tùy chỉnh');
}

const customPresets = ref([]);
const savingNewPreset = ref(false);
const newPresetName = ref('');
const editingPresetId = ref(null);
const editingPresetName = ref('');

async function loadCustomPresetsRaw() {
  try {
    const settings = await window.cardForgeAPI.loadSettings();
    return Array.isArray(settings?.cfMvuGroupPresets) ? settings.cfMvuGroupPresets : [];
  } catch { return []; }
}
async function saveCustomPresetsRaw(presetsList) {
  try {
    const settings = (await window.cardForgeAPI.loadSettings()) || {};
    settings.cfMvuGroupPresets = presetsList;
    await window.cardForgeAPI.saveSettings(settings);
  } catch {}
}
onMounted(async () => { customPresets.value = await loadCustomPresetsRaw(); });

function startSaveNewPreset() {
  if (varGroups.length === 0 || varGroups.every(g => !g.name)) {
    appStore.toastWarning('Hiện không có nhóm biến hợp lệ, không thể lưu thành preset');
    return;
  }
  savingNewPreset.value = true;
  newPresetName.value = `Preset ${customPresets.value.length + 1}`;
}
async function confirmSaveNewPreset() {
  const name = newPresetName.value.trim();
  if (!name) { appStore.toastWarning('Tên preset không được để trống'); return; }
  customPresets.value.push({
    id: 'preset_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name,
    groups: JSON.parse(JSON.stringify(varGroups)),
    createdAt: new Date().toISOString()
  });
  await saveCustomPresetsRaw(customPresets.value);
  savingNewPreset.value = false; newPresetName.value = '';
  appStore.toastSuccess(`Đã lưu "${name}"`);
}
function cancelSaveNewPreset() { savingNewPreset.value = false; newPresetName.value = ''; }
function loadCustomPreset(preset) {
  varGroups.length = 0;
  selected.value = null;
  for (const g of preset.groups) {
    varGroups.push({ name: g.name, fields: g.fields.map(f => ({ ...f })) });
  }
  appStore.toastSuccess(`Đã tải "${preset.name}"`);
}
function startRenamePreset(preset) { editingPresetId.value = preset.id; editingPresetName.value = preset.name; }
async function confirmRenamePreset() {
  const preset = customPresets.value.find(p => p.id === editingPresetId.value);
  if (preset) {
    const n = editingPresetName.value.trim();
    if (n) preset.name = n;
    await saveCustomPresetsRaw(customPresets.value);
  }
  editingPresetId.value = null; editingPresetName.value = '';
}
function deleteCustomPreset(id) {
  appStore.confirmAction('Xóa preset tùy chỉnh này?', async () => {
    customPresets.value = customPresets.value.filter(p => p.id !== id);
    await saveCustomPresetsRaw(customPresets.value);
    appStore.toastSuccess('Đã xóa');
  });
}

/* ========================================================================
 * Quy trình tiêm
 * ======================================================================== */

const injectModalVisible = ref(false);
const injecting = ref(false);
const injectError = ref('');
const injectStrategy = ref('replace');
const pendingKit = ref(null);
const injectConflict = ref({ hasMvu: false, statusRegexNames: [] });

function openInjectPreview() {
  if (statusMode.value === 'text') {
    const html = statusHtmlSource.value;
    pendingKit.value = {
      scripts: [], entries: [
        { comment: TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT, content: generateTextModeRuleEntry(varGroups), cfg: {} }
      ],
      regexes: buildTextModeRegexes(html),
      summary: { scriptCount: 0, entryCount: 1, regexCount: 2 }
    };
    injectConflict.value = { hasMvu: false, statusRegexNames: detectExistingStatusRegex(cardStore) };
    injectError.value = '';
    injectStrategy.value = 'replace';
    injectModalVisible.value = true;
    return;
  }
  pendingKit.value = buildMvuKit({
    groups: JSON.parse(JSON.stringify(varGroups)),
    injectMode: injectMode.value,
    keepFloors: keepFloors.value,
    trackPresentChars: trackPresentChars.value
  });
  injectConflict.value = {
    hasMvu: detectExistingMvu(cardStore),
    statusRegexNames: detectExistingStatusRegex(cardStore)
  };
  injectError.value = '';
  injectStrategy.value = injectConflict.value.hasMvu ? 'merge' : 'replace';
  injectModalVisible.value = true;
}

async function doInject({ strategy }) {
  injecting.value = true;
  injectError.value = '';
  try {
    if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
    cardStore.cardData.extensions.cfMvuVarGroups = JSON.parse(JSON.stringify(varGroups));

    const statusHtml = statusHtmlSource.value;

    if (statusMode.value === 'text') {
      doInjectTextMode(statusHtml);
    } else {
      await doInjectMvuMode(strategy, statusHtml);
    }

    if (!cardStore.cardData.extensions) cardStore.cardData.extensions = {};
    cardStore.cardData.extensions.cfMvuVarGroups = JSON.parse(JSON.stringify(varGroups));

    appStore.toastSuccess(statusMode.value === 'text' ? 'Đã tiêm thanh trạng thái thuần văn bản' : (strategy === 'merge' ? 'Đã tiêm gộp hoàn tất' : 'Đã tiêm bộ MVU + thanh trạng thái hoàn tất'));
    injectModalVisible.value = false;
  } catch (e) {
    injectError.value = e.message;
  } finally { injecting.value = false; }
}

async function doInjectMvuMode(strategy, statusHtml) {
  const kit = pendingKit.value;
  const kitWithHtml = {
    ...kit,
    regexes: statusHtml
      ? [...kit.regexes, {
          scriptName: 'Làm đẹp thanh trạng thái',
          findRegex: '/<StatusPlaceHolderImpl\\s*\\/>/g',
          replaceString: '```html\n' + statusHtml + '\n```',
          markdownOnly: true,
          promptOnly: false
        }]
      : kit.regexes
  };

  if (strategy === 'merge') {
    refreshOldStatusRegex(statusHtml);
    mergeMvuKitIntoCard(cardStore, kitWithHtml, JSON.parse(JSON.stringify(varGroups)));
    const sbRegex = cardStore.regexScripts.find(r => r.scriptName === 'Làm đẹp thanh trạng thái' || r.scriptName === '状态栏美化');
    if (sbRegex && statusHtml) sbRegex.replaceString = '```html\n' + statusHtml + '\n```';
  } else {
    clearOldStatusRegexes();
    applyMvuKit(cardStore, kitWithHtml);
  }
}

function doInjectTextMode(statusHtml) {
  clearOldStatusRegexes();
  removeByKeywordsLive(cardStore.regexScripts, ['对AI隐藏状态数据', 'Ẩn dữ liệu trạng thái với AI'], r => r.scriptName,
    id => cardStore.removeRegexScript(id));

  const textRegexes = buildTextModeRegexes(statusHtml);
  for (const rx of textRegexes) {
    cardStore.addRegexScript({ ...cardStore.createEmptyRegexScript(), ...rx });
  }

  const existingIdx = cardStore.worldEntries.findIndex(e =>
    (e.comment || '').includes('状态数据输出指令') ||
    (e.comment || '').includes('Chỉ lệnh xuất dữ liệu trạng thái') ||
    (e.comment || '').includes(TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT)
  );
  if (existingIdx >= 0) cardStore.removeWorldEntry(cardStore.worldEntries[existingIdx].id);
  const entry = cardStore.addWorldEntry();
  entry.comment = TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT;
  entry.content = generateTextModeRuleEntry(varGroups);
  applyEntryDefaults(entry);

  cardStore.markDirty();
}

function applyEntryDefaults(entry) {
  entry.constant = true;
  entry.enabled = true;
  entry.position = 4;
  entry.insertion_order = 200;
  if (!entry.extensions) entry.extensions = {};
  entry.extensions.depth = 0;
  entry.extensions.prevent_recursion = true;
  entry.extensions.exclude_recursion = true;
}

function clearOldStatusRegexes() {
  for (let i = cardStore.regexScripts.length - 1; i >= 0; i--) {
    const name = cardStore.regexScripts[i].scriptName;
    if (STATUSBAR_REGEX_OLD_NAMES.includes(name)) cardStore.removeRegexScript(cardStore.regexScripts[i].id);
  }
  for (let i = cardStore.worldEntries.length - 1; i >= 0; i--) {
    const c = cardStore.worldEntries[i].comment || '';
    if (c.includes('状态数据输出指令') || c.includes('Chỉ lệnh xuất dữ liệu trạng thái') || c.includes(TEXT_MODE_OUTPUT_RULE_ENTRY_COMMENT))
      cardStore.removeWorldEntry(cardStore.worldEntries[i].id);
  }
}

function refreshOldStatusRegex(statusHtml) {
  if (!statusHtml) return;
  const sbRegex = cardStore.regexScripts.find(r => r.scriptName === 'Làm đẹp thanh trạng thái' || r.scriptName === '状态栏美化');
  if (sbRegex) sbRegex.replaceString = '```html\n' + statusHtml + '\n```';
}

function onClearAll() {
  appStore.confirmAction(
    'Xóa toàn bộ nội dung bàn làm việc? (Không ảnh hưởng đến script/mục Worldbook đã tiêm; nếu muốn gỡ nội dung đã tiêm vui lòng dùng "Gỡ bộ đã tiêm")',
    () => {
      varGroups.length = 0;
      selected.value = null;
      htmlEditedByUser.value = false;
      editedHtml.value = '';
      aiDirection.value = '';
      appStore.toastSuccess('Bàn làm việc đã được xóa trống');
    });
}

function onRemoveInjected() {
  const nScripts = cardStore.tavernScripts.filter(s => MVU_KEYWORDS.some(k => (s.name || '').includes(k))).length;
  const nEntries = cardStore.worldEntries.filter(e => MVU_KEYWORDS.some(k => (e.comment || '').includes(k))).length;
  const nRegexes = cardStore.regexScripts.filter(r => REGEX_KEYWORDS.some(k => (r.scriptName || '').includes(k))
    || STATUSBAR_REGEX_OLD_NAMES.includes(r.scriptName)).length;
  if (nScripts + nEntries + nRegexes === 0 && !(cardStore.cardData.first_mes || '').includes('StatusPlaceHolderImpl')) {
    appStore.toastInfo('Thẻ hiện tại không có nội dung MVU/thanh trạng thái đã tiêm');
    return;
  }
  appStore.confirmAction(
    `Gỡ bộ MVU và thanh trạng thái khỏi thẻ hiện tại?\n(Script: ${nScripts} · Mục Worldbook: ${nEntries} · Regex: ${nRegexes}, đồng thời xóa placeholder trong first mes)`,
    () => {
      removeByKeywordsLive(cardStore.tavernScripts, MVU_KEYWORDS, s => s.name, id => cardStore.removeTavernScript(id));
      removeByKeywordsLive(cardStore.worldEntries, MVU_KEYWORDS, e => e.comment, id => cardStore.removeWorldEntry(id));
      for (let i = cardStore.regexScripts.length - 1; i >= 0; i--) {
        const r = cardStore.regexScripts[i];
        if (REGEX_KEYWORDS.some(k => (r.scriptName || '').includes(k)) || STATUSBAR_REGEX_OLD_NAMES.includes(r.scriptName))
          cardStore.removeRegexScript(r.id);
      }
      const strip = (s) => String(s ?? '').replace(/\n?<StatusPlaceHolderImpl\s*\/>/g, '');
      if (cardStore.cardData.first_mes) cardStore.cardData.first_mes = strip(cardStore.cardData.first_mes);
      for (let i = 0; i < (cardStore.cardData.alternate_greetings || []).length; i++) {
        cardStore.cardData.alternate_greetings[i] = strip(cardStore.cardData.alternate_greetings[i]);
      }
      if (cardStore.cardData.extensions) delete cardStore.cardData.extensions.cfMvuVarGroups;
      loadFromCard();
      cardStore.markDirty();
      appStore.toastSuccess('Đã gỡ bộ MVU và thanh trạng thái');
    });
}

function removeByKeywordsLive(arr, keywords, getLabel, remover) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (keywords.some(k => ((getLabel(arr[i]) || '') + '').includes(k))) remover(arr[i].id);
  }
}
</script>

<style scoped>
.page--workbench { display: flex; flex-direction: column; min-height: 0; }

.wb-actions { gap: 8px; align-items: center; }

.wb-issues-card { padding: 0; }
.wb-issues { display: flex; flex-direction: column; gap: 4px; }
.wb-issue { font-size: 12px; line-height: 1.6; padding: 3px 8px; border-radius: var(--cf-radius-sm); }
.wb-issue--error { background: rgba(239, 68, 68, 0.08); color: #fca5a5; border-left: 3px solid #ef4444; }
.wb-issue--warn { background: rgba(251, 191, 36, 0.07); color: #fcd34d; border-left: 3px solid #f59e0b; }

.wb-grid {
  display: grid;
  grid-template-columns: minmax(230px, 300px) minmax(340px, 1fr) minmax(320px, 1.05fr);
  gap: 14px;
  align-items: start;
  flex: 1;
  min-height: 0;
}
.wb-col { min-width: 0; }
.wb-col--right { position: sticky; top: 12px; }

.wb-left-body { display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 210px); overflow-y: auto; }
.wb-add-btn { align-self: flex-start; }

.wb-group {
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-sm);
  overflow: hidden;
}
.wb-group.wb-dragging { opacity: 0.4; }
.wb-group.wb-dragover { border-color: var(--cf-accent); box-shadow: 0 0 8px rgba(96,165,250,0.3); }
.wb-group__head {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 8px; cursor: default;
  background: rgba(255, 255, 255, 0.02);
}
.wb-group__name { font-size: 13px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-group__count {
  font-size: 10px; padding: 1px 6px; border-radius: 999px;
  background: rgba(96, 165, 250, 0.15); color: #93c5fd;
}
.wb-group-rename { padding: 4px 8px; border-top: 1px dashed var(--cf-border); }

.wb-drag-handle {
  cursor: grab; padding: 0 2px; color: var(--cf-text-muted);
  font-size: 13px; letter-spacing: -2px; user-select: none;
  &:active { cursor: grabbing; }
}

.wb-var {
  display: flex; align-items: center; gap: 6px;
  width: 100%; text-align: left;
  padding: 5px 10px 5px 26px;
  border: 0; border-top: 1px solid rgba(255,255,255,0.04);
  background: transparent; color: var(--cf-text-secondary);
  cursor: pointer; font-size: 12px;
  transition: background 0.15s;
}
.wb-var:hover { background: rgba(96, 165, 250, 0.06); color: var(--cf-text-primary); }
.wb-var.active { background: rgba(96, 165, 250, 0.14); color: var(--cf-text-primary); }
.wb-var--empty { color: var(--cf-text-muted); font-style: italic; }
.wb-var__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-var__init { font-family: var(--cf-font-mono); font-size: 11px; color: var(--cf-text-muted); max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-var__tag { font-size: 9px; padding: 0 5px; border-radius: 999px; background: rgba(148,163,184,0.18); color: #cbd5e1; }

.wb-type-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; }
.wb-type-dot[data-type='number'] { background: #60a5fa; }
.wb-type-dot[data-type='string'] { background: #a3e635; }
.wb-type-dot[data-type='boolean'] { background: #fb923c; }
.wb-type-dot[data-type='enum'] { background: #c084fc; }
.wb-type-dot[data-type='record'] { background: #38bdf8; }
.wb-type-dot[data-type='array'] { background: #f472b6; }

.wb-preset-block { margin-top: 2px; }
.wb-subtitle { font-size: 11px; color: var(--cf-text-muted); margin-bottom: 4px; display: flex; align-items: center; }
.wb-preset-row { display: flex; flex-wrap: wrap; gap: 4px; }
.wb-inline-edit { display: flex; gap: 4px; margin-bottom: 4px; }

.mt-md { margin-top: 12px; }
.mb-md { margin-bottom: 12px; }
.mb-sm { margin-bottom: 8px; }

.select--sm { font-size: 12px; padding: 2px 6px; max-width: 110px; }

.wb-preview-frame {
  width: 100%; height: 420px;
  background: var(--cf-bg-elevated, #181a23);
  border: 0; display: block;
}
.wb-src-row { border-top: 1px dashed var(--cf-border); }
.wb-src-editor {
  width: 100%; height: 220px; margin-top: 6px;
  font-family: var(--cf-font-mono); font-size: 11px; line-height: 1.6;
  background: rgba(0,0,0,0.25); color: var(--cf-text-primary);
  border: 1px solid var(--cf-border); border-radius: var(--cf-radius-sm);
  padding: 8px; resize: vertical;
}

.wb-ai-buttons { flex-wrap: wrap; gap: 6px; }

.wb-play-body { max-height: 340px; overflow-y: auto; }
.wb-play-field {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
  label {
    flex: 0 0 88px; font-size: 11px; color: var(--cf-text-secondary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
}
.wb-play-ctl { flex: 1; min-width: 0; }
.input--sm { font-size: 12px; padding: 3px 6px; }
.wb-play-json {
  flex: 1; min-width: 0;
  font-family: var(--cf-font-mono); font-size: 11px;
  background: rgba(0,0,0,0.2); color: var(--cf-text-primary);
  border: 1px solid var(--cf-border); border-radius: var(--cf-radius-sm);
  padding: 4px 6px; resize: vertical;
}
.wb-play-mono { font-family: var(--cf-font-mono); font-size: 12px; }
.wb-snapshots { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--cf-border); }
.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--cf-text-secondary);
  input { accent-color: var(--cf-accent); }
}

@media (max-width: 1200px) {
  .wb-grid { grid-template-columns: 1fr 1fr; }
  .wb-col--left { grid-column: 1 / -1; }
  .wb-col--right { position: static; grid-column: 1 / -1; order: 3; }
}
@media (max-width: 800px) {
  .wb-grid { grid-template-columns: 1fr; }
}
</style>