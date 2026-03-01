// AI generation streaming handlers
import { CORS_HEADERS, errorResponse, getUser } from './crypto.mjs';
import { getSession, saveSession, getVersions } from './db.mjs';
import { MODEL_OPTIONS, FRAMEWORKS } from './models.mjs';

const SYSTEM_PROMPT = `You are an expert UI developer. Convert the provided input into clean, production-ready frontend code.
Return ONLY the complete code without any explanation, markdown fences, or preamble.
The code must be self-contained and work without external dependencies beyond CDN imports.`;

// ── Provider streaming ───────────────────────────────────────────────────────

async function* streamClaude(messages, model, apiKey, hasThinking) {
  const body = {
    model: model.model_id || model.id,
    max_tokens: hasThinking ? 16000 : 16384,
    stream: true,
    system: SYSTEM_PROMPT,
    messages,
  };
  if (hasThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 10000 };
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'content_block_delta') {
          if (ev.delta?.type === 'thinking_delta') yield `\x00THINK\x00${ev.delta.thinking}`;
          else if (ev.delta?.type === 'text_delta') yield ev.delta.text;
        }
      } catch {}
    }
  }
}

async function* streamOpenAI(messages, modelId, apiKey, baseUrl = 'https://api.openai.com/v1') {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        const text = ev.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {}
    }
  }
}

async function* streamGemini(messages, modelId, apiKey) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map(p => p.type === 'image_url'
          ? { inline_data: { mime_type: p.image_url.url.match(/data:([^;]+)/)?.[1] || 'image/png', data: p.image_url.url.replace(/^data:[^,]+,/, '') } }
          : { text: p.text || p })
      : [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } }) }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        const text = ev.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {}
    }
  }
}

// ── Provider routing ─────────────────────────────────────────────────────────

