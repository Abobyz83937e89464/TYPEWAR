const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const https = require('https');
const http = require('http');

// =============================================
// КОНФИГ
// =============================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8628280796:AAEaBQSyC6WbH2-BzJIhj3IEtlZqvIdahmM';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mhblbxqwrjfxgnxnlmyk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_yjHQeH6OCcPRAuwz_2wywQ_exPxYzmv';
const PORT = process.env.PORT || 3000;

const OWNER_ID = 8503291981;

// =============================================
// АВТО-ОПРЕДЕЛЕНИЕ RENDER URL
// =============================================
function detectRenderURL() {
  if (process.env.RENDER_URL) return process.env.RENDER_URL;
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return 'https://' + process.env.RENDER_EXTERNAL_HOSTNAME;
  if (process.env.RENDER_SERVICE_NAME) return 'https://' + process.env.RENDER_SERVICE_NAME + '.onrender.com';
  if (process.env.HOSTNAME && process.env.HOSTNAME.includes('render')) return 'https://' + process.env.HOSTNAME + '.onrender.com';
  return null;
}

let RENDER_URL = detectRenderURL();
let SUPABASE_CONNECTED = false;

// =============================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================
const app = express();
const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    autoStart: true,
    params: { timeout: 30 }
  },
  request: {
    agentOptions: { keepAlive: true, keepAliveMsecs: 10000 },
    timeout: 60000
  }
});
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

bot.setMyCommands([
  { command: '/wpm', description: 'Твоя статистика и WPM' },
  { command: '/top', description: 'Рейтинг чата' },
  { command: '/duel', description: 'Вызвать на дуэль' },
  { command: '/test', description: 'Тест скорости (на точность)' },
  { command: '/profile', description: 'Подробный профиль' },
  { command: '/titles', description: 'Твои титулы' },
  { command: '/settings', description: 'Настройки чата (для админов)' },
  { command: '/help', description: 'Справка по боту' }
]).catch(err => console.error('[BOT] Ошибка установки команд:', err.message));

// =============================================
// СИСТЕМА ТИТУЛОВ
// =============================================
const ALL_TITLES = {
  // ЗА АКТИВНОСТЬ
  writer: { emoji: '💬', name: 'Писатель', desc: '100 сообщений в чате', category: 'activity' },
  tryhard: { emoji: '🧩', name: 'Задрот', desc: '500 сообщений в чате', category: 'activity' },
  lives_in_chat: { emoji: '💀', name: 'Живёт в чате', desc: '2000 сообщений в чате', category: 'activity' },

  // ЗА СКОРОСТЬ
  snail: { emoji: '🐌', name: 'Улитка', desc: 'WPM ниже 15', category: 'speed' },
  runner: { emoji: '🏃', name: 'Бегун', desc: 'WPM 60+', category: 'speed' },
  racer: { emoji: '🚗', name: 'Гонщик', desc: 'WPM 80+', category: 'speed' },
  rocket: { emoji: '🚀', name: 'Ракета', desc: 'WPM 100+', category: 'speed' },
  lightning: { emoji: '⚡', name: 'Молния', desc: 'WPM 150+', category: 'speed' },
  legend: { emoji: '👑', name: 'Легенда', desc: 'WPM 200+', category: 'speed' },

  // РЕДКИЕ
  glitch: { emoji: '❓', name: 'Глитч', desc: 'Шанс 1% при сообщении', category: 'rare' },
  observed: { emoji: '👁', name: 'Наблюдаемый', desc: 'Бот случайно даёт', category: 'rare' },
  system_error: { emoji: '⚠️', name: 'Ошибка системы', desc: 'WPM превысил лимит', category: 'rare' },

  // ДУЭЛИ
  duelist: { emoji: '⚔️', name: 'Дуэлянт', desc: 'Выиграй 1 дуэль', category: 'duel' },
  champion: { emoji: '🏆', name: 'Чемпион', desc: 'Выиграй 10 дуэлей', category: 'duel' }
};

// =============================================
// КУЛДАУНЫ
// =============================================
const topCooldowns = {};

// =============================================
// ПРОВЕРКА ПОДКЛЮЧЕНИЯ SUPABASE
// =============================================
async function checkSupabase() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) { SUPABASE_CONNECTED = false; return false; }
    SUPABASE_CONNECTED = true;
    return true;
  } catch (e) { SUPABASE_CONNECTED = false; return false; }
}

// =============================================
// PING
// =============================================
function pingServer(url) {
  if (!url) return;
  const pingUrl = url + '/health';
  const client = pingUrl.startsWith('https') ? https : http;
  client.get(pingUrl, (res) => {
    console.log(`[PING] ✅ ${url} → ${res.statusCode}`);
  }).on('error', (err) => {
    console.log(`[PING] ❌ ${url} → ${err.message}`);
  });
}

// =============================================
// CRON
// =============================================
cron.schedule('*/4 * * * *', () => {
  if (RENDER_URL) { pingServer(RENDER_URL); }
  else {
    RENDER_URL = detectRenderURL();
    pingServer(RENDER_URL || `http://localhost:${PORT}`);
  }
});

cron.schedule('* * * * *', async () => {
  try { await supabase.rpc('cleanup_expired_duels'); } catch (e) { }
});

cron.schedule('*/10 * * * *', async () => {
  const was = SUPABASE_CONNECTED;
  await checkSupabase();
  if (!was && SUPABASE_CONNECTED) console.log('[SUPABASE] ✅ Переподключение');
  else if (was && !SUPABASE_CONNECTED) console.log('[SUPABASE] ❌ Потеряно');
});

// =============================================
// EXPRESS
// =============================================
app.get('/', (req, res) => {
  res.json({ bot: 'TYPEWAR', status: 'active', supabase: SUPABASE_CONNECTED, uptime: Math.floor(process.uptime()) + 's' });
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'alive', supabase: SUPABASE_CONNECTED });
});

app.listen(PORT, async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💀  TYPEWAR BOT v3');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const sbOk = await checkSupabase();
  console.log(`[SUPABASE] ${sbOk ? '✅' : '❌'}`);
  RENDER_URL = detectRenderURL();
  if (RENDER_URL) { console.log(`[RENDER]   ✅ ${RENDER_URL}`); setTimeout(() => pingServer(RENDER_URL), 3000); }
  else console.log(`[RENDER]   ⚠️  Не найдена`);
  console.log(`[SERVER]   🌐 Порт: ${PORT}`);
  console.log('\n[BOT]      ⚡ Polling started\n');
});

// =============================================
// ТЕКСТЫ ДЛЯ ТЕСТОВ
// =============================================
const DUEL_TEXTS = [
  'Быстрая коричневая лиса перепрыгнула через ленивую собаку и побежала дальше',
  'Программирование это искусство создания инструкций для компьютера',
  'Скорость печати определяет насколько быстро вы можете выражать мысли',
  'Телеграм это мессенджер который объединяет миллионы людей по всему миру',
  'Каждый день мы печатаем тысячи символов даже не задумываясь об этом',
  'Клавиатура является основным инструментом для ввода информации в компьютер',
  'Соревнования по скорости печати проводятся во многих странах мира',
  'Средняя скорость печати обычного человека составляет около сорока слов в минуту',
  'Тренировка слепой печати значительно повышает продуктивность работы за компьютером',
  'Мировой рекорд скорости печати составляет более двухсот слов в минуту',
  'Никогда не сдавайся потому что великие дела требуют времени и усилий',
  'Искусственный интеллект меняет мир быстрее чем мы успеваем это осознать',
  'Кофе и клавиатура это всё что нужно настоящему программисту для работы',
  'Двадцать первый век стал эрой информации и цифровых технологий',
  'Быстрые пальцы решают кто станет победителем этой дуэли сегодня'
];

