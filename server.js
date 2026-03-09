const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Перевірка що сервер живий
app.get('/', (req, res) => {
  res.send('Tarot Backend працює!');
});

// Головний маршрут — інтерпретація карт через Claude
app.post('/interpret', async (req, res) => {
  const { question, cards } = req.body;

  if (!question || !cards || cards.length !== 3) {
    return res.status(400).json({ error: 'Потрібно question і 3 карти' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API ключ не налаштовано' });
  }

  const cardDescriptions = cards.map(c =>
    `• ${c.positionLabel}: «${c.name}» (${c.meaning})`
  ).join('\n');

  const prompt = `Ти — містичний оракул Таро, який говорить українською мовою. Твій стиль: поетичний, глибокий, особистий і духовний.

Користувач запитує: "${question}"

Три карти:
${cardDescriptions}

Дай цілісну інтерпретацію — 4-6 речень, говори на «ти», поєднай всі три карти в єдину оповідь з метафорами. Починай одразу з містичної фрази.`;

  try {
    // Спочатку отримуємо повну відповідь (без стрімінгу — надійніше)
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude error:', err);
      return res.status(502).json({ error: 'Помилка Claude API: ' + claudeRes.status });
    }

    const data = await claudeRes.json();
    const text = data.content[0].text;

    res.json({ interpretation: text });

  } catch (e) {
    console.error('Server error:', e);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Tarot Backend запущено на порту ' + PORT);
});
