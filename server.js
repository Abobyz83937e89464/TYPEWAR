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
// Токен обновлен
const BOT_TOKEN = process.env.BOT_TOKEN || '8628280796:AAH3aZ0w7uQKvrx93y-AQGQAWrH80kKXHls';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mhblbxqwrjfxgnxnlmyk.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_yjHQeH6OCcPRAuwz_2wywQ_exPxYzmv';
const PORT = process.env.PORT || 3000;

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
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// РЕГИСТРАЦИЯ КОМАНД В МЕНЮ ТЕЛЕГРАМА
bot.setMyCommands([
  { command: '/wpm', description: 'Твоя статистика и WPM' },
  { command: '/top', description: 'Рейтинг чата' },
  { command: '/duel', description: 'Вызвать на дуэль (кто больше напишет)' },
  { command: '/test', description: 'Тест скорости (на точность)' },
  { command: '/profile', description: 'Подробный профиль' },
  { command: '/settings', description: 'Настройки чата (для админов)' },
  { command: '/help', description: 'Справка по боту' }
]).catch(err => console.error('[BOT] Ошибка установки команд:', err.message));

// =============================================
// ПРОВЕРКА ПОДКЛЮЧЕНИЯ SUPABASE
// =============================================
async function checkSupabase() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
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
  if (RENDER_URL) {
    pingServer(RENDER_URL);
  } else {
    RENDER_URL = detectRenderURL();
    if (RENDER_URL) {
      pingServer(RENDER_URL);
    } else {
      pingServer(`http://localhost:${PORT}`);
    }
  }
});

cron.schedule('* * * * *', async () => {
  try { await supabase.rpc('cleanup_expired_duels'); } catch (e) { }
});

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
  res.status(200).json({ status: 'alive', supabase: SUPABASE_CONNECTED, uptime: Math.floor(process.uptime()) });
});

// =============================================
// ЗАПУСК СЕРВЕРА
// =============================================
app.listen(PORT, async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💀  TYPEWAR BOT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sbOk = await checkSupabase();
  if (sbOk) console.log(`[SUPABASE] ✅ Подключён`);
  else console.log(`[SUPABASE] ❌ НЕ подключён`);

  RENDER_URL = detectRenderURL();
  if (RENDER_URL) {
    console.log(`[RENDER]   ✅ Ссылка найдена: ${RENDER_URL}`);
    setTimeout(() => pingServer(RENDER_URL), 3000);
  } else {
    console.log(`[RENDER]   ⚠️  Ссылка не найдена`);
  }

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
// ТРОЛЛИНГ И МЕССЕДЖИ
// =============================================
const TROLL_MESSAGES = {
  slow: ['🐌 ты это печатал ногами?', '🐢 черепаха одобряет твою скорость', '💀 я уснул пока ты печатал', '📠 факс быстрее отправит'],
  normal: ['😐 сойдёт', '🙄 видали и лучше', '👀 неплохо, но не впечатляет', '🤷 ну такое...'],
  fast: ['🔥 быстрые пальцы!', '⚡ ты точно не бот?', '🚀 клавиатура в огне!', '🏎️ формула один одобряет'],
  god: ['👑 МАШИНА!', '🤖 это точно не автокликер?', '⚡ НЕЧЕЛОВЕЧЕСКАЯ СКОРОСТЬ', '💀 клавиатура написала завещание']
};

const WPM_UP_MESSAGES = ['📈 рекорд обновлён!', '🔥 новый личный рекорд!', '⚡ ты стал быстрее!', '💪 прогресс!', '🚀 скорость растёт!'];

// =============================================
// УТИЛИТЫ И АНТИ-ЧИТ
// =============================================
function calculateWPM(chars, seconds) {
  if (seconds <= 0) return 0;
  return Math.round((chars / 5) / (seconds / 60));
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
    trolling_enabled: true,
    duels_enabled: true,
    min_chars: 15,
    cooldown_seconds: 3,
    max_wpm_limit: 300,
    troll_chance: 0.15
  };
}

// 🛑 АНТИ-ЧИТ СИСТЕМА
function isGibberish(text) {
  // Исключаем 4+ одинаковых буквы подряд (аааа, ьььь)
  if (/(.)\1{3,}/.test(text)) return true;
  // Исключаем слова длиннее 20 символов без пробелов (явный спам по клаве)
  const words = text.trim().split(/\s+/);
  if (words.some(w => w.length > 20)) return true;
  // Исключаем 6 согласных подряд
  if (/[бвгджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxyz]{6,}/i.test(text)) return true;
  return false;
}

