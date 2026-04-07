// =============================================
// 💀 TYPEWAR BOT — ПОЛНЫЙ КОД
// =============================================

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const https = require('https');
const http = require('http');
const os = require('os');

// =============================================
// КОНФИГ
// =============================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8628280796:AAG1ZgiThsj-f_XM7pCz5ZJqKCVDH5FPfdA';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mhblbxqwrjfxgnxnlmyk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_yjHQeH6OCcPRAuwz_2wywQ_exPxYzmv';
const PORT = process.env.PORT || 3000;

// =============================================
// АВТО-ОПРЕДЕЛЕНИЕ RENDER URL
// =============================================
function detectRenderURL() {
  // 1. Если задано вручную
  if (process.env.RENDER_URL) return process.env.RENDER_URL;

  // 2. Render автоматически ставит RENDER_EXTERNAL_HOSTNAME
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return 'https://' + process.env.RENDER_EXTERNAL_HOSTNAME;
  }

  // 3. Render ставит RENDER_SERVICE_NAME
  if (process.env.RENDER_SERVICE_NAME) {
    return 'https://' + process.env.RENDER_SERVICE_NAME + '.onrender.com';
  }

  // 4. Пробуем hostname сервера
  if (process.env.HOSTNAME && process.env.HOSTNAME.includes('render')) {
    return 'https://' + process.env.HOSTNAME + '.onrender.com';
  }

  // 5. Не нашли — будем пинговать локально
  return null;
}

let RENDER_URL = detectRenderURL();
let SUPABASE_CONNECTED = false;

// =============================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================
const app = express();
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
// ПРОВЕРКА ПОДКЛЮЧЕНИЯ SUPABASE
// =============================================
async function checkSupabase() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[SUPABASE] ❌ Ошибка подключения:', error.message);
      SUPABASE_CONNECTED = false;
      return false;
    }

    SUPABASE_CONNECTED = true;
    return true;
  } catch (e) {
    console.error('[SUPABASE] ❌ Не удалось подключиться:', e.message);
    SUPABASE_CONNECTED = false;
    return false;
  }
}

// =============================================
// PING ФУНКЦИЯ (универсальная)
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
// KEEP-ALIVE CRON
// =============================================
cron.schedule('*/4 * * * *', () => {
  // Каждые 4 минуты пингуем чтобы не заснул
  if (RENDER_URL) {
    pingServer(RENDER_URL);
  } else {
    // Пробуем переопределить URL (может Render проставил переменные позже)
    RENDER_URL = detectRenderURL();
    if (RENDER_URL) {
      console.log(`[CRON] 🔍 Render URL найден: ${RENDER_URL}`);
      pingServer(RENDER_URL);
    } else {
      // Пингуем локально
      pingServer(`http://localhost:${PORT}`);
    }
  }
});

// Очистка просроченных дуэлей
cron.schedule('* * * * *', async () => {
  try {
    await supabase.rpc('cleanup_expired_duels');
  } catch (e) { }
});

// Периодическая проверка Supabase
cron.schedule('*/10 * * * *', async () => {
  const was = SUPABASE_CONNECTED;
  await checkSupabase();
  if (!was && SUPABASE_CONNECTED) {
    console.log('[SUPABASE] ✅ Переподключение успешно');
  } else if (was && !SUPABASE_CONNECTED) {
    console.log('[SUPABASE] ❌ Соединение потеряно');
  }
});

// =============================================
// EXPRESS
// =============================================
app.get('/', (req, res) => {
  res.json({
    bot: 'TYPEWAR',
    status: 'active',
    supabase: SUPABASE_CONNECTED ? 'connected' : 'disconnected',
    render_url: RENDER_URL || 'not detected',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'alive',
    supabase: SUPABASE_CONNECTED,
    uptime: Math.floor(process.uptime())
  });
});

