"use client";

/**
 * Sprint 2 Frontend:
 * S6  — UI state machine: idle / sending / streaming / success / error
 * S7  — API key validation with instant feedback
 * S8  — Stream content and error message in separate areas
 * S9  — Credit race-condition guard (negative balance prevention)
 * S2  — Input mode tabs: Screenshot / URL / Text
 * S4  — session_id iterative improvement (Revise button)
 * S5  — 8 total models including claude-opus, haiku, gpt4-turbo, gemini-pro
 * S8  — Bootstrap framework support
 *
 * Sprint 3 Frontend:
 * S5  — Variant comparison UI: Current vs Previous side-by-side tab
 * S6  — Code editor: editable textarea toggle with line count
 * S7  — Enhanced status panel: elapsed timer + chars streamed
 *
 * Sprint 4 Frontend (s4-f4):
 * s4-f4 — Extended thinking visualisation: collapsible thinking panel,
 *          spinning Brain indicator while model reasons, token counter
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Code2, Eye, Copy, Download, X, Upload, Key, Cpu, Layers,
  ChevronDown, ChevronUp, Coins, Plus, CheckCircle, Github, Wand2,
  AlertCircle, CheckCircle2, Link2, FileText, RefreshCw, Send,
  Pencil, Columns2, Clock, Hash, Brain, User, LogIn, Video,
} from "lucide-react";
import RoadmapMiniProgress from "../components/RoadmapMiniProgress";
import AccountPanel, { AUTH_TOKEN_KEY, AUTH_EMAIL_KEY } from "../components/AccountPanel";
import AuthModal from "../components/AuthModal";

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const USE_WEBSOCKET_STREAMING = (() => {
  const flag = (process.env.NEXT_PUBLIC_WEBSOCKET_GENERATION ?? "false").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
})();
const INITIAL_CREDITS = 100;
const CREDITS_KEY = "s2c_credits";

const MODELS = [
  // Anthropic — Claude 3.x
  { id: "claude-haiku",          name: "Claude 3.5 Haiku",    badge: "Fast",    badgeColor: "bg-amber-500/10 text-amber-400",  credits: 1,  desc: "Fastest Claude",        keyPrefix: "sk-ant-", hasThinking: false },
  { id: "claude",                name: "Claude 3.5 Sonnet",   badge: "Premium", badgeColor: "bg-amber-500/10 text-amber-300",  credits: 5,  desc: "Best accuracy",         keyPrefix: "sk-ant-", hasThinking: false },
  { id: "claude-opus",           name: "Claude 3 Opus",       badge: "Opus",    badgeColor: "bg-amber-600/10 text-amber-300",  credits: 15, desc: "Most powerful 3.x",     keyPrefix: "sk-ant-", hasThinking: false },
  // Sprint 4 — Extended thinking (s4-b2 / s4-f4)
  { id: "claude-sonnet-thinking",name: "Claude 3.7 (Think)",  badge: "Think",   badgeColor: "bg-cyan-500/10 text-cyan-300",    credits: 20, desc: "Extended reasoning",    keyPrefix: "sk-ant-", hasThinking: true  },
  // Anthropic — Claude 4.x
  { id: "claude-sonnet-4-5",     name: "Claude Sonnet 4.5",   badge: "New",     badgeColor: "bg-orange-500/10 text-orange-300",credits: 6,  desc: "Speed & quality",       keyPrefix: "sk-ant-", hasThinking: false },
  { id: "claude-sonnet-4-6",     name: "Claude Sonnet 4.6",   badge: "Latest",  badgeColor: "bg-orange-500/10 text-orange-200",credits: 7,  desc: "Best Sonnet yet",       keyPrefix: "sk-ant-", hasThinking: false },
  { id: "claude-opus-4-5",       name: "Claude Opus 4.5",     badge: "Opus4",   badgeColor: "bg-red-500/10 text-red-300",      credits: 18, desc: "Premium reasoning",     keyPrefix: "sk-ant-", hasThinking: false },
  { id: "claude-opus-4-6",       name: "Claude Opus 4.6",     badge: "Top",     badgeColor: "bg-red-500/10 text-red-200",      credits: 22, desc: "Most powerful Claude",  keyPrefix: "sk-ant-", hasThinking: false },
  // OpenAI
  { id: "gpt4o-mini",            name: "GPT-4o Mini",         badge: "Economy", badgeColor: "bg-green-500/10 text-green-400",  credits: 1,  desc: "Fast & cheap",          keyPrefix: "sk-",     hasThinking: false },
  { id: "gpt4o",                 name: "GPT-4o",              badge: "Balanced",badgeColor: "bg-blue-500/10 text-blue-400",    credits: 3,  desc: "Good balance",          keyPrefix: "sk-",     hasThinking: false },
  { id: "gpt4-turbo",            name: "GPT-4 Turbo",         badge: "Turbo",   badgeColor: "bg-blue-500/10 text-blue-300",    credits: 4,  desc: "High quality",          keyPrefix: "sk-",     hasThinking: false },
  { id: "gpt-4-1",               name: "GPT-4.1",             badge: "New",     badgeColor: "bg-blue-500/10 text-blue-200",    credits: 5,  desc: "OpenAI flagship",       keyPrefix: "sk-",     hasThinking: false },
  { id: "o3-mini",               name: "o3-mini (Reasoning)", badge: "Reason",  badgeColor: "bg-sky-500/10 text-sky-300",      credits: 8,  desc: "Text-only reasoning",   keyPrefix: "sk-",     hasThinking: false },
  // Google
  { id: "gemini",                name: "Gemini 1.5 Flash",    badge: "Flash",   badgeColor: "bg-purple-500/10 text-purple-400",credits: 2,  desc: "Fast multimodal",       keyPrefix: "AIza",    hasThinking: false },
  { id: "gemini-pro",            name: "Gemini 1.5 Pro",      badge: "Pro",     badgeColor: "bg-purple-500/10 text-purple-300",credits: 6,  desc: "Google's best",         keyPrefix: "AIza",    hasThinking: false },
  // DeepSeek
  { id: "deepseek",              name: "DeepSeek V3",         badge: "OSS",     badgeColor: "bg-teal-500/10 text-teal-400",    credits: 2,  desc: "Best open-source",      keyPrefix: "sk-",     hasThinking: false },
  { id: "deepseek-r1",           name: "DeepSeek R1",         badge: "Reason",  badgeColor: "bg-teal-500/10 text-teal-300",    credits: 4,  desc: "Text-only reasoning",   keyPrefix: "sk-",     hasThinking: false },
  // Alibaba Qwen
  { id: "qwen-vl",               name: "Qwen VL Max",         badge: "Vision",  badgeColor: "bg-indigo-500/10 text-indigo-400",credits: 4,  desc: "Alibaba vision model",  keyPrefix: "sk-",     hasThinking: false },
  { id: "qwen-vl-plus",          name: "Qwen VL Plus",        badge: "Fast",    badgeColor: "bg-indigo-500/10 text-indigo-300",credits: 2,  desc: "Fast & economical",     keyPrefix: "sk-",     hasThinking: false },
  // Moonshot (Kimi)
  { id: "kimi",                  name: "Kimi (Moonshot)",     badge: "128k",    badgeColor: "bg-pink-500/10 text-pink-400",    credits: 3,  desc: "Long context model",    keyPrefix: "sk-",     hasThinking: false },
] as const;

type ModelId = typeof MODELS[number]["id"];
type Framework = "html" | "react" | "vue" | "bootstrap" | "svelte" | "alpine";
type InputMode = "screenshot" | "video" | "url" | "text";

/** S6 — deterministic UI state machine */
type AppState = "idle" | "sending" | "streaming" | "success" | "error";

