import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { normalizeNewWorldEntry } from '../utils/world-entry-normalizer.js';

// Cấu trúc thẻ trống mặc định (chuẩn V2)
function createEmptyCard() {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      creator_notes: '',
      system_prompt: '',
      post_history_instructions: '',
      tags: [],
      creator: '',
      character_version: '1.0',
      alternate_greetings: [],
      extensions: {
        talkativeness: '0.5',
        fav: false,
        world: '',
        cardforge_main_characters: [],
        depth_prompt: { prompt: '', depth: 4, role: 'system' },
        regex_scripts: [],
        tavern_helper: { scripts: [], variables: {} }
      },
      group_only_greetings: [],
      character_book: {
        name: '',
        entries: []
      }
    }
  };
}

function createEmptyWorldEntry(id = 0) {
  return {
    id,
    keys: [],
    secondary_keys: [],
    comment: '',
    content: '',
    constant: false,
    selective: false,
    insertion_order: 100,
    enabled: true,
    position: 'before_char',
    use_regex: false,
    extensions: {
      position: 0,
      exclude_recursion: false,
      display_index: id,
      probability: 100,
      useProbability: true,
      depth: 4,
      selectiveLogic: 0,
      group: '',
      group_override: false,
      group_weight: 100,
      prevent_recursion: false,
      delay_until_recursion: false,
      scan_depth: null,
      match_whole_words: null,
      use_group_scoring: false,
      case_sensitive: null,
      automation_id: '',
      role: 0,
      vectorized: false,
      sticky: null,
      cooldown: null,
      delay: null,
      match_persona_description: false,
      match_character_description: false,
      match_character_personality: false,
      match_character_depth_prompt: false,
      match_scenario: false,
      match_creator_notes: false,
      triggers: [],
      ignore_budget: false
    }
  };
}

function createEmptyRegexScript() {
  return {
    id: crypto.randomUUID(),
    scriptName: 'Script Regex mới',
    findRegex: '',
    replaceString: '',
    trimStrings: [],
    placement: [2],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null
  };
}

function createEmptyTavernScript() {
  return {
    type: 'script',
    enabled: true,
    name: 'Script mới',
    id: crypto.randomUUID(),
    content: '',
    info: '',
    button: { enabled: false, buttons: [] },
    data: {}
  };
}