// =============================================
// ТРОЛЛИНГ
// =============================================
const TROLL_MESSAGES = {
  slow: ['🐌 ты это печатал ногами?', '🐢 черепаха одобряет', '💀 я уснул пока ты печатал', '📠 факс быстрее'],
  normal: ['😐 сойдёт', '🙄 видали и лучше', '👀 неплохо', '🤷 ну такое...'],
  fast: ['🔥 быстрые пальцы!', '⚡ ты точно не бот?', '🚀 клавиатура в огне!', '🏎️ формула один'],
  god: ['👑 МАШИНА!', '🤖 автокликер?', '⚡ НЕЧЕЛОВЕЧЕСКАЯ СКОРОСТЬ', '💀 клавиатура написала завещание']
};

const WPM_UP_MESSAGES = ['📈 рекорд обновлён!', '🔥 новый личный рекорд!', '⚡ ты стал быстрее!', '💪 прогресс!', '🚀 скорость растёт!'];

// =============================================
// УТИЛИТЫ
// =============================================
function calculateWPM(chars, seconds) {
  if (seconds <= 0) return 0;
  return Math.round((chars / 5) / (seconds / 60));
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getTrollCategory(wpm) {
  if (wpm < 20) return 'slow'; if (wpm < 50) return 'normal';
  if (wpm < 100) return 'fast'; return 'god';
}

function esc(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getWpmEmoji(wpm) {
  if (wpm < 15) return '🐌'; if (wpm < 25) return '🐢'; if (wpm < 40) return '🚶';
  if (wpm < 60) return '🏃'; if (wpm < 80) return '🚗'; if (wpm < 100) return '🚀';
  if (wpm < 150) return '⚡'; return '👑';
}

function getRank(wpm) {
  if (wpm < 15) return 'Улитка'; if (wpm < 25) return 'Черепаха'; if (wpm < 40) return 'Пешеход';
  if (wpm < 60) return 'Бегун'; if (wpm < 80) return 'Гонщик'; if (wpm < 100) return 'Ракета';
  if (wpm < 150) return 'Молния'; return 'Легенда';
}

function getProgressBar(wpm, max = 200) {
  const f = Math.min(Math.round((wpm / max) * 10), 10);
  return '▓'.repeat(f) + '░'.repeat(10 - f);
}

function getName(msg) {
  if (msg.from.username) return '@' + msg.from.username;
  if (msg.from.first_name) return msg.from.first_name;
  return 'Аноним';
}

function getNameFromInfo(info) {
  if (!info) return 'Аноним';
  if (info.username) return '@' + info.username;
  if (info.first_name) return info.first_name;
  return 'Аноним';
}

function calculateSimilarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  if (a.length > 500 || b.length > 500) {
    const w1 = a.split(/\s+/), w2 = b.split(/\s+/);
    let m = 0;
    for (const w of w1) if (w2.includes(w)) m++;
    return m / Math.max(w1.length, w2.length);
  }
  const mx = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) mx[0][i] = i;
  for (let j = 0; j <= b.length; j++) mx[j][0] = j;
  for (let j = 1; j <= b.length; j++)
    for (let i = 1; i <= a.length; i++)
      mx[j][i] = Math.min(mx[j][i - 1] + 1, mx[j - 1][i] + 1, mx[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - mx[b.length][a.length] / Math.max(a.length, b.length);
}

function defaultSettings() {
  return {
    trolling_enabled: true, duels_enabled: true, autowpm_enabled: true,
    min_chars: 15, cooldown_seconds: 3, max_wpm_limit: 300, troll_chance: 0.15
  };
}

// =============================================
// 🛑 ЖЁСТКИЙ АНТИ-ЧИТ
// =============================================
function isGibberish(text) {
  // 4+ одинаковых буквы подряд
  if (/(.)\1{3,}/.test(text)) return true;
  // слова длиннее 20 символов
  const words = text.trim().split(/\s+/);
  if (words.some(w => w.length > 20)) return true;
  // 6 согласных подряд
  if (/[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{6,}/i.test(text)) return true;
  return false;
}

function isLaughSpam(text) {
  // Проверяем 5+ повторяющихся одинаковых букв разбросанных по короткому тексту (ахахахах, хххх)
  const clean = text.replace(/\s+/g, '').toLowerCase();
  if (clean.length < 20) {
    const freq = {};
    for (const ch of clean) {
      if (/[а-яёa-z]/i.test(ch)) {
        freq[ch] = (freq[ch] || 0) + 1;
      }
    }
    for (const ch in freq) {
      if (freq[ch] >= 5 && freq[ch] / clean.length > 0.3) return true;
    }
  }
  // Паттерны смеха
  if (/^[хxаaоoеeиiуu)(\s]{4,}$/i.test(clean)) return true;
  if (/([аaхxоo])\1{2,}/i.test(text)) return true;
  if (/ха{2,}/i.test(text) || /хе{2,}/i.test(text) || /хи{2,}/i.test(text)) return true;
  if (/а{2,}х/i.test(text)) return true;
  if (/ло{2,}л/i.test(text)) return true;
  return false;
}

function isOnlyNumbersOrLetters(text) {
  // Только отдельные буквы/цифры через пробел: "а б в г" или "1 2 3 4"
  const words = text.trim().split(/\s+/);
  if (words.length >= 3 && words.every(w => w.length <= 2)) return true;
  // Только цифры
  if (/^\d[\d\s]*$/.test(text.trim())) return true;
  return false;
}

function shouldCountWPM(text, timeDiff, prevText) {
  if (isGibberish(text)) return false;
  if (isLaughSpam(text)) return false;
  if (isOnlyNumbersOrLetters(text)) return false;

  const words = text.trim().split(/\s+/).filter(w => w.length > 0);

  // Если 1-2 слова и время < 4 секунд — не считаем
  if (words.length <= 2 && timeDiff < 4) return false;

  // Если сообщение слишком похоже на предыдущее
  if (prevText && calculateSimilarity(text.toLowerCase(), prevText.toLowerCase()) > 0.8) return false;

  return true;
}

function getValidWordsCount(text) {
  if (isGibberish(text)) return 0;
  if (isLaughSpam(text)) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// =============================================
// ПАРСИНГ ВРЕМЕНИ БАНА
// =============================================
function parseDuration(str) {
  const match = str.match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return val * 60 * 1000;
  if (unit === 'h') return val * 3600 * 1000;
  if (unit === 'd') return val * 86400 * 1000;
  return null;
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + 'с';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'м';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'ч ' + (min % 60) + 'м';
  const d = Math.floor(hr / 24);
  return d + 'д ' + (hr % 24) + 'ч';
}

// =============================================
// БАЗА ДАННЫХ
// =============================================
async function ensureUser(from) {
  try {
    await supabase.from('users').upsert({
      user_id: from.id, username: from.username || null, first_name: from.first_name || null
    }, { onConflict: 'user_id' });
  } catch (e) { console.error('[DB] ensureUser:', e.message); }
}

async function getUserState(userId, chatId) {
  try {
    const { data } = await supabase.from('user_state').select('*')
      .eq('user_id', userId).eq('chat_id', chatId).single();
    return data;
  } catch (e) { return null; }
}

async function updateUserState(userId, chatId, text, cooldownSec = 3) {
  try {
    await supabase.from('user_state').upsert({
      user_id: userId, chat_id: chatId,
      last_message_time: new Date().toISOString(),
      last_message_length: text.length,
      last_message_text: text.substring(0, 300),
      cooldown_until: new Date(Date.now() + cooldownSec * 1000).toISOString()
    }, { onConflict: 'user_id,chat_id' });
  } catch (e) { console.error('[DB] updateState:', e.message); }
}

async function getChatStatsForUser(chatId, userId) {
  try {
    const { data } = await supabase.from('chat_stats').select('*')
      .eq('chat_id', chatId).eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

async function updateChatStats(chatId, userId, wpm) {
  try {
    const { error } = await supabase.rpc('update_chat_stats', { p_chat_id: chatId, p_user_id: userId, p_wpm: wpm });
    if (error) console.error('[DB] updateChatStats:', error.message);
  } catch (e) { console.error('[DB] updateChatStats:', e.message); }
}

async function getChatTop(chatId, limit = 10) {
  try {
    const { data } = await supabase.from('chat_stats').select('user_id, best_wpm, avg_wpm, messages_count, last_wpm')
      .eq('chat_id', chatId).order('best_wpm', { ascending: false }).limit(limit);
    return data || [];
  } catch (e) { return []; }
}

async function getUserInfo(userId) {
  try {
    const { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

async function getChatSettings(chatId) {
  try {
    const { data, error } = await supabase.from('chat_settings').select('*').eq('chat_id', chatId).single();
    if (error && error.code === 'PGRST116') {
      const { data: d } = await supabase.from('chat_settings')
        .upsert({ chat_id: chatId }, { onConflict: 'chat_id' }).select().single();
      return d || defaultSettings();
    }
    if (data && data.autowpm_enabled === undefined) data.autowpm_enabled = true;
    return data || defaultSettings();
  } catch (e) { return defaultSettings(); }
}

async function setChatSetting(chatId, key, value) {
  try {
    const u = { chat_id: chatId }; u[key] = value;
    await supabase.from('chat_settings').upsert(u, { onConflict: 'chat_id' });
  } catch (e) { }
}

// =============================================
// ТИТУЛЫ — БД
// =============================================
async function getUserTitles(userId) {
  try {
    const { data } = await supabase.from('user_titles').select('title_id').eq('user_id', userId);
    return (data || []).map(d => d.title_id);
  } catch (e) { return []; }
}

async function grantTitle(userId, titleId) {
  try {
    const { error } = await supabase.from('user_titles').upsert(
      { user_id: userId, title_id: titleId },
      { onConflict: 'user_id,title_id' }
    );
    return !error;
  } catch (e) { return false; }
}

async function hasTitle(userId, titleId) {
  const titles = await getUserTitles(userId);
  return titles.includes(titleId);
}

async function setActiveTitle(userId, titleId) {
  try {
    await supabase.from('users').update({ active_title: titleId }).eq('user_id', userId);
  } catch (e) { }
}

async function getActiveTitle(userId) {
  try {
    const { data } = await supabase.from('users').select('active_title').eq('user_id', userId).single();
    return data ? data.active_title : null;
  } catch (e) { return null; }
}

// =============================================
// ЗАМОРОЗКА РЕЙТИНГА
// =============================================
async function isRatingBanned(userId) {
  try {
    const { data } = await supabase.from('rating_bans').select('*').eq('user_id', userId).single();
    if (!data) return null;
    if (new Date(data.banned_until) < new Date()) {
      await supabase.from('rating_bans').delete().eq('user_id', userId);
      return null;
    }
    return data;
  } catch (e) { return null; }
}

async function banRating(userId, bannedBy, durationMs) {
  try {
    const until = new Date(Date.now() + durationMs).toISOString();
    await supabase.from('rating_bans').upsert(
      { user_id: userId, banned_until: until, banned_by: bannedBy },
      { onConflict: 'user_id' }
    );
    return until;
  } catch (e) { return null; }
}

async function unbanRating(userId) {
  try {
    await supabase.from('rating_bans').delete().eq('user_id', userId);
    return true;
  } catch (e) { return false; }
}

// =============================================
// ПРОВЕРКА И ВЫДАЧА ТИТУЛОВ
// =============================================
async function checkAndGrantTitles(chatId, userId, wpm, messagesCount, settings) {
  const newTitles = [];

  // За активность
  if (messagesCount >= 100 && !(await hasTitle(userId, 'writer'))) {
    await grantTitle(userId, 'writer'); newTitles.push('writer');
  }
  if (messagesCount >= 500 && !(await hasTitle(userId, 'tryhard'))) {
    await grantTitle(userId, 'tryhard'); newTitles.push('tryhard');
  }
  if (messagesCount >= 2000 && !(await hasTitle(userId, 'lives_in_chat'))) {
    await grantTitle(userId, 'lives_in_chat'); newTitles.push('lives_in_chat');
  }

  // За скорость (best_wpm)
  if (wpm < 15 && !(await hasTitle(userId, 'snail'))) {
    await grantTitle(userId, 'snail'); newTitles.push('snail');
  }
  if (wpm >= 60 && !(await hasTitle(userId, 'runner'))) {
    await grantTitle(userId, 'runner'); newTitles.push('runner');
  }
  if (wpm >= 80 && !(await hasTitle(userId, 'racer'))) {
    await grantTitle(userId, 'racer'); newTitles.push('racer');
  }
  if (wpm >= 100 && !(await hasTitle(userId, 'rocket'))) {
    await grantTitle(userId, 'rocket'); newTitles.push('rocket');
  }
  if (wpm >= 150 && !(await hasTitle(userId, 'lightning'))) {
    await grantTitle(userId, 'lightning'); newTitles.push('lightning');
  }
  if (wpm >= 200 && !(await hasTitle(userId, 'legend'))) {
    await grantTitle(userId, 'legend'); newTitles.push('legend');
  }

  // Ошибка системы — WPM > лимита (но мы его обрезаем, поэтому если сырой > лимита)
  if (wpm > (settings.max_wpm_limit || 300) && !(await hasTitle(userId, 'system_error'))) {
    await grantTitle(userId, 'system_error'); newTitles.push('system_error');
  }

  // Глитч — 1% шанс
  if (Math.random() < 0.01 && !(await hasTitle(userId, 'glitch'))) {
    await grantTitle(userId, 'glitch'); newTitles.push('glitch');
  }

  // Наблюдаемый — 0.5% шанс
  if (Math.random() < 0.005 && !(await hasTitle(userId, 'observed'))) {
    await grantTitle(userId, 'observed'); newTitles.push('observed');
  }

  return newTitles;
}

// =============================================
// ОБНУЛЕНИЕ РЕЙТИНГА
// =============================================
async function nullRating(targetUserId, newValue) {
  try {
    const updateData = { best_wpm: newValue, avg_wpm: newValue, last_wpm: newValue };
    if (newValue === 0) { updateData.messages_count = 0; updateData.total_wpm_sum = 0; }
    const { error } = await supabase.from('chat_stats').update(updateData).eq('user_id', targetUserId);
    if (error) { console.error('[DB] nullRating:', error.message); return false; }
    return true;
  } catch (e) { console.error('[DB] nullRating:', e.message); return false; }
}

// =============================================
// ДУЭЛИ
// =============================================
async function getActiveDuel(chatId) {
  try {
    const { data } = await supabase.from('duels').select('*')
      .eq('chat_id', chatId).in('status', ['pending', 'active'])
      .order('created_at', { ascending: false }).limit(1).single();
    return data;
  } catch (e) { return null; }
}

async function acceptDuel(duelId, user2Id) {
  try {
    const { data } = await supabase.from('duels').update({
      user2_id: user2Id, status: 'active',
      expires_at: new Date(Date.now() + 120000).toISOString()
    }).eq('id', duelId).eq('status', 'pending').select().single();
    return data;
  } catch (e) { return null; }
}

const activeSpamDuels = {};

async function finishSpamDuel(chatId, duelId) {
  const state = activeSpamDuels[duelId];
  if (!state) return;
  const { user1Score, user2Score, u1_id, u2_id } = state;
  delete activeSpamDuels[duelId];

  let winnerId = null;
  if (user1Score > user2Score) winnerId = u1_id;
  else if (user2Score > user1Score) winnerId = u2_id;

  try {
    await supabase.from('duels').update({
      status: 'finished', user1_wpm: user1Score, user2_wpm: user2Score, winner_id: winnerId
    }).eq('id', duelId);
  } catch (e) { }

  // Титулы за дуэль
  if (winnerId) {
    try {
      const { data: wins } = await supabase.from('duels').select('id')
        .eq('winner_id', winnerId).eq('status', 'finished');
      const winCount = wins ? wins.length : 0;
      if (winCount >= 1 && !(await hasTitle(winnerId, 'duelist'))) {
        await grantTitle(winnerId, 'duelist');
        const wInfo = await getUserInfo(winnerId);
        bot.sendMessage(chatId, `🎉 <b>${esc(getNameFromInfo(wInfo))}</b> получил титул ⚔️ <b>Дуэлянт</b>!\nПерейди в бота чтобы надеть →`, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🎖 Мои титулы', url: `https://t.me/${(await bot.getMe()).username}?start=titles` }]] }
        });
      }
      if (winCount >= 10 && !(await hasTitle(winnerId, 'champion'))) {
        await grantTitle(winnerId, 'champion');
        const wInfo = await getUserInfo(winnerId);
        bot.sendMessage(chatId, `🎉 <b>${esc(getNameFromInfo(wInfo))}</b> получил титул 🏆 <b>Чемпион</b>!\nПерейди в бота чтобы надеть →`, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🎖 Мои титулы', url: `https://t.me/${(await bot.getMe()).username}?start=titles` }]] }
        });
      }
    } catch (e) { }
  }

  const u1Info = await getUserInfo(u1_id);
  const u2Info = await getUserInfo(u2_id);
  let wt = '🤝 <b>НИЧЬЯ!</b>';
  if (winnerId === u1_id) wt = `👑 Победитель: <b>${esc(getNameFromInfo(u1Info))}</b>`;
  else if (winnerId === u2_id) wt = `👑 Победитель: <b>${esc(getNameFromInfo(u2Info))}</b>`;

  bot.sendMessage(chatId, `
⚔️ <b>ДУЭЛЬ ЗАВЕРШЕНА!</b>
━━━━━━━━━━━━━━━
${esc(getNameFromInfo(u1Info))}: <b>${user1Score}</b> сообщений
${esc(getNameFromInfo(u2Info))}: <b>${user2Score}</b> сообщений
━━━━━━━━━━━━━━━
${wt}
  `, { parse_mode: 'HTML' });
}

// =============================================
// ХЕЛПЕР: получить ID юзера из reply или @username
// =============================================
async function resolveTargetUser(msg, extraText) {
  // Из ответа на сообщение
  if (msg.reply_to_message && msg.reply_to_message.from) {
    await ensureUser(msg.reply_to_message.from);
    return { userId: msg.reply_to_message.from.id, username: msg.reply_to_message.from.username, firstName: msg.reply_to_message.from.first_name };
  }
  // Из @username в тексте
  if (extraText) {
    const uMatch = extraText.match(/@(\S+)/);
    if (uMatch) {
      const username = uMatch[1];
      try {
        const { data } = await supabase.from('users').select('*').eq('username', username).single();
        if (data) return { userId: data.user_id, username: data.username, firstName: data.first_name };
      } catch (e) { }
    }
  }
  return null;
}

// =============================================
// КОМАНДЫ
// =============================================
bot.onText(/\/start(.*)/, async (msg, match) => {
  if (msg.chat.type !== 'private') return;
  await ensureUser(msg.from);
  const param = (match[1] || '').trim();

  if (param === 'titles') {
    return sendTitlesMenu(msg.chat.id, msg.from.id);
  }

  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR</b> активен

я считаю твою скорость печати
⌨️ <b>WPM</b> • ⚔️ <b>дуэли</b> • 🏆 <b>рейтинг</b>

добавь меня в чат и узнай, кто здесь самый быстрый

/titles — твои титулы
  `, { parse_mode: 'HTML' });
});

bot.on('new_chat_members', async (msg) => {
  try {
    const me = await bot.getMe();
    if (!msg.new_chat_members.some(m => m.id === me.id)) return;
    await getChatSettings(msg.chat.id);
    bot.sendMessage(msg.chat.id, `💀 <b>TYPEWAR</b> активирован\n\nсчитаю WPM, провожу дуэли на скорость.`, { parse_mode: 'HTML' });
  } catch (e) { }
});

// =============================================
// /titles — МЕНЮ ТИТУЛОВ
// =============================================
async function sendTitlesMenu(chatId, userId) {
  const userTitles = await getUserTitles(userId);
  const activeT = await getActiveTitle(userId);

  // Для OWNER — все доступны
  const isOwner = userId === OWNER_ID;

  let text = `🎖 <b>ТВОИ ТИТУЛЫ</b>\n━━━━━━━━━━━━━━━\n`;
  if (activeT && ALL_TITLES[activeT]) {
    text += `Надет: ${ALL_TITLES[activeT].emoji} <b>${ALL_TITLES[activeT].name}</b>\n`;
  } else {
    text += `Надет: <i>нет</i>\n`;
  }
  text += `\n✅ — есть  ❌ — нет\nНажми на титул чтобы узнать больше\n━━━━━━━━━━━━━━━\n`;

  const keyboard = [];
  const categories = { activity: '🧠 Активность', speed: '⚡ Скорость', rare: '🧬 Редкие', duel: '⚔️ Дуэли' };

  for (const cat of Object.keys(categories)) {
    const titles = Object.entries(ALL_TITLES).filter(([, v]) => v.category === cat);
    const row = [];
    for (const [id, t] of titles) {
      const has = isOwner || userTitles.includes(id);
      const prefix = has ? '✅' : '❌';
      row.push({ text: `${prefix} ${t.emoji} ${t.name}`, callback_data: `title_info_${id}` });
      if (row.length === 2) { keyboard.push([...row]); row.length = 0; }
    }
    if (row.length) keyboard.push([...row]);
  }

  if (activeT) {
    keyboard.push([{ text: '❌ Снять титул', callback_data: 'title_unequip' }]);
  }

  bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
}

bot.onText(/\/titles/, async (msg) => {
  await ensureUser(msg.from);
  if (msg.chat.type !== 'private') {
    const me = await bot.getMe();
    bot.sendMessage(msg.chat.id, `🎖 Для управления титулами перейди в бота`, {
      reply_to_message_id: msg.message_id,
      reply_markup: { inline_keyboard: [[{ text: '🎖 Мои титулы', url: `https://t.me/${me.username}?start=titles` }]] }
    });
    return;
  }
  sendTitlesMenu(msg.chat.id, msg.from.id);
});

// =============================================
// CALLBACK: ТИТУЛЫ
// =============================================
bot.on('callback_query', async (query) => {
  const data = query.data;
  const userId = query.from.id;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  // ====== ТИТУЛЫ ======
  if (data.startsWith('title_info_')) {
    const titleId = data.replace('title_info_', '');
    const t = ALL_TITLES[titleId];
    if (!t) { bot.answerCallbackQuery(query.id, { text: 'Титул не найден' }); return; }

    const isOwner = userId === OWNER_ID;
    const has = isOwner || await hasTitle(userId, titleId);
    const activeT = await getActiveTitle(userId);

    let text = `${t.emoji} <b>${t.name}</b>\n\n`;
    text += `📋 <b>Как получить:</b> ${t.desc}\n\n`;
    text += has ? `✅ <b>Титул доступен!</b>` : `❌ <b>Титул ещё не получен</b>`;

    const kb = [];
    if (has && activeT !== titleId) {
      kb.push([{ text: `✅ Надеть ${t.emoji} ${t.name}`, callback_data: `title_equip_${titleId}` }]);
    } else if (has && activeT === titleId) {
      kb.push([{ text: `Уже надето ✅`, callback_data: 'noop' }]);
    }
    kb.push([{ text: '← Назад', callback_data: 'title_back' }]);

    bot.editMessageText(text, {
      chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
      reply_markup: { inline_keyboard: kb }
    }).catch(() => {});
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith('title_equip_')) {
    const titleId = data.replace('title_equip_', '');
    const isOwner = userId === OWNER_ID;
    const has = isOwner || await hasTitle(userId, titleId);
    if (!has) {
      bot.answerCallbackQuery(query.id, { text: '❌ У тебя нет этого титула!', show_alert: true });
      return;
    }
    // Для OWNER — грантим автоматически если нет в базе
    if (isOwner && !(await hasTitle(userId, titleId))) {
      await grantTitle(userId, titleId);
    }
    await setActiveTitle(userId, titleId);
    bot.answerCallbackQuery(query.id, { text: `✅ Титул ${ALL_TITLES[titleId]?.name} надет!` });
    sendTitlesMenu(chatId, userId);
    bot.deleteMessage(chatId, msgId).catch(() => {});
    return;
  }

  if (data === 'title_unequip') {
    await setActiveTitle(userId, null);
    bot.answerCallbackQuery(query.id, { text: '❌ Титул снят' });
    sendTitlesMenu(chatId, userId);
    bot.deleteMessage(chatId, msgId).catch(() => {});
    return;
  }

  if (data === 'title_back') {
    bot.deleteMessage(chatId, msgId).catch(() => {});
    sendTitlesMenu(chatId, userId);
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === 'noop') {
    bot.answerCallbackQuery(query.id);
    return;
  }

  // ====== ДУЭЛИ ======
  if (data.startsWith('d_min_')) {
    const minWords = parseInt(data.split('_')[2]);
    const existing = await getActiveDuel(chatId);
    if (existing) { bot.answerCallbackQuery(query.id, { text: 'Дуэль уже есть!', show_alert: true }); return; }
    bot.deleteMessage(chatId, msgId).catch(() => {});
    try {
      await supabase.from('duels').insert({
        chat_id: chatId, user1_id: userId,
        duel_text: `SPAM_DUEL:${minWords}`, status: 'pending',
        expires_at: new Date(Date.now() + 120000).toISOString()
      });
      bot.sendMessage(chatId, `
⚔️ <b>${esc(query.from.first_name)}</b> вызывает на дуэль!
Минимум слов: <b>${minWords}</b>

👊 Кто примет? Пиши /duel
⏱ Истекает через 2 минуты
      `, { parse_mode: 'HTML' });
    } catch(e) { }
    bot.answerCallbackQuery(query.id);
    return;
  }

  // ====== НАСТРОЙКИ ======
  if (data.startsWith('set_')) {
    try {
      const m = await bot.getChatMember(chatId, userId);
      if (!['creator', 'administrator'].includes(m.status)) {
        bot.answerCallbackQuery(query.id, { text: '⚙️ Только для админов', show_alert: true }); return;
      }
    } catch (e) { }

    const s = await getChatSettings(chatId);
    let key, newVal, label;

    if (data === 'set_trolling') {
      key = 'trolling_enabled'; newVal = !s.trolling_enabled; label = '😈 Троллинг';
    } else if (data === 'set_duels') {
      key = 'duels_enabled'; newVal = !s.duels_enabled; label = '⚔️ Дуэли';
    } else if (data === 'set_autowpm') {
      key = 'autowpm_enabled'; newVal = !(s.autowpm_enabled !== false); label = '📊 Авто-WPM';
    }

    if (key) {
      await setChatSetting(chatId, key, newVal);
      bot.answerCallbackQuery(query.id, { text: `${label}: ${newVal ? '✅ ВКЛ' : '❌ ВЫКЛ'}` });
      // Обновляем сообщение настроек
      const s2 = await getChatSettings(chatId);
      const autowpm2 = s2.autowpm_enabled !== undefined ? s2.autowpm_enabled : true;
      bot.editMessageText(`
⚙️ <b>TYPEWAR — Настройки</b>
━━━━━━━━━━━━━━━
😈 Троллинг: <b>${s2.trolling_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
⚔️ Дуэли: <b>${s2.duels_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📊 Авто-WPM: <b>${autowpm2 ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📏 Мин. символов: <b>${s2.min_chars}</b>
⏱ Кулдаун: <b>${s2.cooldown_seconds}с</b>
🚫 Макс WPM: <b>${s2.max_wpm_limit}</b>
━━━━━━━━━━━━━━━
      `, {
        chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `😈 Троллинг ${s2.trolling_enabled ? '✅' : '❌'}`, callback_data: 'set_trolling' },
              { text: `⚔️ Дуэли ${s2.duels_enabled ? '✅' : '❌'}`, callback_data: 'set_duels' }
            ],
            [
              { text: `📊 Авто-WPM ${autowpm2 ? '✅' : '❌'}`, callback_data: 'set_autowpm' }
            ]
          ]
        }
      }).catch(() => {});
    }
    return;
  }
});