// =============================================
// ЗАПУСК СЕРВЕРА + ДИАГНОСТИКА
// =============================================
app.listen(PORT, async () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💀  TYPEWAR BOT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Проверка Supabase
  const sbOk = await checkSupabase();
  if (sbOk) {
    console.log(`[SUPABASE] ✅ Подключён`);
    console.log(`[SUPABASE] 🔗 ${SUPABASE_URL}`);
  } else {
    console.log(`[SUPABASE] ❌ НЕ подключён`);
    console.log(`[SUPABASE] 🔗 ${SUPABASE_URL}`);
    console.log(`[SUPABASE] ⚠️  Проверь ключ и URL`);
  }

  console.log('');

  // Определение URL
  RENDER_URL = detectRenderURL();
  if (RENDER_URL) {
    console.log(`[RENDER]   ✅ Ссылка найдена`);
    console.log(`[RENDER]   🔗 ${RENDER_URL}`);
    console.log(`[RENDER]   📡 Пингую: ${RENDER_URL}/health`);
    // Первый пинг
    setTimeout(() => pingServer(RENDER_URL), 3000);
  } else {
    console.log(`[RENDER]   ⚠️  Ссылка не найдена`);
    console.log(`[RENDER]   📡 Пингую: http://localhost:${PORT}/health`);
    console.log(`[RENDER]   💡 Подсказка: добавь RENDER_EXTERNAL_HOSTNAME или RENDER_URL в env`);
  }

  console.log('');

  // Инфа о среде
  console.log(`[SERVER]   🌐 Порт: ${PORT}`);
  console.log(`[SERVER]   📦 Node: ${process.version}`);
  console.log(`[SERVER]   💻 Platform: ${os.platform()}`);
  console.log(`[SERVER]   🧠 Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB free`);

  // Render env debug
  if (process.env.RENDER) {
    console.log(`[RENDER]   🏷  Service: ${process.env.RENDER_SERVICE_NAME || 'unknown'}`);
    console.log(`[RENDER]   🏷  Instance: ${process.env.RENDER_INSTANCE_ID || 'unknown'}`);
  }

  console.log('');
  console.log('[BOT]      ⚡ Polling started');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💀  TYPEWAR READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// =============================================
// ТЕКСТЫ ДЛЯ ДУЭЛЕЙ И ТЕСТОВ
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
  'Быстрые пальцы решают кто станет победителем этой дуэли сегодня',
  'Вселенная бесконечна и полна тайн которые человечество только начинает разгадывать',
  'Музыка это язык который понимают все люди независимо от национальности',
  'Зимой снег покрывает землю белым одеялом и всё вокруг становится тихим',
  'Чтение книг развивает воображение и расширяет кругозор любого человека',
  'Спорт и движение помогают сохранять здоровье и бодрость духа каждый день'
];

// =============================================
// ТРОЛЛИНГ
// =============================================
const TROLL_MESSAGES = {
  slow: [
    '🐌 ты это печатал ногами?',
    '🦥 мой дед быстрее печатает... а ему 90',
    '🐢 черепаха одобряет твою скорость',
    '💀 я уснул пока ты печатал',
    '🪦 R.I.P. скорость',
    '🧊 ты случайно не замёрз?',
    '📠 факс быстрее отправит',
    '🦴 археологи нашли твоё сообщение',
    '🐌 улитка просила не сравнивать с тобой',
    '😴 я подожду пока ты допечатаешь...',
    '🏚️ пока ты печатал, дом построили',
    '⏳ я тут состарился'
  ],
  normal: [
    '😐 сойдёт',
    '🙄 видали и лучше',
    '👀 неплохо, но не впечатляет',
    '📝 средний результат, работай над собой',
    '🤷 ну такое...',
    '⚡ есть потенциал',
    '🎯 стабильно, но скучно',
    '💤 не усыпи меня своей скоростью'
  ],
  fast: [
    '🔥 быстрые пальцы!',
    '⚡ ты точно не бот?',
    '👀 подозрительно быстро...',
    '🚀 клавиатура в огне!',
    '💨 тут кто-то торопится',
    '🏎️ формула один одобряет',
    '⌨️ клавиатура просит пощады',
    '🔥 пальцы дымятся!'
  ],
  god: [
    '👑 МАШИНА!',
    '🤖 это точно не автокликер?',
    '💀 ты сломал систему',
    '🏆 легенда клавиатуры',
    '⚡ НЕЧЕЛОВЕЧЕСКАЯ СКОРОСТЬ',
    '🔥🔥🔥 БЕЗУМИЕ',
    '👾 ты из матрицы?',
    '💀 клавиатура написала завещание',
    '🛸 ты точно с этой планеты?'
  ]
};

const WPM_UP_MESSAGES = [
  '📈 рекорд обновлён!',
  '🔥 новый личный рекорд!',
  '⚡ ты стал быстрее!',
  '💪 прогресс!',
  '🚀 скорость растёт!',
  '📊 новый максимум!'
];

