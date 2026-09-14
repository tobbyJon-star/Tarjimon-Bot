import { Telegraf, Markup } from 'telegraf';
import { translate } from '@vitalets/google-translate-api';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config = {
  // TOKENNI SHU FAYLGA YOZMANG: Render -> Settings -> Environment -> BOT_TOKEN
  botToken: process.env.BOT_TOKEN?.trim(),
  adminIds: (process.env.ADMIN_IDS || '8299255756').split(',').map((id) => id.trim()).filter(Boolean),
  rateLimitMs: Number(process.env.RATE_LIMIT_MS) || 700,
  mode: (process.env.RENDER_EXTERNAL_URL ? 'webhook' : (process.env.BOT_MODE || 'polling')).trim().toLowerCase(),
  port: Number(process.env.PORT) || 10000,
  webhookDomain: (process.env.WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '')
};
const BOT_TOKEN = config.botToken;
const RATE_LIMIT_MS = config.rateLimitMs;
const PAGE_SIZE = 12;
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const GAME_FILE = path.join(__dirname, 'data', 'game.json');
const adminIds = new Set(config.adminIds);

if (!BOT_TOKEN || BOT_TOKEN.includes('BU_YERGA') || BOT_TOKEN.includes('PASTE_')) {
  throw new Error('BOT_TOKEN topilmadi. Render Environment Variables yoki lokal terminal environment variable ichiga BOT_TOKEN kiriting.');
}

const languages = [
  ['uz', "O'zbek tili", '🇺🇿'], ['en', 'Ingliz tili', '🇬🇧'], ['ru', 'Rus tili', '🇷🇺'],
  ['tr', 'Turk tili', '🇹🇷'], ['ar', 'Arab tili', '🇸🇦'], ['de', 'Nemis tili', '🇩🇪'],
  ['fr', 'Fransuz tili', '🇫🇷'], ['es', 'Ispan tili', '🇪🇸'], ['it', 'Italyan tili', '🇮🇹'],
  ['pt', 'Portugal tili', '🇵🇹'], ['zh-CN', 'Xitoy tili', '🇨🇳'], ['ko', 'Koreys tili', '🇰🇷'],
  ['ja', 'Yapon tili', '🇯🇵'], ['hi', 'Hind tili', '🇮🇳'], ['fa', 'Fors tili', '🇮🇷'],
  ['kk', 'Qozoq tili', '🇰🇿'], ['ky', "Qirg'iz tili", '🇰🇬'], ['tg', 'Tojik tili', '🇹🇯'],
  ['tk', 'Turkman tili', '🇹🇲'], ['az', 'Ozarbayjon tili', '🇦🇿'], ['uk', 'Ukrain tili', '🇺🇦'],
  ['pl', 'Polyak tili', '🇵🇱'], ['nl', 'Niderland tili', '🇳🇱'], ['el', 'Yunon tili', '🇬🇷'],
  ['he', 'Ibroniy tili', '🇮🇱'], ['id', 'Indonez tili', '🇮🇩'], ['ms', 'Malay tili', '🇲🇾'],
  ['vi', 'Vyetnam tili', '🇻🇳'], ['th', 'Tay tili', '🇹🇭'], ['ro', 'Rumin tili', '🇷🇴'],
  ['hu', 'Venger tili', '🇭🇺'], ['cs', 'Chex tili', '🇨🇿'], ['sv', 'Shved tili', '🇸🇪'],
  ['da', 'Daniya tili', '🇩🇰'], ['no', 'Norveg tili', '🇳🇴'], ['fi', 'Fin tili', '🇫🇮'],
  ['bg', 'Bolgariya tili', '🇧🇬'], ['sr', 'Serb tili', '🇷🇸'], ['sk', 'Slovak tili', '🇸🇰'],
  ['sl', 'Sloven tili', '🇸🇮'], ['hr', 'Xorvat tili', '🇭🇷'], ['ca', 'Katalan tili', '🇪🇸'],
  ['et', 'Eston tili', '🇪🇪'], ['lv', 'Latish tili', '🇱🇻'], ['lt', 'Litva tili', '🇱🇹'],
  ['sw', 'Suahili tili', '🇰🇪'], ['af', 'Afrikaans', '🇿🇦'], ['sq', 'Alban tili', '🇦🇱'],
  ['am', 'Amxar tili', '🇪🇹'], ['hy', 'Arman tili', '🇦🇲'], ['be', 'Belarus tili', '🇧🇾'],
  ['bn', 'Bengal tili', '🇧🇩'], ['bs', 'Bosniya tili', '🇧🇦'], ['ceb', 'Sebuan tili', '🌐'],
  ['eo', 'Esperanto', '🌐'], ['ka', 'Gruzin tili', '🇬🇪'], ['gu', 'Gujarati tili', '🇮🇳'],
  ['ha', 'Hausa tili', '🌐'], ['is', 'Island tili', '🇮🇸'], ['ga', 'Irland tili', '🇮🇪'],
  ['jv', 'Yava tili', '🌐'], ['kn', 'Kannada tili', '🇮🇳'], ['la', 'Lotin tili', '🌐'],
  ['mk', 'Makedon tili', '🇲🇰'], ['ml', 'Malayalam tili', '🇮🇳'], ['mr', 'Marathi tili', '🇮🇳'],
  ['mn', "Mo'g'ul tili", '🇲🇳'], ['my', 'Myanma tili', '🇲🇲'], ['ne', 'Nepal tili', '🇳🇵'],
  ['pa', 'Panjob tili', '🇮🇳'], ['ps', 'Pashto tili', '🌐'], ['si', 'Singal tili', '🇱🇰'],
  ['so', 'Somali tili', '🌐'], ['ta', 'Tamil tili', '🇮🇳'], ['te', 'Telugu tili', '🇮🇳'],
  ['ur', 'Urdu tili', '🇵🇰'], ['cy', 'Uels tili', '🏴'], ['yi', 'Yidish tili', '🌐']
].map(([code, name, flag]) => ({ code, name, flag }));