// =============================================
// /wpm
// =============================================
bot.onText(/\/wpm/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  await ensureUser(msg.from);
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '💀 Добавь меня в чат'); return; }
  const stats = await getChatStatsForUser(chatId, userId);
  if (!stats || stats.messages_count === 0) {
    bot.sendMessage(chatId, `💀 <b>${esc(getName(msg))}</b>\nПока нет данных`, { parse_mode: 'HTML', reply_to_message_id: msg.message_id }); return;
  }
  const ban = await isRatingBanned(userId);
  let banText = '';
  if (ban) { banText = `\n\n🔒 <b>Поступление WPM заморожено</b>\nДо: ${new Date(ban.banned_until).toLocaleString('ru')}`; }

  bot.sendMessage(chatId, `
${getWpmEmoji(stats.best_wpm)} <b>${esc(getName(msg))}</b>
┌ 🏆 лучший: <b>${stats.best_wpm} WPM</b>
├ 📊 средний: <b>${Math.round(stats.avg_wpm)} WPM</b>
├ ⚡ последний: <b>${stats.last_wpm} WPM</b>
├ 💬 сообщений: <b>${stats.messages_count}</b>
└ 🎖 ранг: <b>${getRank(stats.best_wpm)}</b>
${getProgressBar(stats.best_wpm)} ${stats.best_wpm}/200${banText}
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /profile
// =============================================
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  await ensureUser(msg.from);
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '💀 Работает только в чатах'); return; }
  const stats = await getChatStatsForUser(chatId, userId);

  const activeT = await getActiveTitle(userId);
  let titleText = '<i>нет титула</i>';
  if (activeT && ALL_TITLES[activeT]) {
    titleText = `${ALL_TITLES[activeT].emoji} <b>${ALL_TITLES[activeT].name}</b>`;
  }

  const ban = await isRatingBanned(userId);
  let banText = '';
  if (ban) { banText = `\n🔒 <b>Поступление WPM на ваш аккаунт заморожено</b>\nПоступление рейтинга приостановлено до ${new Date(ban.banned_until).toLocaleString('ru')}`; }

  if (!stats || stats.messages_count === 0) {
    const me = await bot.getMe();
    bot.sendMessage(chatId, `
👤 <b>${esc(getName(msg))}</b>
🏷 Титул: ${titleText}
📊 Профиль пуст${banText}
    `, {
      parse_mode: 'HTML', reply_to_message_id: msg.message_id,
      reply_markup: { inline_keyboard: [[{ text: '🎖 Мои титулы', url: `https://t.me/${me.username}?start=titles` }]] }
    });
    return;
  }

  const me = await bot.getMe();
  bot.sendMessage(chatId, `
👤 <b>${esc(getName(msg))}</b>
🏷 Титул: ${titleText}
🎖 Ранг: <b>${getRank(stats.best_wpm)}</b>
🏆 Лучший: <b>${stats.best_wpm} WPM</b>
📊 Средний: <b>${Math.round(stats.avg_wpm)} WPM</b>
⚡ Последний: <b>${stats.last_wpm} WPM</b>
💬 Сообщений: <b>${stats.messages_count}</b>${banText}
  `, {
    parse_mode: 'HTML', reply_to_message_id: msg.message_id,
    reply_markup: { inline_keyboard: [[{ text: '🎖 Мои титулы', url: `https://t.me/${me.username}?start=titles` }]] }
  });
});

