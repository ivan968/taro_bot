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

  if (!question || !cards || cards.length !== 3) {
    return res.status(400).json({ error: 'Потрібно question і 3 карти' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log('ПОМИЛКА: немає GROQ_API_KEY');
    return res.status(500).json({ error: 'API ключ не налаштовано' });
  }

  const cardDescriptions = cards.map(c =>
    `• ${c.positionLabel}: «${c.name}» (${c.meaning})`
  ).join('\n');

  const prompt = `Ти — містичний оракул Таро, який говорить українською мовою. Твій стиль: поетичний, глибокий, особистий і духовний.

Користувач запитує: "${question}"

Три карти:
${cardDescriptions}

Дай цілісну інтерпретацію — 4-6 речень, говори на «ти», поєднай всі три карти в єдину оповідь з метафорами. Починай одразу з містичної фрази. Відповідай тільки українською мовою.`;

  try {
    console.log('Відправляємо запит до Groq...');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.9,
      }),
    });

    console.log('Відповідь Groq статус:', groqRes.status);

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'Помилка Groq API: ' + groqRes.status });
    }

    const data = await groqRes.json();
    const text = data.choices[0].message.content;

    console.log('Успішно! Довжина відповіді:', text.length);
    res.json({ interpretation: text });

  } catch (e) {
    console.error('Server error:', e.message);
    res.status(500).json({ error: 'Внутрішня помилка: ' + e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Tarot Backend запущено на порту ' + PORT);
});