const popularCodes = ['uz', 'en', 'ru', 'tr', 'ar', 'de', 'fr', 'zh-CN', 'ko', 'ja', 'es', 'it'];
const users = new Map();
const bot = new Telegraf(BOT_TOKEN);

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

const history = loadHistory();

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const accountStore = loadJson(USERS_FILE, { accounts: {}, telegramLinks: {} });
const gameStore = loadJson(GAME_FILE, { questions: [], active: false });

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function saveAccounts() {
  saveJson(USERS_FILE, accountStore);
}

function saveGame() {
  saveJson(GAME_FILE, gameStore);
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const actual = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function linkedAccount(userId) {
  const accountId = accountStore.telegramLinks[String(userId)];
  return accountId ? accountStore.accounts[accountId] : null;
}

function requireAccount(ctx) {
  if (linkedAccount(ctx.from.id)) return true;
  ctx.reply('Avval /start orqali ro\'yxatdan o\'ting yoki login qiling.');
  return false;
}

function saveHistory() {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addHistory(userId, original, result, source, target, targetCode, sourceCode) {
  const key = String(userId);
  if (!history[key]) history[key] = [];
  history[key].unshift({ id: crypto.randomUUID(), original, result, source, target, targetCode, sourceCode, at: new Date().toISOString(), saved: false });
  history[key] = history[key].slice(0, 20);
  saveHistory();
}

function isAdmin(userId) {
  return adminIds.has(String(userId));
}

function getLanguage(code) {
  return languages.find((language) => language.code.toLowerCase() === String(code).toLowerCase());
}

function findLanguages(query) {
  const value = query.trim().toLocaleLowerCase();
  return languages.filter((language) => !value || language.name.toLocaleLowerCase().includes(value) || language.code.toLowerCase().includes(value));
}

function getUser(id) {
  if (!users.has(id)) users.set(id, { source: null, target: 'en', searching: false, lastRequestAt: 0, flow: null, game: null });
  return users.get(id);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function likelyUzbek(text) {
  return /(^|\s)(salom|assalomu|men|man|sen|siz|biz|uchun|bilan|bugun|yaxshi|qaysi|til|tarjima|kerak|qil|qiling|qilmoq|bo'laman|bo'ladi|o'zbek)(\s|$)/iu.test(text);
}

async function translateText(text, targetCode, sourceCode) {
  const sourceHint = likelyUzbek(text) ? 'uz' : undefined;
  const result = await translate(text, { to: targetCode, ...((sourceCode || sourceHint) ? { from: sourceCode || sourceHint } : {}) });
  return {
    text: result.text,
    sourceCode: result.raw?.src || sourceHint || 'auto'
  };
}

async function createSpeech(text, languageCode) {
  const chunks = text.match(/.{1,180}(?:\s|$)/gu) || [text];
  const speechLanguages = {
    en: 'en-US', ru: 'ru-RU', tr: 'tr-TR', de: 'de-DE', fr: 'fr-FR',
    es: 'es-ES', it: 'it-IT', pt: 'pt-BR', zh: 'zh-CN', 'zh-CN': 'zh-CN',
    ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', uz: 'tr-TR'
  };
  const speechLanguage = speechLanguages[languageCode] || languageCode || 'en-US';
  const audioParts = [];
  for (const chunk of chunks) {
    const url = new URL('https://translate.google.com/translate_tts');
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('tl', speechLanguage);
    url.searchParams.set('q', chunk.trim());
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://translate.google.com/'
      }
    });
    if (!response.ok) throw new Error(`Ovoz xizmati javobi: ${response.status}`);
    audioParts.push(Buffer.from(await response.arrayBuffer()));
  }
  return Buffer.concat(audioParts);
}

function convertToVoice(audio) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '48k', '-vbr', 'on', '-ac', '1', '-f', 'ogg', 'pipe:1'
    ]);
    const output = [];
    const errors = [];
    ffmpeg.stdout.on('data', (chunk) => output.push(chunk));
    ffmpeg.stderr.on('data', (chunk) => errors.push(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(output));
      reject(new Error(`Voice formatiga o'tkazib bo'lmadi: ${Buffer.concat(errors).toString().slice(0, 180)}`));
    });
    ffmpeg.stdin.end(audio);
  });
}