// ─── S9 — Credits hook with race-condition guard ───────────────────────────────
function useCredits() {
  const [credits, setCreditsState] = useState(INITIAL_CREDITS);

  useEffect(() => {
    const stored = localStorage.getItem(CREDITS_KEY);
    setCreditsState(stored !== null ? Number(stored) : INITIAL_CREDITS);
  }, []);

  const _syncedSet = useCallback((n: number) => {
    const val = Math.max(0, n);
    localStorage.setItem(CREDITS_KEY, String(val));
    setCreditsState(val);
  }, []);

  const safeDeduct = useCallback((n: number): boolean => {
    const stored = localStorage.getItem(CREDITS_KEY);
    const current = stored !== null ? Number(stored) : INITIAL_CREDITS;
    if (current < n) return false;
    _syncedSet(current - n);
    return true;
  }, [_syncedSet]);

  const add = useCallback((n: number) => {
    const stored = localStorage.getItem(CREDITS_KEY);
    const current = stored !== null ? Number(stored) : INITIAL_CREDITS;
    _syncedSet(current + n);
  }, [_syncedSet]);

  return { credits, safeDeduct, add };
}

// ─── S7 — API key validation ──────────────────────────────────────────────────
const ANTHROPIC_MODELS = [
  "claude", "claude-opus", "claude-haiku", "claude-sonnet-thinking",
  "claude-sonnet-4-5", "claude-sonnet-4-6", "claude-opus-4-5", "claude-opus-4-6",
] as const;

function validateApiKey(key: string, modelId: ModelId): string | null {
  if (!key.trim()) return "API key is required";
  if ((ANTHROPIC_MODELS as readonly string[]).includes(modelId) && !key.startsWith("sk-ant-")) {
    return "Claude requires an Anthropic key starting with sk-ant-…";
  }
  if (["gpt4o", "gpt4o-mini", "gpt4-turbo"].includes(modelId) && !key.startsWith("sk-")) {
    return "OpenAI requires a key starting with sk-…";
  }
  if (["gemini", "gemini-pro"].includes(modelId) && !key.startsWith("AIza")) {
    return "Gemini requires a key starting with AIza…";
  }
  return null;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#1a1a1a] border border-white/10
        text-white text-sm px-4 py-3 rounded-xl shadow-xl transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
    >
      <CheckCircle size={15} className="text-green-400 shrink-0" />
      {message}
    </div>
  );
}