// =============================================
// /top — с кулдауном 30 сек
// =============================================
bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '🏆 Только в чатах'); return; }

  // Кулдаун 30 сек на весь чат
  const now = Date.now();
  if (topCooldowns[chatId] && now - topCooldowns[chatId] < 30000) {
    const left = Math.ceil((30000 - (now - topCooldowns[chatId])) / 1000);
    bot.sendMessage(chatId, `⏱ Попробуйте снова через <b>${left}с</b>`, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    return;
  }
  topCooldowns[chatId] = now;

  const top = await getChatTop(chatId, 15);
  if (!top.length) { bot.sendMessage(chatId, '🏆 <b>Рейтинг пуст</b>', { parse_mode: 'HTML' }); return; }
  let text = '🏆 <b>TYPEWAR — ТОП ЧАТА</b>\n━━━━━━━━━━━━━━━\n\n';
  const medals = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < top.length; i++) {
    const e = top[i]; const info = await getUserInfo(e.user_id);
    const medal = medals[i] || `<b>${i + 1}.</b>`;
    const ban = await isRatingBanned(e.user_id);
    let banMark = '';
    if (ban) banMark = '\n    <b>🔒 Рейтинг заморожен</b>';
    text += `${medal} ${esc(getNameFromInfo(info))}\n    ${getWpmEmoji(e.best_wpm)} <b>${e.best_wpm}</b> WPM  (msg: ${e.messages_count})${banMark}\n`;
  }
  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// =============================================