async function downloadTelegramFile(ctx, fileId) {
  const url = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(url.href || url);
  if (!response.ok) throw new Error(`Telegram faylini yuklab bo'lmadi: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function recognizeImage(ctx, fileId) {
  const image = await downloadTelegramFile(ctx, fileId);
  const worker = await createWorker('eng+uzb+rus');
  try {
    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

async function translateAndReply(ctx, text) {
  const user = getUser(ctx.from.id);
  if (Date.now() - user.lastRequestAt < RATE_LIMIT_MS) {
    await ctx.reply('Iltimos, so\'rovlar orasida biroz kuting.');
    return;
  }
  user.lastRequestAt = Date.now();
  const target = getLanguage(user.target) || getLanguage('en');
  const status = await ctx.reply('⏳ Tarjima qilinmoqda...');
  try {
    const result = await translateText(text, target.code, user.source);
    const sourceLanguage = getLanguage(user.source);
    const sourceName = sourceLanguage?.name || getLanguage(result.sourceCode)?.name || 'Avto-aniqlangan til';
    addHistory(ctx.from.id, text, result.text, sourceName, target.name, target.code, user.source || result.sourceCode);
    const account = linkedAccount(ctx.from.id);
    if (account) {
      account.translations += 1;
      account.target = target.code;
      saveAccounts();
    }
    const output = `📥 <b>${escapeHtml(sourceName)}</b>  ➜  📤 <b>${escapeHtml(target.name)}</b>\n\n${escapeHtml(result.text)}`;
    const translationId = history[String(ctx.from.id)][0].id;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⭐ Saqlash', `translation:save:${translationId}`), Markup.button.callback('🔊 O\'qib berish', `translation:speak:${translationId}`)],
      [Markup.button.callback('🔄 Tilni o\'zgartirish', `languages:swap:${translationId}`), Markup.button.callback('🌐 Tillar ro\'yxati', 'languages:all:0')]
    ]);
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, output, { parse_mode: 'HTML', ...keyboard });
  } catch (error) {
    console.error('Tarjima xatosi:', error.message);
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, `❌ ${escapeHtml(error.message)}`, resultButtons());
  }
}

function label(code) {
  const language = getLanguage(code);
  return language ? `${language.flag} ${language.name}` : code;
}

function languageButtons(page = 0, popular = true, step = 'target') {
  const codes = popular ? popularCodes : languages.map((language) => language.code);
  const pageCount = Math.ceil(codes.length / PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(Number(page), pageCount - 1));
  const visible = codes.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const rows = [];

  for (let i = 0; i < visible.length; i += 2) {
    rows.push(visible.slice(i, i + 2).map((code) => {
      const language = getLanguage(code);
      return Markup.button.callback(`${language.flag} ${language.name.replace(' tili', '')}`, `language:${step}:${code}`);
    }));
  }

  const navigation = [];
  if (currentPage > 0) navigation.push(Markup.button.callback('⬅️', `languages:${step}:${popular ? 'popular' : 'all'}:${currentPage - 1}`));
  if (currentPage < pageCount - 1) navigation.push(Markup.button.callback('➡️', `languages:${step}:${popular ? 'popular' : 'all'}:${currentPage + 1}`));
  if (navigation.length) rows.push(navigation);
  rows.push([Markup.button.callback('📚 Barcha tillar', `languages:${step}:all:0`)]);
  rows.push([Markup.button.callback('🔎 Til qidirish', `languages:search:${step}`)]);
  return Markup.inlineKeyboard(rows);
}

function resultButtons() {
  return Markup.inlineKeyboard([[Markup.button.callback('🔄 Tilni o\'zgartirish', 'languages:popular'), Markup.button.callback('🌐 Tillar ro\'yxati', 'languages:all:0')]]);
}

async function showLanguages(ctx, type, page, step = 'target') {
  getUser(ctx.from.id).searching = false;
  const popular = type === 'popular';
  const user = getUser(ctx.from.id);
  const selected = step === 'source' ? user.source : user.target;
  const selectedLabel = selected ? label(selected) : 'Avto-aniqlash';
  const title = step === 'source' ? '1-qadam: Matn qaysi tilda?' : '2-qadam: Qaysi tilga tarjima qilinsin?';
  const text = `${title}\n\nTanlangan: <b>${escapeHtml(selectedLabel)}</b>`;
  const keyboard = languageButtons(page, popular, step);
  if (ctx.callbackQuery?.message) await safeEditMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
  else await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
}

function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👤 Profil', 'account:profile'), Markup.button.callback('🏆 Reyting', 'account:leaderboard')],
    [Markup.button.callback('🎮 O\'yin', 'game:start'), Markup.button.callback('⭐ Saqlanganlar', 'account:saved')],
    [Markup.button.callback('🌐 Til tanlash', 'languages:source:popular')],
    [Markup.button.callback('🆘 Yordam', 'help')]
  ]);
}

function welcomeText(account) {
  return `Assalomu alaykum, <b>${escapeHtml(account.firstName)} ${escapeHtml(account.lastName)}</b>!\n\n` +
    'Tarjima qiling, ball to\'plang va 20 savolli o\'yinda reytingga kiring.\n' +
    `Joriy nishon til: <b>${escapeHtml(label(account.target || 'en'))}</b>`;
}

function sendAuthMenu(ctx) {
  return ctx.reply('Botdan foydalanish uchun akkaunt yarating yoki mavjud akkauntga kiring:', authKeyboard());
}

function authKeyboard() {
  return Markup.keyboard([['📝 Register', '🔐 Login']]).resize().persistent();
}

function genderKeyboard() {
  return Markup.keyboard([['👨 Erkak', '👩 Ayol']]).resize().oneTime();
}

function contactKeyboard() {
  return Markup.keyboard([Markup.button.contactRequest('📱 Telegram raqamimni yuborish')]).resize().oneTime();
}

function removeReplyKeyboard() {
  return Markup.removeKeyboard();
}

async function editCallbackMessage(ctx, text, extra = {}) {
  if (!ctx.callbackQuery?.message) return ctx.reply(text, extra);
  return safeEditMessage(ctx, text, extra);
}

async function safeEditMessage(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (error) {
    if (error.response?.error_code === 400 && /message is not modified/i.test(error.response.description || '')) {
      return undefined;
    }
    throw error;
  }
}

bot.start(async (ctx) => {
  const account = linkedAccount(ctx.from.id);
  if (!account) return sendAuthMenu(ctx);
  await ctx.reply(welcomeText(account), { parse_mode: 'HTML', ...mainMenu() });
});

bot.action('auth:register', async (ctx) => {
  await ctx.answerCbQuery();
  getUser(ctx.from.id).flow = { type: 'register', step: 'name' };
  await ctx.reply('Ism va familyangizni bitta xabarda yuboring. Masalan: Ali Valiyev');
});

bot.action('auth:login', async (ctx) => {
  await ctx.answerCbQuery();
  getUser(ctx.from.id).flow = { type: 'login', step: 'name' };
  await ctx.reply('Register paytidagi ism va familyangizni yuboring.');
});

bot.hears('📝 Register', async (ctx) => {
  getUser(ctx.from.id).flow = { type: 'register', step: 'name' };
  await ctx.reply('Ism va familyangizni bitta xabarda yuboring. Masalan: Ali Valiyev');
});

bot.hears('🔐 Login', async (ctx) => {
  getUser(ctx.from.id).flow = { type: 'login', step: 'name' };
  await ctx.reply('Register paytidagi ism va familyangizni yuboring.');
});

bot.command('menu', async (ctx) => {
  if (!requireAccount(ctx)) return;
  await ctx.reply('Asosiy menyu:', mainMenu());
});

const helpText = `🆘 <b>Ellita Translate yordam</b>\n\n` +
  `Botdan foydalanish uchun matn yuboring — u tanlangan yo'nalishda tarjima qiladi.\n\n` +
  `📌 <b>Asosiy komandalar:</b>\n` +
  `/start — botni boshlash yoki akkauntga kirish\n` +
  `/menu — asosiy menyuga qaytish\n` +
  `/language — matn tilini tanlash\n` +
  `/languages — tarjima qilinadigan tilni tanlash\n` +
  `/history — tarjimalar tarixini ko'rish\n` +
  `/saved — saqlangan tarjimalarni ko'rish\n` +
  `/profile — profilingizni ko'rish\n` +
  `/leaderboard — reytingni ko'rish\n` +
  `/game — so'z o'yinini boshlash\n` +
  `/correct matn — matnni grammatik to'g'rilash\n` +
  `/logout — akkauntdan chiqish\n\n` +
  `🔄 Tarjima xabaridagi <b>Tilni o'zgartirish</b> tugmasi ikki tilni almashtiradi.\n` +
  `💡 Har qanday payt /menu deb yozsangiz, asosiy menyu qaytadi.`;

bot.command('help', async (ctx) => {
  await ctx.reply(helpText, { parse_mode: 'HTML', ...mainMenu() });
});

bot.command('logout', async (ctx) => {
  delete accountStore.telegramLinks[String(ctx.from.id)];
  saveAccounts();
  getUser(ctx.from.id).flow = null;
  await sendAuthMenu(ctx);
});

function accountLevel(points) {
  if (points >= 500) return 'Oltin';
  if (points >= 250) return 'Kumush';
  if (points >= 100) return 'Bronza';
  return 'Boshlovchi';
}

function profileText(account) {
  return `👤 <b>${escapeHtml(account.firstName)} ${escapeHtml(account.lastName)}</b>\n\n` +
    `⚧ Jins: ${escapeHtml(account.gender || 'Kiritilmagan')}\n📱 ${escapeHtml(account.phone)}\n🌐 Asosiy til: ${escapeHtml(label(account.target || 'en'))}\n` +
    `📚 Tarjimalar soni: <b>${account.translations}</b>\n⭐ Ball: <b>${account.points}</b>\n🏅 Daraja: <b>${accountLevel(account.points)}</b>`;
}

async function showProfile(ctx) {
  const account = linkedAccount(ctx.from.id);
  if (!account) return sendAuthMenu(ctx);
  await editCallbackMessage(ctx, profileText(account), { parse_mode: 'HTML', ...mainMenu() });
}

async function showSaved(ctx) {
  const account = linkedAccount(ctx.from.id);
  if (!account) return sendAuthMenu(ctx);
  const items = account.saved || [];
  if (!items.length) return editCallbackMessage(ctx, '⭐ Saqlangan tarjimalar hozircha yo\'q.', mainMenu());
  const message = items.slice(-10).reverse().map((item, index) => `${index + 1}. ${item.original}\n➜ ${item.result}`).join('\n\n');
  await editCallbackMessage(ctx, `⭐ <b>Saqlangan tarjimalar</b>\n\n${escapeHtml(message)}`, { parse_mode: 'HTML', ...mainMenu() });
}

async function showLeaderboard(ctx) {
  const accounts = Object.values(accountStore.accounts).sort((a, b) => b.points - a.points).slice(0, 10);
  if (!accounts.length) return editCallbackMessage(ctx, 'Reyting hali bo\'sh.', mainMenu());
  const message = accounts.map((account, index) => `${index + 1}. ${account.firstName} ${account.lastName} — ${account.points} ball`).join('\n');
  await editCallbackMessage(ctx, `🏆 <b>Top 10 reyting</b>\n\n${escapeHtml(message)}`, { parse_mode: 'HTML', ...mainMenu() });
}

bot.action('account:profile', async (ctx) => { await ctx.answerCbQuery(); if (requireAccount(ctx)) await showProfile(ctx); });
bot.action('account:saved', async (ctx) => { await ctx.answerCbQuery(); if (requireAccount(ctx)) await showSaved(ctx); });
bot.action('account:leaderboard', async (ctx) => { await ctx.answerCbQuery(); if (requireAccount(ctx)) await showLeaderboard(ctx); });
bot.command('profile', async (ctx) => { if (requireAccount(ctx)) await showProfile(ctx); });
bot.command('saved', async (ctx) => { if (requireAccount(ctx)) await showSaved(ctx); });
bot.command('leaderboard', async (ctx) => { if (requireAccount(ctx)) await showLeaderboard(ctx); });

function correctGrammar(text) {
  let corrected = text.trim().replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])(?=[^\s])/g, '$1 ');
  corrected = corrected.replace(/\bi\b/g, 'I');
  if (corrected) corrected = corrected[0].toLocaleUpperCase() + corrected.slice(1);
  if (corrected && !/[.!?]$/.test(corrected)) corrected += '.';
  return corrected;
}

