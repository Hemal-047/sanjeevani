const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const TEXT_MODEL = 'llama-3.3-70b';
const VISION_MODEL = 'qwen3-vl-235b-a22b';

function getHeaders() {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey || apiKey === 'your_venice_api_key_here') {
    throw new Error('VENICE_API_KEY is not configured');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function chatCompletion(messages, { model = TEXT_MODEL, temperature = 0.2, maxTokens = 4096 } = {}) {
  const res = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[VENICE] API error ${res.status} for model ${model}:`, body);
    throw new Error(`Venice API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function visionCompletion(base64Image, mimeType, textPrompt, { temperature = 0.2, maxTokens = 4096 } = {}) {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` },
        },
        { type: 'text', text: textPrompt },
      ],
    },
  ];

  return chatCompletion(messages, { model: VISION_MODEL, temperature, maxTokens });
}

module.exports = { chatCompletion, visionCompletion, TEXT_MODEL, VISION_MODEL };
