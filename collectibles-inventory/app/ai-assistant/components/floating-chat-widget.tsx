// components/ai/FloatingChatWidget.tsx
"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import { askSQL } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bot,
  Send,
  Loader2,
  Mic,
  ArrowLeft,
  X as CloseIcon,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = {
  role: "user" | "assistant";
  content: string;
  id: string;
};

// Simple theme variables so colors can be customized via CSS variables
const THEME = {
  launcherBg: "var(--chat-launcher-bg, #2563eb)",
  panelBg: "var(--chat-panel-bg, #60a5fa)",
  headerBg: "var(--chat-header-bg, rgba(255,255,255,0))",
  botBubbleBg: "var(--chat-bot-bubble-bg, #3b82f6)",
  userBubbleBg: "var(--chat-user-bubble-bg, #93c5fd)",
  inputBg: "var(--chat-input-bg, #ffffff)",
  inputText: "var(--chat-input-text, #1f2937)",
};

type ChatVariant = "floating" | "inline";

type FloatingChatWidgetProps = {
  variant?: ChatVariant;
  anchor?: "left" | "right";
};

export default function FloatingChatWidget({
  variant = "floating",
  anchor = "right",
}: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<"home" | "inventory" | "pricing">("home");
  const [pricingFields, setPricingFields] = useState({
    certNumber: "",
    description: "",
    grade: "",
  });
  const [fabHover, setFabHover] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen]);

  // Guided pricing flow uses a server-side fixed prompt via /pricing/estimate.
  // Build and send pricing request from structured fields, not free text.
  const sendPricingPrompt = async () => {
    const { certNumber, description, grade } = pricingFields;
    const cn = certNumber.trim();
    const desc = description.trim();
    const grd = grade.trim();
    if (!cn || !desc || !grd || loading) return;

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Estimate request: #${cn} — ${desc} (Grade: ${grd})`,
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const backendBase =
        process.env.BACKEND_URL || "https://www.conejocoin.net";
      const response = await fetch(
        `${backendBase}/api/v1/ai/pricing/estimate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cert_number: cn,
            description: desc,
            grade: grd,
            history: [],
          }),
          signal: abortRef.current?.signal,
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${errText || response.statusText}`,
          },
        ]);
        return;
      }

      const result = await response.json();
      const text = result?.text || "No response.";
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: String(text) },
      ]);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${e?.message || "failed"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const q = input.trim();
    if (step !== "inventory") return;
    if (!q || loading) return;
    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      // Inventory flow

      const sql = await askSQL(q, { forceRefresh: true });
      if (!sql) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I couldn’t generate a query for that.",
          },
        ]);
        return;
      }

      const backendBase =
        process.env.BACKEND_URL || "https://www.conejocoin.net";
      const response = await fetch(`${backendBase}/api/v1/ai/execute-sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
        signal: abortRef.current?.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error running query: ${errText || response.statusText}`,
          },
        ]);
        return;
      }

      const result = await response.json();
      let content = "No results found.";

      if (Array.isArray(result.columns) && Array.isArray(result.data)) {
        const columns: string[] = result.columns;
        const rows: any[][] = result.data;
        const preview = rows.slice(0, 5);

        // If there is a single column or a first column named 'name', present a numbered list
        const firstColIsName =
          (columns[0] || "").toString().trim().toLowerCase() === "name";
        if (columns.length === 1 || firstColIsName) {
          const numbered = preview
            .map((row, i) => `${i + 1}. ${String(row[0] ?? "")}`)
            .join("\n");
          const remainder =
            rows.length > preview.length
              ? `\n… and ${rows.length - preview.length} more`
              : "";
          content = numbered + remainder;
        } else {
          // Fallback to a compact table preview
          const header = columns.join(" | ");
          const lines = preview.map((row) =>
            row
              .map((cell) => {
                if (cell === null || cell === undefined) return "";
                if (typeof cell === "object") return JSON.stringify(cell);
                return String(cell);
              })
              .join(" | "),
          );

          const remainder =
            rows.length > preview.length
              ? `\n… and ${rows.length - preview.length} more row${
                  rows.length - preview.length === 1 ? "" : "s"
                }`
              : "";

          content = header;
          if (lines.length) {
            content += "\n" + lines.join("\n");
          }
          content += remainder;
        }
      } else if (result.summary && Object.keys(result.summary).length > 0) {
        content = `Summary: ${JSON.stringify(result.summary, null, 2)}`;
      } else if (result.data) {
        content = `Results: ${JSON.stringify(result.data, null, 2)}`;
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content,
        },
      ]);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${e?.message || "failed"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  return (
    <>
      {variant === "floating" && (
        <button
          aria-label="Open AI Assistant"
          onClick={() => setIsOpen((o) => !o)}
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
          className={cn(
            "fixed bottom-4 z-[60] rounded-full w-12 h-12 sm:w-14 sm:h-14 grid place-items-center transition-colors duration-200 shadow-card",
            anchor === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6",
            "text-white",
          )}
          style={{
            backgroundColor:
              fabHover || isOpen
                ? ("var(--accent-lime, #E8FF66)" as any)
                : ("var(--fab-bg, #2d2d2d)" as any),
            boxShadow: "0 12px 32px rgba(13, 12, 11, 0.18)",
          }}
        >
          <Bot className="w-7 h-7 text-white" />
        </button>
      )}

      {variant === "inline" && !isOpen && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setIsOpen(true)}
        >
          Open assistant
        </Button>
      )}

      {isOpen && (
        <Card
          className={cn(
            "shadow-2xl rounded-3xl border-none flex flex-col overflow-hidden",
            variant === "floating"
              ? cn(
                  "fixed bottom-20 z-[60] w-[320px] sm:w-[360px] max-w-[90vw] h-[480px] sm:h-[520px] max-h-[85vh]",
                  anchor === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6",
                )
              : "w-full h-[520px] max-h-[70vh]",
          )}
          style={{ backgroundColor: THEME.panelBg }}
        >
          <header
            className="flex items-center justify-between p-4 text-white"
            style={{ backgroundColor: THEME.headerBg }}
          >
            <button
              className="p-1"
              onClick={() => {
                setMessages([]);
                setInput("");
                setStep("home");
                setPricingFields({
                  certNumber: "",
                  description: "",
                  grade: "",
                });
              }}
              aria-label="Back to welcome"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                if (variant === "floating") {
                  setMessages([]);
                  setInput("");
                  setStep("home");
                  setPricingFields({
                    certNumber: "",
                    description: "",
                    grade: "",
                  });
                }
              }}
              className="p-1"
            >
              <CloseIcon size={20} />
            </button>
          </header>

          <CardContent
            ref={scrollRef}
            className="flex-1 flex flex-col justify-between p-4 overflow-y-auto min-h-0"
          >
            {messages.length === 0 && step === "home" ? (
              <div className="flex flex-col items-center justify-center text-center text-white h-full gap-4">
                <Bot size={80} className="mb-2 opacity-90" />
                <h2 className="text-xl font-medium">
                  How can I help you today?
                </h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStep("inventory");
                      setInput("");
                      window.requestAnimationFrame(() => {
                        inputRef.current?.focus();
                      });
                    }}
                  >
                    Help with inventory
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStep("pricing");
                    }}
                  >
                    Help estimate price
                  </Button>
                </div>
              </div>
            ) : step === "pricing" && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center text-white h-full gap-4">
                <Bot size={80} className="mb-2 opacity-90" />
                <h2 className="text-xl font-medium">Price estimate</h2>
                <div className="w-full max-w-sm text-left space-y-3 bg-white/10 rounded-xl p-4">
                  <p className="text-sm opacity-90">
                    Enter details for price estimation (NGC)
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs opacity-90">
                      Certification Number
                    </label>
                    <input
                      className="w-full rounded-md px-3 py-2 text-sm text-black"
                      value={pricingFields.certNumber}
                      onChange={(e) =>
                        setPricingFields((f) => ({
                          ...f,
                          certNumber: e.target.value,
                        }))
                      }
                      placeholder="e.g., 1234567-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs opacity-90">Description</label>
                    <input
                      className="w-full rounded-md px-3 py-2 text-sm text-black"
                      value={pricingFields.description}
                      onChange={(e) =>
                        setPricingFields((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      placeholder="e.g., 1950 Mexico 5 Pesos"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs opacity-90">Grade</label>
                    <input
                      className="w-full rounded-md px-3 py-2 text-sm text-black"
                      value={pricingFields.grade}
                      onChange={(e) =>
                        setPricingFields((f) => ({
                          ...f,
                          grade: e.target.value,
                        }))
                      }
                      placeholder="e.g., MS65"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-90">
                    <span>Certification Service: NGC</span>
                    <span>Holder: excellent condition</span>
                  </div>
                  <Button
                    disabled={
                      !pricingFields.certNumber ||
                      !pricingFields.description ||
                      !pricingFields.grade ||
                      loading
                    }
                    onClick={sendPricingPrompt}
                    className="w-full"
                  >
                    Get estimate
                  </Button>
                  <div className="flex justify-center">
                    <button
                      className="text-xs underline opacity-90"
                      onClick={() => {
                        setMessages([]);
                        setInput("");
                        setStep("home");
                        setPricingFields({
                          certNumber: "",
                          description: "",
                          grade: "",
                        });
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                {messages.map((m) => (
                  <Fragment key={m.id}>
                    <div
                      className={cn(
                        "text-sm font-medium text-white/90",
                        m.role === "assistant" ? "text-left" : "text-right",
                      )}
                    >
                      {m.role === "assistant" ? "Bot" : "You"}
                    </div>
                    <div
                      className={cn(
                        "px-4 py-2 rounded-lg text-white w-fit max-w-[85%] whitespace-pre-wrap",
                        m.role === "assistant"
                          ? "text-left"
                          : "text-left ml-auto",
                      )}
                      style={{
                        backgroundColor:
                          m.role === "assistant"
                            ? THEME.botBubbleBg
                            : THEME.userBubbleBg,
                      }}
                    >
                      {m.content}
                    </div>
                  </Fragment>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {step === "inventory" && (
            <footer className="p-4 mt-auto">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 shadow-inner"
                style={{ backgroundColor: THEME.inputBg }}
              >
                <Search size={20} className="text-gray-400" />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask"
                  className="flex-1 bg-transparent text-sm placeholder-gray-400 focus:outline-none"
                  style={{ color: THEME.inputText }}
                />
                <button
                  type="button"
                  className="text-gray-400 hover:text-blue-500"
                  aria-label="Use voice"
                >
                  <Mic size={20} />
                </button>
              </div>
            </footer>
          )}
        </Card>
      )}
    </>
  );
}