bot.command('correct', async (ctx) => {
  if (!requireAccount(ctx)) return;
  const text = ctx.message.text.replace(/^\/correct\s*/i, '').trim();
  if (!text) return ctx.reply('Foydalanish: /correct Men bugun maktabga bordim');
  await ctx.reply(`✍️ <b>Tuzatilgan matn:</b>\n${escapeHtml(correctGrammar(text))}`, { parse_mode: 'HTML' });
});

bot.action(/^translation:save:(.+)$/, async (ctx) => {
  if (!requireAccount(ctx)) return ctx.answerCbQuery();
  const account = linkedAccount(ctx.from.id);
  const item = (history[String(ctx.from.id)] || []).find((entry) => entry.id === ctx.match[1]);
  if (!item) return ctx.answerCbQuery('Tarjima topilmadi.', { show_alert: true });
  account.saved = account.saved || [];
  if (!account.saved.some((entry) => entry.id === item.id)) account.saved.push(item);
  item.saved = true;
  saveAccounts();
  saveHistory();
  await ctx.answerCbQuery('⭐ Saqlandi');
});

bot.action(/^translation:speak:(.+)$/, async (ctx) => {
  if (!requireAccount(ctx)) return ctx.answerCbQuery();
  const item = (history[String(ctx.from.id)] || []).find((entry) => entry.id === ctx.match[1]);
  if (!item) return ctx.answerCbQuery('Tarjima topilmadi.', { show_alert: true });
  await ctx.answerCbQuery('🔊 Ovoz tayyorlanmoqda...');
  try {
    const targetLanguage = getLanguage(item.targetCode) || languages.find((language) => language.name === item.target);
    const audio = await createSpeech(item.result, targetLanguage?.code || 'en');
    const voice = await convertToVoice(audio);
    await ctx.replyWithVoice({ source: voice }, { caption: `🔊 ${item.target}` });
  } catch (error) {
    console.error('Ovoz xatosi:', error.message);
    await ctx.reply(`⚠️ Ovozli o\'qish ishlamadi: ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
  }
});

function gamePrompt(question, index) {
  return `🎮 <b>O\'yin ${index + 1}/20</b>\n\n${escapeHtml(question)}`;
}

bot.action(/^languages:swap:(.+)$/, async (ctx) => {
  if (!requireAccount(ctx)) return ctx.answerCbQuery();
  const item = (history[String(ctx.from.id)] || []).find((entry) => entry.id === ctx.match[1]);
  if (!item) return ctx.answerCbQuery('Tarjima topilmadi.', { show_alert: true });
  const oldSource = item.sourceCode || getLanguage(item.source)?.code || 'auto';
  const oldTarget = item.targetCode || getLanguage(item.target)?.code || 'en';
  if (oldSource === 'auto') return ctx.answerCbQuery('Bu tarjimada manba tili aniqlanmagan.', { show_alert: true });
  await ctx.answerCbQuery('🔄 Tillar almashtirilmoqda...');
  try {
    const result = await translateText(item.original, oldSource, oldTarget);
    const newSource = getLanguage(oldTarget) || getLanguage('en');
    const newTarget = getLanguage(oldSource) || getLanguage('en');
    item.result = result.text;
    item.source = newSource.name;
    item.target = newTarget.name;
    item.sourceCode = newSource.code;
    item.targetCode = newTarget.code;
    const user = getUser(ctx.from.id);
    user.source = newSource.code;
    user.target = newTarget.code;
    const account = linkedAccount(ctx.from.id);
    if (account) {
      account.target = newTarget.code;
      saveAccounts();
    }
    saveHistory();
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⭐ Saqlash', `translation:save:${item.id}`), Markup.button.callback('🔊 O\'qib berish', `translation:speak:${item.id}`)],
      [Markup.button.callback('🔄 Tilni o\'zgartirish', `languages:swap:${item.id}`), Markup.button.callback('🌐 Tillar ro\'yxati', 'languages:all:0')]
    ]);
    await ctx.editMessageText(`📥 <b>${escapeHtml(item.source)}</b>  ➜  📤 <b>${escapeHtml(item.target)}</b>\n\n${escapeHtml(item.result)}`, { parse_mode: 'HTML', ...keyboard });
  } catch (error) {
    await ctx.reply(`❌ ${escapeHtml(error.message)}`, { parse_mode: 'HTML' });
  }
});