const EVENT_MESSAGES = [
  '⚡ ВНИМАНИЕ! Проверка скорости активирована!\nСледующее сообщение будет измерено!',
  '🎯 SPEED CHECK! Покажи на что способен!\nПиши следующее сообщение быстро!',
  '💀 TYPEWAR ВЫЗОВ! Следующее сообщение покажет твою реальную скорость!',
  '🔥 РЕЖИМ ТУРБО! Следующее сообщение = твой WPM!'
];

// =============================================
// УТИЛИТЫ
// =============================================
function calculateWPM(chars, seconds) {
  if (seconds <= 0) return 0;
  return Math.round((chars / 5) / (seconds / 60));
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTrollCategory(wpm) {
  if (wpm < 20) return 'slow';
  if (wpm < 50) return 'normal';
  if (wpm < 100) return 'fast';
  return 'god';
}

function esc(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getWpmEmoji(wpm) {
  if (wpm < 15) return '🐌';
  if (wpm < 25) return '🐢';
  if (wpm < 40) return '🚶';
  if (wpm < 60) return '🏃';
  if (wpm < 80) return '🚗';
  if (wpm < 100) return '🚀';
  if (wpm < 150) return '⚡';
  return '👑';
}

function getRank(wpm) {
  if (wpm < 15) return 'Улитка';
  if (wpm < 25) return 'Черепаха';
  if (wpm < 40) return 'Пешеход';
  if (wpm < 60) return 'Бегун';
  if (wpm < 80) return 'Гонщик';
  if (wpm < 100) return 'Ракета';
  if (wpm < 150) return 'Молния';
  return 'Легенда';
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
      mx[j][i] = Math.min(
        mx[j][i - 1] + 1,
        mx[j - 1][i] + 1,
        mx[j - 1][i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return 1 - mx[b.length][a.length] / Math.max(a.length, b.length);
}

function defaultSettings() {
  return {
    trolling_enabled: true,
    duels_enabled: true,
    events_enabled: true,
    min_chars: 15,
    cooldown_seconds: 3,
    max_wpm_limit: 300,
    troll_chance: 0.15
  };
}

// =============================================
// БАЗА ДАННЫХ
// =============================================
async function ensureUser(from) {
  try {
    await supabase.from('users').upsert({
      user_id: from.id,
      username: from.username || null,
      first_name: from.first_name || null
    }, { onConflict: 'user_id' });
  } catch (e) {
    console.error('[DB] ensureUser:', e.message);
  }
}

async function getUserState(userId, chatId) {
  try {
    const { data } = await supabase
      .from('user_state').select('*')
      .eq('user_id', userId).eq('chat_id', chatId).single();
    return data;
  } catch (e) { return null; }
}

async function updateUserState(userId, chatId, text, cooldownSec = 3) {
  try {
    await supabase.from('user_state').upsert({
      user_id: userId,
      chat_id: chatId,
      last_message_time: new Date().toISOString(),
      last_message_length: text.length,
      last_message_text: text.substring(0, 300),
      cooldown_until: new Date(Date.now() + cooldownSec * 1000).toISOString()
    }, { onConflict: 'user_id,chat_id' });
  } catch (e) {
    console.error('[DB] updateState:', e.message);
  }
}

async function getChatStatsForUser(chatId, userId) {
  try {
    const { data } = await supabase
      .from('chat_stats').select('*')
      .eq('chat_id', chatId).eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

async function updateChatStats(chatId, userId, wpm) {
  try {
    const { error } = await supabase.rpc('update_chat_stats', {
      p_chat_id: chatId, p_user_id: userId, p_wpm: wpm
    });
    if (error) console.error('[DB] updateChatStats:', error.message);
  } catch (e) {
    console.error('[DB] updateChatStats:', e.message);
  }
}

async function getChatTop(chatId, limit = 10) {
  try {
    const { data } = await supabase
      .from('chat_stats')
      .select('user_id, best_wpm, avg_wpm, messages_count, last_wpm')
      .eq('chat_id', chatId)
      .order('best_wpm', { ascending: false })
      .limit(limit);
    return data || [];
  } catch (e) { return []; }
}

async function getUserInfo(userId) {
  try {
    const { data } = await supabase
      .from('users').select('*').eq('user_id', userId).single();
    return data;
  } catch (e) { return null; }
}

async function getChatSettings(chatId) {
  try {
    const { data, error } = await supabase
      .from('chat_settings').select('*')
      .eq('chat_id', chatId).single();
    if (error && error.code === 'PGRST116') {
      const { data: d } = await supabase
        .from('chat_settings')
        .upsert({ chat_id: chatId }, { onConflict: 'chat_id' })
        .select().single();
      return d || defaultSettings();
    }
    return data || defaultSettings();
  } catch (e) { return defaultSettings(); }
}

async function setChatSetting(chatId, key, value) {
  try {
    const u = { chat_id: chatId };
    u[key] = value;
    await supabase.from('chat_settings').upsert(u, { onConflict: 'chat_id' });
  } catch (e) { }
}

// =============================================
// ДУЭЛИ
// =============================================
async function createDuel(chatId, user1Id) {
  try {
    const { data } = await supabase.from('duels').insert({
      chat_id: chatId, user1_id: user1Id,
      duel_text: rand(DUEL_TEXTS), status: 'pending',
      expires_at: new Date(Date.now() + 120000).toISOString()
    }).select().single();
    return data;
  } catch (e) { return null; }
}

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

async function submitDuelResult(duelId, userId, wpm) {
  try {
    const { data: duel } = await supabase.from('duels').select('*').eq('id', duelId).single();
    if (!duel) return null;
    const update = {};
    if (duel.user1_id === userId) {
      update.user1_wpm = wpm; update.user1_finished = true;
      update.user1_time = new Date().toISOString();
    } else if (duel.user2_id === userId) {
      update.user2_wpm = wpm; update.user2_finished = true;
      update.user2_time = new Date().toISOString();
    } else return null;

    const u1 = duel.user1_id === userId ? true : duel.user1_finished;
    const u2 = duel.user2_id === userId ? true : duel.user2_finished;
    if (u1 && u2) {
      const w1 = duel.user1_id === userId ? wpm : duel.user1_wpm;
      const w2 = duel.user2_id === userId ? wpm : duel.user2_wpm;
      update.winner_id = w1 > w2 ? duel.user1_id : w2 > w1 ? duel.user2_id : null;
      update.status = 'finished';
    }
    const { data } = await supabase.from('duels')
      .update(update).eq('id', duelId).select().single();
    return data;
  } catch (e) { return null; }
}

// =============================================
// ИВЕНТЫ
// =============================================
async function createEvent(chatId, userId) {
  try {
    const { data } = await supabase.from('active_events').insert({
      chat_id: chatId, user_id: userId,
      event_type: 'speed_check', active: true,
      expires_at: new Date(Date.now() + 60000).toISOString()
    }).select().single();
    return data;
  } catch (e) { return null; }
}

async function getActiveEvent(chatId, userId) {
  try {
    const { data } = await supabase.from('active_events').select('*')
      .eq('chat_id', chatId).eq('user_id', userId).eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).single();
    return data;
  } catch (e) { return null; }
}

async function deactivateEvent(id) {
  try {
    await supabase.from('active_events').update({ active: false }).eq('id', id);
  } catch (e) { }
}

// =============================================
// /start — В ЛИЧКЕ
// =============================================
bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  await ensureUser(msg.from);

  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR</b> активен

я считаю твою скорость печати

⌨️ <b>WPM</b> • ⚔️ <b>дуэли</b> • 🏆 <b>рейтинг</b>

добавь меня в чат и узнай,
кто здесь самый быстрый

━━━━━━━━━━━━━━━

📋 <b>Команды:</b>
/wpm — твой профиль и статистика
/top — рейтинг чата
/duel — вызвать на дуэль
/test — тест скорости
/profile — подробный профиль
/settings — настройки чата (админ)
/help — справка

━━━━━━━━━━━━━━━

<i>скорость считается автоматически
по сообщениям в чате</i>
  `, { parse_mode: 'HTML' });
});

// =============================================
// ДОБАВЛЕНИЕ В ЧАТ
// =============================================
bot.on('new_chat_members', async (msg) => {
  const me = await bot.getMe();
  if (!msg.new_chat_members.some(m => m.id === me.id)) return;

  await getChatSettings(msg.chat.id);

  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR</b> активирован

считаю скорость печати (WPM)
⚔️ дуэли • 🏆 рейтинг • ⚡ проверки

━━━━━━━━━━━━━━━

для лучшей работы выдайте права администратора
<i>(не обязательно — просто для отличия от фейков)</i>

━━━━━━━━━━━━━━━

📋 <b>Команды:</b>
/wpm — статистика
/top — рейтинг чата
/duel — дуэль
/test — тест скорости
/profile — профиль
/settings — настройки
  `, { parse_mode: 'HTML' });
});

// =============================================
// /wpm
// =============================================
bot.onText(/\/wpm/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  await ensureUser(msg.from);

  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '💀 Добавь меня в чат чтобы считать WPM', { parse_mode: 'HTML' });
    return;
  }

  const stats = await getChatStatsForUser(chatId, userId);

  if (!stats || stats.messages_count === 0) {
    bot.sendMessage(chatId, `💀 <b>${esc(getName(msg))}</b>\n\n📊 Пока нет данных\nПросто пиши в чат — я считаю автоматически`, {
      parse_mode: 'HTML', reply_to_message_id: msg.message_id
    });
    return;
  }

  bot.sendMessage(chatId, `
${getWpmEmoji(stats.best_wpm)} <b>${esc(getName(msg))}</b>

┌ 🏆 лучший: <b>${stats.best_wpm} WPM</b>
├ 📊 средний: <b>${Math.round(stats.avg_wpm)} WPM</b>
├ ⚡ последний: <b>${stats.last_wpm} WPM</b>
├ 💬 сообщений: <b>${stats.messages_count}</b>
└ 🎖 ранг: <b>${getRank(stats.best_wpm)}</b>

${getProgressBar(stats.best_wpm)} ${stats.best_wpm}/200
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /profile — ПОДРОБНЫЙ
// =============================================
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  await ensureUser(msg.from);

  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '💀 Профиль работает только в чатах', { parse_mode: 'HTML' });
    return;
  }

  const stats = await getChatStatsForUser(chatId, userId);
  const userInfo = await getUserInfo(userId);

  if (!stats || stats.messages_count === 0) {
    bot.sendMessage(chatId, `💀 <b>${esc(getName(msg))}</b>\n\n📊 Профиль пуст\nПиши в чат — данные появятся`, {
      parse_mode: 'HTML', reply_to_message_id: msg.message_id
    });
    return;
  }

  const top = await getChatTop(chatId, 50);
  let pos = '—';
  for (let i = 0; i < top.length; i++) {
    if (top[i].user_id === userId) { pos = `#${i + 1}`; break; }
  }

  const days = userInfo?.created_at
    ? Math.floor((Date.now() - new Date(userInfo.created_at).getTime()) / 86400000)
    : 0;

  bot.sendMessage(chatId, `
━━━━━━━━━━━━━━━
${getWpmEmoji(stats.best_wpm)} <b>ПРОФИЛЬ</b>
━━━━━━━━━━━━━━━

👤 <b>${esc(getName(msg))}</b>
🎖 Ранг: <b>${getRank(stats.best_wpm)}</b>
🏅 Позиция: <b>${pos}</b>

━━━━━━━━━━━━━━━
⌨️ <b>СКОРОСТЬ</b>
━━━━━━━━━━━━━━━

🏆 Лучший: <b>${stats.best_wpm} WPM</b>
${getProgressBar(stats.best_wpm)}

📊 Средний: <b>${Math.round(stats.avg_wpm)} WPM</b>
${getProgressBar(Math.round(stats.avg_wpm))}

⚡ Последний: <b>${stats.last_wpm} WPM</b>

━━━━━━━━━━━━━━━
📈 <b>СТАТИСТИКА</b>
━━━━━━━━━━━━━━━

💬 Сообщений: <b>${stats.messages_count}</b>
📅 Дней в системе: <b>${days}</b>
🕐 Обновлено: <b>${new Date(stats.updated_at).toLocaleDateString('ru-RU')}</b>
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /top
// =============================================
bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') {
    bot.sendMessage(chatId, '🏆 Рейтинг только в чатах', { parse_mode: 'HTML' });
    return;
  }

  const top = await getChatTop(chatId, 15);
  if (!top.length) {
    bot.sendMessage(chatId, '🏆 <b>Рейтинг пуст</b>\n\nПишите в чат — я начну считать', { parse_mode: 'HTML' });
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  let text = '🏆 <b>TYPEWAR — ТОП ЧАТА</b>\n━━━━━━━━━━━━━━━\n\n';

  for (let i = 0; i < top.length; i++) {
    const e = top[i];
    const info = await getUserInfo(e.user_id);
    const name = getNameFromInfo(info);
    const medal = medals[i] || `<b>${i + 1}.</b>`;

    text += `${medal} ${esc(name)}\n`;
    text += `    ${getWpmEmoji(e.best_wpm)} <b>${e.best_wpm}</b> WPM  avg: ${Math.round(e.avg_wpm)}  msgs: ${e.messages_count}\n`;
    text += `    ${getProgressBar(e.best_wpm)}\n\n`;
  }

  text += '━━━━━━━━━━━━━━━\n<i>💬 пишите больше — рейтинг обновляется автоматически</i>';
  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// =============================================
// /duel
// =============================================
bot.onText(/\/duel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '⚔️ Дуэли только в чатах'); return; }

  const settings = await getChatSettings(chatId);
  if (!settings.duels_enabled) { bot.sendMessage(chatId, '⚔️ Дуэли отключены'); return; }

  await ensureUser(msg.from);
  const existing = await getActiveDuel(chatId);

  if (existing) {
    if (existing.status === 'pending' && existing.user1_id !== userId) {
      const duel = await acceptDuel(existing.id, userId);
      if (duel) {
        const u1 = await getUserInfo(duel.user1_id);
        const now = new Date().toISOString();

        await supabase.from('user_state').upsert({
          user_id: duel.user1_id, chat_id: chatId,
          last_message_time: now, last_message_length: 0,
          last_message_text: '__DUEL__:' + duel.duel_text
        }, { onConflict: 'user_id,chat_id' });

        await supabase.from('user_state').upsert({
          user_id: userId, chat_id: chatId,
          last_message_time: now, last_message_length: 0,
          last_message_text: '__DUEL__:' + duel.duel_text
        }, { onConflict: 'user_id,chat_id' });

        bot.sendMessage(chatId, `
⚔️ <b>ДУЭЛЬ НАЧАЛАСЬ!</b>
━━━━━━━━━━━━━━━

${esc(getNameFromInfo(u1))} ⚡ VS ⚡ ${esc(getName(msg))}

━━━━━━━━━━━━━━━
📝 <b>Напишите этот текст:</b>

<code>${duel.duel_text}</code>

━━━━━━━━━━━━━━━
⏱ 2 минуты! Перепишите быстрее!
        `, { parse_mode: 'HTML' });
        return;
      }
    }
    if (existing.user1_id === userId) {
      bot.sendMessage(chatId, '⚔️ Ты уже создал дуэль! Жди\n/cancel — отменить', { reply_to_message_id: msg.message_id });
    } else {
      bot.sendMessage(chatId, '⚔️ Дуэль уже идёт!', { reply_to_message_id: msg.message_id });
    }
    return;
  }

  const duel = await createDuel(chatId, userId);
  if (!duel) { bot.sendMessage(chatId, '❌ Ошибка'); return; }

  bot.sendMessage(chatId, `
⚔️ <b>${esc(getName(msg))}</b> вызывает на дуэль!

👊 Кто примет? Пиши /duel
⏱ Истекает через 2 минуты
  `, { parse_mode: 'HTML' });
});

// /cancel
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const duel = await getActiveDuel(chatId);
  if (!duel) { bot.sendMessage(chatId, 'Нет активных дуэлей'); return; }
  if (duel.user1_id !== msg.from.id && duel.status === 'pending') {
    bot.sendMessage(chatId, 'Только создатель может отменить'); return;
  }
  await supabase.from('duels').update({ status: 'cancelled' }).eq('id', duel.id);
  bot.sendMessage(chatId, '⚔️ Дуэль отменена');
});

// =============================================
// /test
// =============================================
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
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

<code>${testText}</code>

━━━━━━━━━━━━━━━
⏱ 2 минуты
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

// =============================================
// /settings
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
  bot.sendMessage(chatId, `
⚙️ <b>TYPEWAR — Настройки</b>
━━━━━━━━━━━━━━━

😈 Троллинг: <b>${s.trolling_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
⚔️ Дуэли: <b>${s.duels_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
⚡ Ивенты: <b>${s.events_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📏 Мин. символов: <b>${s.min_chars}</b>
⏱ Кулдаун: <b>${s.cooldown_seconds}с</b>
🚫 Макс WPM: <b>${s.max_wpm_limit}</b>
🎲 Шанс троллинга: <b>${Math.round(s.troll_chance * 100)}%</b>

━━━━━━━━━━━━━━━
/set_trolling on/off
/set_duels on/off
/set_events on/off
  `, { parse_mode: 'HTML' });
});

// Set команды
const boolVal = (v) => ['on', '1', 'true', 'да', 'вкл'].includes(v.toLowerCase());

bot.onText(/\/set_trolling (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  try { const m = await bot.getChatMember(chatId, msg.from.id); if (!['creator', 'administrator'].includes(m.status)) return; } catch (e) { }
  const on = boolVal(match[1]);
  await setChatSetting(chatId, 'trolling_enabled', on);
  bot.sendMessage(chatId, `😈 Троллинг: <b>${on ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/set_duels (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  try { const m = await bot.getChatMember(chatId, msg.from.id); if (!['creator', 'administrator'].includes(m.status)) return; } catch (e) { }
  const on = boolVal(match[1]);
  await setChatSetting(chatId, 'duels_enabled', on);
  bot.sendMessage(chatId, `⚔️ Дуэли: <b>${on ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/set_events (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  try { const m = await bot.getChatMember(chatId, msg.from.id); if (!['creator', 'administrator'].includes(m.status)) return; } catch (e) { }
  const on = boolVal(match[1]);
  await setChatSetting(chatId, 'events_enabled', on);
  bot.sendMessage(chatId, `⚡ Ивенты: <b>${on ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>`, { parse_mode: 'HTML' });
});

// =============================================
// /help
// =============================================
bot.onText(/\/help/, async (msg) => {
  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR — ПОМОЩЬ</b>
━━━━━━━━━━━━━━━

⌨️ <b>Как работает?</b>
Автоматически считаю WPM по сообщениям
Формула: (символы / 5) / (время в минутах)

━━━━━━━━━━━━━━━

📋 <b>Команды:</b>
/wpm — статистика
/profile — подробный профиль
/top — рейтинг чата
/duel — дуэль
/test — тест скорости
/cancel — отменить дуэль
/settings — настройки (админ)
/help — справка

━━━━━━━━━━━━━━━

⚔️ <b>Дуэли:</b>
1. /duel — создать
2. Соперник /duel — принять
3. Оба пишут текст
4. Победа быстрейшему

━━━━━━━━━━━━━━━

🎖 <b>Ранги:</b>
🐌 0-14  🐢 15-24  🚶 25-39
🏃 40-59  🚗 60-79  🚀 80-99
⚡ 100-149  👑 150+
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

  // =============================================
  // ДУЭЛЬ
  // =============================================
  const activeDuel = await getActiveDuel(chatId);
  if (activeDuel && activeDuel.status === 'active') {
    const isP = (activeDuel.user1_id === userId || activeDuel.user2_id === userId);
    if (isP) {
      const sim = calculateSimilarity(
        activeDuel.duel_text.toLowerCase().trim(),
        text.toLowerCase().trim()
      );
      if (sim >= 0.65) {
        let startTime;
        if (state && state.last_message_text && state.last_message_text.startsWith('__DUEL__:')) {
          startTime = new Date(state.last_message_time).getTime();
        } else {
          startTime = new Date(activeDuel.expires_at).getTime() - 120000;
        }

        const td = (Date.now() - startTime) / 1000;
        const wpm = Math.min(calculateWPM(text.length, td), settings.max_wpm_limit);
        const acc = Math.round(sim * 100);
        const result = await submitDuelResult(activeDuel.id, userId, wpm);

        if (result && result.status === 'finished') {
          const u1 = await getUserInfo(result.user1_id);
          const u2 = await getUserInfo(result.user2_id);
          const n1 = getNameFromInfo(u1), n2 = getNameFromInfo(u2);

          let wt;
          if (result.winner_id === null) wt = '🤝 <b>НИЧЬЯ!</b>';
          else {
            const wn = result.winner_id === result.user1_id ? n1 : n2;
            wt = `👑 Победитель: <b>${esc(wn)}</b>`;
          }

          bot.sendMessage(chatId, `
⚔️ <b>ДУЭЛЬ ЗАВЕРШЕНА!</b>
━━━━━━━━━━━━━━━

${esc(n1)}: <b>${result.user1_wpm} WPM</b>
${esc(n2)}: <b>${result.user2_wpm} WPM</b>

━━━━━━━━━━━━━━━
${wt}
          `, { parse_mode: 'HTML' });

          await updateChatStats(chatId, result.user1_id, result.user1_wpm);
          await updateChatStats(chatId, result.user2_id, result.user2_wpm);
        } else if (result) {
          bot.sendMessage(chatId,
            `✅ <b>${esc(getName(msg))}</b> финишировал!\n⚡ ${wpm} WPM • 🎯 ${acc}%\n\nЖдём второго...`,
            { parse_mode: 'HTML' }
          );
        }
        await updateUserState(userId, chatId, text, settings.cooldown_seconds);
        return;
      }
    }
  }

  // =============================================
  // ТЕСТ
  // =============================================
  if (state && state.last_message_text && state.last_message_text.startsWith('__TEST__:')) {
    const testText = state.last_message_text.replace('__TEST__:', '');
    const sim = calculateSimilarity(testText.toLowerCase().trim(), text.toLowerCase().trim());

    if (sim >= 0.65) {
      const td = (Date.now() - new Date(state.last_message_time).getTime()) / 1000;
      const wpm = Math.min(calculateWPM(text.length, td), settings.max_wpm_limit);
      const acc = Math.round(sim * 100);

      await updateUserState(userId, chatId, text, settings.cooldown_seconds);

      const oldStats = await getChatStatsForUser(chatId, userId);
      const wasRecord = !oldStats || wpm > (oldStats.best_wpm || 0);
      await updateChatStats(chatId, userId, wpm);

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
      return;
    }
  }

  // =============================================
  // АВТО WPM
  // =============================================

  // Фильтры
  if (text.length < settings.min_chars) {
    await updateUserState(userId, chatId, text, settings.cooldown_seconds);
    return;
  }
  if (state && state.last_message_text === text) return;
  if (/^(.)\1{5,}$/.test(text.replace(/\s/g, ''))) return;
  if (state && state.cooldown_until && Date.now() < new Date(state.cooldown_until).getTime()) {
    await updateUserState(userId, chatId, text, settings.cooldown_seconds);
    return;
  }

  // Считаем WPM
  if (state && state.last_message_time && !state.last_message_text?.startsWith('__')) {
    const td = (Date.now() - new Date(state.last_message_time).getTime()) / 1000;

    if (td >= 1 && td <= 300) {
      const wpm = calculateWPM(text.length, td);

      if (wpm > 0 && wpm <= settings.max_wpm_limit) {
        const oldStats = await getChatStatsForUser(chatId, userId);
        const oldBest = oldStats ? oldStats.best_wpm : 0;

        await updateChatStats(chatId, userId, wpm);

        // =============================================
        // 📈 РЕКОРД ПОБИТ — уведомление
        // =============================================
        if (wpm > oldBest && oldBest > 0) {
          const diff = wpm - oldBest;
          bot.sendMessage(chatId, `
📈 <b>${esc(getName(msg))}</b>

${getWpmEmoji(wpm)} WPM поднялся до <b>${wpm}</b>! (+${diff})
было: ${oldBest} → стало: <b>${wpm}</b>

${rand(WPM_UP_MESSAGES)}
          `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
        }
        // Первый замер
        else if (oldBest === 0 && (!oldStats || oldStats.messages_count === 0)) {
          bot.sendMessage(chatId, `
⚡ <b>${esc(getName(msg))}</b> — первый замер!

${getWpmEmoji(wpm)} <b>${wpm} WPM</b> • ${getRank(wpm)}

<i>продолжай писать — я слежу за скоростью</i>
          `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
        }

        // Ивент активный?
        const ae = await getActiveEvent(chatId, userId);
        if (ae) {
          await deactivateEvent(ae.id);
          bot.sendMessage(chatId, `
⚡ <b>РЕЗУЛЬТАТ ПРОВЕРКИ</b>
━━━━━━━━━━━━━━━
${getWpmEmoji(wpm)} <b>${esc(getName(msg))}</b>
скорость: <b>${wpm} WPM</b>
ранг: <b>${getRank(wpm)}</b>
${getProgressBar(wpm)}
          `, { parse_mode: 'HTML' });
        }

        // Троллинг
        if (settings.trolling_enabled && Math.random() < settings.troll_chance) {
          if (wpm <= oldBest || oldBest === 0) {
            bot.sendMessage(chatId, rand(TROLL_MESSAGES[getTrollCategory(wpm)]), {
              reply_to_message_id: msg.message_id
            });
          }
        }

        // Рандом ивент (3%)
        if (settings.events_enabled && Math.random() < 0.03) {
          const ev = await createEvent(chatId, userId);
          if (ev) {
            bot.sendMessage(chatId, `🎯 <b>${esc(getName(msg))}</b>\n\n${rand(EVENT_MESSAGES)}`, {
              parse_mode: 'HTML'
            });
          }
        }
      }
    }
  }

  await updateUserState(userId, chatId, text, settings.cooldown_seconds);
});

// =============================================
// ОШИБКИ
// =============================================
bot.on('polling_error', (e) => console.error('[BOT] Polling:', e.code, e.message));
bot.on('error', (e) => console.error('[BOT] Error:', e.message));
process.on('uncaughtException', (e) => console.error('[FATAL]', e.message));
process.on('unhandledRejection', (r) => console.error('[FATAL]', r));
