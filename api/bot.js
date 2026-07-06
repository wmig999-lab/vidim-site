// Vidim Telegram-бот (@vidim_consult_bot) — консьерж и точка входа в воронку.
// Webhook-функция на Vercel (тот же репозиторий, что и лендинг/бриф).
//
// Переменные окружения (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  — токен от @BotFather (обязательно)
//   OWNER_CHAT_ID       — ваш Telegram chat_id для уведомлений о лидах (узнать: @userinfobot)
//   BOT_WEBHOOK_SECRET  — любая случайная строка; защищает вебхук и разовую настройку
//
// Разовая настройка вебхука после деплоя (открыть в браузере один раз):
//   https://vidim.site/api/bot?action=setup&key=<BOT_WEBHOOK_SECRET>

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER = process.env.OWNER_CHAT_ID;
const SECRET = process.env.BOT_WEBHOOK_SECRET || '';
const BRIEF_URL = 'https://brief.vidim.site';
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

async function tg(method, payload) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

function send(chatId, text, extra = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

const startKb = {
  inline_keyboard: [
    [{ text: '🚀 Пройти бесплатный бриф', url: BRIEF_URL }],
    [{ text: '❓ Задать вопрос эксперту', callback_data: 'ask' }],
    [{ text: '📋 Услуги и цены', callback_data: 'price' }],
  ],
};

const briefKb = {
  inline_keyboard: [[{ text: '🚀 Пройти бесплатный бриф', url: BRIEF_URL }]],
};

const TXT = {
  start:
`Здравствуйте! Это <b>Vidim</b> — операционная диагностика с ИИ.

Мы находим, где бизнес теряет деньги: падение маржи, кассовые разрывы, рост дебиторки, зависимость от «незаменимых» — <b>раньше, чем это станет кризисом</b>.

Начните с бесплатного брифа: 6 вопросов за 5 минут → отчёт с топ-3 рисками вашей компании.`,
  about:
`<b>Vidim — внешний взгляд на ваш бизнес.</b>

Связка опытного управленца и ИИ-аналитики находит слабые сигналы в ваших данных: аномалии, утечки, узкие места — то, что глазами не найти за месяц.

Мы не раздаём советы «со стороны» — участвуем в результате. NDA до начала работ, данные обрабатываются на серверах в России (152-ФЗ).

Для компаний от 100 сотрудников.`,
  price:
`<b>Три шага. Любой можно остановить.</b>

🟢 <b>Бриф — бесплатно · 5 минут</b>
6 вопросов → ИИ-отчёт с топ-3 рисками.

🔵 <b>Экспресс-диагностика — 200 000 ₽ · 5–7 дней</b>
Карта узких мест с приоритизацией по влиянию на прибыль. Гарантия возврата 100%. Сумма зачитывается в аудит.

🟣 <b>Аудит + ТЗ — от 600 000 ₽ · 4–8 недель</b>
Полная карта процессов и готовые ТЗ для подрядчиков.`,
  ask:
`Напишите ваш вопрос одним сообщением — передам эксперту, ответит здесь в ближайшее время.

А топ-3 риска вашей компании можно узнать бесплатно за 5 минут: ${BRIEF_URL}`,
  gotQuestion:
`Спасибо! Передал эксперту — ответит здесь в ближайшее время.

Чтобы разговор был предметным, пройдите бесплатный бриф (6 вопросов, 5 минут) — эксперт сразу увидит топ-3 риска вашей компании: ${BRIEF_URL}`,
  unknown: 'Команда не распознана. Наберите /start, чтобы начать.',
};

function userLabel(u) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  const uname = u.username ? ` @${u.username}` : '';
  return `${name || 'без имени'}${uname} (id ${u.id})`;
}

async function notifyOwner(text) {
  if (OWNER) {
    try { await send(OWNER, text); } catch (e) { /* игнорируем */ }
  }
}

module.exports = async (req, res) => {
  // --- Разовая настройка вебхука: GET /api/bot?action=setup&key=<SECRET> ---
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.action === 'setup') {
      if (!TOKEN) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN не задан' });
      if (!SECRET || q.key !== SECRET) return res.status(403).json({ error: 'Неверный или пустой ключ' });
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const url = `https://${host}/api/bot`;
      const r = await tg('setWebhook', {
        url,
        secret_token: SECRET,
        allowed_updates: ['message', 'callback_query'],
      });
      return res.status(200).json({ webhook: url, telegram: r });
    }
    return res.status(200).send('Vidim bot: OK');
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!TOKEN) return res.status(200).end();

  // Защита вебхука секретом (Telegram присылает его заголовком)
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) {
    return res.status(401).end();
  }

  const update = req.body || {};

  try {
    // Нажатия на inline-кнопки
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      await tg('answerCallbackQuery', { callback_query_id: cq.id });
      if (cq.data === 'ask') await send(chatId, TXT.ask);
      else if (cq.data === 'price') await send(chatId, TXT.price, { reply_markup: startKb });
      return res.status(200).end();
    }

    const msg = update.message;
    if (msg && msg.text) {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');

      if (cmd === '/start' || cmd === '/help') {
        await send(chatId, TXT.start, { reply_markup: startKb });
        if (cmd === '/start') await notifyOwner(`👤 Новый пользователь в боте: ${userLabel(msg.from)}`);
      } else if (cmd === '/brief') {
        await send(chatId, 'Бриф — 6 вопросов, 5 минут, отчёт приходит сразу:', { reply_markup: briefKb });
      } else if (cmd === '/about') {
        await send(chatId, TXT.about, { reply_markup: startKb });
      } else if (cmd === '/price') {
        await send(chatId, TXT.price, { reply_markup: startKb });
      } else if (cmd === '/question') {
        await send(chatId, TXT.ask);
      } else if (cmd.startsWith('/')) {
        await send(chatId, TXT.unknown, { reply_markup: startKb });
      } else {
        // Произвольный текст = вопрос/лид
        await send(chatId, TXT.gotQuestion);
        await notifyOwner(`💬 Вопрос от ${userLabel(msg.from)}:\n\n${text}`);
      }
      return res.status(200).end();
    }
  } catch (e) {
    // Никогда не роняем вебхук — Telegram будет ретраить при не-200
  }

  return res.status(200).end();
};