async function startGame(ctx) {
  if (!requireAccount(ctx)) return;
  if (!gameStore.active || gameStore.questions.length < 20) return ctx.reply('Hozircha faol o\'yin yo\'q.');
  const user = getUser(ctx.from.id);
  user.game = { index: 0, score: 0 };
  await ctx.reply(gamePrompt(gameStore.questions[0].question, 0), { parse_mode: 'HTML' });
}

bot.action('game:start', async (ctx) => { await ctx.answerCbQuery(); await startGame(ctx); });
bot.command('game', startGame);

bot.command('gamecreate', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Bu buyruq faqat admin uchun.');
  getUser(ctx.from.id).flow = { type: 'gamecreate', questions: [] };
  await ctx.reply('20 ta savol yarating. Har birini quyidagi formatda yuboring:\nSavol | To\'g\'ri javob\n\n1-savolni yuboring.');
});

async function handleAuthFlow(ctx, text, flow) {
  const userId = String(ctx.from.id);
  const user = getUser(ctx.from.id);
  if (flow.type === 'adminsearch') {
    user.flow = null;
    return sendAdminUsers(ctx, text);
  }
  if (flow.type === 'register') {
    if (flow.step === 'name') {
      const parts = text.split(/\s+/);
      if (parts.length < 2) return ctx.reply('Iltimos, ism va familyani birga yuboring. Masalan: Ali Valiyev');
      flow.firstName = parts.shift();
      flow.lastName = parts.join(' ');
      flow.step = 'gender';
      return ctx.reply('Jinsingizni tanlang:', genderKeyboard());
    }
    if (flow.step === 'gender') {
      if (!['👨 Erkak', '👩 Ayol'].includes(text)) return ctx.reply('Iltimos, Erkak yoki Ayol tugmasini tanlang.', genderKeyboard());
      flow.gender = text.includes('Erkak') ? 'Erkak' : 'Ayol';
      flow.step = 'phone';
      return ctx.reply('Telegramdagi telefon raqamingizni yuborish uchun quyidagi tugmani bosing:', contactKeyboard());
    }
    if (flow.step === 'phone') {
      if (!/^\+?[0-9 ()-]{7,20}$/.test(text)) return ctx.reply('Telefon raqami noto\'g\'ri. Telegramdagi kontakt yuborish tugmasidan foydalaning.', contactKeyboard());
      flow.phone = text;
      flow.step = 'password';
      return ctx.reply('Parol yozing: jami 8 ta belgi, aynan 4 ta harf va 4 ta raqam. Masalan: Abcd1234');
    }
    const letterCount = (text.match(/[A-Za-z]/g) || []).length;
    const digitCount = (text.match(/\d/g) || []).length;
    if (!/^[A-Za-z\d]{8}$/.test(text) || letterCount !== 4 || digitCount !== 4) {
      return ctx.reply('Parol noto\'g\'ri. Aynan 4 ta harf va 4 ta raqamdan iborat 8 ta belgi kiriting.');
    }
    const nameKey = normalizeName(`${flow.firstName} ${flow.lastName}`);
    if (Object.values(accountStore.accounts).some((account) => account.nameKey === nameKey)) {
      return ctx.reply('Bu ism-familya bilan akkaunt mavjud. Login qilib ko\'ring: /start');
    }
    const id = crypto.randomUUID();
    accountStore.accounts[id] = {
      id, nameKey, firstName: flow.firstName, lastName: flow.lastName, gender: flow.gender, phone: flow.phone,
      password: hashPassword(text), target: 'en', translations: 0, points: 0, saved: [], createdAt: new Date().toISOString()
    };
    accountStore.telegramLinks[userId] = id;
    saveAccounts();
    user.target = accountStore.accounts[id].target;
    user.flow = null;
    await ctx.reply(`✅ Akkaunt yaratildi!\n\n${welcomeText(accountStore.accounts[id])}`, { parse_mode: 'HTML', ...removeReplyKeyboard() });
    return ctx.reply('Asosiy menyu:', mainMenu());
  }

  if (flow.type === 'login') {
    if (flow.step === 'name') {
      flow.nameKey = normalizeName(text);
      flow.step = 'password';
      return ctx.reply('Parolingizni yuboring.');
    }
    const account = Object.values(accountStore.accounts).find((entry) => entry.nameKey === flow.nameKey && verifyPassword(text, entry.password));
    if (!account) return ctx.reply('Ism-familya yoki parol noto\'g\'ri. Qaytadan urinib ko\'ring: /start');
    accountStore.telegramLinks[userId] = account.id;
    saveAccounts();
    user.target = account.target || 'en';
    user.flow = null;
    await ctx.reply(`✅ Akkauntga muvaffaqiyatli kirdingiz!\n\n${welcomeText(account)}`, { parse_mode: 'HTML', ...removeReplyKeyboard() });
    return ctx.reply('Asosiy menyu:', mainMenu());
  }

  if (flow.type === 'gamecreate') {
    const pair = text.split('|').map((part) => part.trim());
    if (pair.length !== 2 || !pair[0] || !pair[1]) return ctx.reply('Format: Savol | To\'g\'ri javob');
    flow.questions.push({ question: pair[0], answer: pair[1].toLocaleLowerCase() });
    if (flow.questions.length < 20) return ctx.reply(`${flow.questions.length}/20 qabul qilindi. Keyingi savolni yuboring.`);
    gameStore.questions = flow.questions;
    gameStore.active = true;
    saveGame();
    user.flow = null;
    return ctx.reply('✅ 20 ta savolli o\'yin yaratildi va foydalanuvchilar uchun ishga tushdi.');
  }
}

