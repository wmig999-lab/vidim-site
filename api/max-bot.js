// =============================================================
// api/max-bot.js — вебхук-бот Vidim для мессенджера MAX (VK)
// Обслуживается проектом vidim-site (домен www.vidim.site).
// Env (Vercel, проект vidim-site):
//   MAX_BOT_TOKEN       — токен от @MasterBot (обязательно)
//   MAX_OWNER_ID        — ваш user_id в MAX для уведомлений о лидах (напр. 171004316)
//   MAX_WEBHOOK_SECRET  — случайная строка; защищает разовую настройку и входящий вебхук
// Разовая регистрация вебхука:
//   https://www.vidim.site/api/max-bot?action=setup&key=<MAX_WEBHOOK_SECRET>
//
// TLS: API MAX (platform-api2.max.ru) подписан «Russian Trusted Sub CA» (Минцифры),
// которого нет в доверенных у Node на Vercel → вшиваем Sub CA и ходим через https с ca.
// =============================================================

const https = require('https');

const API_HOST = 'platform-api2.max.ru';
const TOKEN = process.env.MAX_BOT_TOKEN;
const OWNER = process.env.MAX_OWNER_ID;
const SECRET = process.env.MAX_WEBHOOK_SECRET || '';
const BRIEF_URL = 'https://brief.vidim.site';
const SITE_URL = 'https://vidim.site';

