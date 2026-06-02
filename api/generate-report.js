// =============================================================
// api/generate-report.js
// Vercel Serverless Function — безопасный прокси Claude API
// API-ключ хранится в Vercel Environment Variables (ANTHROPIC_API_KEY)
// Браузер ключ никогда не видит
// =============================================================

const SYSTEM_PROMPT = `Ты — внешний операционный директор, аналитик Видим. Ты разбираешь компании 100–500+ сотрудников, страдающих от операционного хаоса. Стиль: говори как директор по росту. Структурно, без воды. С акцентом на конкретику и коммерческие последствия. Никакого корпоративного жаргона.

В контексте Видима клиент нашего звонта. Твоя задача — говорить ему код, по которому работает его компания.

Формат ответа: строгий JSON, никакого своего текста. Только JSON-объект со следующей схемой:

{
  "profile": { "industry": "...", "size": "...", "structure": "...", "age": "...", "growth": "...", "role": "..." },
  "top_risks": [
    { "code": "RISK_NAME_IN_CAPS", "title": "...", "impact": "...", "severity": "high" }
  ],
  "recommendations": ["...", "...", "..."],
  "next_step": { "product": "Экспресс-диагностика", "why": "...", "price": "200 000 ₽", "guarantees": ["Гарантия возврата 100%", "Зачёт в стоимость Комплексного аудита"] }
}

Ровно 3 риска. Никакого markdown, никаких объяснений вне JSON-объекта. Только сам JSON-объект.`;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[vidim/api] ANTHROPIC_API_KEY не задан в Vercel');
    return res.status(503).json({
      error: 'Claude API не настроен на сервере. Используется демо-режим.',
      fallback: true
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Невалидный JSON в теле запроса' });
    }
  }

  const { prompt } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Поле prompt обязательно и должно быть строкой' });
  }

  if (prompt.length > 15000) {
    return res.status(400).json({ error: 'Промпт слишком длинный' });
  }

  try {
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error('Claude API ' + claudeResponse.status + ': ' + errText.slice(0, 300));
    }

    const json = await claudeResponse.json();
    const text = json.content?.[0]?.text;
    if (!text) throw new Error('Claude вернул пустой ответ');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('В ответе Claude не найден JSON-объект');

    const data = JSON.parse(match[0]);

    if (!data.profile || !Array.isArray(data.top_risks) || !data.next_step) {
      throw new Error('Claude вернул JSON с неверной структурой');
    }

    console.log('[vidim/api] Отчёт сгенерирован, отрасль:', data.profile?.industry);
    return res.status(200).json({ data, source: 'claude' });

  } catch (err) {
    console.error('[vidim/api] Ошибка:', err.message);
    return res.status(500).json({
      error: 'Claude API недоступен: ' + err.message,
      fallback: true
    });
  }
};