function getValidWordsCount(text) {
  if (isGibberish(text)) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
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

// Храним активные сессии дуэлей (подсчет сообщений) в памяти
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
      status: 'finished',
      user1_wpm: user1Score, 
      user2_wpm: user2Score,
      winner_id: winnerId
    }).eq('id', duelId);
  } catch (e) { }

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
// КОМАНДЫ
// =============================================
bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  await ensureUser(msg.from);
  bot.sendMessage(msg.chat.id, `
💀 <b>TYPEWAR</b> активен

я считаю твою скорость печати
⌨️ <b>WPM</b> • ⚔️ <b>дуэли</b> • 🏆 <b>рейтинг</b>

добавь меня в чат и узнай, кто здесь самый быстрый
  `, { parse_mode: 'HTML' });
});

bot.on('new_chat_members', async (msg) => {
  const me = await bot.getMe();
  if (!msg.new_chat_members.some(m => m.id === me.id)) return;
  await getChatSettings(msg.chat.id);
  bot.sendMessage(msg.chat.id, `💀 <b>TYPEWAR</b> активирован\n\nсчитаю WPM, провожу дуэли на скорость.`, { parse_mode: 'HTML' });
});

bot.onText(/\/wpm/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  await ensureUser(msg.from);
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '💀 Добавь меня в чат', { parse_mode: 'HTML' }); return; }
  const stats = await getChatStatsForUser(chatId, userId);
  if (!stats || stats.messages_count === 0) {
    bot.sendMessage(chatId, `💀 <b>${esc(getName(msg))}</b>\nПока нет данных`, { parse_mode: 'HTML', reply_to_message_id: msg.message_id }); return;
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

bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id; const userId = msg.from.id;
  await ensureUser(msg.from);
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '💀 Работает только в чатах'); return; }
  const stats = await getChatStatsForUser(chatId, userId);
  if (!stats || stats.messages_count === 0) { bot.sendMessage(chatId, `📊 Профиль пуст`); return; }
  bot.sendMessage(chatId, `
👤 <b>${esc(getName(msg))}</b>
🎖 Ранг: <b>${getRank(stats.best_wpm)}</b>
🏆 Лучший: <b>${stats.best_wpm} WPM</b>
📊 Средний: <b>${Math.round(stats.avg_wpm)} WPM</b>
💬 Сообщений: <b>${stats.messages_count}</b>
  `, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
});

bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '🏆 Только в чатах'); return; }
  const top = await getChatTop(chatId, 15);
  if (!top.length) { bot.sendMessage(chatId, '🏆 <b>Рейтинг пуст</b>', { parse_mode: 'HTML' }); return; }
  let text = '🏆 <b>TYPEWAR — ТОП ЧАТА</b>\n━━━━━━━━━━━━━━━\n\n';
  const medals = ['🥇', '🥈', '🥉'];
  for (let i = 0; i < top.length; i++) {
    const e = top[i]; const info = await getUserInfo(e.user_id);
    const medal = medals[i] || `<b>${i + 1}.</b>`;
    text += `${medal} ${esc(getNameFromInfo(info))}\n    ${getWpmEmoji(e.best_wpm)} <b>${e.best_wpm}</b> WPM  (msg: ${e.messages_count})\n`;
  }
  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// =============================================
// НОВАЯ СИСТЕМА ДУЭЛЕЙ
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
      bot.sendMessage(chatId, '⚔️ Ты уже создал дуэль! Жди соперника.\n/cancel — отменить', { reply_to_message_id: msg.message_id });
    } else {
      bot.sendMessage(chatId, '⚔️ Дуэль уже идёт!', { reply_to_message_id: msg.message_id });
    }
    return;
  }

  // Создание дуэли - выбор количества слов
  bot.sendMessage(chatId, `⚔️ <b>Выбери минимальное количество слов в сообщении:</b>`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '1 слово', callback_data: 'd_min_1' }, { text: '2 слова (ты рак)', callback_data: 'd_min_2' }],
        [{ text: '3 слова', callback_data: 'd_min_3' }, { text: '5 слов', callback_data: 'd_min_5' }]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  if (!query.data.startsWith('d_min_')) return;
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const minWords = parseInt(query.data.split('_')[2]);

  const existing = await getActiveDuel(chatId);
  if (existing) {
    bot.answerCallbackQuery(query.id, { text: 'Дуэль уже создана или идет!', show_alert: true });
    return;
  }

  bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

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
    bot.answerCallbackQuery(query.id);
  } catch(e) { }
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const duel = await getActiveDuel(chatId);
  if (!duel) { bot.sendMessage(chatId, 'Нет активных дуэлей'); return; }
  if (duel.user1_id !== msg.from.id && duel.status === 'pending') { bot.sendMessage(chatId, 'Только создатель может отменить'); return; }
  await supabase.from('duels').update({ status: 'cancelled' }).eq('id', duel.id);
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

  // Убрал <code>, чтобы нельзя было скопировать одним кликом
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
// /settings
// =============================================
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === 'private') { bot.sendMessage(chatId, '⚙️ Только в чатах'); return; }
  try {
    const m = await bot.getChatMember(chatId, msg.from.id);
    if (!['creator', 'administrator'].includes(m.status)) { bot.sendMessage(chatId, '⚙️ Только для админов', { reply_to_message_id: msg.message_id }); return; }
  } catch (e) { }
  const s = await getChatSettings(chatId);
  bot.sendMessage(chatId, `
⚙️ <b>TYPEWAR — Настройки</b>
━━━━━━━━━━━━━━━
😈 Троллинг: <b>${s.trolling_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
⚔️ Дуэли: <b>${s.duels_enabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>
📏 Мин. символов: <b>${s.min_chars}</b>
⏱ Кулдаун: <b>${s.cooldown_seconds}с</b>
🚫 Макс WPM: <b>${s.max_wpm_limit}</b>

━━━━━━━━━━━━━━━
/set_trolling on/off
/set_duels on/off
  `, { parse_mode: 'HTML' });
});

