"use client";

/**
 * Sprint 2 Frontend:
 * S6  — UI state machine: idle / sending / streaming / success / error
 * S9  — Credit race-condition guard (negative balance prevention)
 * S2  — Input mode tabs: Screenshot / URL / Text
 * S4  — session_id iterative improvement (Revise button)
 * S5  — 8 total models including claude-opus, haiku, gpt4-turbo, gemini-pro
 *
 * Sprint 3 Frontend:
 * S5  — Variant comparison UI: Current vs Previous side-by-side tab
 * S6  — Code editor: editable textarea toggle with line count
 * S7  — Enhanced status panel: elapsed timer + chars streamed
 *
 * Sprint 4 Frontend (s4-f4):
 * s4-f4 — Extended thinking visualisation: collapsible thinking panel
 *
 * Sprint 5: Sidebar redesign — narrow 64px sidebar, full-width input/output
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Code2, Eye, Copy, Download, X, Upload, Wand2, Coins, Plus,
  AlertCircle, Link2, FileText, RefreshCw, Send,
  Pencil, Columns2, Clock, Hash, Brain, User, Video,
  Folder, Gift, MessageCircle, Settings, ChevronDown, ChevronUp,
} from "lucide-react";
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

// Default model used for all generations (backend manages API keys)
const DEFAULT_MODEL = "claude-haiku";
const DEFAULT_FRAMEWORK = "html";

const MODELS = [
  { id: "claude-haiku",        credits: 1,  hasThinking: false },
  { id: "claude",              credits: 5,  hasThinking: false },
  { id: "claude-opus",         credits: 15, hasThinking: false },
  { id: "claude-sonnet-thinking", credits: 20, hasThinking: true },
  { id: "claude-sonnet-4-5",   credits: 6,  hasThinking: false },
  { id: "claude-sonnet-4-6",   credits: 7,  hasThinking: false },
  { id: "claude-opus-4-5",     credits: 18, hasThinking: false },
  { id: "claude-opus-4-6",     credits: 22, hasThinking: false },
  { id: "gpt4o-mini",          credits: 1,  hasThinking: false },
  { id: "gpt4o",               credits: 3,  hasThinking: false },
  { id: "gpt4-turbo",          credits: 4,  hasThinking: false },
  { id: "gpt-4-1",             credits: 5,  hasThinking: false },
  { id: "o3-mini",             credits: 8,  hasThinking: false },
  { id: "gemini",              credits: 2,  hasThinking: false },
  { id: "gemini-pro",          credits: 6,  hasThinking: false },
  { id: "deepseek",            credits: 2,  hasThinking: false },
  { id: "deepseek-r1",         credits: 4,  hasThinking: false },
  { id: "qwen-vl",             credits: 4,  hasThinking: false },
  { id: "qwen-vl-plus",        credits: 2,  hasThinking: false },
  { id: "kimi",                credits: 3,  hasThinking: false },
] as const;

type ModelId = typeof MODELS[number]["id"];
type Framework = "html" | "react" | "vue" | "bootstrap" | "svelte" | "alpine";
type InputMode = "screenshot" | "video" | "url" | "text";
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

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#1a1a1a] border border-white/10
      text-white text-sm px-4 py-3 rounded-xl shadow-xl transition-all duration-300
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
    >
      <span className="text-green-400">✓</span>
      {message}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AppPage() {
  const [inputMode, setInputMode] = useState<InputMode>("screenshot");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");

  // Fixed defaults — no user-facing model/framework/apiKey selection
  const selectedModel: ModelId = DEFAULT_MODEL;
  const selectedFramework: Framework = DEFAULT_FRAMEWORK;
  const apiKey = "";

  const [generatedCode, setGeneratedCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showRevise, setShowRevise] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [previousCode, setPreviousCode] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [charsStreamed, setCharsStreamed] = useState(0);
  const streamStartRef = useRef<number>(0);
  const [thinkingText, setThinkingText] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "preview" | "compare">("code");
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

  const canGenerateIgnoringCredits = (() => {
    if (isGenerating) return false;
    if (inputMode === "screenshot" || inputMode === "video") return !!imageFile;
    if (inputMode === "url") return urlInput.trim().length > 0;
    if (inputMode === "text") return textInput.trim().length >= 10;
    return false;
  })();
  const hasEnoughCredits = credits >= currentModel.credits;
  const needsCredits = canGenerateIgnoringCredits && !hasEnoughCredits;
  const canGenerate = canGenerateIgnoringCredits && hasEnoughCredits;

  // Backend health check (silent)
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {});
  }, []);

  // Load auth token from localStorage / URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      const urlEmail = params.get("email");
      const urlUserId = params.get("userId");
      if (urlToken && urlEmail && urlUserId) {
        localStorage.setItem(AUTH_TOKEN_KEY, urlToken);
        localStorage.setItem(AUTH_EMAIL_KEY, urlEmail);
        localStorage.setItem("ptf_user_id", urlUserId);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const email = localStorage.getItem(AUTH_EMAIL_KEY);
      if (token) setAuthToken(token);
      if (email) setAuthEmail(email);
    }
  }, []);

  // Elapsed timer during generation
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

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });

  const handleFile = async (file: File) => {
    const isVideo = inputMode === "video";
    if (isVideo && !file.type.startsWith("video/")) return showToast("Only video files are supported.");
    if (!isVideo && !file.type.startsWith("image/")) return showToast("Only image files are supported.");
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
    dropZoneRef.current?.classList.remove("!border-blue-500/50");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const switchInputMode = (mode: InputMode) => {
    setInputMode(mode);
    setErrorMessage(null);
    setIsEditing(false);
    if (appState === "error") setAppState("idle");
  };

  const applyStreamChunk = (chunk: string, state: { code: string }) => {
    let { code } = state;
    let nextCode = code;

    if (chunk.includes("\x00THINK\x00")) {
      const parts = chunk.split("\x00THINK\x00");
      if (parts[0]) { nextCode += parts[0]; setGeneratedCode(nextCode); }
      const thinkingParts = parts.slice(1).join("");
      if (thinkingParts) { setThinkingText((prev) => prev + thinkingParts); setShowThinking(true); }
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
        if (parsed?.type === "error") throw new Error(parsed.message ?? "Streaming error");
      } catch (jsonErr) {
        if (jsonErr instanceof SyntaxError) {
          nextCode += chunk;
          setGeneratedCode(nextCode);
          if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
        } else { throw jsonErr; }
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
      state.code = applyStreamChunk(decoder.decode(value, { stream: true }), state);
    }
    setAppState("success");
    showToast(`Done! ${credits - creditCount} credits remaining`);
  };

  const getWebSocketUrl = () => {
    const backend = new URL(BACKEND_URL);
    const proto = backend.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${backend.host}${backend.pathname.replace(/\/$/, "")}/api/generate/ws`;
  };

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
            api_key: apiKey,
            model: selectedModel,
            framework: selectedFramework,
            session_id: sessionId,
          };
          if (inputMode === "url" && !overrideTextPrompt) { payload.url = urlInput.trim(); }
          else if (inputMode === "text" || overrideTextPrompt) {
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
        try { receivedAnyChunk = true; streamState.code = applyStreamChunk(event.data, streamState); }
        catch (err) {
          streamError = err instanceof Error ? err : new Error("Failed to process stream");
          ws.close(1011, "stream parse failed");
          reject(streamError);
        }
      };
      ws.onerror = () => { if (!streamError) streamError = new Error("WebSocket connection error"); reject(streamError); };
      ws.onclose = (event) => {
        websocketRef.current = null;
        if (userStoppedRef.current) { resolve(); return; }
        if (streamError) { reject(streamError); return; }
        if (!receivedAnyChunk || event.code === 1008) { reject(new Error("WebSocket streaming is not available.")); return; }
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
      formData.append("api_key", apiKey);
      formData.append("model", selectedModel);
      formData.append("framework", selectedFramework);
      if (sessionId) formData.append("session_id", sessionId);
      res = await fetch(`${BACKEND_URL}${endpoint}`, { method: "POST", body: formData, signal: abortRef.current?.signal });
    } else if (inputMode === "url" && !overrideTextPrompt) {
      res = await fetch(`${BACKEND_URL}/api/generate/from-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, url: urlInput.trim(), model: selectedModel, framework: selectedFramework, session_id: sessionId }),
        signal: abortRef.current?.signal,
      });
    } else {
      const description = overrideTextPrompt ?? textInput.trim();
      res = await fetch(`${BACKEND_URL}/api/generate/from-text`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, description, model: selectedModel, framework: selectedFramework, session_id: sessionId }),
        signal: abortRef.current?.signal,
      });
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: "Unknown server error" }));
      throw new Error(errBody?.message ?? errBody?.detail ?? "Generation failed");
    }
    await readStream(res, currentModel.credits);
  };

  const generateCode = async (overrideTextPrompt?: string) => {
    if (!canGenerate && !overrideTextPrompt) return;
    if (!safeDeduct(currentModel.credits)) { window.location.href = "/"; return; }
    abortRef.current = new AbortController();
    setAppState("sending");
    setErrorMessage(null);
    setActiveTab("code");
    setIsEditing(false);
    setThinkingText("");
    setShowThinking(false);
    if (!overrideTextPrompt) {
      if (generatedCode.trim()) setPreviousCode(generatedCode);
      setGeneratedCode("");
      setSessionId(null);
    } else {
      if (generatedCode.trim()) setPreviousCode(generatedCode);
    }
    try {
      if (USE_WEBSOCKET_STREAMING) {
        try { await generateViaWebSocket(overrideTextPrompt); if (userStoppedRef.current) return; return; }
        catch (err) {
          if (err instanceof Error && err.message === "WebSocket streaming is not available.") {
            await generateViaHttp(overrideTextPrompt); return;
          }
          throw err;
        }
      }
      await generateViaHttp(overrideTextPrompt);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") { setAppState("idle"); add(currentModel.credits); return; }
      setErrorMessage(err instanceof Error ? err.message : "Generation failed");
      setAppState("error");
      add(currentModel.credits);
    }
  };

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
    if (appState === "streaming" || appState === "sending") { add(currentModel.credits); setAppState("idle"); }
  };

  const copyCode = () => { navigator.clipboard.writeText(generatedCode); showToast("Copied to clipboard!"); };

  const downloadCode = () => {
    const ext = "html";
    const blob = new Blob([generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `generated.${ext}`; a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded!");
  };

  const resetAll = () => {
    setGeneratedCode(""); setPreviousCode("");
    setImageFile(null); setImagePreview(null);
    setUrlInput(""); setTextInput("");
    setSessionId(null); setAppState("idle"); setErrorMessage(null);
    setIsEditing(false); setShowRevise(false); setReviseText("");
    setThinkingText(""); setActiveTab("code");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Sidebar button ────────────────────────────────────────────────────────
  const SidebarBtn = ({ icon, label, onClick, highlighted = false }: {
    icon: React.ReactNode; label: string; onClick: () => void; highlighted?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1 w-full px-1 py-2 rounded-lg transition-colors
        ${highlighted
          ? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/20"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}
    >
      {icon}
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );

  const generateBtnContent = () => {
    if (needsCredits) return (<><Coins size={16} /> Get More Credits →</>);
    return (<><Wand2 size={16} /> Generate Code</>);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">

      {/* ── Narrow Sidebar ── */}
      <nav className="w-16 shrink-0 flex flex-col items-center py-3 gap-0.5 border-r border-white/[0.06] bg-[#0d0d0d]">
        {/* Logo */}
        <Link href="/" className="mb-3 p-1 rounded-lg hover:bg-white/5 transition-colors" title="Home">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-sm leading-none">/</span>
          </div>
        </Link>

        <div className="flex flex-col gap-0.5 w-full px-2">
          <SidebarBtn icon={<Folder size={17} />} label="Projects" onClick={() => {}} />
          <SidebarBtn icon={<Plus size={17} />} label="New" onClick={resetAll} highlighted />
        </div>

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 w-full px-2">
          <SidebarBtn icon={<Gift size={17} />} label="Feedback" onClick={() => {}} />
          <SidebarBtn icon={<MessageCircle size={17} />} label="Support" onClick={() => {}} />
          <SidebarBtn icon={<Settings size={17} />} label="Settings" onClick={() => {}} />
          {/* Account */}
          <button
            onClick={() => authToken ? setShowAccount(true) : setShowAuthModal(true)}
            title={authEmail ?? "Sign in"}
            className="flex flex-col items-center gap-1 w-full px-1 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
              {authEmail
                ? <span className="text-white text-[11px] font-bold">{authEmail[0].toUpperCase()}</span>
                : <User size={14} />}
            </div>
            <span className="text-[9px] leading-none">Account</span>
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* INPUT AREA — visible when no code and not actively generating */}
        {!generatedCode && appState !== "sending" && !isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
            <div className="w-full max-w-[760px]">

              {/* Input mode tabs */}
              <div className="flex rounded-[10px] bg-[#111] border border-white/[0.06] p-1 mb-5 gap-1">
                {([
                  { mode: "screenshot" as InputMode, label: "Upload",  icon: <Upload size={13} /> },
                  { mode: "url"        as InputMode, label: "URL",     icon: <Link2 size={13} /> },
                  { mode: "text"       as InputMode, label: "Text",    icon: <FileText size={13} /> },
                  { mode: "video"      as InputMode, label: "Video",   icon: <Video size={13} /> },
                ]).map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    onClick={() => switchInputMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium rounded-lg transition-colors
                      ${inputMode === mode ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    {icon}{label}
                  </button>
                ))}
              </div>

              {/* Screenshot / Video drop zone */}
              {(inputMode === "screenshot" || inputMode === "video") && (
                <>
                  <div
                    ref={dropZoneRef}
                    className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
                      ${imagePreview ? "border-transparent" : "border-white/10 hover:border-white/20"}`}
                    onDragOver={(e) => { e.preventDefault(); dropZoneRef.current?.classList.add("!border-blue-500/50"); }}
                    onDragLeave={() => dropZoneRef.current?.classList.remove("!border-blue-500/50")}
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
                        {inputMode === "video"
                          ? <video src={imagePreview} controls className="w-full rounded-xl max-h-[300px] object-contain" />
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={imagePreview} alt="Preview" className="w-full rounded-xl object-contain max-h-[300px]" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(); }}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors"
                        ><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="py-16 flex flex-col items-center gap-3 text-center">
                        <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center">
                          <Upload size={24} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="text-gray-300 text-[15px]">Drop up to 5 screenshots or a single video</p>
                          <p className="text-gray-600 text-sm mt-1">Supports PNG, JPG, MP4, MOV, WebM (max 20MB each, 30s video)</p>
                          <p className="text-blue-400 text-sm mt-2 cursor-pointer hover:underline">Browse files</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {!imagePreview && (
                    <>
                      <div className="flex items-center gap-4 my-5">
                        <div className="flex-1 h-px bg-white/[0.06]" />
                        <span className="text-gray-600 text-sm">or</span>
                        <div className="flex-1 h-px bg-white/[0.06]" />
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => switchInputMode("video")}
                          className="px-6 py-2.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-[#222] text-sm font-medium transition-colors"
                        >
                          Record Screen
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* URL input */}
              {inputMode === "url" && (
                <div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-[#111] border border-white/[0.08] focus:border-blue-500/50 rounded-xl px-4 py-4 text-base text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors"
                  />
                  <p className="text-[12px] text-gray-600 mt-2">We&apos;ll screenshot the page and convert it to code. Public URLs only.</p>
                </div>
              )}

              {/* Text description */}
              {inputMode === "text" && (
                <div>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={7}
                    placeholder={"Describe the UI you want to create…\n\ne.g. A modern dashboard with a sidebar nav, stats cards at the top, and a table of recent orders below."}
                    className="w-full bg-[#111] border border-white/[0.08] focus:border-blue-500/50 rounded-xl px-4 py-3.5 text-base text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors resize-none"
                  />
                  <p className={`text-[12px] mt-1.5 ${textInput.length < 10 && textInput.length > 0 ? "text-red-400" : "text-gray-600"}`}>
                    {textInput.length}/4000 {textInput.length < 10 && textInput.length > 0 ? "(min 10 chars)" : ""}
                  </p>
                </div>
              )}

              {/* Error message */}
              {errorMessage && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                  <button onClick={() => { setErrorMessage(null); setAppState("idle"); }}><X size={12} /></button>
                </div>
              )}

              {/* Generate button — only visible when there is input or credits needed */}
              {(canGenerateIgnoringCredits || needsCredits) && (
                <button
                  onClick={needsCredits ? () => { window.location.href = "/"; } : () => generateCode()}
                  className={`w-full mt-5 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[15px] transition-all cursor-pointer
                    ${needsCredits
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                      : "bg-[#1d1d1d] border border-white/10 text-white hover:bg-[#252525]"}`}
                >
                  {generateBtnContent()}
                </button>
              )}

              {/* Credits hint */}
              {credits < 20 && (
                <p className="text-center text-[12px] text-gray-700 mt-2">
                  {credits} credits remaining ·{" "}
                  <a href="/" className="text-amber-500 hover:underline">Upgrade →</a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* SENDING SCREEN — initial loader before streaming starts */}
        {appState === "sending" && !generatedCode && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <span className="flex gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-2" />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-3" />
              </span>
              <span className="text-sm text-gray-400">
                {inputMode === "video" ? "Extracting frame and processing…" : inputMode === "url" ? "Taking screenshot and processing…" : "Processing…"}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-600"><Clock size={10} /> {elapsedSec}s</span>
              <button onClick={stopGenerating} className="text-[12px] text-gray-700 hover:text-gray-500 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* OUTPUT SECTION — shown during streaming or when code exists */}
        {(generatedCode || appState === "streaming") && (
          <section className="flex-1 flex flex-col overflow-hidden">

            {/* Tab bar + actions */}
            <div className="shrink-0 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#0f0f0f]">
              <div className="flex">
                <button
                  onClick={() => { setActiveTab("code"); setIsEditing(false); }}
                  className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                    ${activeTab === "code" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                >
                  <Code2 size={14} />
                  index.html
                </button>
                <button
                  onClick={() => { if (generatedCode) setActiveTab("preview"); }}
                  disabled={!generatedCode}
                  className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                    ${activeTab === "preview" ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"}`}
                >
                  <Eye size={14} /> Preview
                </button>
                {previousCode && generatedCode && (
                  <button
                    onClick={() => setActiveTab("compare" as typeof activeTab)}
                    className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors
                      ${(activeTab as string) === "compare" ? "border-violet-500 text-violet-300" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                  >
                    <Columns2 size={14} /> Compare
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {generatedCode && activeTab === "code" && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors
                      ${isEditing ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "text-gray-400 hover:text-white border-white/[0.08] hover:border-white/20"}`}
                  >
                    <Pencil size={12} /> {isEditing ? "Editing" : "Edit"}
                  </button>
                )}
                {sessionId && generatedCode && (
                  <button
                    onClick={() => { setShowRevise(!showRevise); if (!showRevise) setTimeout(() => reviseInputRef.current?.focus(), 50); }}
                    className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors"
                  >
                    <RefreshCw size={12} /> Revise
                  </button>
                )}
                {generatedCode && (
                  <>
                    <button onClick={copyCode} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <Copy size={12} /> Copy
                    </button>
                    <button onClick={downloadCode} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <Download size={12} /> Download
                    </button>
                    <span className="text-gray-700 text-[11px] flex items-center gap-1">
                      <Hash size={10} /> {generatedCode.length.toLocaleString()}
                    </span>
                  </>
                )}
                {appState === "streaming" && (
                  <button
                    onClick={stopGenerating}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <X size={12} /> Stop
                  </button>
                )}
              </div>
            </div>

            {/* Revise input bar */}
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
              {activeTab === "code" && !isEditing && (
                <pre ref={codeRef} className="h-full overflow-auto p-5 text-[13px] leading-relaxed text-gray-300 font-mono bg-[#0c0c0c] whitespace-pre-wrap break-words">
                  {generatedCode}
                </pre>
              )}
              {activeTab === "code" && isEditing && (
                <div className="h-full flex flex-col bg-[#0c0c0c]">
                  <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-orange-500/5 border-b border-orange-500/10 text-[11px] text-orange-400">
                    <Pencil size={11} /> Editing mode — changes affect the Preview tab instantly
                    <button onClick={() => setIsEditing(false)} className="ml-auto text-gray-600 hover:text-gray-400"><X size={12} /></button>
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
              {activeTab === "preview" && (
                <iframe className="w-full h-full border-0" sandbox="allow-scripts" srcDoc={generatedCode} />
              )}
              {(activeTab as string) === "compare" && previousCode && generatedCode && (
                <div className="h-full flex overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden border-r border-white/[0.06]">
                    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white/[0.02] border-b border-white/[0.06] text-[11px] text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-gray-500" /> Previous version
                    </div>
                    <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-gray-400 font-mono whitespace-pre-wrap break-words bg-[#0a0a0a]">{previousCode}</pre>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-500/5 border-b border-blue-500/10 text-[11px] text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-400" /> Current version
                    </div>
                    <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap break-words bg-[#0c0c0c]">{generatedCode}</pre>
                  </div>
                </div>
              )}

              {/* Extended thinking panel */}
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
                    ) : <Brain size={12} />}
                    <span className="font-medium">Extended Thinking</span>
                    <span className="ml-auto text-[10px] text-gray-600">{thinkingText.length.toLocaleString()} chars</span>
                    {showThinking ? <ChevronUp size={10} className="text-gray-500" /> : <ChevronDown size={10} className="text-gray-500" />}
                  </button>
                  {showThinking && (
                    <pre className="px-3 pb-3 text-[10px] leading-relaxed text-gray-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-white/[0.05]">
                      {thinkingText}
                    </pre>
                  )}
                </div>
              )}

              {/* Streaming indicator */}
              {appState === "streaming" && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#1a1a1a] border border-white/10 px-4 py-2 rounded-full text-sm text-gray-300">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 dot-1" />
                    <span className="w-2 h-2 rounded-full bg-blue-400 dot-2" />
                    <span className="w-2 h-2 rounded-full bg-blue-400 dot-3" />
                  </span>
                  {currentModel.hasThinking && thinkingText && charsStreamed === 0
                    ? <span className="flex items-center gap-1.5"><Brain size={12} className="text-cyan-400" /> Reasoning…</span>
                    : <span>AI is coding…</span>}
                  <span className="flex items-center gap-1 text-[11px] text-gray-500"><Clock size={10} /> {elapsedSec}s</span>
                  {charsStreamed > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><Hash size={10} /> {charsStreamed.toLocaleString()}</span>}
                </div>
              )}
            </div>
          </section>
        )}

      </main>

      <Toast message={toastMsg} visible={toastVisible} />

      {showAccount && authToken && authEmail && (
        <AccountPanel token={authToken} email={authEmail} onClose={() => setShowAccount(false)} />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(token, email) => { setAuthToken(token); setAuthEmail(email); }}
        />
      )}
    </div>
  );
}