bot.on('contact', async (ctx) => {
  const user = getUser(ctx.from.id);
  const flow = user.flow;
  if (!flow || flow.type !== 'register' || flow.step !== 'phone') return;
  const contact = ctx.message.contact;
  if (contact.user_id && String(contact.user_id) !== String(ctx.from.id)) {
    return ctx.reply('Iltimos, o\'zingizning Telegram kontaktingizni yuboring.');
  }
  flow.phone = contact.phone_number.startsWith('+') ? contact.phone_number : `+${contact.phone_number}`;
  flow.step = 'password';
  await ctx.reply('Kontakt qabul qilindi ✅\nParol yozing: jami 8 ta belgi, aynan 4 ta harf va 4 ta raqam. Masalan: Abcd1234', removeReplyKeyboard());
});

async function handleGameAnswer(ctx, text, user) {
  const account = linkedAccount(ctx.from.id);
  const question = gameStore.questions[user.game.index];
  if (text.toLocaleLowerCase() === question.answer) {
    user.game.score += 10;
    account.points += 10;
    await ctx.reply('✅ To\'g\'ri! +10 ball');
  } else {
    await ctx.reply(`❌ Noto\'g\'ri. To\'g\'ri javob: ${escapeHtml(question.answer)}`);
  }
  user.game.index += 1;
  if (user.game.index >= 20) {
    const score = user.game.score;
    user.game = null;
    saveAccounts();
    return ctx.reply(`🎉 O\'yin tugadi! Natijangiz: ${score}/200 ball.`, mainMenu());
  }
  await ctx.reply(gamePrompt(gameStore.questions[user.game.index].question, user.game.index), { parse_mode: 'HTML' });
}