export const useCardStore = defineStore('card', () => {
  // Trạng thái (State)
  const card = ref(createEmptyCard());
  const filePath = ref(null);
  const coverImagePath = ref(null);
  const coverImageBase64 = ref(null);
  const isDirty = ref(false);
  const lastSaved = ref(null);
  const projects = ref([]);
  const currentProjectId = ref(null);

  // Getter
  const cardData = computed(() => card.value.data);
  const worldEntries = computed(() => card.value.data.character_book?.entries || []);
  const regexScripts = computed(() => card.value.data.extensions?.regex_scripts || []);

  const tavernScripts = computed(() => {
    const th = card.value.data.extensions?.tavern_helper;
    if (!th) return [];
    let scripts;
    // Xử lý cả dạng từ điển và dạng cặp danh sách
    if (Array.isArray(th)) {
      const scriptsEntry = th.find(e => e[0] === 'scripts');
      scripts = scriptsEntry ? scriptsEntry[1] : [];
    } else {
      scripts = th.scripts || [];
    }
    // Đảm bảo mỗi script đều có đối tượng button hợp lệ
    for (const s of scripts) {
      if (!s.button) s.button = { enabled: false, buttons: [] };
      if (!Array.isArray(s.button.buttons)) s.button.buttons = [];
    }
    return scripts;
  });

  const cardName = computed(() => card.value.data.name || 'Nhân vật chưa đặt tên');

  const stats = computed(() => {
    const entries = worldEntries.value;
    const enabledEntries = entries.filter(e => e.enabled);
    const constantEntries = entries.filter(e => e.constant && e.enabled);
    const totalContentLength = entries.reduce((sum, e) => sum + (e.content?.length || 0), 0);
    const estimatedTokens = Math.round(totalContentLength * 1.3); // Ước tính token thô

    return {
      totalEntries: entries.length,
      enabledEntries: enabledEntries.length,
      constantEntries: constantEntries.length,
      disabledEntries: entries.length - enabledEntries.length,
      regexCount: regexScripts.value.length,
      scriptCount: tavernScripts.value.length,
      alternateGreetings: card.value.data.alternate_greetings?.length || 0,
      estimatedTokens,
      totalContentChars: totalContentLength
    };
  });

  // Hành động (Actions)
  function newCard() {
    card.value = createEmptyCard();
    filePath.value = null;
    coverImagePath.value = null;
    coverImageBase64.value = null;
    isDirty.value = false;
  }

  function snapshotCurrentProject() {
    const project = projects.value.find(item => item.id === currentProjectId.value);
    if (!project) return;
    project.name = cardName.value;
    project.card = JSON.parse(JSON.stringify(card.value));
    project.filePath = filePath.value;
    project.coverImagePath = coverImagePath.value;
    project.updatedAt = new Date().toISOString();
  }

  async function persistProjects() {
    snapshotCurrentProject();
    const settings = await window.cardForgeAPI.loadSettings() || {};
    settings.cardProjects = JSON.parse(JSON.stringify(projects.value));
    settings.currentProjectId = currentProjectId.value;
    await window.cardForgeAPI.saveSettings(settings);
  }

  async function loadProjects() {
    try {
      const settings = await window.cardForgeAPI.loadSettings() || {};
      projects.value = Array.isArray(settings.cardProjects) ? settings.cardProjects : [];
      currentProjectId.value = settings.currentProjectId || null;
      const current = projects.value.find(item => item.id === currentProjectId.value);
      if (current?.card) {
        loadFromJson(JSON.parse(JSON.stringify(current.card)));
        filePath.value = current.filePath || null;
        coverImagePath.value = current.coverImagePath || null;
      }
    } catch {
      projects.value = [];
      currentProjectId.value = null;
    }
  }

  async function createProject(name = 'Nhân vật chưa đặt tên') {
    snapshotCurrentProject();
    const id = crypto.randomUUID();
    newCard();
    card.value.data.name = name;
    projects.value.push({ id, name, card: JSON.parse(JSON.stringify(card.value)), filePath: null, coverImagePath: null, updatedAt: new Date().toISOString() });
    currentProjectId.value = id;
    await persistProjects();
    return id;
  }

  async function switchProject(id) {
    if (id === currentProjectId.value) return;
    snapshotCurrentProject();
    const target = projects.value.find(item => item.id === id);
    if (!target) return;
    currentProjectId.value = id;
    loadFromJson(JSON.parse(JSON.stringify(target.card)));
    filePath.value = target.filePath || null;
    coverImagePath.value = target.coverImagePath || null;
    await persistProjects();
  }

  async function removeProject(id) {
    const index = projects.value.findIndex(item => item.id === id);
    if (index === -1) return;
    projects.value.splice(index, 1);
    if (currentProjectId.value === id) {
      const next = projects.value[0];
      currentProjectId.value = next?.id || null;
      if (next) loadFromJson(JSON.parse(JSON.stringify(next.card))); else newCard();
    }
    await persistProjects();
  }

  function loadFromJson(json) {
    // Xử lý cả định dạng cấp cao nhất lẫn định dạng khối data lồng nhau
    if (json.data) {
      card.value = json;
    } else if (json.name && json.first_mes) {
      // Định dạng V1 cũ hoặc dạng phẳng
      card.value = { spec: 'chara_card_v2', spec_version: '2.0', data: json };
    }

    // Đảm bảo extensions tồn tại
    if (!card.value.data.extensions) {
      card.value.data.extensions = {};
    }
    if (!card.value.data.extensions.regex_scripts) {
      card.value.data.extensions.regex_scripts = [];
    }
    if (!card.value.data.extensions.tavern_helper) {
      card.value.data.extensions.tavern_helper = { scripts: [], variables: {} };
    }
    if (!card.value.data.character_book) {
      card.value.data.character_book = { name: '', entries: [] };
    }

    // Bổ sung cfSortKey cho tất cả mục (Thứ tự hiển thị nội bộ CardBuilding, độc lập với insertion_order và display_index của ST)
    const entries = card.value.data.character_book.entries || [];
    let nextKey = 1;
    const usedKeys = new Set();
    for (const e of entries) {
      if (!e.extensions) e.extensions = {};
      if (typeof e.extensions.cfSortKey === 'number') {
        usedKeys.add(e.extensions.cfSortKey);
      }
    }
    for (const e of entries) {
      if (typeof e.extensions.cfSortKey !== 'number') {
        while (usedKeys.has(nextKey)) nextKey++;
        e.extensions.cfSortKey = nextKey;
        usedKeys.add(nextKey);
        nextKey++;
      }
    }
    if (!card.value.data.alternate_greetings) {
      card.value.data.alternate_greetings = [];
    }
    if (!card.value.data.extensions.depth_prompt) {
      card.value.data.extensions.depth_prompt = { prompt: '', depth: 4, role: 'system' };
    }
    if (!Array.isArray(card.value.data.extensions.cardforge_main_characters)) {
      card.value.data.extensions.cardforge_main_characters = [];
    }

    // Chuẩn hóa tavern_helper từ dạng cặp danh sách sang từ điển
    const th = card.value.data.extensions.tavern_helper;
    if (Array.isArray(th)) {
      const obj = {};
      for (const [key, val] of th) {
        obj[key] = val;
      }
      card.value.data.extensions.tavern_helper = obj;
    }

    isDirty.value = false;
  }

  function exportJson() {
    const d = card.value.data;
    const obj = {
      name: d.name,
      description: d.description,
      personality: d.personality,
      scenario: d.scenario,
      first_mes: d.first_mes,
      mes_example: d.mes_example,
      creatorcomment: d.creator_notes,
      avatar: 'none',
      talkativeness: d.extensions?.talkativeness || '0.5',
      fav: d.extensions?.fav || false,
      tags: d.tags || [],
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: d,
      create_date: new Date().toISOString()
    };
    return JSON.parse(JSON.stringify(obj));
  }

  function markDirty() {
    isDirty.value = true;
  }

  // Thao tác Worldbook
  let _nextEntryId = 0;

  function addWorldEntry(entry = null) {
    const entries = card.value.data.character_book.entries;
    const maxId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 0;
    if (maxId > _nextEntryId) _nextEntryId = maxId;
    else _nextEntryId++;
    const newEntry = normalizeNewWorldEntry(entry || createEmptyWorldEntry(_nextEntryId), { source: entry ? 'generated' : 'manual' });
    newEntry.id = _nextEntryId;
    if (!newEntry.extensions) newEntry.extensions = {};
    const maxKey = entries.length > 0
      ? Math.max(0, ...entries.map(e => e.extensions?.cfSortKey ?? 0))
      : 0;
    newEntry.extensions.cfSortKey = maxKey + 1;
    entries.push(newEntry);
    isDirty.value = true;
    return newEntry;
  }

  function removeWorldEntry(id) {
    const entries = card.value.data.character_book.entries;
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries.splice(idx, 1);
      isDirty.value = true;
    }
  }

  function duplicateWorldEntry(id) {
    const entries = card.value.data.character_book.entries;
    const source = entries.find(e => e.id === id);
    if (source) {
      const clone = JSON.parse(JSON.stringify(source));
      clone.comment = (clone.comment || '') + ' (Bản sao)';
      addWorldEntry(clone);
    }
  }

  // Thao tác Regex
  function addRegexScript(script = null) {
    const scripts = card.value.data.extensions.regex_scripts;
    scripts.push(script || createEmptyRegexScript());
    isDirty.value = true;
  }

  function removeRegexScript(id) {
    const scripts = card.value.data.extensions.regex_scripts;
    const idx = scripts.findIndex(s => s.id === id);
    if (idx !== -1) {
      scripts.splice(idx, 1);
      isDirty.value = true;
    }
  }

  function reorderRegexScript(fromId, toId) {
    const scripts = card.value.data.extensions.regex_scripts;
    const fromIdx = scripts.findIndex(s => s.id === fromId);
    const toIdx = scripts.findIndex(s => s.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [item] = scripts.splice(fromIdx, 1);
    scripts.splice(toIdx, 0, item);
    isDirty.value = true;
  }

  // Thao tác script Tavern Helper
  function addTavernScript(script = null) {
    const th = card.value.data.extensions.tavern_helper;
    if (!th.scripts) th.scripts = [];
    th.scripts.push(script || createEmptyTavernScript());
    isDirty.value = true;
  }

  function removeTavernScript(id) {
    const th = card.value.data.extensions.tavern_helper;
    if (!th.scripts) return;
    const idx = th.scripts.findIndex(s => s.id === id);
    if (idx !== -1) {
      th.scripts.splice(idx, 1);
      isDirty.value = true;
    }
  }

  // Lời mở đầu dự phòng
  function addGreeting(text = '') {
    card.value.data.alternate_greetings.push(text);
    isDirty.value = true;
  }

  function removeGreeting(index) {
    card.value.data.alternate_greetings.splice(index, 1);
    isDirty.value = true;
  }

  return {
    card, filePath, coverImagePath, coverImageBase64, isDirty, lastSaved, projects, currentProjectId,
    cardData, worldEntries, regexScripts, tavernScripts, cardName, stats,
    newCard, loadFromJson, exportJson, markDirty,
    loadProjects, persistProjects, createProject, switchProject, removeProject,
    addWorldEntry, removeWorldEntry, duplicateWorldEntry,
    addRegexScript, removeRegexScript, reorderRegexScript,
    addTavernScript, removeTavernScript,
    addGreeting, removeGreeting,
    createEmptyWorldEntry, createEmptyRegexScript, createEmptyTavernScript
  };
});