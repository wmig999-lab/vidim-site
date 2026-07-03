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

ПРАВИЛА: Ровно 3 риска, 3-4 рекомендации, хотя бы одна quick_win. В signal каждого риска — отраслевая метрика. Никакого markdown. Только валидный JSON.

━━━ ВТОРОЙ БЛОК: ВНУТРЕННИЙ ОТЧЁТ (поле internal) ━━━
Помимо клиентского отчёта сгенерируй internal — разбор ДЛЯ КОМАНДЫ Vidim, глубже и откровеннее клиентского. Клиент его не увидит, поэтому будь прямым.
- deep_diagnosis.risks: 5–7 рисков (больше и детальнее, чем клиентские 3), каждый: title, mechanism (отраслевой механизм), impact_rub (последствия в ₽/%), severity (critical/high/medium), signal (метрика+порог).
- deep_diagnosis.root_cause_hypotheses: 2–3 версии сквозной корневой причины.
- deep_diagnosis.benchmarks: отраслевые ориентиры с пометкой «типично, не факт об этой компании».
- industry_playbook.typical_problems: типовые «болезни» именно этой отрасли (не только из брифа).
- industry_playbook.step_plan: план починки по шагам, каждый: step, horizon (quick/1_month/3_months/strategic), why.
- call_strategy.hook_questions: 3–5 цепляющих вопросов под этот бриф для диагностического звонка.
- call_strategy.pressure_points: на какие боли/риски давить.
- call_strategy.objections: 2–4 вероятных возражения, каждое: objection + response (как отвечаем).
- call_strategy.upsell_path: как вести клиента диагностика(200k)→аудит(от 600k)→проект.
- honest_flags.assumptions_vs_facts: где мы ДОДУМАЛИ vs что реально следует из брифа.
- honest_flags.verify_on_diagnostic: что обязательно уточнить на диагностике.
- honest_flags.client_red_flags: сигналы «турист»/нереалистичные ожидания/риск неплатёжеспособности (если есть; иначе пустой массив).
Внутренний блок — тем же отраслевым языком. Только валидный JSON, без markdown.
`;

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
    },
    internal: {
      type: 'object',
      properties: {
        deep_diagnosis: {
          type: 'object',
          properties: {
            risks: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' }, mechanism: { type: 'string' },
              impact_rub: { type: 'string' }, severity: { type: 'string' }, signal: { type: 'string' }
            }, required: ['title','mechanism','impact_rub','severity','signal'] } },
            root_cause_hypotheses: { type: 'array', items: { type: 'string' } },
            benchmarks: { type: 'array', items: { type: 'string' } }
          },
          required: ['risks','root_cause_hypotheses','benchmarks']
        },
        industry_playbook: {
          type: 'object',
          properties: {
            typical_problems: { type: 'array', items: { type: 'string' } },
            step_plan: { type: 'array', items: { type: 'object', properties: {
              step: { type: 'string' }, horizon: { type: 'string' }, why: { type: 'string' }
            }, required: ['step','horizon','why'] } }
          },
          required: ['typical_problems','step_plan']
        },
        call_strategy: {
          type: 'object',
          properties: {
            hook_questions: { type: 'array', items: { type: 'string' } },
            pressure_points: { type: 'array', items: { type: 'string' } },
            objections: { type: 'array', items: { type: 'object', properties: {
              objection: { type: 'string' }, response: { type: 'string' }
            }, required: ['objection','response'] } },
            upsell_path: { type: 'string' }
          },
          required: ['hook_questions','pressure_points','objections','upsell_path']
        },
        honest_flags: {
          type: 'object',
          properties: {
            assumptions_vs_facts: { type: 'array', items: { type: 'string' } },
            verify_on_diagnostic: { type: 'array', items: { type: 'string' } },
            client_red_flags: { type: 'array', items: { type: 'string' } }
          },
          required: ['assumptions_vs_facts','verify_on_diagnostic','client_red_flags']
        }
      },
      required: ['deep_diagnosis','industry_playbook','call_strategy','honest_flags']
    }
  },
  required: ['profile', 'top_risks', 'recommendations', 'diagnostic_hypothesis', 'next_step', 'internal']
};

function internalToText(i) {
  i = i || {};
  const dd = i.deep_diagnosis || {}, pb = i.industry_playbook || {}, cs = i.call_strategy || {}, hf = i.honest_flags || {};
  const L = [];
  const bullet = (arr, fn) => (arr || []).map(fn).join('\n');
  L.push('═══ УГЛУБЛЁННАЯ ДИАГНОСТИКА (для команды) ═══');
  L.push(bullet(dd.risks, (r, n) => `${n + 1}. [${r.severity || ''}] ${r.title || ''}\n   Механизм: ${r.mechanism || ''}\n   Последствия: ${r.impact_rub || ''}\n   Сигнал: ${r.signal || ''}`));
  L.push('\nГипотезы корневой причины:');
  L.push(bullet(dd.root_cause_hypotheses, (h) => `• ${h}`));
  L.push('\nОтраслевые бенчмарки (типично, не факт):');
  L.push(bullet(dd.benchmarks, (b) => `• ${b}`));
  L.push('\n═══ ОТРАСЛЕВОЙ ПОШАГОВЫЙ ПЛАН ═══');
  L.push('Типовые проблемы отрасли:');
  L.push(bullet(pb.typical_problems, (p) => `• ${p}`));
  L.push('\nПлан по шагам:');
  L.push(bullet(pb.step_plan, (s, n) => `${n + 1}. (${s.horizon || ''}) ${s.step || ''} — ${s.why || ''}`));
  L.push('\n═══ СТРАТЕГИЯ ЗВОНКА ═══');
  L.push('Цепляющие вопросы:');
  L.push(bullet(cs.hook_questions, (q) => `• ${q}`));
  L.push('\nНа что давить:');
  L.push(bullet(cs.pressure_points, (p) => `• ${p}`));
  L.push('\nВозражения → ответы:');
  L.push(bullet(cs.objections, (o) => `• «${o.objection || ''}» → ${o.response || ''}`));
  L.push(`\nАпсейл-путь: ${cs.upsell_path || ''}`);
  L.push('\n═══ ЧЕСТНЫЕ ФЛАГИ ═══');
  L.push('Додумали vs факт:');
  L.push(bullet(hf.assumptions_vs_facts, (x) => `• ${x}`));
  L.push('\nУточнить на диагностике:');
  L.push(bullet(hf.verify_on_diagnostic, (x) => `• ${x}`));
  const rf = hf.client_red_flags || [];
  L.push('\nRed flags клиента:');
  L.push(rf.length ? bullet(rf, (x) => `• ${x}`) : '• нет');
  return L.join('\n');
}

function stripInternal(data) {
  const internal = data && data.internal;
  if (data) delete data.internal;
  return internal || null;
}

const EMAILJS = {
  url: 'https://api.emailjs.com/api/v1.0/email/send',
  service: 'service_c8kqi5s',
  publicKey: 'Xvg10AeigkaR_anxB',
  tplNotify: 'template_jakea23'
};

async function sendInternalEmail(internal, meta) {
  const key = process.env.EMAILJS_PRIVATE_KEY;
  if (!key) { console.warn('[vidim/api] EMAILJS_PRIVATE_KEY not set — internal email skipped'); return false; }
  if (!internal) { console.warn('[vidim/api] internal missing — email skipped'); return false; }
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 8000);
  try {
    const m = meta || {};
    const body =
      `🔒 ВНУТРЕННИЙ ОТЧЁТ ПО БРИФУ (не для клиента)\n\n` +
      `Лид: ${m.name || '—'} · ${m.company || '—'}\n` +
      `Телефон: ${m.phone || '—'} · Email: ${m.email || '—'}\n` +
      `Отрасль: ${m.industry || '—'} · Размер: ${m.size || '—'}\n` +
      `Модель: ${m.apiModel || ''}\n\n` +
      internalToText(internal);
    const r = await fetch(EMAILJS.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        service_id: EMAILJS.service,
        template_id: EMAILJS.tplNotify,
        user_id: EMAILJS.publicKey,
        accessToken: key,
        template_params: {
          company_industry: m.industry || '', company_size: m.size || '',
          client_name: m.name || '', client_phone: m.phone || '', client_email: m.email || '',
          company_name: m.company || '',
          brief_answers: body, report_text: body,
          api_status: '🔒 ВНУТРЕННИЙ ОТЧЁТ', pains: 'внутренний разбор'
        }
      })
    });
    if (!r.ok) { const t = await r.text(); console.error('[vidim/api] internal email failed', r.status, t.slice(0, 200)); return false; }
    console.log('[vidim/api] internal email sent → info@');
    return true;
  } catch (e) { console.error('[vidim/api] internal email exception', e.message); return false; }
  finally { clearTimeout(to); }
}

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
        options: { temperature: 0.4, num_predict: 8000 },
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
    const internal = stripInternal(data);
    const teamNotified = await sendInternalEmail(internal, {
      industry: data.profile && data.profile.industry, size: data.profile && data.profile.size,
      name: body.name, email: body.email, phone: body.phone, company: body.company,
      apiModel: MODEL
    });
    return res.status(200).json({ data, source: 'ollama', teamNotified });
  } catch(err) {
    console.error('[vidim/api] error:', err.message);
    return res.status(500).json({ error: err.message, fallback: true });
  }
}

module.exports = handler;
module.exports.internalToText = internalToText;
module.exports.stripInternal = stripInternal;
module.exports.sendInternalEmail = sendInternalEmail;
// Vercel: даём функции время на генерацию (на Pro до 300с; на Hobby клампится к лимиту плана).
module.exports.config = { maxDuration: 60 };