// Russian Trusted Sub CA (Минцифры) — якорь доверия для *.max.ru
const MAX_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIG6DCCBNCgAwIBAgICEAUwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjQwNzE1MTI1MDQxWhcNMjkwNzE5MTI1MDQxWjBvMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMR8wHQYDVQQDDBZSdXNzaWFuIFRydXN0ZWQgU3Vi
IENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA1j0rkZECOt1S8o7I
JY+4YKAxuEa5xaHKHXT2EpkuC/0krqMOjUy2oPIRNgR5g8X0Jl6jamxeGLc4Q1tf
ju6or9oSRYThIUhRsFDQNBiBBEXoBgWxTfiKB2eyT97+pz5TBtBiRCPaLGRHYLRb
9Jz2HkJlxbtNPjtDrF5DPHym+mZ1M1z3hIQYAqJwLpsEBnsw/VxWMlxqHoeewd0h
uJMd71KQ5vOKlz7KrIZ6EobNNa6wItuvsfj3kYCK7O78uLHGXXFxdr8Hae9lMUmC
8F7AFwa+bO1LRlTlqW7rE3rLf+jj70N01N8T3o22v14YBaFBWQWncAVYD2JuL3tH
252+kdNOERf1fLbLRigJAbd+hOhWYlNf963TFDgnNPliHNIW72SygVBnI2V3JwO1
dp1hVKpK/zt8ziGdHW4gmOLTsH50YKdR4jNqUgQv4wASlKn9OpN6zHYc5G8h86fY
BM+zxE5ikGI+I/vIqBuI0eaDU92AWN/YjFLpu8tMu9kLRSCf1vug6FIfDPWVo7iP
ac/SI2v8jnnpaW7ph/Pz3WkzaG7ZZJsfFs+8dploWc6LOoDtbFBhMdGMxu024msC
0PSjZb5ODXPIaO2NsA7fMiAtZcoK6anTUJh4zOP/stA9qsJGNxdrEmiPXSmBZY/N
Y0wkZgZ6JTDhw7038bPvctkblJkCAwEAAaOCAYswggGHMB0GA1UdDgQWBBR3Pdk5
r0K93FvKduru/c4+YSkwXzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qws
hzAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0TAQH/BAgwBgEB/wIBADCBmAYIKwYBBQUH
AQEEgYswgYgwQAYIKwYBBQUHMAKGNGh0dHA6Ly9udWMtY2RwLnZvc2tob2QucnUv
Y2RwL3Jvb3RjYV9zc2xfcnNhMjAyMi5jcnQwRAYIKwYBBQUHMAKGOGh0dHA6Ly9u
dWMtY2RwLmRpZ2l0YWwuZ292LnJ1L2NkcC9yb290Y2Ffc3NsX3JzYTIwMjIuY3J0
MIGFBgNVHR8EfjB8MDqgOKA2hjRodHRwOi8vbnVjLWNkcC52b3NraG9kLnJ1L2Nk
cC9yb290Y2Ffc3NsX3JzYTIwMjIuY3JsMD6gPKA6hjhodHRwOi8vbnVjLWNkcC5k
aWdpdGFsLmdvdi5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNybDANBgkqhkiG
9w0BAQsFAAOCAgEAmsINXtQ7wwUWvIeOr80MdJS/5G4xhyZOVEmeUorThquT672y
cCg3XCxc4fwbiZqSSbBqntQ7RtiTAKMYMvBageKoVHbzz+R4jX01tKcTx8cDePrz
dJ73bLNUorE7RU9QsW4KyiUeRmjMDV23AUlEvuQFTwgkHXvbac1BBdPn9CrssQuF
5EGohZKcQPFiAAc4SHbRNhlr7uAwgpc/erzI9EAcvA6BVAXcVKoeGpV01uexUgZ6
St5RP9UmDWNA7T4yVXWJ233N0Q8bl+6AswINQ3PosPu6yQQHQjr65YS06epK+AeI
6j+oGR4xI7EhTQhQvaobnGmX/8QQ7XDRYCP2HXYxiffnn/CfZ/BVyKLYeY1ZipjE
nzqdQIC2+Q3WtY8jsVRQMP38WFRmtsIt5snehnPTs5bKGVIcYzj3o3Ex/K7agEz0
zAJ0JR5ivXZOvNkT0g9x1v+S1IkU3e/nX1a+tpRquMtnHX0L2lXArNHUbaOO9EJt
d57WaIpofV5cVhhwShOgAuBc9UMJF3/n4t4RKiPxtsK8P67gcmphMhslj7AMYrYM
ej2NvQZY4m3ub3CPC/PrTjDONvb+8g5xrKtxBjYqC74HSB4dg9G3WimSDUuP2Su6
G2y2TUeyJuCvCLz289VoO0vg7cNdMobE3KCqAiiNhN2VBFxHAUKmUoRcRdw=
-----END CERTIFICATE-----`;

// --- низкоуровневый вызов MAX API через https с вшитым CA ---
function maxApi(method, path, { query, body } = {}) {
  return new Promise((resolve, reject) => {
    const qs = query ? '?' + new URLSearchParams(query).toString() : '';
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Authorization': TOKEN };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request(
      { host: API_HOST, path: path + qs, method, headers, ca: MAX_CA, timeout: 12000 },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })); }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// Отправка сообщения в чат (chat_id) или пользователю (user_id)
function sendMessage(target, text, buttons) {
  const query = target.chat_id ? { chat_id: target.chat_id } : { user_id: target.user_id };
  const body = { text };
  if (buttons && buttons.length) {
    body.attachments = [{ type: 'inline_keyboard', payload: { buttons } }];
  }
  return maxApi('POST', '/messages', { query, body });
}

function notifyOwner(text) {
  if (!OWNER) return Promise.resolve();
  return sendMessage({ user_id: OWNER }, text).catch(e => console.error('[max-bot] notifyOwner failed', e.message));
}

// --- контент ---
const BTN_BRIEF = { type: 'link', text: '🚀 Пройти бесплатный бриф', url: BRIEF_URL };

const WELCOME =
  'Здравствуйте! Это Vidim — внешний взгляд на ваш бизнес.\n\n' +
  'За 5 минут бесплатный бриф даст персональный ИИ-разбор операционных и финансовых рисков вашей компании — без звонков.\n\n' +
  'Выберите, с чего начать. Или просто напишите свой вопрос — передам эксперту.';

const WELCOME_BUTTONS = [
  [BTN_BRIEF],
  [{ type: 'callback', text: '💼 Услуги и цены', payload: 'prices' }],
  [{ type: 'callback', text: '💬 Задать вопрос эксперту', payload: 'question' }],
];

const PRICES =
  'Как мы работаем — три шага:\n\n' +
  '1. Бесплатный бриф (5 мин) — первичный ИИ-разбор рисков.\n' +
  '2. Экспресс-диагностика — 200 000 ₽, 5–7 дней. Гарантия возврата 100%, зачёт в аудит.\n' +
  '3. Комплексный аудит + ТЗ — от 600 000 ₽.\n\n' +
  'Начать удобнее с бесплатного брифа.';

const QUESTION =
  'Напишите ваш вопрос прямо здесь одним сообщением — передам эксперту Vidim, ответим лично.';

const AFTER_QUESTION =
  'Спасибо! Передал ваш вопрос эксперту — ответим здесь.\n' +
  'А пока можете пройти бесплатный бриф — это 5 минут.';

// --- обработчик ---
module.exports = async (req, res) => {
  const q = req.query || {};

  if (req.method === 'GET') {
    // Разовая регистрация вебхука
    if (q.action === 'setup') {
      if (!TOKEN) return res.status(500).json({ error: 'MAX_BOT_TOKEN не задан' });
      if (!SECRET || q.key !== SECRET) return res.status(403).json({ error: 'Неверный или пустой ключ' });
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const url = `https://${host}/api/max-bot?s=${SECRET}`;
      const r = await maxApi('POST', '/subscriptions', {
        body: { url, update_types: ['message_created', 'bot_started', 'message_callback'] },
      });
      return res.status(200).json({ webhook: url, max: { status: r.status, body: safeJson(r.body) } });
    }
    // Список подписок (диагностика)
    if (q.action === 'info') {
      if (!SECRET || q.key !== SECRET) return res.status(403).json({ error: 'Неверный ключ' });
      const r = await maxApi('GET', '/subscriptions');
      return res.status(200).json({ status: r.status, body: safeJson(r.body) });
    }
    return res.status(200).send('MAX bot: OK');
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!TOKEN) return res.status(200).end();
  // Защита входящего вебхука секретом в query (?s=...). Если MAX не сохранит query — снимем гейт.
  if (SECRET && q.s !== SECRET) { console.warn('[max-bot] webhook secret mismatch'); return res.status(401).end(); }

  const update = req.body || {};
  console.log('[max-bot] update', JSON.stringify(update)); // сырой апдейт в рантайм-логи (для отладки)

  try {
    const type = update.update_type || update.type;

    // Нажатие inline-кнопки
    if (type === 'message_callback') {
      const cb = update.callback || {};
      const payload = cb.payload || update.payload;
      const chatId = (update.message && update.message.recipient && update.message.recipient.chat_id)
        || (cb.message && cb.message.recipient && cb.message.recipient.chat_id)
        || update.chat_id;
      if (chatId) {
        if (payload === 'prices') await sendMessage({ chat_id: chatId }, PRICES, [[BTN_BRIEF]]);
        else if (payload === 'question') await sendMessage({ chat_id: chatId }, QUESTION);
        else await sendMessage({ chat_id: chatId }, WELCOME, WELCOME_BUTTONS);
      }
      return res.status(200).end();
    }

    // Пользователь запустил бота
    if (type === 'bot_started') {
      const chatId = update.chat_id || (update.message && update.message.recipient && update.message.recipient.chat_id);
      if (chatId) await sendMessage({ chat_id: chatId }, WELCOME, WELCOME_BUTTONS);
      await notifyOwner(`👤 Новый пользователь в MAX-боте: ${userLabel(update.user)}`);
      return res.status(200).end();
    }

    // Входящее сообщение
    if (type === 'message_created') {
      const m = update.message || {};
      const chatId = m.recipient && m.recipient.chat_id;
      const text = (m.body && m.body.text ? m.body.text : '').trim();
      const sender = m.sender || {};
      if (!chatId) return res.status(200).end();

      if (/^\/?(start|старт|help|помощь)$/i.test(text)) {
        await sendMessage({ chat_id: chatId }, WELCOME, WELCOME_BUTTONS);
      } else if (text) {
        // произвольный текст = вопрос эксперту
        await notifyOwner(`💬 Вопрос в MAX-боте от ${userLabel(sender)} (id ${sender.user_id || '—'}):\n${text}`);
        await sendMessage({ chat_id: chatId }, AFTER_QUESTION, [[BTN_BRIEF]]);
      }
      return res.status(200).end();
    }

    return res.status(200).end();
  } catch (e) {
    console.error('[max-bot] handler error', e.message);
    return res.status(200).end(); // 200, чтобы MAX не ретраил бесконечно
  }
};

function userLabel(u) {
  if (!u) return 'пользователь';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || ('id' + (u.user_id || '?'));
}
function safeJson(s) { try { return JSON.parse(s); } catch (e) { return s; } }