bot.command('language', (ctx) => showLanguages(ctx, 'popular', 0, 'source'));
bot.command('languages', (ctx) => showLanguages(ctx, 'all', 0, 'target'));
bot.action(/^languages:(source|target):(popular|all)(?::(\d+))?$/, async (ctx) => {
  await ctx.answerCbQuery();
  await showLanguages(ctx, ctx.match[2], ctx.match[3] || 0, ctx.match[1]);
});
bot.action(/^languages:(popular|all)(?::(\d+))?$/, async (ctx) => {
  await ctx.answerCbQuery();
  await showLanguages(ctx, ctx.match[1], ctx.match[2] || 0, 'target');
});
bot.action(/^languages:search:(source|target)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  user.languageStep = ctx.match[1];
  user.searching = true;
  user.languageMessageId = ctx.callbackQuery.message.message_id;
  await ctx.editMessageText(`${ctx.match[1] === 'source' ? '1-qadam: Matn tilini' : '2-qadam: Tarjima tilini'} yozing.\nMasalan: uz, English, русский.`);
});
bot.action('languages:search', async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  user.languageStep = 'target';
  user.searching = true;
  user.languageMessageId = ctx.callbackQuery.message.message_id;
  await ctx.editMessageText('Tarjima tilini yozing.\nMasalan: uz, English, русский.');
});
bot.action(/^language:(source|target):(.+)$/, async (ctx) => {
  const user = getUser(ctx.from.id);
  const step = ctx.match[1];
  const code = ctx.match[2];
  const selectedLanguage = getLanguage(code);
  if (!selectedLanguage) return ctx.answerCbQuery('Til topilmadi.', { show_alert: true });
  if (step === 'source') user.source = selectedLanguage.code;
  else {
    if (user.source === selectedLanguage.code) return ctx.answerCbQuery('Manba va tarjima tili bir xil bo\'lmasin.', { show_alert: true });
    user.target = selectedLanguage.code;
  }
  const account = linkedAccount(ctx.from.id);
  if (account && step === 'target') {
    account.target = selectedLanguage.code;
    saveAccounts();
  }
  await ctx.answerCbQuery(`${selectedLanguage.name} tanlandi`);
  if (step === 'source') return showLanguages(ctx, 'popular', 0, 'target');
  await safeEditMessage(ctx, `✅ <b>Tarjima yo'nalishi saqlandi</b>\n\n📥 ${escapeHtml(label(user.source))}  ➜  📤 ${escapeHtml(label(user.target))}\n\nEndi matn yuboring.`, { parse_mode: 'HTML' });
});

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, helpText, { parse_mode: 'HTML', ...mainMenu() });
});

bot.command('history', async (ctx) => {
  const items = history[String(ctx.from.id)] || [];
  if (!items.length) return ctx.reply('Tarjima tarixingiz hozircha bo\'sh.');
  const message = items.slice(0, 10).map((item, index) => `${index + 1}. ${item.original}\n   ➜ ${item.result}`).join('\n\n');
  await ctx.reply(`📚 <b>Tarjima tarixi</b>\n\n${escapeHtml(message)}`, { parse_mode: 'HTML' });
});

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Bu buyruq faqat admin uchun.');
  const usersWithHistory = Object.keys(history).length;
  const allItems = Object.values(history).flat();
  const totalTranslations = allItems.length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = allItems.filter((item) => item.at?.startsWith(today)).length;
  const languagesUsed = allItems.reduce((counts, item) => {
    counts[item.target] = (counts[item.target] || 0) + 1;
    return counts;
  }, {});
  const topLanguages = Object.entries(languagesUsed).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([language, count]) => `${language}: ${count}`).join(', ') || 'hali yo\'q';
  await ctx.reply(`🛠 <b>Ellita_translate admin panel</b>\n\n👥 Faol foydalanuvchilar: ${users.size}\n💾 Ro\'yxatdan o\'tganlar: ${Object.keys(accountStore.accounts).length}\n🌍 Jami tarjimalar: ${totalTranslations}\n📅 Bugungi tarjimalar: ${todayCount}\n🏆 Mashhur tillar: ${escapeHtml(topLanguages)}\n🖼 OCR: faol\n🎙 Ovozli funksiya: o\'chirilgan\n\nBuyruqlar:\n/broadcast Xabar\n/users\n/stats\n/gamecreate`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('👥 Ro\'yxatdan o\'tganlar', 'admin:users')]])
  });
});

bot.action('admin:users', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Faqat admin uchun.', { show_alert: true });
  await ctx.answerCbQuery();
  await sendAdminUsers(ctx, '');
});

bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Bu buyruq faqat admin uchun.');
  const allItems = Object.values(history).flat();
  const recent = allItems.slice(0, 5).map((item) => `• ${item.source} → ${item.target}: ${item.original.slice(0, 45)}`).join('\n') || 'Ma\'lumot yo\'q';
  await ctx.reply(`📊 <b>So\'nggi tarjimalar</b>\n\n${escapeHtml(recent)}`, { parse_mode: 'HTML' });
});

bot.command('users', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Bu buyruq faqat admin uchun.');
  await sendAdminUsers(ctx, '');
});