// /duel
// =============================================
bot.onText(/\/duel/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '⚔️ Дуэли только в чатах'); return; }
  const settings = await getChatSettings(chatId);
  if (!settings.duels_enabled) { bot.sendMessage(chatId, '⚔️ Дуэли отключены'); return; }
  await ensureUser(msg.from);

  const existing = await getActiveDuel(chatId);
  if (existing) {
    if (existing.status === 'pending' && existing.user1_id !== userId) {
      const duel = await acceptDuel(existing.id, userId);
      if (duel) {
        const minWords = parseInt(duel.duel_text.split(':')[1]) || 2;
        const u1 = await getUserInfo(duel.user1_id);
        activeSpamDuels[duel.id] = { user1Score: 0, user2Score: 0, minWords, u1_id: duel.user1_id, u2_id: userId };
        bot.sendMessage(chatId, `
⚔️ <b>ДУЭЛЬ НАЧАЛАСЬ!</b>
━━━━━━━━━━━━━━━
${esc(getNameFromInfo(u1))} ⚡ VS ⚡ ${esc(getName(msg))}

📝 <b>ПРАВИЛА:</b>
Кто отправит больше сообщений за <b>2 минуты</b>!
Минимум слов в сообщении: <b>${minWords}</b>
<i>Спам и одинаковые буквы не считаются!</i>

⏱ <b>ВРЕМЯ ПОШЛО!</b>
        `, { parse_mode: 'HTML' });
        setTimeout(() => finishSpamDuel(chatId, duel.id), 120000);
        return;
      }
    }
    if (existing.user1_id === userId) {
      bot.sendMessage(chatId, '⚔️ Ты уже создал дуэль!\n/cancel — отменить', { reply_to_message_id: msg.message_id });
    } else { bot.sendMessage(chatId, '⚔️ Дуэль уже идёт!', { reply_to_message_id: msg.message_id }); }
    return;
  }

  bot.sendMessage(chatId, `⚔️ <b>Выбери минимум слов в сообщении:</b>`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '1 слово', callback_data: 'd_min_1' }, { text: '2 слова', callback_data: 'd_min_2' }],
        [{ text: '3 слова', callback_data: 'd_min_3' }, { text: '5 слов', callback_data: 'd_min_5' }]
      ]
    }
  });
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const duel = await getActiveDuel(chatId);
  if (!duel) { bot.sendMessage(chatId, 'Нет активных дуэлей'); return; }
  if (duel.user1_id !== msg.from.id && duel.status === 'pending') { bot.sendMessage(chatId, 'Только создатель может отменить'); return; }
  await supabase.from('duels').update({ status: 'cancelled' }).eq('id', duel.id);
  if (activeSpamDuels[duel.id]) delete activeSpamDuels[duel.id];
  bot.sendMessage(chatId, '⚔️ Дуэль отменена');
});

