/**
 * Xây dựng bản tóm tắt ngữ cảnh của thẻ nhân vật hiện tại, dùng cho tính năng tạo bằng AI
 * Toàn bộ tính năng AI trước khi gọi đều nên đính kèm ngữ cảnh này
 *
 * @param {*} cardStore - Store thẻ nhân vật
 * @param {string} [matchText] - Tùy chọn. Khi truyền văn bản vào, mục đèn xanh sẽ khớp theo từ khóa chính
 *   (chỉ nhét mục trúng khớp); không truyền sẽ lấy 20 mục đầu theo logic cũ để đảm bảo tương thích ngược
 * @param {{modelContextTokens?: number, contextRatio?: number}} [options]
 */
export function buildCardContext(cardStore, matchText = '', options = {}) {
  const d = cardStore.cardData;
  const entries = cardStore.worldEntries;
  const regexScripts = cardStore.regexScripts;
  const scripts = cardStore.tavernScripts;

  const useMatch = typeof matchText === 'string' && matchText.trim().length > 0;
  const modelContextTokens = Math.max(8000, Number(options.modelContextTokens) || 25000);
  const contextRatio = Math.min(0.25, Math.max(0.05, Number(options.contextRatio) || 0.12));
  const MAX_TOTAL_CHARS = Math.min(48000, Math.max(6000, Math.floor(modelContextTokens * contextRatio * 4)));
  const PER_ENTRY_CHARS = useMatch ? 1000 : 400;

  const lines = [];

  if (d.name) lines.push(`Tên nhân vật: ${d.name}`);
  if (d.personality) lines.push(`Tính cách: ${d.personality}`);
  if (d.scenario) lines.push(`Thiết lập bối cảnh: ${d.scenario}`);
  if (d.description) lines.push(`Mô tả nhân vật (500 từ đầu): ${d.description.slice(0, 500)}`);
  if (d.first_mes) lines.push(`Lời mở đầu (1000 từ đầu): ${d.first_mes.slice(0, 1000)}`);

  if (entries.length > 0) {
    const enabled = entries.filter(e => e.enabled);
    const constant = enabled.filter(e => e.constant);
    const triggered = enabled.filter(e => !e.constant);

    lines.push(`\n========== Nội dung Worldbook (${entries.length} mục, đang bật ${enabled.length}) ==========`);

    let worldBudget = MAX_TOTAL_CHARS;

    if (constant.length > 0) {
      lines.push(`\n--- Thiết lập thường trực (${constant.length} mục, đèn xanh) ---`);
      let written = 0;
      for (const e of constant) {
        if (worldBudget <= 0) {
          lines.push(`...Worldbook vượt quá giới hạn ký tự ${MAX_TOTAL_CHARS}, còn lại ${constant.length - written} mục thường trực chưa hiển thị`);
          break;
        }
        const c = (e.content || '').slice(0, PER_ENTRY_CHARS);
        const block = `【${e.comment || '(Chưa đặt tên)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > PER_ENTRY_CHARS ? '...' : ''}`;
        lines.push(block);
        worldBudget -= block.length;
        written++;
      }
    }

    if (triggered.length > 0) {
      if (useMatch) {
        const matchLower = matchText.toLowerCase();
        const matched = triggered.filter(e => {
          const keys = e.keys || [];
          return keys.some(k => k && matchLower.includes(String(k).toLowerCase()));
        });
        if (matched.length > 0) {
          lines.push(`\n--- Kích hoạt bằng từ khóa (${matched.length} mục khớp / ${triggered.length} mục đèn xanh) ---`);
          let written = 0;
          for (const e of matched) {
            if (worldBudget <= 0) {
              lines.push(`...Worldbook vượt quá giới hạn ký tự, còn lại ${matched.length - written} mục khớp chưa hiển thị`);
              break;
            }
            const c = (e.content || '').slice(0, PER_ENTRY_CHARS);
            const block = `【${e.comment || '(Chưa đặt tên)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > PER_ENTRY_CHARS ? '...' : ''}`;
            lines.push(block);
            worldBudget -= block.length;
            written++;
          }
        } else {
          lines.push(`\n--- Kích hoạt bằng từ khóa: ${triggered.length} mục đèn xanh đều không khớp từ khóa đã nhập hiện tại ---`);
        }
      } else {
        const showCount = Math.min(20, triggered.length);
        lines.push(`\n--- Kích hoạt bằng từ khóa (${triggered.length} mục, hiển thị ${showCount} mục đầu) ---`);
        for (const e of triggered.slice(0, showCount)) {
          const c = (e.content || '').slice(0, 150);
          lines.push(`【${e.comment || '(Chưa đặt tên)'}】 keys:[${(e.keys || []).join(',')}]\n${c}${(e.content || '').length > 150 ? '...' : ''}`);
        }
        if (triggered.length > showCount) {
          lines.push(`...Còn ${triggered.length - showCount} mục kích hoạt chưa hiển thị`);
        }
      }
    }
  }

  if (regexScripts.length > 0) {
    lines.push(`\nScript Regex hiện có: ${regexScripts.length} script`);
    regexScripts.slice(0, 5).forEach(r => {
      lines.push(`- ${r.scriptName} [${r.markdownOnly ? 'Chỉ lớp hiển thị' : r.promptOnly ? 'Chỉ lớp AI' : 'Hai lớp'}]`);
    });
  }

  if (scripts.length > 0) {
    lines.push(`\nScript Tavern Helper hiện có: ${scripts.length} script`);
    scripts.slice(0, 5).forEach(s => {
      lines.push(`- ${s.name} [${s.enabled ? 'Đang bật' : 'Đã tắt'}]`);
    });
  }

  return lines.join('\n');
}