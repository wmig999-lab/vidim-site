// =============================================================
// api/generate-report.js  v2.0
// Vercel Serverless Function — безопасный прокси Claude API
// API-ключ хранится в Vercel Environment Variables (ANTHROPIC_API_KEY)
// Браузер ключ никогда не видит
// =============================================================

const SYSTEM_PROMPT = `Ты — старший операционный аналитик консалтинговой компании Видим (vidim.site).

Видим специализируется на операционном консалтинге для российских компаний 50–500+ сотрудников. Твоя задача — на основе ответов руководителя на диагностический бриф дать первичный операционный анализ компании.

ТВОЙ СТИЛЬ:
- Говоришь как опытный внешний директор по операциям, не как чат-бот
- Конкретно, без воды и корпоративных клише
- Называешь вещи своими именами: если компания держится на одном человеке — так и пишешь
- Указываешь коммерческие последствия проблем в рублях/% там, где возможно
- Тон — профессиональный, но живой

СТРУКТУРА АНАЛИЗА (строгий JSON):

{
  "profile": { "industry": "...", "size": "...", "role": "...", "maturity": "Стартап/Растущая/Зрелая/Кризисная", "growth_stage": "Выживание/Рост/Масштабирование/Оптимизация", "summary": "2-3 предложения" },
  "top_risks": [{ "code": "КОД", "title": "...", "what_happens": "...", "impact": "...", "severity": "critical/high/medium", "signal": "..." }],
  "recommendations": [{ "action": "...", "why": "...", "horizon": "quick_win/1_month/3_months/strategic", "effort": "low/medium/high" }],
  "diagnostic_hypothesis": "2-3 предложения — одна сквозная идея о корневой причине.",
  "next_step": { "product": "Экспресс-диагностика", "why": "персонализировано", "what_will_get": "конкретно", "price": "200 000 ₽", "duration": "5–7 рабочих дней", "guarantees": ["Гарантия возврата 100%", "Зачёт в Комплексный аудит"] }
}

ПРАВИЛА: Ровно 3 риска, 3-4 рекомендации, хотя бы одна quick_win. Никакого markdown. Только JSON.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Claude API не настроен на сервере.', fallback: true });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'invalid json' }); }
  }
  const { prompt } = body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });
  if (prompt.length > 20000) return res.status(400).json({ error: 'prompt too long' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!r.ok) { const e = await r.text(); throw new Error('Claude API ' + r.status + ': ' + e.slice(0,300)); }
    const json = await r.json();
    const text = json.content?.[0]?.text;
    if (!text) throw new Error('empty response');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON found');
    const data = JSON.parse(match[0]);
    if (!data.profile || !Array.isArray(data.top_risks) || !data.next_step) throw new Error('invalid structure');
    console.log('[vidim/api] v2.0 OK:', data.profile?.industry, '/', data.profile?.maturity);
    return res.status(200).json({ data, source: 'claude' });
  } catch(err) {
    console.error('[vidim/api] error:', err.message);
    return res.status(500).json({ error: err.message, fallback: true });
  }
};
