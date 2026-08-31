/**
 * Chẩn đoán thẻ nhân vật —— Các hàm sửa lỗi thuần frontend + Ngăn xếp hoàn tác
 * Quy tắc CardBuilding: order toàn bộ 100; thường trực chỉ bật exclude_recursion; kích hoạt bật cả hai
 */

const undoStack = [];
const MAX_UNDO = 5;

function recordUndo(entry, fixId, label) {
  undoStack.push({
    fixId,
    entryId: entry?.id ?? null,
    snapshot: entry ? JSON.parse(JSON.stringify(entry)) : null,
    label
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

/**
 * Áp dụng một mục sửa lỗi đơn lẻ
 * @param {object} cardStore - Instance của useCardStore()
 * @param {string} fixId
 * @param {object} payload - { entryId, ... }
 * @returns {boolean} Thành công hay không
 */
export function applyFix(cardStore, fixId, payload) {
  const entries = cardStore.worldEntries || [];
  const entry = payload?.entryId != null ? entries.find(e => e.id === payload.entryId) : null;

  switch (fixId) {
    case 'fix_order_100':
      if (!entry) return false;
      recordUndo(entry, fixId, `Đổi order của #${entry.id} thành 100`);
      entry.insertion_order = 100;
      break;

    case 'fix_make_constant':
      if (!entry) return false;
      recordUndo(entry, fixId, `Chuyển mục cô lập #${entry.id} thành thường trực`);
      entry.constant = true;
      entry.selective = false;
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = false;
      break;

    case 'fix_delete_entry':
      if (!entry) return false;
      recordUndo(entry, fixId, `Xóa mục #${entry.id} "${entry.comment || '(Chưa đặt tên)'}"`);
      cardStore.removeWorldEntry(entry.id);
      break;

    case 'fix_filter_empty_keys':
      if (!entry) return false;
      recordUndo(entry, fixId, `Lọc bỏ chuỗi rỗng trong keys của #${entry.id}`);
      entry.keys = (entry.keys || []).filter(k => k && String(k).trim());
      break;

    case 'fix_recursion_for_constant':
      if (!entry) return false;
      recordUndo(entry, fixId, `Sửa cài đặt đệ quy cho mục thường trực #${entry.id}`);
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = false;
      break;

    case 'fix_recursion_for_triggered':
      if (!entry) return false;
      recordUndo(entry, fixId, `Sửa cài đặt đệ quy cho mục kích hoạt #${entry.id}`);
      if (!entry.extensions) entry.extensions = {};
      entry.extensions.exclude_recursion = true;
      entry.extensions.prevent_recursion = true;
      break;

    default:
      return false;
  }

  cardStore.markDirty();
  return true;
}

/**
 * Sửa nhanh tất cả —— Quét qua toàn bộ kết quả chẩn đoán, tự động sửa mọi vấn đề có cờ fixable
 * @param {object} cardStore
 * @param {Array} allCheckResults - Giá trị trả về từ runAllChecks()
 * @returns {{ fixed, skipped }} Thống kê sửa lỗi
 */
export function applyAllFixes(cardStore, allCheckResults) {
  let fixed = 0;
  let skipped = 0;

  for (const check of allCheckResults) {
    for (const issue of (check.issues || [])) {
      if (issue.fixable && issue.fixId) {
        if (applyFix(cardStore, issue.fixId, issue.fixPayload)) {
          fixed++;
        } else {
          skipped++;
        }
      }
    }
  }

  return { fixed, skipped };
}

/**
 * Hoàn tác 1 lần sửa gần nhất
 * @returns {{ label } | null}
 */
export function undoLastFix(cardStore) {
  const last = undoStack.pop();
  if (!last) return null;
  const entries = cardStore.worldEntries || [];
  const entry = entries.find(e => e.id === last.entryId);

  if (entry && last.snapshot) {
    Object.assign(entry, last.snapshot);
    if (entry.extensions && last.snapshot.extensions) {
      Object.assign(entry.extensions, last.snapshot.extensions);
    }
  } else if (!entry && last.fixId === 'fix_delete_entry' && last.snapshot) {
    const restored = cardStore.addWorldEntry();
    Object.assign(restored, last.snapshot);
    if (last.snapshot.extensions) {
      restored.extensions = { ...last.snapshot.extensions };
    }
  }

  cardStore.markDirty();
  return { label: last.label };
}

/**
 * Lấy kích thước ngăn xếp hoàn tác hiện tại
 */
export function getUndoStackSize() {
  return undoStack.length;
}

/**
 * Xóa sạch ngăn xếp hoàn tác
 */
export function clearUndoStack() {
  undoStack.length = 0;
}

/**
 * Tóm tắt nhãn các bước trong ngăn xếp hoàn tác
 */
export function getUndoStackLabels() {
  return undoStack.map(u => u.label);
}