const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Tarot Backend працює!');
});

app.post('/interpret', async (req, res) => {
  const { question, cards } = req.body;

  console.log('=== Новий запит ===');
  console.log('Питання:', question);
  console.log('Карти:', JSON.stringify(cards));

  if (!question || !cards || cards.length !== 3) {
    return res.status(400).json({ error: 'Потрібно question і 3 карти' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ПОМИЛКА: немає API ключа');
    return res.status(500).json({ error: 'API ключ не налаштовано' });
  }

  console.log('API ключ є:', apiKey.slice(0, 10) + '...');

  const cardDescriptions = cards.map(c =>
    `• ${c.positionLabel}: «${c.name}» (${c.meaning})`
  ).join('\n');

  const prompt = `Ти — містичний оракул Таро, який говорить українською мовою. Твій стиль: поетичний, глибокий, особистий і духовний.

Користувач запитує: "${question}"

Три карти:
${cardDescriptions}

Дай цілісну інтерпретацію — 4-6 речень, говори на «ти», поєднай всі три карти в єдину оповідь з метафорами. Починай одразу з містичної фрази.`;

  try {
    console.log('Відправляємо запит до Claude...');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    console.log('Відповідь Claude статус:', claudeRes.status);

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude error body:', err);
      return res.status(502).json({ error: 'Помилка Claude API: ' + claudeRes.status, details: err });
    }

    const data = await claudeRes.json();
    console.log('Успішно! Довжина відповіді:', data.content[0].text.length);

    res.json({ interpretation: data.content[0].text });

  } catch (e) {
    console.error('Server error:', e.message);
    res.status(500).json({ error: 'Внутрішня помилка: ' + e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Tarot Backend запущено на порту ' + PORT);
});