// =============================================
// /test
// =============================================
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  await ensureUser(msg.from);
  const testText = rand(DUEL_TEXTS);
  await supabase.from('user_state').upsert({
    user_id: userId, chat_id: chatId,
    last_message_time: new Date().toISOString(),
    last_message_length: 0,
    last_message_text: '__TEST__:' + testText
  }, { onConflict: 'user_id,chat_id' });

  bot.sendMessage(chatId, `
⌨️ <b>ТЕСТ СКОРОСТИ</b>
━━━━━━━━━━━━━━━
Перепиши текст как можно быстрее:

<b>${testText}</b>

━━━━━━━━━━━━━━━
⏱ 2 минуты
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /settings — с инлайн кнопками
// =============================================
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '⚙️ Только в чатах'); return; }
  try {
    const m = await bot.getChatMember(chatId, msg.from.id);
    if (!['creator', 'administrator'].includes(m.status)) {
      bot.sendMessage(chatId, '⚙️ Только для админов', { reply_to_message_id: msg.message_id }); return;
    }
  } catch (e) { }
  const s = await getChatSettings(chatId);
  const autowpm = s.autowpm_enabled !== undefined ? s.autowpm_enabled : true;

  bot.sendMessage(chatId, `
⚙️ <b>TYPEWAR — Настройки</b>
━━━━━━━━━━━━━━━
😈 Троллинг: <b>${s.trolling_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
⚔️ Дуэли: <b>${s.duels_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📊 Авто-WPM: <b>${autowpm ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📏 Мин. символов: <b>${s.min_chars}</b>
⏱ Кулдаун: <b>${s.cooldown_seconds}с</b>
🚫 Макс WPM: <b>${s.max_wpm_limit}</b>
━━━━━━━━━━━━━━━
  `, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: `😈 Троллинг ${s.trolling_enabled ? '✅' : '❌'}`, callback_data: 'set_trolling' },
          { text: `⚔️ Дуэли ${s.duels_enabled ? '✅' : '❌'}`, callback_data: 'set_duels' }
        ],
        [
          { text: `📊 Авто-WPM ${autowpm ? '✅' : '❌'}`, callback_data: 'set_autowpm' }
        ]
      ]
    }
  });
});

// =============================================
// 👑 OWNER COMMANDS
// =============================================

// /null_rating @user 0  или  ответом на сообщение /null_rating 0
bot.onText(/\/null_rating(.*)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;
  const chatId = msg.chat.id;
  const args = (match[1] || '').trim();

  // Парсим
  let target = null;
  let newValue = 0;

  // Формат: /null_rating @user 50
  const m1 = args.match(/@(\S+)\s+(\d+)/);
  // Формат: /null_rating 50 (ответом)
  const m2 = args.match(/^(\d+)$/);

  if (m1) {
    const username = m1[1];
    newValue = parseInt(m1[2]);
    try {
      const { data } = await supabase.from('users').select('*').eq('username', username).single();
      if (data) target = { userId: data.user_id, username: data.username };
    } catch (e) { }
  } else if (m2 && msg.reply_to_message) {
    newValue = parseInt(m2[1]);
    const from = msg.reply_to_message.from;
    await ensureUser(from);
    target = { userId: from.id, username: from.username };
  } else if (!args) {
    // Просто /null_rating ответом
    if (msg.reply_to_message) {
      const from = msg.reply_to_message.from;
      await ensureUser(from);
      target = { userId: from.id, username: from.username };
      newValue = 0;
    }
  }

  if (!target) {
    bot.sendMessage(chatId, `
🔧 <b>Использование:</b>
<code>/null_rating @username 0</code>
<code>/null_rating 50</code> (ответом на сообщение)
<code>/null_rating @username 50</code>
    `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    return;
  }

  const success = await nullRating(target.userId, newValue);
  if (success) {
    bot.sendMessage(chatId, `
🔧 <b>РЕЙТИНГ ОБНУЛЁН</b>
━━━━━━━━━━━━━━━
👤 Юзер: <b>${target.username ? '@' + esc(target.username) : 'ID:' + target.userId}</b>
📊 Новое значение: <b>${newValue}</b>
${newValue === 0 ? '💀 Всё обнулено.' : `⚡ WPM: ${newValue}`}
    `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
  } else {
    bot.sendMessage(chatId, `❌ Ошибка`, { reply_to_message_id: msg.message_id });
  }
});

// /ban_rating @user 30m  или  ответом /ban_rating 30m
bot.onText(/\/ban_rating(.*)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;
  const chatId = msg.chat.id;
  const args = (match[1] || '').trim();

  let target = null;
  let durationStr = null;

  // @user 30m
  const m1 = args.match(/@(\S+)\s+(\d+[mhd])/i);
  // 30m ответом
  const m2 = args.match(/^(\d+[mhd])$/i);

  if (m1) {
    const username = m1[1];
    durationStr = m1[2];
    try {
      const { data } = await supabase.from('users').select('*').eq('username', username).single();
      if (data) target = { userId: data.user_id, username: data.username };
    } catch (e) { }
  } else if (m2 && msg.reply_to_message) {
    durationStr = m2[1];
    const from = msg.reply_to_message.from;
    await ensureUser(from);
    target = { userId: from.id, username: from.username };
  }

  if (!target || !durationStr) {
    bot.sendMessage(chatId, `
🔒 <b>Использование:</b>
<code>/ban_rating @user 30m</code>
<code>/ban_rating 1h</code> (ответом)
m=минуты h=часы d=дни
    `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    return;
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    bot.sendMessage(chatId, '❌ Неверный формат. Пример: 30m, 1h, 2d', { reply_to_message_id: msg.message_id });
    return;
  }

  const until = await banRating(target.userId, msg.from.id, durationMs);
  if (until) {
    bot.sendMessage(chatId, `
🔒 <b>РЕЙТИНГ ЗАМОРОЖЕН</b>
━━━━━━━━━━━━━━━
👤 Юзер: <b>${target.username ? '@' + esc(target.username) : 'ID:' + target.userId}</b>
⏱ На: <b>${formatDuration(durationMs)}</b>
📅 До: <b>${new Date(until).toLocaleString('ru')}</b>
    `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
  } else {
    bot.sendMessage(chatId, '❌ Ошибка', { reply_to_message_id: msg.message_id });
  }
});

// /unban_rating @user  или  ответом
bot.onText(/\/unban_rating(.*)/, async (msg, match) => {
  if (msg.from.id !== OWNER_ID) return;
  const chatId = msg.chat.id;
  const args = (match[1] || '').trim();

  let target = null;
  const uMatch = args.match(/@(\S+)/);
  if (uMatch) {
    try {
      const { data } = await supabase.from('users').select('*').eq('username', uMatch[1]).single();
      if (data) target = { userId: data.user_id, username: data.username };
    } catch (e) { }
  } else if (msg.reply_to_message) {
    const from = msg.reply_to_message.from;
    await ensureUser(from);
    target = { userId: from.id, username: from.username };
  }

  if (!target) {
    bot.sendMessage(chatId, `
🔓 <b>Использование:</b>
<code>/unban_rating @user</code>
Или ответом на сообщение
    `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
    return;
  }

  const ok = await unbanRating(target.userId);
  bot.sendMessage(chatId, ok
    ? `🔓 Рейтинг <b>${target.username ? '@' + esc(target.username) : 'ID:' + target.userId}</b> разморожен!`
    : '❌ Ошибка', { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /help
// =============================================
bot.onText(/\/help/, async (msg) => {
  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR — ПОМОЩЬ</b>
Автоматически считаю WPM по всем сообщениям в чате.

📋 <b>Команды:</b>
/wpm — статистика
/profile — профиль
/top — рейтинг чата
/duel — спам-дуэль
/test — тест скорости
/titles — твои титулы
/cancel — отменить дуэль
/settings — настройки (админ)
  `, { parse_mode: 'HTML' });
});

// =============================================
// 💀 ГЛАВНЫЙ ОБРАБОТЧИК СООБЩЕНИЙ
// =============================================
bot.on('message', async (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith('/')) return;
  if (msg.from.is_bot) return;
  if (msg.chat.type === 'private') return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  await ensureUser(msg.from);
  const settings = await getChatSettings(chatId);
  const state = await getUserState(userId, chatId);
  const autowpmEnabled = settings.autowpm_enabled !== undefined ? settings.autowpm_enabled : true;

  // =============================================
  // ДУЭЛЬ
  // =============================================
  const activeDuel = await getActiveDuel(chatId);
  if (activeDuel && activeDuel.status === 'active' && activeDuel.duel_text.startsWith('SPAM_DUEL:')) {
    const duelState = activeSpamDuels[activeDuel.id];
    if (duelState) {
      if (userId === duelState.u1_id || userId === duelState.u2_id) {
        const wordsCount = getValidWordsCount(text);
        if (wordsCount >= duelState.minWords) {
          if (userId === duelState.u1_id) duelState.user1Score++;
          if (userId === duelState.u2_id) duelState.user2Score++;
        }
      }
    }
    return;
  }

  // =============================================
  // ТЕСТ НА ТОЧНОСТЬ
  // =============================================
  if (state && state.last_message_text && state.last_message_text.startsWith('__TEST__:')) {
    const testText = state.last_message_text.replace('__TEST__:', '');
    const sim = calculateSimilarity(testText.toLowerCase().trim(), text.toLowerCase().trim());

    if (sim >= 0.65) {
      const td = (Date.now() - new Date(state.last_message_time).getTime()) / 1000;
      const rawWpm = calculateWPM(text.length, td);
      const wpm = Math.min(rawWpm, settings.max_wpm_limit);
      const acc = Math.round(sim * 100);

      await updateUserState(userId, chatId, text, settings.cooldown_seconds);

      // Проверка заморозки
      const ban = await isRatingBanned(userId);
      if (!ban) {
        const oldStats = await getChatStatsForUser(chatId, userId);
        const wasRecord = !oldStats || wpm > (oldStats.best_wpm || 0);
        await updateChatStats(chatId, userId, wpm);

        // Титулы
        const newStats = await getChatStatsForUser(chatId, userId);
        if (newStats) {
          const newTitles = await checkAndGrantTitles(chatId, userId, newStats.best_wpm, newStats.messages_count, settings);
          for (const tid of newTitles) {
            const t = ALL_TITLES[tid];
            if (t) {
              const me = await bot.getMe();
              bot.sendMessage(chatId, `🎉 <b>${esc(getName(msg))}</b> получил титул ${t.emoji} <b>${t.name}</b>!`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: '🎖 Надеть титул', url: `https://t.me/${me.username}?start=titles` }]] }
              });
            }
          }
        }

        // Ошибка системы
        if (rawWpm > settings.max_wpm_limit && !(await hasTitle(userId, 'system_error'))) {
          await grantTitle(userId, 'system_error');
          const me = await bot.getMe();
          bot.sendMessage(chatId, `🎉 <b>${esc(getName(msg))}</b> получил титул ⚠️ <b>Ошибка системы</b>!`, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '🎖 Надеть титул', url: `https://t.me/${me.username}?start=titles` }]] }
          });
        }

        let rec = '';
        if (wasRecord && wpm > 0) rec = `\n\n🔥 <b>${rand(WPM_UP_MESSAGES)}</b>`;

        bot.sendMessage(chatId, `
⌨️ <b>РЕЗУЛЬТАТ ТЕСТА</b>
━━━━━━━━━━━━━━━
${getWpmEmoji(wpm)} <b>${esc(getName(msg))}</b>
⚡ Скорость: <b>${wpm} WPM</b>
🎯 Точность: <b>${acc}%</b>
⏱ Время: <b>${td.toFixed(1)}с</b>
🎖 Ранг: <b>${getRank(wpm)}</b>
${getProgressBar(wpm)}${rec}
        `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
      } else {
        bot.sendMessage(chatId, `
⌨️ <b>РЕЗУЛЬТАТ ТЕСТА</b>
━━━━━━━━━━━━━━━
${getWpmEmoji(wpm)} <b>${esc(getName(msg))}</b>
⚡ Скорость: <b>${wpm} WPM</b>
🎯 Точность: <b>${acc}%</b>
⏱ Время: <b>${td.toFixed(1)}с</b>

🔒 <b>Рейтинг заморожен — результат не записан</b>
        `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
      }
      return;
    }
  }

  // =============================================
  // АВТО WPM
  // =============================================
  if (text.length < settings.min_chars) {
    await updateUserState(userId, chatId, text, settings.cooldown_seconds);
    return;
  }

  if (state && state.last_message_text === text) return;
  if (state && state.cooldown_until && Date.now() < new Date(state.cooldown_until).getTime()) {
    await updateUserState(userId, chatId, text, settings.cooldown_seconds);
    return;
  }

  // Подсчет
  if (state && state.last_message_time && !state.last_message_text?.startsWith('__')) {
    const td = (Date.now() - new Date(state.last_message_time).getTime()) / 1000;

    // Жёсткий фильтр
    if (!shouldCountWPM(text, td, state.last_message_text)) {
      await updateUserState(userId, chatId, text, settings.cooldown_seconds);
      return;
    }

    if (td >= 1 && td <= 300) {
      const rawWpm = calculateWPM(text.length, td);
      const wpm = Math.min(rawWpm, settings.max_wpm_limit);

      if (wpm > 0 && wpm <= settings.max_wpm_limit) {
        // Проверка заморозки
        const ban = await isRatingBanned(userId);
        if (ban) {
          await updateUserState(userId, chatId, text, settings.cooldown_seconds);
          return;
        }

        const oldStats = await getChatStatsForUser(chatId, userId);
        const oldBest = oldStats ? oldStats.best_wpm : 0;

        await updateChatStats(chatId, userId, wpm);

        // Титулы
        const newStats = await getChatStatsForUser(chatId, userId);
        if (newStats) {
          const newTitles = await checkAndGrantTitles(chatId, userId, newStats.best_wpm, newStats.messages_count, settings);
          for (const tid of newTitles) {
            const t = ALL_TITLES[tid];
            if (t) {
              try {
                const me = await bot.getMe();
                bot.sendMessage(chatId, `🎉 <b>${esc(getName(msg))}</b> получил титул ${t.emoji} <b>${t.name}</b>!`, {
                  parse_mode: 'HTML',
                  reply_markup: { inline_keyboard: [[{ text: '🎖 Надеть титул', url: `https://t.me/${me.username}?start=titles` }]] }
                });
              } catch (e) { }
            }
          }
        }

        // Ошибка системы (если сырой > лимита)
        if (rawWpm > settings.max_wpm_limit && !(await hasTitle(userId, 'system_error'))) {
          await grantTitle(userId, 'system_error');
          try {
            const me = await bot.getMe();
            bot.sendMessage(chatId, `🎉 <b>${esc(getName(msg))}</b> получил титул ⚠️ <b>Ошибка системы</b>!`, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: [[{ text: '🎖 Надеть титул', url: `https://t.me/${me.username}?start=titles` }]] }
            });
          } catch (e) { }
        }

        if (autowpmEnabled) {
          if (wpm > oldBest && oldBest > 0) {
            const diff = wpm - oldBest;
            bot.sendMessage(chatId, `
📈 <b>${esc(getName(msg))}</b>
${getWpmEmoji(wpm)} WPM поднялся до <b>${wpm}</b>! (+${diff})
было: ${oldBest} → стало: <b>${wpm}</b>
${rand(WPM_UP_MESSAGES)}
            `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
          }
          else if (oldBest === 0 && (!oldStats || oldStats.messages_count === 0)) {
            bot.sendMessage(chatId, `
⚡ <b>${esc(getName(msg))}</b> — первый замер!
${getWpmEmoji(wpm)} <b>${wpm} WPM</b> • ${getRank(wpm)}
            `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
          }

          if (settings.trolling_enabled && Math.random() < settings.troll_chance) {
            if (wpm <= oldBest || oldBest === 0) {
              bot.sendMessage(chatId, rand(TROLL_MESSAGES[getTrollCategory(wpm)]), { reply_to_message_id: msg.message_id });
            }
          }
        }
      }
    }
  }

  await updateUserState(userId, chatId, text, settings.cooldown_seconds);
});

// =============================================
// ОШИБКИ — улучшенная обработка
// =============================================
bot.on('polling_error', (e) => {
  if (e.code === 'EFATAL' || e.code === 'ETELEGRAM') {
    console.error('[BOT] Polling error (reconnecting...):', e.code);
  } else {
    console.error('[BOT] Polling:', e.code, e.message);
  }
});
bot.on('error', (e) => console.error('[BOT] Error:', e.message));
process.on('uncaughtException', (e) => {
  console.error('[FATAL]', e.message);
  // Не крашим процесс при сетевых ошибках
});
process.on('unhandledRejection', (r) => {
  if (r && r.code === 'EFATAL') {
    console.error('[FATAL] Network error, continuing...');
    return;
  }
  console.error('[FATAL]', r);
});
