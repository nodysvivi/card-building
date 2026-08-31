import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
// Phải import trước tiên: đảm bảo window.cardForgeAPI luôn tồn tại
// (thật trên desktop, hoặc shim an toàn trên web) trước khi bất kỳ
// module nào khác gọi tới nó.
import './utils/platform.js';
import errorLogger from './utils/error-logger.js';

// Cài đặt bắt lỗi trước khi chạy mọi đoạn mã
errorLogger.install();

// Giao diện (Views)
import Dashboard from './views/Dashboard.vue';
import BasicInfo from './views/BasicInfo.vue';
import CharSetting from './views/CharSetting.vue';
import GreetingEditor from './views/GreetingEditor.vue';
import WorldBookEditor from './views/WorldBookEditor.vue';
import RegexEditor from './views/RegexEditor.vue';
import ScriptEditor from './views/ScriptEditor.vue';
import EjsEditor from './views/EjsEditor.vue';
import StatusBarWorkbench from './views/StatusBarWorkbench.vue';
import NpcGenerator from './views/NpcGenerator.vue';
import NovelExtractor from './views/NovelExtractor.vue';
import PlayerChar from './views/PlayerChar.vue';
import DialogueSample from './views/DialogueSample.vue';
import ExtraRules from './views/ExtraRules.vue';
import PackageExport from './views/PackageExport.vue';
import AiAssistant from './views/AiAssistant.vue';
import CardDiagnostic from './views/CardDiagnostic.vue';
import Statistics from './views/Statistics.vue';
import ApiSettings from './views/ApiSettings.vue';

// Kiểu dáng (Styles)
import './styles/main.scss';

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard, meta: { title: 'Bàn làm việc' } },
  { path: '/basic', name: 'basic', component: BasicInfo, meta: { title: 'Thông tin cơ bản' } },
  { path: '/charsetting', name: 'charsetting', component: CharSetting, meta: { title: 'Thiết lập nhân vật' } },
  { path: '/worldbook', name: 'worldbook', component: WorldBookEditor, meta: { title: 'Worldbook' } },
  { path: '/npc', name: 'npc', component: NpcGenerator, meta: { title: 'Trình tạo NPC' } },
  { path: '/novel-extract', name: 'novel-extract', component: NovelExtractor, meta: { title: 'Trích xuất tiểu thuyết' } },
  { path: '/greeting', name: 'greeting', component: GreetingEditor, meta: { title: 'Lời mở đầu' } },
  { path: '/player', name: 'player', component: PlayerChar, meta: { title: 'Nhân vật người chơi' } },
  { path: '/dialogue', name: 'dialogue', component: DialogueSample, meta: { title: 'Mẫu đối thoại' } },
  { path: '/extra', name: 'extra', component: ExtraRules, meta: { title: 'Yêu cầu bổ sung' } },
  { path: '/regex', name: 'regex', component: RegexEditor, meta: { title: 'Script Regex' } },
  { path: '/scripts', name: 'scripts', component: ScriptEditor, meta: { title: 'Script Tavern Helper' } },
  { path: '/ejs', name: 'ejs', component: EjsEditor, meta: { title: 'Mẫu EJS' } },
  { path: '/workbench', name: 'workbench', component: StatusBarWorkbench, meta: { title: 'Bàn làm việc thanh trạng thái' } },
  { path: '/package', name: 'package', component: PackageExport, meta: { title: 'Đóng gói thẻ nhân vật' } },
  { path: '/diagnostic', name: 'diagnostic', component: CardDiagnostic, meta: { title: 'Chẩn đoán thẻ nhân vật' } },
  { path: '/assistant', name: 'assistant', component: AiAssistant, meta: { title: 'Trợ lý AI' } },
  { path: '/statistics', name: 'statistics', component: Statistics, meta: { title: 'Thống kê thẻ' } },
  { path: '/api', name: 'api', component: ApiSettings, meta: { title: 'Cài đặt API' } }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const app = createApp(App);
app.config.errorHandler = (err, instance, info) => {
  errorLogger.logVueError(err, instance, info);
  // Đồng thời in ra console để tiện gỡ lỗi (patchConsoleError sẽ ghi lại lần nữa nhưng type khác)
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[Vue Error]', err);
  }
};
app.use(createPinia());
app.use(router);
app.mount('#app');