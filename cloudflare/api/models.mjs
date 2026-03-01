// Model and framework definitions (port from backend/models.py)

export const FRAMEWORKS = {
  html:      { id: 'html',      name: 'HTML + Tailwind',    description: 'Plain HTML with Tailwind CSS CDN' },
  react:     { id: 'react',     name: 'React + Tailwind',   description: 'React functional components with hooks' },
  vue:       { id: 'vue',       name: 'Vue + Tailwind',     description: 'Vue 3 Composition API' },
  bootstrap: { id: 'bootstrap', name: 'HTML + Bootstrap 5', description: 'Bootstrap 5 CDN' },
  svelte:    { id: 'svelte',    name: 'Svelte + Tailwind',  description: 'Svelte components' },
  alpine:    { id: 'alpine',    name: 'HTML + Alpine.js',   description: 'Alpine.js directives' },
};

export const MODEL_OPTIONS = {
  'claude-haiku':           { id: 'claude-haiku',           name: 'Claude Haiku',         provider: 'Anthropic', model_id: 'claude-haiku-4-5-20251001',   credits: 1,  supports_vision: true,  has_thinking: false },
  'claude':                 { id: 'claude',                 name: 'Claude Sonnet',        provider: 'Anthropic', model_id: 'claude-sonnet-4-6',           credits: 5,  supports_vision: true,  has_thinking: false },
  'claude-opus':            { id: 'claude-opus',            name: 'Claude Opus',          provider: 'Anthropic', model_id: 'claude-opus-4-6',             credits: 15, supports_vision: true,  has_thinking: false },
  'claude-sonnet-thinking': { id: 'claude-sonnet-thinking', name: 'Claude Sonnet Thinking', provider: 'Anthropic', model_id: 'claude-sonnet-4-6',       credits: 20, supports_vision: true,  has_thinking: true  },
  'claude-sonnet-4-5':      { id: 'claude-sonnet-4-5',      name: 'Claude Sonnet 4.5',   provider: 'Anthropic', model_id: 'claude-sonnet-4-5',           credits: 6,  supports_vision: true,  has_thinking: false },
  'claude-sonnet-4-6':      { id: 'claude-sonnet-4-6',      name: 'Claude Sonnet 4.6',   provider: 'Anthropic', model_id: 'claude-sonnet-4-6',           credits: 7,  supports_vision: true,  has_thinking: false },
  'claude-opus-4-5':        { id: 'claude-opus-4-5',        name: 'Claude Opus 4.5',     provider: 'Anthropic', model_id: 'claude-opus-4-5',             credits: 18, supports_vision: true,  has_thinking: false },
  'claude-opus-4-6':        { id: 'claude-opus-4-6',        name: 'Claude Opus 4.6',     provider: 'Anthropic', model_id: 'claude-opus-4-6',             credits: 22, supports_vision: true,  has_thinking: false },
  'gpt4o-mini':             { id: 'gpt4o-mini',             name: 'GPT-4o Mini',         provider: 'OpenAI',    model_id: 'gpt-4o-mini',                 credits: 1,  supports_vision: true,  has_thinking: false },
  'gpt4o':                  { id: 'gpt4o',                  name: 'GPT-4o',              provider: 'OpenAI',    model_id: 'gpt-4o',                      credits: 3,  supports_vision: true,  has_thinking: false },
  'gpt4-turbo':             { id: 'gpt4-turbo',             name: 'GPT-4 Turbo',         provider: 'OpenAI',    model_id: 'gpt-4-turbo',                 credits: 4,  supports_vision: true,  has_thinking: false },
  'gpt-4-1':                { id: 'gpt-4-1',                name: 'GPT-4.1',             provider: 'OpenAI',    model_id: 'gpt-4.1',                     credits: 5,  supports_vision: true,  has_thinking: false },
  'o3-mini':                { id: 'o3-mini',                name: 'o3-mini',             provider: 'OpenAI',    model_id: 'o3-mini',                     credits: 8,  supports_vision: false, has_thinking: false },
  'gemini':                 { id: 'gemini',                 name: 'Gemini Flash',        provider: 'Google',    model_id: 'gemini-2.0-flash',             credits: 2,  supports_vision: true,  has_thinking: false },
  'gemini-pro':             { id: 'gemini-pro',             name: 'Gemini Pro',          provider: 'Google',    model_id: 'gemini-2.0-pro',               credits: 6,  supports_vision: true,  has_thinking: false },
  'deepseek':               { id: 'deepseek',               name: 'DeepSeek V3',         provider: 'DeepSeek',  model_id: 'deepseek-chat',               credits: 2,  supports_vision: false, has_thinking: false },
  'deepseek-r1':            { id: 'deepseek-r1',            name: 'DeepSeek R1',         provider: 'DeepSeek',  model_id: 'deepseek-reasoner',           credits: 4,  supports_vision: false, has_thinking: false },
  'qwen-vl':                { id: 'qwen-vl',                name: 'Qwen VL Max',         provider: 'Alibaba',   model_id: 'qwen-vl-max',                 credits: 4,  supports_vision: true,  has_thinking: false },
  'qwen-vl-plus':           { id: 'qwen-vl-plus',           name: 'Qwen VL Plus',        provider: 'Alibaba',   model_id: 'qwen-vl-plus',                credits: 2,  supports_vision: true,  has_thinking: false },
  'kimi':                   { id: 'kimi',                   name: 'Kimi (128k)',          provider: 'Moonshot',  model_id: 'moonshot-v1-128k',            credits: 3,  supports_vision: false, has_thinking: false },
};

export function modelsResponse() {
  const models = Object.values(MODEL_OPTIONS).map(m => ({
    id: m.id, name: m.name, provider: m.provider, credits: m.credits,
    supports_vision: m.supports_vision, has_thinking: m.has_thinking,
  }));
  const frameworks = Object.values(FRAMEWORKS);
  return new Response(JSON.stringify({ models, frameworks }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
