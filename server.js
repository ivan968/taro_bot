/**
 * ═══════════════════════════════════════════════════════════
 * MYSTIC TAROT — server.js
 * Бекенд для Telegram Mini App
 * Проксі між фронтендом і Claude API (зі стрімінгом)
 * ═══════════════════════════════════════════════════════════
 */

const express = require('express');
const cors    = require('cors');
const app     = express();

/* ──────────────────────────────────────────────────────────
   CORS — дозволяємо запити з будь-якого домену
   (Telegram Mini App відкривається з telegram.org)
────────────────────────────────────────────────────────── */
app.use(cors({
  origin: '*', // або вкажи свій домен: 'https://твій-сайт.com'
  methods: ['POST', 'GET'],
}));

app.use(express.json());

/* ──────────────────────────────────────────────────────────
   GET / — перевірка що сервер живий
   Відкрий у браузері твій Railway URL — побачиш цей текст
────────────────────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.send('🔮 Mystic Tarot Backend — працює!');
});

/* ──────────────────────────────────────────────────────────
   POST /interpret — головний маршрут
   Отримує питання + карти від фронтенду,
   відправляє запит до Claude API,
   стрімить відповідь назад до клієнта
────────────────────────────────────────────────────────── */
app.post('/interpret', async (req, res) => {

  /* 1. Перевіряємо що тіло запиту не пусте */
  const { question, cards } = req.body;

  if (!question || !cards || cards.length !== 3) {
    return res.status(400).json({
      error: 'Потрібно передати question і масив з 3 карт'
    });
  }

  /* 2. Перевіряємо що API ключ є на сервері */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY не налаштовано на сервері'
    });
  }

  /* 3. Будуємо промпт для Claude */
  const cardDescriptions = cards.map(c =>
    `• ${c.positionLabel}: «${c.name}» (${c.meaning}) — ${c.interpretation}`
  ).join('\n');

  const prompt = `Ти — містичний оракул Таро, який говорить українською мовою. Твій стиль: поетичний, глибокий, особистий і духовний — як мудрий провидець, що дивиться крізь завісу часу.

Користувач запитує: "${question}"

Випали три карти:
${cardDescriptions}

Дай цілісну інтерпретацію розкладу. Вимоги:
- Говори безпосередньо до людини (на «ти»)
- Поєднай всі три карти в єдину плавну оповідь — не перелічуй їх окремо
- Відповідь має бути особистою, враховуй саме це питання
- Використовуй метафори, образи, поетичну мову
- Обсяг: 4–6 речень, не більше
- НЕ починай зі слів «Звичайно», «Ось», «Я»
- Починай одразу з містичної, захоплюючої фрази`;

  /* 4. Налаштовуємо заголовки для SSE стрімінгу до клієнта */
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // вимикаємо буфер nginx

  /* 5. Відправляємо запит до Claude API */
  let claudeResponse;
  try {
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        stream:     true,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
  } catch (networkErr) {
    console.error('Помилка підключення до Claude API:', networkErr);
    return res.status(502).json({ error: 'Не вдалося підключитися до Claude API' });
  }

  /* 6. Якщо Claude повернув помилку */
  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    console.error('Claude API error:', claudeResponse.status, errorText);
    return res.status(claudeResponse.status).json({
      error: `Claude API повернув помилку: ${claudeResponse.status}`
    });
  }

  /* 7. Прокидаємо стрімінг від Claude прямо до клієнта */
  claudeResponse.body.pipe(res);

  /* 8. Якщо клієнт відключився — зупиняємо стрімінг */
  req.on('close', () => {
    claudeResponse.body.destroy();
  });
});

/* ──────────────────────────────────────────────────────────
   ЗАПУСК СЕРВЕРА
   Railway автоматично передає PORT через змінну середовища
────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔮 Tarot Backend запущено на порту ${PORT}`);
});
