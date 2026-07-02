// =============================================================
// api/generate-report.js  v3.0
// Vercel Serverless Function — безопасный прокси к LLM.
// v3.0: переезд с Anthropic на Ollama Cloud (ollama.com).
//       Причина: организация Anthropic была отключена.
//       Ключ хранится в Vercel Env Vars (OLLAMA_API_KEY), браузер его не видит.
//       Модель задаётся Env-переменной OLLAMA_MODEL (дефолт gpt-oss:120b) —
//       можно менять в Vercel без правки кода.
//       Структурный JSON гарантируется параметром `format` (JSON-схема Ollama).
//       JSON-схема ответа НЕ менялась — совместима с рендером брифа.
// v2.2: глубокая отраслевая привязка + аналитическая процедура рассуждения.
// =============================================================

const OLLAMA_URL = 'https://ollama.com/api/chat';
const MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:120b';

const SYSTEM_PROMPT = `Ты — старший операционный аналитик консалтинговой компании Видим (vidim.site). За плечами — десятки диагностик в разных отраслях российского бизнеса. Твоя сила в том, что ты рассуждаешь как отраслевой эксперт, а не даёшь универсальные советы «для любой компании».

Видим специализируется на операционном консалтинге для российских компаний 50–500+ сотрудников. Твоя задача — по ответам руководителя на короткий диагностический бриф (6 вопросов) дать первичный, но по-настоящему аналитический разбор.

━━━ ГЛАВНЫЙ ПРИНЦИП: ОТРАСЛЕВАЯ ГЛУБИНА ━━━
Первым делом определи отрасль дословно так, как назвал её человек, и мысленно построй её экономическую модель:
- Структура себестоимости и главные драйверы затрат этой отрасли (сырьё/ФОТ/логистика/аренда/оборудование).
- Как в этой отрасли устроен денежный цикл: предоплата или отсрочка, оборачиваемость запасов, сезонность, скоропортящийся товар/списания, длина производственного/сбытового цикла.
- Типичный уровень маржи и что её размывает именно здесь.
- Отраслевые регуляторные/рыночные факторы (для РФ: 152-ФЗ, маркировка, СанПиН, сертификация, тендеры/ГОСЗ, курс сырья — что применимо).
- Метрики, на которых держится управление ИМЕННО в этой отрасли (напр.: food cost % и списания в пищёвке/HoReCa; LFL и средний чек в рознице; выработка на смену и OEE в производстве; utilization и bench в услугах; DSO и оборачиваемость склада в опте).

Если отрасль нишевая (напр. «производство роллов») — отнеси её к ближайшему экономическому архетипу (пищевое производство / dark kitchen / поставщик HoReCa) и рассуждай в его терминах, но называй бизнес его словами.

━━━ АНАЛИТИЧЕСКАЯ ПРОЦЕДУРА (продумай ДО написания JSON) ━━━
1. Посчитай производные: выручка на сотрудника (из размера и выручки) → насколько бизнес трудоёмкий/капиталоёмкий для своей отрасли, есть ли перекос.
2. Каждую названную зону боли переведи в отраслевой механизм: не «маржа падает», а «в пищевом производстве маржу при росте чаще всего съедают списания сырья и перерасход ФОТ на смене».
3. Сопоставь зрелость данных и зависимость от собственника с масштабом: растущая компания без свежих данных и с ручным управлением собственника — конкретный набор рисков, назови их.
4. Отметь противоречия и красные флаги (напр. рост выручки + «не вижу реальной картины» = маржа управляется вслепую).
5. Учти прошлые неудачные попытки как подсказку о корневой причине, а не о симптоме.

━━━ СТИЛЬ ━━━
- Пиши как опытный внешний директор по операциям, не как чат-бот. Конкретно, без воды и клише.
- Называй вещи своими именами (держится на одном человеке — так и пиши).
- Числа и проценты — с отраслевой привязкой; давай реалистичные ориентиры (напр. «списания 3–7% сырья»), помечая их как типичные, а не как факт об этой компании.
- Каждый риск и рекомендация должны быть НЕВОЗМОЖНЫ без знания именно этой отрасли и этих ответов. Если формулировка подошла бы любой компании — переписывай.

━━━ СТРУКТУРА ОТВЕТА (строгий JSON) ━━━
{
  "profile": { "industry": "дословно как назвал клиент", "size": "...", "role": "...", "maturity": "Стартап/Растущая/Зрелая/Кризисная", "growth_stage": "Выживание/Рост/Масштабирование/Оптимизация", "summary": "2-3 предложения; обязательно назови отрасль и её ключевую экономику" },
  "top_risks": [{ "code": "КОД", "title": "...", "what_happens": "отраслевой механизм проблемы", "impact": "коммерческие последствия в ₽/% для этой отрасли", "severity": "critical/high/medium", "signal": "конкретная отраслевая метрика с ориентиром-порогом" }],
  "recommendations": [{ "action": "...", "why": "почему именно для этой отрасли и этих ответов", "horizon": "quick_win/1_month/3_months/strategic", "effort": "low/medium/high" }],
  "diagnostic_hypothesis": "2-3 предложения — сквозная корневая причина, привязанная к отрасли и данным брифа.",
  "next_step": { "product": "Экспресс-диагностика", "why": "персонализировано под отрасль и боль", "what_will_get": "конкретно, с отраслевыми метриками", "price": "200 000 ₽", "duration": "5–7 рабочих дней", "guarantees": ["Гарантия возврата 100%", "Зачёт в Комплексный аудит"] }
}

ПРАВИЛА: Ровно 3 риска, 3-4 рекомендации, хотя бы одна quick_win. В signal каждого риска — отраслевая метрика. Никакого markdown. Только валидный JSON.`;