// ─── Input Mode Tab ────────────────────────────────────────────────────────────
function InputModeTab({
  mode, label, icon, active, onClick,
}: {
  mode: InputMode; label: string; icon: React.ReactNode;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium rounded-lg transition-colors
        ${active ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AppPage() {
  // Input mode (S2)
  const [inputMode, setInputMode] = useState<InputMode>("screenshot");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");

  // Core state
  const [apiKey, setApiKey] = useState("");
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("claude");
  const [selectedFramework, setSelectedFramework] = useState<Framework>("html");
  const [generatedCode, setGeneratedCode] = useState("");

  // Session / Revise (S4)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showRevise, setShowRevise] = useState(false);
  const [reviseText, setReviseText] = useState("");

  // S3-S5 — Variant comparison
  const [previousCode, setPreviousCode] = useState("");

  // S3-S6 — Code editor toggle
  const [isEditing, setIsEditing] = useState(false);

  // S3-S7 — Status panel
  const [elapsedSec, setElapsedSec] = useState(0);
  const [charsStreamed, setCharsStreamed] = useState(0);
  const streamStartRef = useRef<number>(0);

  // Sprint 4 s4-f4 — Extended thinking visualisation
  const [thinkingText, setThinkingText] = useState("");
  const [showThinking, setShowThinking] = useState(false);

  // Sprint 4 s4-f2/s4-f3 — Auth state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  /** S6 — single source of truth for UI state */
  const [appState, setAppState] = useState<AppState>("idle");
  /** S8 — separate error message area */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"code" | "preview" | "compare">("code");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const { credits, safeDeduct, add } = useCredits();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reviseInputRef = useRef<HTMLInputElement>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const userStoppedRef = useRef(false);

  const currentModel = MODELS.find((m) => m.id === selectedModel)!;
  const isGenerating = appState === "sending" || appState === "streaming";

  // S7 — live API key validation
  const apiKeyError = apiKeyTouched ? validateApiKey(apiKey, selectedModel) : null;
  const apiKeyValid = apiKey.trim().length > 0 && apiKeyError === null;

  const canGenerate = (() => {
    if (isGenerating || !apiKeyValid || credits < currentModel.credits) return false;
    if (inputMode === "screenshot" || inputMode === "video") return !!imageFile;
    if (inputMode === "url") return urlInput.trim().length > 0;
    if (inputMode === "text") return textInput.trim().length >= 10;
    return false;
  })();

  // Backend health check
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((r) => setBackendOnline(r.ok))
      .catch(() => setBackendOnline(false));
  }, []);

  // Sprint 4 s4-f2 — Load auth token from localStorage
  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const email = localStorage.getItem(AUTH_EMAIL_KEY);
    if (token) setAuthToken(token);
    if (email) setAuthEmail(email);
  }, []);

  // S3-S7 — Elapsed timer during generation
  useEffect(() => {
    if (!isGenerating) return;
    streamStartRef.current = Date.now();
    setElapsedSec(0);
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - streamStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Dosya okunamadı"));
      reader.readAsDataURL(file);
    });
  };

  // File handling
  const handleFile = async (file: File) => {
    const isVideo = inputMode === "video";

    if (isVideo && !file.type.startsWith("video/")) {
      return showToast("Only video files are supported for video mode.");
    }
    if (!isVideo && !file.type.startsWith("image/")) {
      return showToast("Only image files are supported for this mode.");
    }
    if (file.size > 20 * 1024 * 1024) return showToast("File too large (max 20MB)");

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setGeneratedCode("");
    setErrorMessage(null);
    setAppState("idle");
    setActiveTab("code");
    setSessionId(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setErrorMessage(null);
    setAppState("idle");
    setSessionId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove("border-blue-500");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Switch input mode — reset related state
  const switchInputMode = (mode: InputMode) => {
    setInputMode(mode);
    setErrorMessage(null);
    setIsEditing(false);
    if (appState === "error") setAppState("idle");
  };

  // ── Stream reader shared across all generate calls ────────────────────────
  const applyStreamChunk = (chunk: string, state: { code: string }) => {
    let { code } = state;
    let nextCode = code;

    // Sprint 4 s4-f4: Extended thinking chunks
    if (chunk.includes("\x00THINK\x00")) {
      const parts = chunk.split("\x00THINK\x00");
      if (parts[0]) {
        nextCode += parts[0];
        setGeneratedCode(nextCode);
      }
      const thinkingParts = parts.slice(1).join("");
      if (thinkingParts) {
        setThinkingText((prev) => prev + thinkingParts);
        setShowThinking(true);
      }
      state.code = nextCode;
      return nextCode;
    }

    if (chunk.includes("[SESSION_ID]")) {
      const parts = chunk.split("\n\n[SESSION_ID]");
      if (parts[0]) {
        nextCode += parts[0];
        setGeneratedCode(nextCode);
        if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
      }
      const newSid = parts[1]?.trim();
      if (newSid) setSessionId(newSid);
      state.code = nextCode;
      return nextCode;
    }

    if (chunk.trim().startsWith('{"type":"error"')) {
      try {
        const parsed = JSON.parse(chunk.trim());
        if (parsed?.type === "error") {
          throw new Error(parsed.message ?? "Streaming error");
        }
      } catch (jsonErr) {
        if (jsonErr instanceof SyntaxError) {
          nextCode += chunk;
          setGeneratedCode(nextCode);
          if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
        } else {
          throw jsonErr;
        }
      }
    } else {
      nextCode += chunk;
      setGeneratedCode(nextCode);
      setCharsStreamed(nextCode.length);
      if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }

    state.code = nextCode;
    return nextCode;
  };

  const readStream = async (res: Response, creditCount: number) => {
    setAppState("streaming");
    setCharsStreamed(0);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const state = { code: "" };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      state.code = applyStreamChunk(chunk, state);
    }

    setAppState("success");
    showToast(`Done! ${credits - creditCount} credits remaining`);
  };

  const getWebSocketUrl = () => {
    const backend = new URL(BACKEND_URL);
    const proto = backend.protocol === "https:" ? "wss:" : "ws:";
    const base = `${proto}//${backend.host}${backend.pathname.replace(/\/$/, "")}`;
    return `${base}/api/generate/ws`;
  };

  // ── Sprint 3 — WebSocket generation (feature flag) ────────────────────────
  const generateViaWebSocket = async (overrideTextPrompt?: string) => {
    const creditCount = currentModel.credits;
    setAppState("streaming");
    setCharsStreamed(0);
    userStoppedRef.current = false;

    const streamState = { code: "" };
    let streamError: Error | null = null;
    let receivedAnyChunk = false;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(getWebSocketUrl());
      websocketRef.current = ws;

      ws.onopen = async () => {
        try {
          const payload: Record<string, unknown> = {
            input_mode: inputMode === "screenshot" ? "screenshot" : inputMode === "video" ? "video" : inputMode,
            api_key: apiKey.trim(),
            model: selectedModel,
            framework: selectedFramework,
            session_id: sessionId,
          };

          if (inputMode === "url" && !overrideTextPrompt) {
            payload.url = urlInput.trim();
          } else if (inputMode === "text" || overrideTextPrompt) {
            payload.input_mode = "text";
            payload.description = overrideTextPrompt?.trim() ?? textInput.trim();
          } else {
            const dataUrl = await readFileAsDataUrl(imageFile as File);
            if (inputMode === "video") payload.video_b64 = dataUrl;
            else payload.image_b64 = dataUrl;
          }

          ws.send(JSON.stringify(payload));
        } catch (err) {
          streamError = err instanceof Error ? err : new Error("WebSocket prepare failed");
          ws.close(1011, "prepare failed");
          reject(streamError);
        }
      };

      ws.onmessage = (event) => {
        try {
          receivedAnyChunk = true;
          streamState.code = applyStreamChunk(event.data, streamState);
        } catch (err) {
          streamError = err instanceof Error ? err : new Error("Failed to process stream");
          ws.close(1011, "stream parse failed");
          reject(streamError);
        }
      };

      ws.onerror = () => {
        if (!streamError) streamError = new Error("WebSocket connection error");
        reject(streamError);
      };

      ws.onclose = (event) => {
        websocketRef.current = null;
        if (userStoppedRef.current) {
          resolve();
          return;
        }
        if (streamError) {
          reject(streamError);
          return;
        }
        if (!receivedAnyChunk || event.code === 1008) {
          reject(new Error("WebSocket streaming is not available."));
          return;
        }
        setAppState("success");
        showToast(`Done! ${credits - creditCount} credits remaining`);
        resolve();
      };
    });
  };

  const generateViaHttp = async (overrideTextPrompt?: string) => {
    let res: Response;

    if ((inputMode === "screenshot" || inputMode === "video") && imageFile && !overrideTextPrompt) {
      const formData = new FormData();
      const endpoint = inputMode === "video" ? "/api/generate/video" : "/api/generate";
      const fieldName = inputMode === "video" ? "video" : "image";
      formData.append(fieldName, imageFile);
      formData.append("api_key", apiKey.trim());
      formData.append("model", selectedModel);
      formData.append("framework", selectedFramework);
      if (sessionId) formData.append("session_id", sessionId);

      res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        body: formData,
        signal: abortRef.current?.signal,
      });

    } else if (inputMode === "url" && !overrideTextPrompt) {
      res = await fetch(`${BACKEND_URL}/api/generate/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          url: urlInput.trim(),
          model: selectedModel,
          framework: selectedFramework,
          session_id: sessionId,
        }),
        signal: abortRef.current?.signal,
      });

    } else {
      const description = overrideTextPrompt ?? textInput.trim();
      res = await fetch(`${BACKEND_URL}/api/generate/from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          description,
          model: selectedModel,
          framework: selectedFramework,
          session_id: sessionId,
        }),
        signal: abortRef.current?.signal,
      });
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: "Unknown server error" }));
      const msg = errBody?.message ?? errBody?.detail ?? "Generation failed";
      throw new Error(msg);
    }

    await readStream(res, currentModel.credits);
    if (inputMode === "video") {
      // Unused in this branch.
    }
  };

  // ── S6 + S9 — Generate with state machine & race-condition guard ─────────────
  const generateCode = async (overrideTextPrompt?: string) => {
    if (!canGenerate && !overrideTextPrompt) return;

    if (!safeDeduct(currentModel.credits)) {
      setErrorMessage(`Insufficient credits. Need ${currentModel.credits}, have ${credits}.`);
      setAppState("error");
      return;
    }

    abortRef.current = new AbortController();
    setAppState("sending");
    setErrorMessage(null);
    setActiveTab("code");
    setIsEditing(false);
    setThinkingText("");
    setShowThinking(false);
    if (!overrideTextPrompt) {
      // S3-S5 — save current as "previous" before clearing for variant comparison
      if (generatedCode.trim()) setPreviousCode(generatedCode);
      setGeneratedCode("");
      setSessionId(null);
    } else {
      // Revise: save current as previous too
      if (generatedCode.trim()) setPreviousCode(generatedCode);
    }

    try {
      if (USE_WEBSOCKET_STREAMING) {
        if (!imageFile && ["screenshot", "video"].includes(inputMode)) {
          throw new Error(`${inputMode === "video" ? "Video" : "Screenshot"} input is required.`);
        }
        if (!urlInput.trim() && inputMode === "url") {
          throw new Error("URL is required.");
        }
        if (!textInput.trim() && inputMode === "text" && !overrideTextPrompt) {
          throw new Error("Text input is required.");
        }
        if (overrideTextPrompt && overrideTextPrompt.trim().length < 10) {
          throw new Error("Override prompt too short.");
        }

        try {
          await generateViaWebSocket(overrideTextPrompt);
          if (userStoppedRef.current) return;
          return;
        } catch (err) {
          if (err instanceof Error && err.message === "WebSocket streaming is not available.") {
            await generateViaHttp(overrideTextPrompt);
            return;
          }
          throw err;
        }
      }

      await generateViaHttp(overrideTextPrompt);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setAppState("idle");
        add(currentModel.credits);
        return;
      }
      const msg = err instanceof Error ? err.message : "Generation failed";
      setErrorMessage(msg);
      setAppState("error");
      add(currentModel.credits);
    }
  };

  // S4 — Revise: submit revision text with existing session
  const applyRevision = async () => {
    const prompt = reviseText.trim();
    if (!prompt || prompt.length < 10) return showToast("Please describe what to change (min 10 chars)");
    setShowRevise(false);
    setReviseText("");
    await generateCode(prompt);
  };

  const stopGenerating = () => {
    userStoppedRef.current = true;
    websocketRef.current?.close(1000, "User cancelled");
    websocketRef.current = null;
    abortRef.current?.abort();
    if (appState === "streaming" || appState === "sending") {
      add(currentModel.credits);
      setAppState("idle");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    showToast("Copied to clipboard!");
  };

  const downloadCode = () => {
    const ext = selectedFramework === "react" ? "jsx"
      : selectedFramework === "vue" ? "vue"
      : "html";
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `generated.${ext}`; a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded!");
  };

  const creditClass = credits === 0
    ? "bg-red-500/10 border-red-500/30 text-red-400"
    : credits < 10
    ? "bg-red-500/10 border-red-500/20 text-red-400"
    : "bg-amber-500/10 border-amber-500/20 text-amber-400";

  const generateBtnContent = () => {
    if (appState === "sending") return (
      <>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-3" />
        </span>
        Sending…
      </>
    );
    if (appState === "streaming") return (
      <>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 dot-3" />
        </span>
        Stop Generating
      </>
    );
    if (credits < currentModel.credits) return (<><Coins size={16} /> Insufficient Credits</>);
    return (
      <>
        <Wand2 size={16} />
        Generate Code
        <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-[12px]">
          {currentModel.credits} <Coins size={9} className="inline -mt-0.5" />
        </span>
      </>
    );
  };

  const FRAMEWORKS: { id: Framework; label: string }[] = [
    { id: "html",      label: "HTML" },
    { id: "react",     label: "React" },
    { id: "vue",       label: "Vue" },
    { id: "bootstrap", label: "Bootstrap" },
    { id: "svelte",    label: "Svelte" },
    { id: "alpine",    label: "Alpine.js" },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 bg-[#0a0a0a] border-b border-white/[0.06] px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 select-none">
          <div className="w-7 h-7 bg-white rounded flex items-center justify-center">
            <span className="text-black font-black text-base leading-none">/</span>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">
            Pic<span className="text-blue-400">ToFrontend</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <RoadmapMiniProgress compact className="hidden md:flex" />

          {/* S6 — state indicator */}
          {isGenerating && (
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <span className={`w-1.5 h-1.5 rounded-full bg-blue-400 ${appState === "streaming" ? "dot-1" : ""}`} />
              {appState === "sending" ? "Sending…" : "Streaming…"}
            </div>
          )}
          {appState === "success" && (
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2 size={12} /> Done
            </div>
          )}
          {/* S4 — session indicator */}
          {sessionId && appState !== "sending" && appState !== "streaming" && (
            <div className="hidden sm:flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <RefreshCw size={11} /> Session Active
            </div>
          )}

          {/* Backend status */}
          <div className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
            <span className={`w-1.5 h-1.5 rounded-full ${backendOnline === null ? "bg-gray-500" : backendOnline ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-gray-400">{backendOnline === null ? "Checking…" : backendOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Credits */}
          <div className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border ${creditClass}`}>
            <Coins size={12} />
            <span className="font-semibold">{credits}</span>
            <span className="text-current opacity-70">credits</span>
          </div>
          {!authToken && (
            <button
              onClick={() => { add(50); showToast("+50 credits added!"); }}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-white/[0.08] hover:border-white/20 transition-colors"
            >
              <Plus size={12} /> Add Credits
            </button>
          )}
          {/* s4-q1 — A/B compare link */}
          <Link
            href="/compare"
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-white/[0.06] hover:border-violet-500/40 text-gray-500 hover:text-violet-400 transition-all"
            title="Model Karşılaştırma"
          >
            A/B
          </Link>

          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors">
            <Github size={18} />
          </a>

          {/* Sprint 4 s4-f2/f3 — Auth button */}
          {authToken && authEmail ? (
            <button
              onClick={() => setShowAccount(true)}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-white/[0.08] hover:border-white/20 text-gray-400 hover:text-white transition-colors"
              title={authEmail}
            >
              <User size={12} />
              <span className="hidden sm:inline max-w-[100px] truncate">{authEmail.split("@")[0]}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-blue-500/30 hover:border-blue-500/60 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <LogIn size={12} /> Giriş Yap
            </button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <aside className="w-[380px] shrink-0 border-r border-white/[0.06] flex flex-col overflow-y-auto">

          {/* ── S2 — Input Mode Tabs ── */}
          <div className="p-3 border-b border-white/[0.06] bg-[#0d0d0d]">
            <div className="flex bg-[#111] border border-white/[0.08] rounded-xl p-1 gap-1">
              <InputModeTab mode="screenshot" label="Screenshot" icon={<Upload size={12} />}
                active={inputMode === "screenshot"} onClick={() => switchInputMode("screenshot")} />
              <InputModeTab mode="video" label="Video" icon={<Video size={12} />}
                active={inputMode === "video"} onClick={() => switchInputMode("video")} />
              <InputModeTab mode="url" label="URL" icon={<Link2 size={12} />}
                active={inputMode === "url"} onClick={() => switchInputMode("url")} />
              <InputModeTab mode="text" label="Text" icon={<FileText size={12} />}
                active={inputMode === "text"} onClick={() => switchInputMode("text")} />
            </div>
          </div>

          <div className="p-5 flex flex-col gap-5 flex-1">

            {/* ── Screenshot / Video drop zone ── */}
            {(inputMode === "screenshot" || inputMode === "video") && (
              <div
                ref={dropZoneRef}
                className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
                  ${imagePreview ? "border-transparent" : "border-white/10 hover:border-blue-500/50"}`}
                onDragOver={(e) => { e.preventDefault(); dropZoneRef.current?.classList.add("border-blue-500"); }}
                onDragLeave={() => dropZoneRef.current?.classList.remove("border-blue-500")}
                onDrop={onDrop}
                onClick={() => !imagePreview && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={inputMode === "video" ? "video/mp4,video/webm,video/quicktime" : "image/png,image/jpeg,image/webp,image/gif"}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {imagePreview ? (
                  <div className="relative">
                    {inputMode === "video" ? (
                      <video
                        src={imagePreview}
                        controls
                        className="w-full rounded-xl max-h-[200px] object-contain"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="Preview" className="w-full rounded-xl object-contain max-h-[200px]" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 bg-white/[0.04] rounded-xl flex items-center justify-center">
                      <Upload size={22} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-gray-300 text-sm">
                        {inputMode === "video"
                          ? "Drop a video here or "
                          : "Drop a screenshot here or "}
                        <span className="text-blue-400">browse</span>
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {inputMode === "video" ? "MP4, WEBM, MOV " : "PNG, JPG, WEBP "}
                        — max 20 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── URL input ── */}
            {inputMode === "url" && (
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  <Link2 size={11} /> Page URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-[#111] border border-white/[0.08] focus:border-blue-500/50 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">
                  We&apos;ll screenshot the page and convert it to code. Public URLs only.
                </p>
              </div>
            )}

            {/* ── Text description ── */}
            {inputMode === "text" && (
              <div>
                <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  <FileText size={11} /> UI Description
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                  placeholder="Describe the UI you want to create…&#10;&#10;e.g. A modern dashboard with a sidebar nav, stats cards at the top, and a table of recent orders below."
                  className="w-full bg-[#111] border border-white/[0.08] focus:border-blue-500/50 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors resize-none"
                />
                <p className={`text-[11px] mt-1 ${textInput.length < 10 && textInput.length > 0 ? "text-red-400" : "text-gray-600"}`}>
                  {textInput.length}/4000 chars {textInput.length < 10 && textInput.length > 0 ? "(min 10)" : ""}
                </p>
              </div>
            )}

            {/* ── S7 — API Key with instant validation feedback ── */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <Key size={11} /> API Key
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onBlur={() => setApiKeyTouched(true)}
                    onFocus={() => setApiKeyTouched(false)}
                    placeholder={
                      (ANTHROPIC_MODELS as readonly string[]).includes(selectedModel) ? "sk-ant-…" :
                      ["gemini", "gemini-pro"].includes(selectedModel) ? "AIza…" : "sk-…"
                    }
                    className={`w-full bg-[#111] border rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors
                      ${apiKeyError ? "border-red-500/50 focus:border-red-500/70" :
                        apiKeyValid ? "border-green-500/40 focus:border-green-500/60" :
                        "border-white/[0.08] focus:border-blue-500/50"}`}
                  />
                  {apiKeyTouched && apiKey && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {apiKeyError
                        ? <AlertCircle size={14} className="text-red-400" />
                        : <CheckCircle2 size={14} className="text-green-400" />}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 bg-[#111] border border-white/[0.08] rounded-lg text-gray-500 hover:text-white transition-colors"
                >
                  {showApiKey ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              {apiKeyError && (
                <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={10} /> {apiKeyError}
                </p>
              )}
              {!apiKeyError && (
                <p className="text-[11px] text-gray-600 mt-1.5">
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">OpenAI</a>
                  {" · "}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Anthropic</a>
                  {" · "}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Gemini</a>
                </p>
              )}
            </div>

            {/* Model Selection — 8 models in 2-col grid */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <Cpu size={11} /> AI Model
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setApiKeyTouched(false); }}
                    className={`relative text-left p-2.5 rounded-lg border transition-all
                      ${selectedModel === m.id
                        ? "border-blue-500/50 bg-blue-500/5 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
                        : "border-white/[0.06] bg-[#111] hover:border-white/20"}`}
                  >
                    {selectedModel === m.id && (
                      <CheckCircle size={10} className="absolute top-1.5 right-1.5 text-blue-400" />
                    )}
                    <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded mb-1 ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                    <p className="text-white text-[11px] font-semibold leading-tight flex items-center gap-1">
                      {m.name}
                      {m.hasThinking && <Brain size={9} className="text-cyan-400 shrink-0" />}
                    </p>
                    <p className="text-gray-600 text-[10px] mt-0.5">{m.desc}</p>
                    <p className="text-amber-400 text-[10px] font-semibold mt-0.5">{m.credits}cr</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Framework — now includes Bootstrap */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                <Layers size={11} /> Framework
              </label>
              <div className="flex bg-[#111] border border-white/[0.08] rounded-lg p-1 gap-1">
                {FRAMEWORKS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedFramework(id)}
                    className={`flex-1 py-1.5 rounded-md text-[12px] font-medium transition-colors
                      ${selectedFramework === id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* S8 — Dedicated error message area */}
            {errorMessage && appState === "error" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Generation failed</p>
                  <p className="text-red-400/80 leading-snug">{errorMessage}</p>
                </div>
                <button
                  onClick={() => { setErrorMessage(null); setAppState("idle"); }}
                  className="ml-auto shrink-0 hover:text-red-300 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Generate / Stop button */}
            <div className="mt-auto">
              <button
                onClick={appState === "streaming" ? stopGenerating : () => generateCode()}
                disabled={appState === "sending" || (!isGenerating && !canGenerate)}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-[15px] transition-all
                  ${appState === "streaming"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                    : appState === "sending"
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 cursor-wait"
                    : canGenerate
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"}`}
              >
                {generateBtnContent()}
              </button>
              <p className="text-center text-gray-600 text-[12px] mt-2">
                {credits} credits remaining
                {credits < 20 && (
                  <button
                    onClick={() => { add(50); showToast("+50 credits added!"); }}
                    className="ml-2 text-blue-400 hover:underline"
                  >
                    + Add 50
                  </button>
                )}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right Panel ── */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs + actions */}
          <div className="shrink-0 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#0f0f0f]">
            <div className="flex">
              {/* Code tab */}
              <button
                onClick={() => { setActiveTab("code"); setIsEditing(false); }}
                className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                  ${activeTab === "code"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"}`}
              >
                <Code2 size={14} />
                {"index." + (selectedFramework === "react" ? "jsx" : selectedFramework === "vue" ? "vue" : selectedFramework === "svelte" ? "svelte" : "html")}
              </button>

              {/* Preview tab */}
              <button
                onClick={() => { if (generatedCode) setActiveTab("preview"); }}
                disabled={!generatedCode}
                className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                  ${activeTab === "preview"
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"}`}
              >
                <Eye size={14} /> Preview
              </button>

              {/* S3-S5 — Compare tab (only when there's a previous version) */}
              {previousCode && generatedCode && (
                <button
                  onClick={() => setActiveTab("compare" as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                    ${(activeTab as string) === "compare"
                      ? "border-violet-500 text-violet-300"
                      : "border-transparent text-gray-500 hover:text-gray-300"}`}
                >
                  <Columns2 size={14} /> Compare
                </button>
              )}
            </div>
            {generatedCode && (
              <div className="flex items-center gap-2">
                {/* S3-S6 — Edit toggle */}
                {activeTab === "code" && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors
                      ${isEditing
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                        : "text-gray-400 hover:text-white border-white/[0.08] hover:border-white/20"}`}
                  >
                    <Pencil size={12} /> {isEditing ? "Editing" : "Edit"}
                  </button>
                )}
                {/* S4 — Revise button */}
                {sessionId && (
                  <button
                    onClick={() => {
                      setShowRevise(!showRevise);
                      if (!showRevise) setTimeout(() => reviseInputRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors"
                  >
                    <RefreshCw size={12} /> Revise
                  </button>
                )}
                <button onClick={copyCode} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <Copy size={12} /> Copy
                </button>
                <button onClick={downloadCode} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <Download size={12} /> Download
                </button>
                {/* S3-S7 — char count */}
                <span className="text-gray-700 text-[11px] flex items-center gap-1">
                  <Hash size={10} /> {generatedCode.length.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* S4 — Revise input bar */}
          {showRevise && (
            <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-violet-500/20 bg-violet-500/5">
              <RefreshCw size={13} className="text-violet-400 shrink-0" />
              <input
                ref={reviseInputRef}
                type="text"
                value={reviseText}
                onChange={(e) => setReviseText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyRevision()}
                placeholder="Describe what to change… (e.g. Make the header dark blue)"
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none"
              />
              <button
                onClick={applyRevision}
                disabled={isGenerating || reviseText.trim().length < 5}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={11} /> Apply
              </button>
              <button onClick={() => { setShowRevise(false); setReviseText(""); }} className="text-gray-600 hover:text-gray-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            {/* S3-S6 — Code view (read) or edit (textarea) */}
            {activeTab === "code" && !isEditing && (
              <pre
                ref={codeRef}
                className="h-full overflow-auto p-5 text-[13px] leading-relaxed text-gray-300 font-mono bg-[#0c0c0c] whitespace-pre-wrap break-words"
              >
                {generatedCode || (
                  <span className="text-gray-700">
                    {inputMode === "screenshot"
                      ? `// Your generated code will appear here...\n//\n// 1. Upload a screenshot\n// 2. Enter your API key\n// 3. Select AI model\n// 4. Click "Generate Code"\n//\n// Code streams in real-time as AI writes it!`
                      : inputMode === "video"
                      ? `// Video mode:\n// 1. Upload a video (MP4/WEBM/MOV)\n// 2. Enter your API key\n// 3. Select AI model\n// 4. Click "Generate Code"\n//\n// A representative frame is extracted and converted to code in real-time!`
                      : inputMode === "url"
                      ? `// URL mode:\n// 1. Paste a public URL\n// 2. Enter your API key\n// 3. Click Generate — we'll screenshot and convert it!`
                      : `// Text mode:\n// 1. Describe the UI you want to create\n// 2. Enter your API key\n// 3. Click Generate — AI will build it from scratch!`}
                  </span>
                )}
              </pre>
            )}

            {/* S3-S6 — Edit mode textarea */}
            {activeTab === "code" && isEditing && (
              <div className="h-full flex flex-col bg-[#0c0c0c]">
                <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-orange-500/5 border-b border-orange-500/10 text-[11px] text-orange-400">
                  <Pencil size={11} /> Editing mode — changes affect the Preview tab instantly
                  <button onClick={() => setIsEditing(false)} className="ml-auto text-gray-600 hover:text-gray-400">
                    <X size={12} />
                  </button>
                </div>
                <textarea
                  value={generatedCode}
                  onChange={(e) => setGeneratedCode(e.target.value)}
                  className="flex-1 resize-none bg-[#0c0c0c] text-[13px] leading-relaxed text-gray-300 font-mono p-5 focus:outline-none"
                  spellCheck={false}
                />
                <div className="shrink-0 px-4 py-1 border-t border-white/[0.04] flex items-center gap-4 text-[11px] text-gray-600">
                  <span>{generatedCode.split("\n").length} lines</span>
                  <span>{generatedCode.length.toLocaleString()} chars</span>
                </div>
              </div>
            )}

            {/* Preview tab */}
            {activeTab === "preview" && (
              <iframe className="w-full h-full border-0" sandbox="allow-scripts" srcDoc={generatedCode} />
            )}

            {/* S3-S5 — Compare tab: side-by-side Previous vs Current */}
            {(activeTab as string) === "compare" && previousCode && generatedCode && (
              <div className="h-full flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.06]">
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-[11px] text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-gray-500" /> Previous version
                  </div>
                  <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-gray-400 font-mono whitespace-pre-wrap break-words bg-[#0a0a0a]">
                    {previousCode}
                  </pre>
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-500/5 border-b border-blue-500/10 text-[11px] text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-400" /> Current version
                  </div>
                  <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap break-words bg-[#0c0c0c]">
                    {generatedCode}
                  </pre>
                </div>
              </div>
            )}

            {/* Sprint 4 s4-f4 — Extended thinking panel */}
            {thinkingText && (
              <div className="absolute top-3 right-3 w-72 bg-[#111] border border-cyan-500/20 rounded-xl shadow-xl overflow-hidden z-10">
                <button
                  onClick={() => setShowThinking(!showThinking)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-cyan-400 hover:bg-cyan-500/5 transition-colors"
                >
                  {appState === "streaming" ? (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400" />
                    </span>
                  ) : (
                    <Brain size={12} />
                  )}
                  <span className="font-medium">Extended Thinking</span>
                  <span className="ml-auto text-[10px] text-gray-600">
                    {thinkingText.length.toLocaleString()} chars
                  </span>
                  {showThinking
                    ? <ChevronUp size={10} className="text-gray-500" />
                    : <ChevronDown size={10} className="text-gray-500" />}
                </button>
                {showThinking && (
                  <pre className="px-3 pb-3 text-[10px] leading-relaxed text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-white/[0.05]">
                    {thinkingText}
                  </pre>
                )}
              </div>
            )}

            {/* S3-S7 — Enhanced streaming indicator with elapsed time + chars */}
            {appState === "streaming" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1a1a1a] border border-white/10 px-4 py-2 rounded-full text-sm text-gray-300">
                <span className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 dot-1" />
                  <span className="w-2 h-2 rounded-full bg-blue-400 dot-2" />
                  <span className="w-2 h-2 rounded-full bg-blue-400 dot-3" />
                </span>
                {currentModel.hasThinking && thinkingText && charsStreamed === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Brain size={12} className="text-cyan-400" /> Reasoning…
                  </span>
                ) : (
                  <span>AI is coding…</span>
                )}
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Clock size={10} /> {elapsedSec}s
                </span>
                {charsStreamed > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Hash size={10} /> {charsStreamed.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Sending indicator */}
            {appState === "sending" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0c]/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <span className="flex gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-1" />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-2" />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-3" />
                  </span>
                  <span className="text-sm text-gray-400">
                    {inputMode === "video"
                      ? "Extracting frame and processing…"
                      : inputMode === "url"
                      ? "Taking screenshot and processing…"
                      : "Processing…"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-600">
                    <Clock size={10} /> {elapsedSec}s
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Toast message={toastMsg} visible={toastVisible} />

      {/* Sprint 4 s4-f3 — Account Panel slide-in */}
      {showAccount && authToken && authEmail && (
        <AccountPanel
          token={authToken}
          email={authEmail}
          onClose={() => setShowAccount(false)}
        />
      )}

      {/* Auth popup modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(token, email) => {
            setAuthToken(token);
            setAuthEmail(email);
          }}
        />
      )}
    </div>
  );
}