function getGenerator(modelInfo, messages, apiKey) {
  const { provider, model_id } = modelInfo;
  switch (provider) {
    case 'Anthropic': return streamClaude(messages, modelInfo, apiKey, modelInfo.has_thinking);
    case 'OpenAI':    return streamOpenAI(messages, model_id, apiKey);
    case 'Google':    return streamGemini(messages, model_id, apiKey);
    case 'DeepSeek':  return streamOpenAI(messages, model_id, apiKey, 'https://api.deepseek.com/v1');
    case 'Alibaba':   return streamOpenAI(messages, model_id, apiKey, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    case 'Moonshot':  return streamOpenAI(messages, model_id, apiKey, 'https://api.moonshot.cn/v1');
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Streaming response builder ───────────────────────────────────────────────

function buildMessages(userContent, sessionMessages) {
  const messages = [...sessionMessages];
  messages.push({ role: 'user', content: userContent });
  return messages;
}

function imageContent(base64, mimeType, text) {
  return [
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
    { type: 'text', text },
  ];
}

function streamResponse(gen, env, sessionId, sessionMessages, userId) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  let fullOutput = '';

  (async () => {
    try {
      for await (const chunk of gen) {
        if (!chunk.startsWith('\x00THINK\x00')) fullOutput += chunk;
        await writer.write(enc.encode(chunk));
      }
      // Save session + emit session id
      const newSessionId = sessionId || crypto.randomUUID();
      const newMessages = [...sessionMessages, { role: 'assistant', content: fullOutput }];
      const versions = (await getVersions(env.DB, newSessionId)).concat([{ code: fullOutput, ts: new Date().toISOString() }]);
      await saveSession(env.DB, newSessionId, userId, newMessages, versions);
      await writer.write(enc.encode(`\n\n[SESSION_ID]${newSessionId}`));
    } catch (err) {
      await writer.write(enc.encode(`\n\n[ERROR]${err.message}`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked', 'X-Accel-Buffering': 'no' },
  });
}

// ── Route handlers ───────────────────────────────────────────────────────────

export async function generateImageHandler(request, env) {
  const authUser = await getUser(request, env);
  let formData;
  try { formData = await request.formData(); } catch { return errorResponse('INVALID_BODY', 'Multipart form data required'); }

  const file       = formData.get('file');
  const model      = formData.get('model') || 'claude';
  const framework  = formData.get('framework') || 'html';
  const apiKey     = formData.get('api_key') || '';
  const sessionId  = formData.get('session_id') || null;

  if (!file) return errorResponse('MISSING_FILE', 'Image file required');

  const modelInfo = MODEL_OPTIONS[model];
  if (!modelInfo) return errorResponse('INVALID_MODEL', `Unknown model: ${model}`);
  if (!apiKey) return errorResponse('MISSING_API_KEY', 'api_key is required');

  const ab = await file.arrayBuffer();
  if (ab.byteLength > 20 * 1024 * 1024) return errorResponse('FILE_TOO_LARGE', 'Max file size is 20MB', 413);

  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  const mime = file.type || 'image/png';
  const fwInfo = FRAMEWORKS[framework] || FRAMEWORKS['html'];
  const prompt = `Convert this screenshot to ${fwInfo.name} code (${fwInfo.description}).`;

  const { messages: sessionMessages } = await getSession(env.DB, sessionId || '');
  const userContent = imageContent(b64, mime, prompt);
  const messages = buildMessages(userContent, sessionMessages);

  return streamResponse(getGenerator(modelInfo, messages, apiKey), env, sessionId, sessionMessages, authUser?.sub);
}

export async function generateTextHandler(request, env) {
  const authUser = await getUser(request, env);
  let body;
  try { body = await request.json(); } catch { return errorResponse('INVALID_BODY', 'JSON required'); }

  const { text, model = 'claude', framework = 'html', api_key: apiKey = '', session_id: sessionId = null } = body || {};
  if (!text) return errorResponse('MISSING_TEXT', 'text is required');
  if (!apiKey) return errorResponse('MISSING_API_KEY', 'api_key is required');

  const modelInfo = MODEL_OPTIONS[model];
  if (!modelInfo) return errorResponse('INVALID_MODEL', `Unknown model: ${model}`);

  const fwInfo = FRAMEWORKS[framework] || FRAMEWORKS['html'];
  const prompt = `${text}\n\nConvert this to ${fwInfo.name} code (${fwInfo.description}).`;

  const { messages: sessionMessages } = await getSession(env.DB, sessionId || '');
  const messages = buildMessages([{ type: 'text', text: prompt }], sessionMessages);

  return streamResponse(getGenerator(modelInfo, messages, apiKey), env, sessionId, sessionMessages, authUser?.sub);
}

export async function generateUrlHandler(request, env) {
  const authUser = await getUser(request, env);
  let body;
  try { body = await request.json(); } catch { return errorResponse('INVALID_BODY', 'JSON required'); }

  const { url, model = 'claude', framework = 'html', api_key: apiKey = '', session_id: sessionId = null } = body || {};
  if (!url) return errorResponse('MISSING_URL', 'url is required');
  if (!apiKey) return errorResponse('MISSING_API_KEY', 'api_key is required');

  const modelInfo = MODEL_OPTIONS[model];
  if (!modelInfo) return errorResponse('INVALID_MODEL', `Unknown model: ${model}`);

  // Use screenshotting via a public API (or skip if no key)
  const ssKey = env.SCREENSHOT_API_KEY || '';
  let imageBase64 = null;
  let imageMime = 'image/png';

  if (ssKey) {
    const ssUrl = `https://api.screenshotone.com/take?access_key=${ssKey}&url=${encodeURIComponent(url)}&format=png&viewport_width=1280&viewport_height=900`;
    const ssRes = await fetch(ssUrl);
    if (ssRes.ok) {
      const ab = await ssRes.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    }
  }

  const fwInfo = FRAMEWORKS[framework] || FRAMEWORKS['html'];
  let userContent;
  if (imageBase64) {
    userContent = imageContent(imageBase64, imageMime, `Convert the screenshot of ${url} to ${fwInfo.name} code.`);
  } else {
    userContent = [{ type: 'text', text: `Create a ${fwInfo.name} recreation of the webpage at: ${url}. Make it visually accurate.` }];
  }

  const { messages: sessionMessages } = await getSession(env.DB, sessionId || '');
  const messages = buildMessages(userContent, sessionMessages);

  return streamResponse(getGenerator(modelInfo, messages, apiKey), env, sessionId, sessionMessages, authUser?.sub);
}

export async function versionsHandler(request, env, sessionId) {
  const versions = await getVersions(env.DB, sessionId);
  return new Response(JSON.stringify({ session_id: sessionId, versions }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