const boolVal = (v) => ['on', '1', 'true', 'да', 'вкл'].includes(v.toLowerCase());
bot.onText(/\/set_trolling (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  try { const m = await bot.getChatMember(chatId, msg.from.id); if (!['creator', 'administrator'].includes(m.status)) return; } catch (e) { }
  const on = boolVal(match[1]); await setChatSetting(chatId, 'trolling_enabled', on);
  bot.sendMessage(chatId, `😈 Троллинг: <b>${on ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/set_duels (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  try { const m = await bot.getChatMember(chatId, msg.from.id); if (!['creator', 'administrator'].includes(m.status)) return; } catch (e) { }
  const on = boolVal(match[1]); await setChatSetting(chatId, 'duels_enabled', on);
  bot.sendMessage(chatId, `⚔️ Дуэли: <b>${on ? '✅ ВКЛ' : '❌ ВЫКЛ'}</b>`, { parse_mode: 'HTML' });
});

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
/cancel — отменить дуэль
/settings — настройки
  `, { parse_mode: 'HTML' });
});

// =============================================
// СЕКРЕТНАЯ КОМАНДА СОЗДАТЕЛЯ (Morpheusov)
// =============================================
const CREATOR_ID = 8503291981; 

bot.onText(/\/null_rating\s+@?([\w]+)(?:\s+(\d+))?/, async (msg, match) => {
  if (msg.from.id !== CREATOR_ID) return;
  const chatId = msg.chat.id;
  const target = match[1];
  const val = match[2] ? parseInt(match[2]) : 0;

  let targetUserId;
  
  if (/^\d+$/.test(target)) {
    targetUserId = parseInt(target);
  } else {
    try {
      const { data, error } = await supabase.from('users').select('user_id').ilike('username', target).limit(1).single();
      if (data) {
        targetUserId = data.user_id;
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ Пользователь @${target} не найден в БД.`, { reply_to_message_id: msg.message_id });
      return;
    }
  }

  if (!targetUserId) {
    bot.sendMessage(chatId, `❌ Не удалось определить ID пользователя @${target}.`, { reply_to_message_id: msg.message_id });
    return;
  }

  try {
    // Обнуляем или устанавливаем значение во всех чатах для этого юзера
    await supabase.from('chat_stats').update({
      best_wpm: val,
      avg_wpm: val,
      last_wpm: val,
      messages_count: val === 0 ? 0 : 1
    }).eq('user_id', targetUserId);

    bot.sendMessage(chatId, `✅ Рейтинг пользователя ${target} изменён на <b>${val} WPM</b> (глобально во всех чатах).`, { parse_mode: 'HTML', reply_to_message_id: msg.message_id });
  } catch (e) {
    bot.sendMessage(chatId, `❌ Ошибка при обновлении: ${e.message}`, { reply_to_message_id: msg.message_id });
  }
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
  // ДУЭЛЬ - Подсчет сообщений
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
    // В дуэли на спам мы не считаем WPM для базы, чтобы не портить стату рандомными обрывками
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
  
  if (text.length < settings.min_chars) {
    await updateUserState(userId, chatId, text, settings.cooldown_seconds);
    return;
  }
  
  // АНТИ-ЧИТ: Фильтруем спам, повторения и одинаковые буквы
  if (isGibberish(text)) {
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

    if (td >= 1 && td <= 300) {
      const wpm = calculateWPM(text.length, td);

      if (wpm > 0 && wpm <= settings.max_wpm_limit) {
        const oldStats = await getChatStatsForUser(chatId, userId);
        const oldBest = oldStats ? oldStats.best_wpm : 0;

        await updateChatStats(chatId, userId, wpm);

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

  await updateUserState(userId, chatId, text, settings.cooldown_seconds);
});

// =============================================
// ОШИБКИ
// =============================================
bot.on('polling_error', (e) => console.error('[BOT] Polling:', e.code, e.message));
bot.on('error', (e) => console.error('[BOT] Error:', e.message));
process.on('uncaughtException', (e) => console.error('[FATAL]', e.message));
process.on('unhandledRejection', (r) => console.error('[FATAL]', r));