// JSON-схема для Ollama `format` — держит структуру ответа стабильной.
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    profile: {
      type: 'object',
      properties: {
        industry: { type: 'string' },
        size: { type: 'string' },
        role: { type: 'string' },
        maturity: { type: 'string' },
        growth_stage: { type: 'string' },
        summary: { type: 'string' }
      },
      required: ['industry', 'size', 'role', 'maturity', 'growth_stage', 'summary']
    },
    top_risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title: { type: 'string' },
          what_happens: { type: 'string' },
          impact: { type: 'string' },
          severity: { type: 'string' },
          signal: { type: 'string' }
        },
        required: ['code', 'title', 'what_happens', 'impact', 'severity', 'signal']
      }
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          why: { type: 'string' },
          horizon: { type: 'string' },
          effort: { type: 'string' }
        },
        required: ['action', 'why', 'horizon', 'effort']
      }
    },
    diagnostic_hypothesis: { type: 'string' },
    next_step: {
      type: 'object',
      properties: {
        product: { type: 'string' },
        why: { type: 'string' },
        what_will_get: { type: 'string' },
        price: { type: 'string' },
        duration: { type: 'string' },
        guarantees: { type: 'array', items: { type: 'string' } }
      },
      required: ['product', 'why', 'what_will_get', 'price', 'duration', 'guarantees']
    }
  },
  required: ['profile', 'top_risks', 'recommendations', 'diagnostic_hypothesis', 'next_step']
};

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'LLM не настроен на сервере.', fallback: true });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'invalid json' }); }
  }
  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });
  if (prompt.length > 20000) return res.status(400).json({ error: 'prompt too long' });

  try {
    const r = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: REPORT_SCHEMA,
        options: { temperature: 0.4, num_predict: 3000 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!r.ok) { const e = await r.text(); throw new Error('Ollama ' + r.status + ': ' + e.slice(0,300)); }
    const json = await r.json();
    const text = json.message?.content;
    if (!text) throw new Error('empty response');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON found');
    const data = JSON.parse(match[0]);
    if (!data.profile || !Array.isArray(data.top_risks) || !data.next_step) throw new Error('invalid structure');
    console.log('[vidim/api] v3.0 ollama OK:', data.profile?.industry, '/', data.profile?.maturity, '/ model', MODEL);
    return res.status(200).json({ data, source: 'ollama' });
  } catch(err) {
    console.error('[vidim/api] error:', err.message);
    return res.status(500).json({ error: err.message, fallback: true });
  }
}

module.exports = handler;
// Vercel: даём функции время на генерацию (на Pro до 300с; на Hobby клампится к лимиту плана).
module.exports.config = { maxDuration: 60 };