async function sendAdminUsers(ctx, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const accounts = Object.values(accountStore.accounts).filter((account) => {
    if (!normalizedQuery) return true;
    return `${account.firstName} ${account.lastName}`.toLocaleLowerCase().includes(normalizedQuery) ||
      String(account.phone || '').includes(normalizedQuery);
  });
  const details = accounts.slice(0, 50).map((account, index) =>
    `<b>${index + 1}. ${escapeHtml(account.firstName)} ${escapeHtml(account.lastName)}</b>\n` +
    `╰ ${escapeHtml(account.gender || 'Kiritilmagan')}  •  📱 ${escapeHtml(account.phone)}\n` +
    `   📚 ${account.translations} ta tarjima  •  ⭐ ${account.points} ball\n` +
    `   <code>ID: ${escapeHtml(account.id)}</code>`
  ).join('\n\n');
  const title = normalizedQuery ? `🔎 <b>Qidiruv natijalari</b>\n<code>${escapeHtml(query)}</code>` : '👥 <b>Ro\'yxatdan o\'tgan foydalanuvchilar</b>';
  const summary = `╭───────────────╮\n│  <b>JAMI</b>  <code>${accounts.length}</code> ta foydalanuvchi\n╰───────────────╯`;
  const content = details || '📭 Mos foydalanuvchi topilmadi.';
  await ctx.reply(`${title}\n\n${summary}\n\n${content}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔎 Yangi qidiruv', 'admin:search')]])
  });
}

bot.action('admin:search', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Faqat admin uchun.', { show_alert: true });
  await ctx.answerCbQuery();
  getUser(ctx.from.id).flow = { type: 'adminsearch' };
  await ctx.reply('Ism-familya yoki telefon raqamini yuboring.');
});

bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply('Bu buyruq faqat admin uchun.');
  const message = ctx.message.text.replace(/^\/broadcast\s*/i, '').trim();
  if (!message) return ctx.reply('Foydalanish: /broadcast Xabar matni');
  let sent = 0;
  for (const userId of users.keys()) {
    try { await ctx.telegram.sendMessage(userId, message); sent += 1; } catch (error) { console.error('Broadcast xatosi:', error.message); }
  }
  await ctx.reply(`✅ Xabar ${sent} ta foydalanuvchiga yuborildi.`);
});

bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.trim();
  if (!query) return ctx.answerInlineQuery([], { cache_time: 1, switch_pm_text: 'Tarjima uchun matn yozing', switch_pm_parameter: 'start' });
  const user = getUser(ctx.from.id);
  try {
    const target = getLanguage(user.target) || getLanguage('en');
    const result = await translateText(query, target.code);
    await ctx.answerInlineQuery([{
      type: 'article', id: `${ctx.inlineQuery.id}-translation`, title: `Tarjima: ${target.name}`,
      description: result.text, input_message_content: { message_text: result.text }
    }], { cache_time: 2, is_personal: true });
  } catch {
    await ctx.answerInlineQuery([], { cache_time: 1 });
  }
});

bot.on('photo', async (ctx) => {
  const status = await ctx.reply('🖼 Rasmdagi matn aniqlanmoqda...');
  try {
    const photos = ctx.message.photo;
    const text = await recognizeImage(ctx, photos[photos.length - 1].file_id);
    if (!text) throw new Error('Rasmda matn topilmadi.');
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, `📝 Rasm matni:\n${escapeHtml(text)}\n\n⏳ Tarjima qilinmoqda...`, { parse_mode: 'HTML' });
    await translateAndReply(ctx, text);
  } catch (error) {
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, `❌ Rasm tarjima qilinmadi: ${escapeHtml(error.message)}`);
  }
});

bot.on('text', async (ctx) => {
  const user = getUser(ctx.from.id);
  const text = ctx.message.text.trim();
  if (!text || text.startsWith('/')) return;

  if (user.flow) return handleAuthFlow(ctx, text, user.flow);
  if (!requireAccount(ctx)) return;
  if (user.game) return handleGameAnswer(ctx, text, user);

  if (user.searching) {
    user.searching = false;
    const matches = findLanguages(text).slice(0, 24);
    if (!matches.length) return ctx.reply('Til topilmadi. Boshqa nom yoki kod yuboring.');
    const rows = [];
    const step = user.languageStep || 'target';
    for (let i = 0; i < matches.length; i += 2) rows.push(matches.slice(i, i + 2).map((language) => Markup.button.callback(`${language.flag} ${language.name.replace(' tili', '')}`, `language:${step}:${language.code}`)));
    const keyboard = Markup.inlineKeyboard(rows);
    if (user.languageMessageId) {
      try {
        return await ctx.telegram.editMessageText(ctx.chat.id, user.languageMessageId, undefined, 'Mos tillar:', keyboard);
      } catch (error) {
        if (error.response?.error_code === 400 && /message is not modified/i.test(error.response.description || '')) {
          return ctx.reply('Bu qidiruv natijalari allaqachon ko\'rsatilgan.', keyboard);
        }
        throw error;
      }
    }
    return ctx.reply('Mos tillar:', keyboard);
  }

  await translateAndReply(ctx, text);
});

bot.catch((error) => console.error('Bot xatosi:', error));

async function startBot() {
  try {
    const launchOptions = config.mode === 'webhook'
      ? { webhook: { domain: config.webhookDomain, port: config.port } }
      : { dropPendingUpdates: true };
    if (config.mode === 'webhook' && !config.webhookDomain) {
      throw new Error('WEBHOOK_DOMAIN yoki Renderning RENDER_EXTERNAL_URL qiymati topilmadi.');
    }
    await bot.launch(launchOptions);
    try {
      await configureCommandMenus();
    } catch (error) {
      console.error('Telegram menyu sozlamasi xatosi:', error.message);
    }
    console.log('Ellita_translate ishga tushdi: node bot.js');
  } catch (error) {
    if (error.response?.error_code === 409 || /409|another getUpdates request/i.test(error.message)) {
      console.error('409 Conflict: shu BOT_TOKEN bilan boshqa polling jarayoni ishlayapti. Lokal botni to\'xtating yoki Renderda BOT_MODE=webhook qiling.');
      process.exitCode = 1;
      return;
    }
    console.error('Telegram ulanishi xatosi:', error.message);
    process.exitCode = 1;
  }
}

async function configureCommandMenus() {
  const userCommands = [
    { command: 'start', description: 'Botni boshlash' },
    { command: 'help', description: 'Yordam va komandalar' },
    { command: 'menu', description: 'Asosiy menyu' },
    { command: 'profile', description: 'Profil' },
    { command: 'saved', description: 'Saqlangan tarjimalar' },
    { command: 'leaderboard', description: 'Reyting' },
    { command: 'game', description: 'O\'yinni boshlash' },
    { command: 'correct', description: 'Grammatikani tuzatish' },
    { command: 'logout', description: 'Akkauntdan chiqish' }
  ];
  await bot.telegram.setMyCommands(userCommands);
  for (const adminId of adminIds) {
    await bot.telegram.setMyCommands([
      ...userCommands,
      { command: 'admin', description: 'Admin panel' },
      { command: 'users', description: 'Foydalanuvchilar' },
      { command: 'stats', description: 'Statistika' },
      { command: 'gamecreate', description: '20 savolli o\'yin yaratish' },
      { command: 'broadcast', description: 'Xabar yuborish' }
    ], { type: 'chat', chat_id: Number(adminId) });
    await bot.telegram.setChatMenuButton(Number(adminId), { type: 'commands' });
  }
}

startBot();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
