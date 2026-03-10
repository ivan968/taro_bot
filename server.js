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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('ПОМИЛКА: немає GEMINI_API_KEY');
    return res.status(500).json({ error: 'API ключ не налаштовано' });
  }

  const cardDescriptions = cards.map(c =>
    `• ${c.positionLabel}: «${c.name}» (${c.meaning})`
  ).join('\n');

  const prompt = `Ти — містичний оракул Таро, який говорить українською мовою. Твій стиль: поетичний, глибокий, особистий і духовний.

Користувач запитує: "${question}"

Три карти:
${cardDescriptions}

Дай цілісну інтерпретацію — 4-6 речень, говори на «ти», поєднай всі три карти в єдину оповідь з метафорами. Починай одразу з містичної фрази. Відповідай тільки українською.`;

  try {
    console.log('Відправляємо запит до Gemini...');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 800,
          }
        }),
      }
    );

    console.log('Відповідь Gemini статус:', geminiRes.status);

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'Помилка Gemini API: ' + geminiRes.status });
    }

    const data = await geminiRes.json();
    const text = data.candidates[0].content.parts[0].text;

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
