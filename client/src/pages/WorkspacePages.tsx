/** Quiet Intelligence Console workbench: clear user controls, styled illustrative data, and no simulated backend persistence. */
import { api } from "@/services/api";
import { AppShell, NewConversationButton } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import type { ConversationSummary, MemoryRecord, Message, ModelRead, ProviderRead } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Archive, ArrowDownToLine, ArrowRight, BarChart3, Bell, Bot, BrainCircuit, CalendarClock, Check, ChevronDown, ChevronsUpDown, CircleAlert, Clock3, Copy, Download, Edit3, Ellipsis, ExternalLink, FileText, Filter, FolderOpen, Gauge, Globe2, KeyRound, LayoutDashboard, LockKeyhole, Mail, MessageSquareText, MoreHorizontal, Network, PanelRightClose, Pencil, Pin, Plus, RefreshCw, Search, SendHorizontal, Settings2, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Tags, Trash2, Undo2, UserRound, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";

const conversations: ConversationSummary[] = [
  { id: "c_203", title: "Planning the knowledge system", updatedAt: "Just now", model: "Gemini 2.5 Pro", memoryUsed: true },
  { id: "c_202", title: "Launch messaging review", updatedAt: "2h ago", model: "Qwen 2.5 14B", memoryUsed: true },
  { id: "c_201", title: "Research synthesis", updatedAt: "Yesterday", model: "Gemini 2.5 Flash", memoryUsed: false },
  { id: "c_200", title: "Quarterly reflection", updatedAt: "Aug 14", model: "Gemini 2.5 Pro", memoryUsed: true },
];
const memories: MemoryRecord[] = [];

function backendToast(action: string) { toast.info("Backend action required", { description: `${action} is ready for the FastAPI service. No data was changed in this preview.` }); }
function IndexLabel({ children }: { children: React.ReactNode }) { return <p className="index-label">{children}</p>; }
function PageIntro({ label, title, copy, action }: { label?: string; title: string; copy?: string; action?: React.ReactNode }) { return <div className="mb-7 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl">{label && <IndexLabel>{label}</IndexLabel>}<h2 className="font-display mt-2 text-[31px] font-semibold tracking-[-0.055em] sm:text-[36px]">{title}</h2>{copy && <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{copy}</p>}</div>{action}</div>; }
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={cn("rounded-2xl border border-border bg-card shadow-[0_14px_36px_-30px_rgba(21,39,35,0.35)]", className)}>{children}</section>; }
function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "teal" | "neutral" | "warning" | "dark" }) { const styles = { teal: "border-[color:color-mix(in_oklab,var(--memory-teal)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--memory-teal)_9%,transparent)] text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]", neutral: "border-border bg-secondary text-muted-foreground", warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300", dark: "border-white/10 bg-white/10 text-white/75" }; return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold", styles[tone])}>{children}</span>; }
function IconButton({ label, children, onClick, className = "" }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) { return <button onClick={onClick} aria-label={label} title={label} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground active:scale-[0.97]", className)}>{children}</button>; }
function Button({ children, onClick, variant = "primary", className = "", disabled = false }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "dark"; className?: string; disabled?: boolean }) { const variants = { primary: "bg-[color:var(--memory-teal)] text-white hover:bg-[color:var(--memory-teal-deep)]", secondary: "border border-border bg-card text-foreground hover:bg-secondary", danger: "bg-red-600 text-white hover:bg-red-700", dark: "bg-foreground text-background hover:opacity-90" }; return <button onClick={onClick} disabled={disabled} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-bold transition duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60", variants[variant], className)}>{children}</button>; }
function EmptyState({ icon: Icon = BrainCircuit, title, copy, action }: { icon?: typeof BrainCircuit; title: string; copy: string; action?: React.ReactNode }) { return <div className="flex min-h-[250px] flex-col items-center justify-center p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_oklab,var(--memory-teal)_11%,transparent)]"><Icon className="h-5 w-5 text-[color:var(--memory-teal)]" /></span><h3 className="font-display mt-4 text-lg font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{copy}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function StatCard({ label, value, detail, icon: Icon, trend }: { label: string; value: string; detail: string; icon: typeof BrainCircuit; trend?: string }) { return <Panel className="p-5"><div className="flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_11%,transparent)]"><Icon className="h-[18px] w-[18px] text-[color:var(--memory-teal)]" /></span>{trend && <Pill tone="teal">{trend}</Pill>}</div><p className="font-display mt-5 text-[28px] font-semibold tracking-[-0.055em]">{value}</p><p className="mt-1 text-xs font-bold">{label}</p><p className="mt-2 text-[11px] text-muted-foreground">{detail}</p></Panel>; }

function ChatPage() {
  const [modelOpen, setModelOpen] = useState(false);
  const [conversationsList, setConversationsList] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messagesList, setMessagesList] = useState<Message[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelRead[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelRead | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftResponse, setDraftResponse] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const activeConversation = conversationsList.find((c) => c.id === activeConvId);

  // Load initial data: conversations and registry models (filtered by enabled providers server-side)
 useEffect(() => {
  const loadChat = async () => {
    try {
      const [convs, mods] = await Promise.all([
        api.conversations.list(),
        api.models.listRegistry(),
      ]);

      setAvailableModels(mods);

      if (convs.length > 0) {
        // Existing conversation
        setConversationsList(convs);
        setActiveConvId(convs[0].id);
      } else {
        // No conversation exists → create one
        const newConversation = await api.conversations.create(
          "Untitled Chat"
        );

        setConversationsList([newConversation]);
        setActiveConvId(newConversation.id);
      }
    } catch (error) {
      console.error("FAILED TO LOAD CHAT:", error);
      toast.error("Failed to load chat");
    }
  };

  loadChat();
}, []);

  // Fetch messages and select correct model when active conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    api.conversations
      .listMessages(activeConvId)
      .then((msgs) => {
        setMessagesList(msgs);
        setErrorMsg("");
      })
      .catch(() => {
        toast.error("Failed to load messages");
      });

    const activeConv = conversationsList.find((c) => c.id === activeConvId);
    if (activeConv && availableModels.length > 0) {
      const match = availableModels.find((m) => m.id === activeConv.selected_model_id);
      if (match) {
        setSelectedModel(match);
      } else {
        setSelectedModel(null);
      }
    }
  }, [activeConvId, conversationsList, availableModels]);

  const handleNewConversation = async () => {
    try {
      const newConv = await api.conversations.create();
      setConversationsList((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setMessagesList([]);
    } catch {
      toast.error("Failed to create conversation");
    }
  };

  const handleSelectModel = async (model: ModelRead) => {
  console.log("MODEL CLICKED:", model);

  setSelectedModel(model);
  setModelOpen(false);

  if (!activeConvId) {
    console.error("NO ACTIVE CONVERSATION");
    toast.error("No active conversation");
    return;
  }

  try {
    console.log("SAVING MODEL:", activeConvId, model.id);

    await api.conversations.update(activeConvId, {
      selected_model_id: model.id,
    });

    setConversationsList((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConvId
          ? {
              ...conversation,
              selected_model_id: model.id,
            }
          : conversation
      )
    );

    console.log("MODEL SAVED:", model.display_name);
    toast.success(`Selected model: ${model.display_name}`);
  } catch (error) {
    console.error("MODEL SAVE FAILED:", error);
    toast.error("Failed to save model selection");
  }
};

  const send = () => {
    if (!messageText.trim() || !activeConvId || isGenerating) return;
    if (!selectedModel) {
      toast.error("Please select a model first (ensure a provider is connected and enabled)");
      return;
    }
    const userPrompt = messageText;
    setMessageText("");
    setErrorMsg("");
    setIsGenerating(true);
    setDraftResponse("");

    // Optimistically append user message
    const userMsg: Message = {
      id: Math.random().toString(),
      conversation_id: activeConvId,
      role: "user",
      content: userPrompt,
      provider: selectedModel.provider,
      model_id: selectedModel.model_key,
      created_at: new Date().toISOString(),
    };
    setMessagesList((prev) => [...prev, userMsg]);

    const req = {
      message: userPrompt,
      provider: selectedModel.provider,
      model_key: selectedModel.model_key,
    };

    api.conversations.generate(
      activeConvId,
      req,
      (chunk) => {
        setDraftResponse((prev) => prev + chunk);
      },
      () => {
        setIsGenerating(false);
        setDraftResponse("");
        // Reload messages to get finalized server state
        api.conversations.listMessages(activeConvId).then(setMessagesList);
      },
      (err) => {
        setIsGenerating(false);
        setErrorMsg(err.message || "An error occurred");
        setModelOpen(true);
      }
    );
  };

  return <AppShell title="AI Chat" eyebrow="Workspace" action={<NewConversationButton onClick={handleNewConversation} />}><div className="mx-auto grid max-w-[1530px] gap-5 xl:grid-cols-[270px_minmax(0,1fr)_240px]">
    <Panel className="hidden overflow-hidden xl:block"><div className="border-b border-border p-4"><button className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs text-muted-foreground"><Search className="h-3.5 w-3.5" /> Search conversations</button></div><div className="p-2"><p className="index-label px-3 pb-2 pt-2">Recent</p>{conversationsList.map((conversation) => <button key={conversation.id} onClick={() => setActiveConvId(conversation.id)} className={cn("w-full rounded-xl p-3 text-left transition hover:bg-secondary/60", conversation.id === activeConvId && "bg-[color:color-mix(in_oklab,var(--memory-teal)_7%,transparent)]")}><p className="truncate text-xs font-bold">{conversation.title || "Untitled Chat"}</p><div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground"><span>{conversation.updatedAt}</span>{conversation.memoryUsed && <BrainCircuit className="h-3 w-3 text-[color:var(--memory-teal)]" />}</div></button>)}</div></Panel>
    <Panel className="flex min-h-[680px] flex-col overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-bold">{activeConversation?.title || "Untitled Chat"}</p><div className="mt-1 flex items-center gap-2"><Pill tone="teal"><BrainCircuit className="h-3 w-3" /> Context active</Pill><span className="text-[10px] text-muted-foreground">User-scoped memory context</span></div></div><div className="relative"><button onClick={() => setModelOpen((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold transition hover:bg-secondary"><span className="h-2 w-2 rounded-full bg-[color:var(--memory-teal)]" />{selectedModel?.display_name || "Select Model"}<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></button>{modelOpen && <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"><p className="index-label px-3 py-2">Available for you</p>{availableModels.map((model) => <button key={model.id} onClick={() => handleSelectModel(model)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-secondary", selectedModel?.id === model.id && "bg-[color:color-mix(in_oklab,var(--memory-teal)_8%,transparent)]")}><span><span className="block text-xs font-bold">{model.display_name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{model.provider} · {model.model_key}</span></span>{selectedModel?.id === model.id && <Check className="h-4 w-4 text-[color:var(--memory-teal)]" />}</button>)}</div>}</div></div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
        {messagesList.length === 0 && !isGenerating && (
          <EmptyState icon={BrainCircuit} title="Start the conversation" copy="Say hello! The assistant will pull context from your long-term memory vault as you chat." />
        )}
        {messagesList.map((msg) => (
          <div key={msg.id} className="mx-auto w-full max-w-[760px]">
            <div className="mb-2 flex items-center gap-2">
              {msg.role === "assistant" ? (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[color:var(--memory-teal)] text-[10px] font-bold text-white">MH</span>
                  <p className="index-label">AI Memory Hub · {msg.provider ? `${msg.provider} / ` : ""}{msg.model_id || "Assistant"}</p>
                </>
              ) : (
                <p className="index-label">You</p>
              )}
            </div>
            <div className={cn("rounded-2xl rounded-tl-sm p-4 text-sm leading-6 whitespace-pre-wrap", msg.role === "user" ? "bg-secondary" : "border border-border bg-card shadow-sm")}>
              {msg.content}
            </div>
          </div>
        ))}
        {draftResponse && (isGenerating || errorMsg) && (
          <div className="mx-auto w-full max-w-[760px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[color:var(--memory-teal)] text-[10px] font-bold text-white">MH</span>
              <p className="index-label">AI Memory Hub · {selectedModel?.provider} / {selectedModel?.display_name} {errorMsg && "· Incomplete"}</p>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-border bg-card p-4 text-sm leading-6 whitespace-pre-wrap">
              {draftResponse}
              <span className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground block">Drafting response <span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--memory-teal)]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--memory-teal)] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--memory-teal)] [animation-delay:300ms]" /></span></span>
            </div>
          </div>
        )}
        {errorMsg && (
          <div className="mx-auto w-full max-w-[760px] rounded-xl border border-red-500/20 bg-red-50/50 p-4 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
            <span className="font-bold block mb-1">Generation failed:</span>
            {errorMsg}
          </div>
        )}
      </div>
      <div className="border-t border-border p-3 sm:p-4"><div className="mx-auto max-w-[760px] rounded-2xl border border-border bg-background p-2 focus-within:border-[color:var(--memory-teal)] focus-within:ring-4 focus-within:ring-[color:color-mix(in_oklab,var(--memory-teal)_10%,transparent)]"><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} rows={2} placeholder="Ask with your current memory context…" className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground" /><div className="flex items-center justify-between px-1"><Pill tone="teal"><BrainCircuit className="h-3 w-3" /> Memory on</Pill><button onClick={send} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--memory-teal)] text-white transition hover:bg-[color:var(--memory-teal-deep)] active:scale-[0.97]" aria-label="Send message"><SendHorizontal className="h-3.5 w-3.5" /></button></div></div></div></Panel>
    <div className="hidden space-y-4 xl:block"><Panel className="p-4"><IndexLabel>Retrieved memory</IndexLabel><p className="mt-3 text-xs font-bold">Writing preference</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Concise, structured explanations with a clear next action.</p><Link href="/memory" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">View memories <ArrowRight className="h-3 w-3" /></Link></Panel><Panel className="p-4"><IndexLabel>Session integrity</IndexLabel><div className="mt-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[color:var(--memory-teal)]" /><p className="text-xs font-bold">Model switch is explicit</p></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Changing a model does not silently alter your selected conversation context.</p></Panel></div>
  </div></AppShell>;
}

function ConversationsPage() { return <AppShell title="Conversation History" eyebrow="Workspace" action={<NewConversationButton onClick={() => backendToast("Creating a conversation")} />}><div className="mx-auto max-w-[1160px]"><PageIntro label="Full record" title="Your conversation history" copy="Review the full, chronological record. History is kept distinct from the information you approve for long-term memory." action={<Button variant="secondary" onClick={() => api.conversations.export().catch(() => backendToast("Exporting conversations"))}><Download className="h-4 w-4" /> Export history</Button>} /><Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input placeholder="Search your conversations" className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-[color:var(--memory-teal)]" /></div><Button variant="secondary"><Filter className="h-3.5 w-3.5" /> All models</Button></div><div className="divide-y divide-border">{conversations.map((conversation) => <Link key={conversation.id} href="/chat" className="group flex items-center gap-4 px-4 py-4 transition hover:bg-secondary/60 sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary"><MessageSquareText className="h-4 w-4 text-muted-foreground" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-bold">{conversation.title}</span>{conversation.memoryUsed && <Pill tone="teal"><BrainCircuit className="h-3 w-3" /> Memory used</Pill>}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{conversation.model} · Updated {conversation.updatedAt}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" /></Link>)}</div></Panel></div></AppShell>; }

function MemoryDashboardPage() { return <AppShell title="Memory Dashboard" eyebrow="Memory" action={<Button onClick={() => backendToast("Adding a memory")}><Plus className="h-4 w-4" /> Add memory</Button>}><div className="mx-auto max-w-[1200px]"><PageIntro label="Long-term memory" title="A clear record of what you keep" copy="Review the context available to future conversations. Each record is searchable, attributable, and under your control." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total memories" value="128" detail="12 added this month" icon={BrainCircuit} trend="+12" /><StatCard label="Pinned context" value="8" detail="Shown first when relevant" icon={Pin} /><StatCard label="Categories" value="6" detail="Organize the way you work" icon={Tags} /><StatCard label="Archived" value="14" detail="Retained, not retrieved" icon={Archive} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]"><Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="text-sm font-bold">Recent memory</p><p className="mt-1 text-[11px] text-muted-foreground">Active records from your long-term layer</p></div><Link href="/memory/search" className="text-xs font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Search all</Link></div><div className="divide-y divide-border">{memories.slice(0, 3).map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div></Panel><div className="space-y-6"><Panel className="p-5"><IndexLabel>Memory retrieval</IndexLabel><div className="mt-4 flex items-end gap-2"><p className="font-display text-[34px] font-semibold tracking-[-0.06em]">72%</p><Pill tone="teal">Helpful context used</Pill></div><div className="mt-5 flex h-20 items-end gap-2">{[28, 42, 35, 58, 46, 68, 62, 79, 71, 90].map((height, index) => <span key={index} style={{ height: `${height}%` }} className={cn("w-full rounded-t-sm", index > 6 ? "bg-[color:var(--memory-teal)]" : "bg-[color:color-mix(in_oklab,var(--memory-teal)_19%,transparent)]")} />)}</div><p className="mt-3 text-[11px] text-muted-foreground">Retrieval activity over the last 10 sessions</p></Panel><Panel className="overflow-hidden"><div className="border-b border-border p-5"><IndexLabel>By category</IndexLabel></div>{[['Preferences', '34', '38%'], ['Projects', '28', '31%'], ['Work style', '19', '21%']].map(([name, count, width]) => <div key={name} className="px-5 py-3"><div className="flex justify-between text-xs"><span className="font-bold">{name}</span><span className="text-muted-foreground">{count}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><span style={{ width }} className="block h-full rounded-full bg-[color:var(--memory-teal)]" /></div></div>)}</Panel></div></div></div></AppShell>; }

function MemoryRow({ memory }: { memory: MemoryRecord }) { return <Link href={`/memory/${memory.id}`} className="group flex gap-3 px-5 py-4 transition hover:bg-secondary/60"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_9%,transparent)]"><BrainCircuit className="h-4 w-4 text-[color:var(--memory-teal)]" /></span><span className="memory-thread min-w-0 flex-1 pl-3"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold">{memory.title}</span>{memory.pinned && <Pin className="h-3 w-3 fill-[color:var(--memory-teal)] text-[color:var(--memory-teal)]" />}<Pill tone={memory.status === "archived" ? "neutral" : "teal"}>{memory.category}</Pill></span><span className="mt-1 block truncate text-[11px] leading-5 text-muted-foreground">{memory.content}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">Source: {memory.source} · Updated {memory.updatedAt}</span></span><ArrowRight className="mt-2 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" /></Link>; }

function MemorySearchPage() { const [query, setQuery] = useState(""); const active = useMemo(() => memories.filter((memory) => memory.status === "active" && `${memory.title} ${memory.content} ${memory.category}`.toLowerCase().includes(query.toLowerCase())), [query]); return <AppShell title="Search Memories" eyebrow="Memory"><div className="mx-auto max-w-[1000px]"><PageIntro label="Find context" title="Search the memory layer" copy="Search only long-term memory records. Conversation history is available separately from the workspace rail." /><div className="relative"><Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories by idea, category, or source…" className="h-14 w-full rounded-2xl border border-input bg-card pl-12 pr-5 text-sm outline-none shadow-sm transition focus:border-[color:var(--memory-teal)] focus:ring-4 focus:ring-[color:color-mix(in_oklab,var(--memory-teal)_10%,transparent)]" /></div><div className="mt-5 flex flex-wrap gap-2">{['All active', 'Preferences', 'Projects', 'Work style', 'Pinned'].map((filter, index) => <button key={filter} className={cn("rounded-full border px-3 py-1.5 text-[11px] font-bold transition", index === 0 ? "border-[color:var(--memory-teal)] bg-[color:color-mix(in_oklab,var(--memory-teal)_9%,transparent)] text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]" : "border-border bg-card text-muted-foreground hover:bg-secondary")}>{filter}</button>)}</div><Panel className="mt-6 overflow-hidden">{active.length ? <div className="divide-y divide-border">{active.map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div> : <EmptyState icon={Search} title="No memory matches that search" copy="Try another phrase or remove a category filter. Your conversation history is searched from its own section." action={<Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>} />}</Panel></div></AppShell>; }

function CategoriesPage() { const groups = [{ name: "Preferences", count: 34, note: "How you prefer information and collaboration", color: "bg-teal-500" }, { name: "Projects", count: 28, note: "Objectives, product context, and active initiatives", color: "bg-amber-500" }, { name: "Work style", count: 19, note: "Processes, tools, and decision patterns", color: "bg-sky-500" }, { name: "People", count: 17, note: "Context about collaborators you chose to retain", color: "bg-violet-500" }, { name: "Archive", count: 14, note: "Records you retained but removed from retrieval", color: "bg-slate-400" }, { name: "Other", count: 16, note: "Unclassified context awaiting review", color: "bg-rose-500" }]; return <AppShell title="Memory Categories" eyebrow="Memory" action={<Button variant="secondary" onClick={() => backendToast("Creating a category")}><Plus className="h-4 w-4" /> New category</Button>}><div className="mx-auto max-w-[1100px]"><PageIntro label="Organize your context" title="Categories that fit your work" copy="Categories help you browse and review long-term memory. Records remain individually editable and attributable." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map((group) => <Link href="/memory/search" key={group.name} className="group rounded-2xl border border-border bg-card p-5 shadow-[0_14px_36px_-30px_rgba(21,39,35,0.35)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_-30px_rgba(21,39,35,0.35)]"><span className={cn("h-2.5 w-2.5 rounded-full", group.color)} /><div className="mt-5 flex items-end justify-between"><p className="font-display text-[23px] font-semibold tracking-[-0.04em]">{group.name}</p><p className="font-display text-[28px] font-semibold tracking-[-0.05em]">{group.count}</p></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{group.note}</p><span className="mt-5 inline-flex items-center gap-1 text-[11px] font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">View memories <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span></Link>)}</div></div></AppShell>; }

function TimelinePage() { return <AppShell title="Memory Timeline" eyebrow="Memory"><div className="mx-auto max-w-[980px]"><PageIntro label="The memory thread" title="See how your long-term context evolved" copy="The timeline shows when a memory was created or changed, while preserving a link back to its source conversation." /><div className="relative ml-3 border-l border-[color:color-mix(in_oklab,var(--memory-teal)_30%,transparent)] pl-8 sm:ml-5 sm:pl-10">{[['Today', memories.slice(0, 2)], ['Aug 12, 2026', [memories[2]]], ['Jul 27, 2026', [memories[3]]]].map(([date, items]) => <div key={date as string} className="relative pb-10"><span className="absolute -left-[39px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-background bg-[color:var(--memory-teal)] sm:-left-[47px]" /><p className="index-label mb-4">{date as string}</p><div className="space-y-3">{(items as MemoryRecord[]).map((memory) => <Panel key={memory.id} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-bold">{memory.title}</p>{memory.pinned && <Pin className="h-3.5 w-3.5 fill-[color:var(--memory-teal)] text-[color:var(--memory-teal)]" />}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{memory.content}</p></div><Pill tone={memory.status === "archived" ? "neutral" : "teal"}>{memory.status === "archived" ? 'Archived' : 'Created'}</Pill></div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><MessageSquareText className="h-3 w-3" /> Source: {memory.source}</span><span>·</span><span>Updated {memory.updatedAt}</span><Link href={`/memory/${memory.id}`} className="ml-auto font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">Open details</Link></div></Panel>)}</div></div>)}</div></div></AppShell>; }

function MemoryDetailsPage() {
  const [, navigate] = useLocation();
  const memory = memories[0];

  const handleArchive = async () => {
    try {
      await api.memories.archive(memory.id);
      toast.success("Memory archived");
      navigate("/memory");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive memory"
      );
    }
  };

  const handlePin = async () => {
    try {
      await api.memories.pin(memory.id);
      toast.success("Memory pinned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to pin memory"
      );
    }
  };

  const handleDelete = async () => {
    try {
      await api.memories.remove(memory.id);
      toast.success("Memory deleted");
      navigate("/memory");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete memory"
      );
    }
  };

  return (
    <AppShell title="Memory Details" eyebrow="Memory">
      <div className="mx-auto max-w-[1040px]">
        <button
          onClick={() => navigate("/memory")}
          className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          All memories
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <Panel className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="teal">{memory.category}</Pill>

              {memory.pinned && (
                <Pill tone="teal">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Pill>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-[32px] font-semibold tracking-[-0.055em]">
                  {memory.title}
                </h2>

                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                  {memory.content}
                </p>
              </div>

              <div className="flex gap-1">
                <IconButton
                  label="Edit memory"
                  onClick={() => backendToast("Editing a memory")}
                >
                  <Pencil className="h-4 w-4" />
                </IconButton>

                <IconButton
                  label="More memory actions"
                  onClick={() => backendToast("Opening memory actions")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <IndexLabel>Memory source</IndexLabel>

              <Link
                href="/conversations"
                className="mt-3 flex items-center justify-between rounded-xl border border-border bg-[color:var(--surface-warm)] p-4 transition hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card">
                    <MessageSquareText className="h-4 w-4 text-[color:var(--memory-teal)]" />
                  </span>

                  <span>
                    <span className="block text-xs font-bold">
                      {memory.source}
                    </span>

                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Conversation record · Aug 16, 2026
                    </span>
                  </span>
                </span>

                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel className="p-5">
              <IndexLabel>Record state</IndexLabel>

              <div className="mt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-bold">{memory.createdAt}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last updated</span>
                  <span className="font-bold">{memory.updatedAt}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Pill tone="teal">Active</Pill>
                </div>
              </div>
            </Panel>

            <Panel className="p-3">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={handleArchive}
              >
                <Archive className="h-4 w-4" />
                Archive memory
              </Button>

              <Button
                variant="secondary"
                className="mt-2 w-full justify-start"
                onClick={handlePin}
              >
                <Pin className="h-4 w-4" />
                Pin as important
              </Button>

              <Button
                variant="secondary"
                className="mt-2 w-full justify-start text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete memory
              </Button>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
function ModelSelectorPage() {
  const [availableModels, setAvailableModels] = useState<ModelRead[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelRead | null>(null);
  const [conversationsList, setConversationsList] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.models.listRegistry(), api.conversations.list()])
      .then(([mods, convs]) => {
        setAvailableModels(mods);
        setConversationsList(convs);
        setActiveConvId(convs[0]?.id ?? null);
        if (mods.length > 0) {
          setSelectedModel(mods[0]);
        }
      })
      .catch(() => {
        toast.error("Failed to load available models");
      });
  }, []);

const handleSelectModel = async (model: ModelRead) => {
  console.log("MODEL CLICKED:", model);

  setSelectedModel(model);

  if (!activeConvId) {
    console.error("NO ACTIVE CONVERSATION");
    toast.error("No active conversation");
    return;
  }

  try {
    console.log("SAVING MODEL:", activeConvId, model.id);

    await api.conversations.update(activeConvId, {
      selected_model_id: model.id,
    });

    setConversationsList((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConvId
          ? {
              ...conversation,
              selected_model_id: model.id,
            }
          : conversation
      )
    );

    console.log("MODEL SAVED:", model.display_name);
    toast.success(`Selected model: ${model.display_name}`);
  } catch (error) {
    console.error("MODEL SAVE FAILED:", error);
    toast.error("Failed to save model selection");
  }
};

  const grouped = availableModels.reduce<Record<string, ModelRead[]>>((acc, model) => {
    (acc[model.provider] ??= []).push(model);
    return acc;
  }, {});

  return <AppShell title="AI Model Selector" eyebrow="Models"><div className="mx-auto max-w-[1060px]"><PageIntro label="Your deliberate choice" title="Use the model you intend to use" copy="Only providers and models configured and enabled for your account are available here. Selecting one here does not silently switch a provider." /><div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]"><Panel className="bg-[color:var(--ink-soft)] p-6 text-white"><Pill tone="dark"><span className="h-1.5 w-1.5 rounded-full bg-[color:var(--memory-teal-light)]" /> Current selection</Pill><p className="font-display mt-6 text-[29px] font-semibold tracking-[-0.055em]">{selectedModel?.display_name || "None selected"}</p><p className="mt-2 text-sm text-white/60">{selectedModel?.provider} · {selectedModel?.model_key || "No model active"}</p><div className="mt-8 border-t border-white/10 pt-5"><p className="text-xs font-bold">Your context stays intact</p><p className="mt-2 text-xs leading-5 text-white/60">Model changes are explicit. Conversation history and long-term memory remain attached to your workspace, not the model.</p></div></Panel><div className="space-y-4">{Object.entries(grouped).map(([provider, models]) => <Panel key={provider} className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_10%,transparent)]"><Bot className="h-4 w-4 text-[color:var(--memory-teal)]" /></span><span><span className="block text-sm font-bold uppercase">{provider}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Configured and available</span></span></span><Pill tone="teal">{models.length} models</Pill></div><div className="p-2">{models.map((model) => <button key={model.id} onClick={() => handleSelectModel(model)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-secondary", selectedModel?.id === model.id && "bg-[color:color-mix(in_oklab,var(--memory-teal)_8%,transparent)]")}><span><span className="flex items-center gap-2 text-xs font-bold">{model.display_name}{model.is_local && <Pill tone="neutral">Local</Pill>}</span><span className="mt-1 block text-[10px] text-muted-foreground">{model.model_key}</span></span>{selectedModel?.id === model.id ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--memory-teal)]"><Check className="h-3 w-3 text-white" /></span> : <span className="h-5 w-5 rounded-full border border-border" />}</button>)}</div></Panel>)}</div></div><Panel className="mt-6 border-dashed bg-[color:var(--surface-warm)] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">Need another provider?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">OpenAI, Anthropic, DeepSeek, Groq, and OpenRouter are not selectable until you securely configure and enable them in settings.</p></div><Link href="/settings/providers"><Button variant="secondary">Provider settings <ArrowRight className="h-4 w-4" /></Button></Link></div></Panel></div></AppShell>; }

const ALL_PROVIDERS = [
  { id: "gemini", name: "Google Gemini", detail: "Connect to Google Gemini API" },
  { id: "openai", name: "OpenAI", detail: "Connect to official OpenAI API" },
  { id: "anthropic", name: "Anthropic Claude", detail: "Connect to Anthropic Claude API" },
  { id: "deepseek", name: "DeepSeek", detail: "Connect to DeepSeek API" },
  { id: "groq", name: "Groq", detail: "Connect to Groq Cloud API" },
  { id: "openrouter", name: "OpenRouter", detail: "Connect to OpenRouter API" },
  { id: "ollama", name: "Ollama (local)", detail: "Local Ollama host connection", local: true },
];

function ProvidersPage() {
  const [configuredList, setConfiguredList] = useState<ProviderRead[]>([]);

  const loadProviders = () => {
    api.providers.listConfigured()
      .then(setConfiguredList)
      .catch(() => toast.error("Failed to load configured providers"));
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleConnect = async (providerId: string) => {
    let key: string | null = null;
    if (providerId !== "ollama") {
      key = window.prompt(`Enter your API key for ${providerId}:`);
      if (key === null) return;
      if (!key.trim()) {
        toast.error("API key cannot be empty");
        return;
      }
    }
    try {
      await api.providers.configure(providerId, key, true);
      toast.success(`${providerId} configured successfully`);
      loadProviders();
    } catch (e: any) {
      toast.error(e.message || "Failed to configure provider");
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!window.confirm(`Disconnect ${providerId}? This will remove its API key.`)) return;
    try {
      await api.providers.remove(providerId);
      toast.success(`${providerId} disconnected`);
      loadProviders();
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect provider");
    }
  };

  const handleToggle = async (providerId: string, currentEnabled: boolean) => {
    try {
      await api.providers.update(providerId, { is_enabled: !currentEnabled });
      toast.success(`${providerId} ${!currentEnabled ? "enabled" : "disabled"}`);
      loadProviders();
    } catch (e: any) {
      toast.error(e.message || "Failed to update provider status");
    }
  };

  return <AppShell title="AI Provider Settings" eyebrow="Control center"><div className="mx-auto max-w-[1050px]"><PageIntro label="Provider connections" title="Connect only what you want to use" copy="Credentials belong on the backend. This browser interface never displays or stores a provider secret in plaintext." action={<Link href="/settings/api-keys"><Button variant="secondary"><KeyRound className="h-4 w-4" /> Credential vault</Button></Link>} /><div className="space-y-3">{ALL_PROVIDERS.map((provider) => {
    const config = configuredList.find(c => c.provider === provider.id);
    const isConnected = !!config;
    const isEnabled = config?.is_enabled ?? false;

    return <Panel key={provider.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-center gap-4"><span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", isConnected && isEnabled ? "bg-[color:color-mix(in_oklab,var(--memory-teal)_12%,transparent)]" : "bg-secondary")}><Globe2 className={cn("h-5 w-5", isConnected && isEnabled ? "text-[color:var(--memory-teal)]" : "text-muted-foreground")} /></span><span><span className="flex items-center gap-2"><span className="text-sm font-bold">{provider.name}</span><Pill tone={isConnected && isEnabled ? "teal" : isConnected ? "neutral" : "neutral"}>{isConnected ? (isEnabled ? "Connected & Enabled" : "Connected (Disabled)") : "Not Configured"}</Pill></span><span className="mt-1 block text-[11px] text-muted-foreground">{provider.detail}</span></span></div>{isConnected ? <div className="flex gap-2"><Button variant="secondary" onClick={() => handleToggle(provider.id, isEnabled)}>{isEnabled ? "Disable" : "Enable"}</Button><Button variant="secondary" onClick={() => handleDisconnect(provider.id)}>Disconnect</Button></div> : <Button onClick={() => handleConnect(provider.id)}>Connect provider <ArrowRight className="h-4 w-4" /></Button>}</Panel>;
  })}</div><Panel className="mt-6 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--memory-teal)]" /><div><p className="text-sm font-bold">Provider availability governs model selection</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Only a configured, healthy provider returns models to the selection screen. AI Memory Hub does not automatically fall back to another provider when a model is unavailable.</p></div></div></Panel></div></AppShell>; }

function ApiKeysPage() { return <AppShell title="API Key Management" eyebrow="Control center"><div className="mx-auto max-w-[970px]"><PageIntro label="Credential vault" title="Keep provider credentials off the client" copy="Provider credentials are designed to be encrypted and handled by the FastAPI backend. This screen shows connection state and last use—not a raw secret." action={<Button onClick={() => backendToast("Adding a credential")}><Plus className="h-4 w-4" /> Add credential</Button>} /><Panel className="overflow-hidden"><div className="grid grid-cols-[1.2fr_1fr_0.8fr_auto] gap-4 border-b border-border bg-[color:var(--surface-warm)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"><span>Provider</span><span>Key state</span><span>Last used</span><span /></div>{[['Google', 'Encrypted and available', 'Today, 10:41'], ['Ollama', 'Local connection — no cloud key', 'Today, 10:40'], ['OpenAI', 'Not configured', '—']].map(([provider, state, used]) => <div key={provider} className="grid grid-cols-[1.2fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-0"><span className="flex items-center gap-2 text-xs font-bold"><KeyRound className="h-4 w-4 text-[color:var(--memory-teal)]" /> {provider}</span><span><Pill tone={state.includes('available') || state.includes('Local') ? 'teal' : 'neutral'}>{state}</Pill></span><span className="text-[11px] text-muted-foreground">{used}</span><IconButton label={`Manage ${provider} credential`} onClick={() => backendToast(`Managing ${provider} credential`)}><MoreHorizontal className="h-4 w-4" /></IconButton></div>)}</Panel><div className="mt-5 grid gap-4 sm:grid-cols-2"><Panel className="p-5"><LockKeyhole className="h-5 w-5 text-[color:var(--memory-teal)]" /><p className="mt-4 text-sm font-bold">No plaintext in the browser</p><p className="mt-2 text-xs leading-5 text-muted-foreground">The frontend only receives credential status. Secrets never appear in components, local storage, logs, or network-facing markup.</p></Panel><Panel className="p-5"><ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" /><p className="mt-4 text-sm font-bold">Rotation stays explicit</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Credential rotation and removal need an authenticated backend action, with clear provider-specific confirmation.</p></Panel></div></div></AppShell>; }

function AnalyticsPage() { return <AppShell title="Analytics Dashboard" eyebrow="Control center"><div className="mx-auto max-w-[1200px]"><PageIntro label="Workspace activity" title="Understand the shape of your memory" copy="Activity figures help you review usage patterns. They are informational and never change what memory is retrieved." action={<Button variant="secondary"><CalendarClock className="h-4 w-4" /> Last 30 days <ChevronDown className="h-3.5 w-3.5" /></Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total memories" value="128" detail="Across 6 categories" icon={BrainCircuit} trend="+12" /><StatCard label="Conversations" value="46" detail="11 with retrieved memory" icon={MessageSquareText} trend="+8" /><StatCard label="Retrieval activity" value="72%" detail="Sessions with context used" icon={Gauge} trend="+4%" /><StatCard label="Models used" value="4" detail="Across 2 providers" icon={Bot} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]"><Panel className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-bold">Memory growth</p><p className="mt-1 text-[11px] text-muted-foreground">Long-term records created over time</p></div><Pill tone="teal">+12 this month</Pill></div><div className="mt-8 flex h-[220px] items-end gap-2">{[28, 33, 37, 34, 46, 49, 58, 61, 64, 72, 78, 84].map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end"><span style={{ height: `${height}%` }} className="w-full rounded-t-md bg-[color:color-mix(in_oklab,var(--memory-teal)_18%,transparent)] transition group-hover:bg-[color:var(--memory-teal)]" /><span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">{index % 2 === 0 ? `W${index + 1}` : ''}</span></div>)}</div></Panel><Panel className="p-5"><p className="text-sm font-bold">Provider usage</p><p className="mt-1 text-[11px] text-muted-foreground">Requests by configured provider</p><div className="mt-7 space-y-5">{[['Google', '68%', '68'], ['Ollama', '32%', '32']].map(([name, value, width]) => <div key={name}><div className="flex justify-between text-xs"><span className="font-bold">{name}</span><span className="text-muted-foreground">{value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><span style={{ width: `${width}%` }} className="block h-full rounded-full bg-[color:var(--memory-teal)]" /></div></div>)}</div><div className="mt-7 border-t border-border pt-5"><p className="index-label">Model usage</p>{[['Gemini 2.5 Pro', '41%'], ['Gemini 2.5 Flash', '27%'], ['Qwen 2.5 14B', '20%'], ['Llama 3.3 70B', '12%']].map(([name, value]) => <div key={name} className="mt-3 flex justify-between text-[11px]"><span className="font-bold">{name}</span><span className="text-muted-foreground">{value}</span></div>)}</div></Panel></div></div></AppShell>; }

function PrivacyPage() { const actions = [{ icon: Download, title: "Export memories", copy: "Request a portable export of your long-term memory records.", action: "Prepare memory export", variant: "secondary" as const }, { icon: Trash2, title: "Delete selected memories", copy: "Choose specific records to remove after authenticated confirmation.", action: "Choose memories", variant: "secondary" as const }, { icon: Archive, title: "Delete all memories", copy: "Permanently remove your full long-term memory layer. This requires deliberate confirmation.", action: "Delete all memories", variant: "danger" as const }, { icon: FileText, title: "Export conversations", copy: "Request the complete conversation history separately from memory.", action: "Prepare conversation export", variant: "secondary" as const }, { icon: MessageSquareText, title: "Delete conversations", copy: "Remove selected conversation records without altering separate memory unless you choose it.", action: "Manage conversations", variant: "secondary" as const }, { icon: KeyRound, title: "Remove provider credentials", copy: "Disconnect and revoke stored provider credentials through the secure backend vault.", action: "Manage credentials", variant: "secondary" as const }]; return <AppShell title="Privacy Center" eyebrow="Control center"><div className="mx-auto max-w-[1100px]"><PageIntro label="Your data controls" title="Control the record, on your terms" copy="Privacy actions are kept visible and separate. Memory, conversations, and provider credentials each have their own scope of control." /><Panel className="mb-6 border-[color:color-mix(in_oklab,var(--memory-teal)_28%,transparent)] bg-[color:color-mix(in_oklab,var(--memory-teal)_6%,transparent)] p-5"><div className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--memory-teal)]"><ShieldCheck className="h-5 w-5 text-white" /></span><div><p className="text-sm font-bold">Memory is not model property</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A future FastAPI backend must scope every conversation and vector query to the authenticated user. The selected model receives only the controlled context needed for the active request.</p></div></div></Panel><div className="grid gap-4 md:grid-cols-2">{actions.map(({ icon: Icon, title, copy, action, variant }) => <Panel key={title} className="p-5"><Icon className={cn("h-5 w-5", variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-[color:var(--memory-teal)]')} /><h3 className="font-display mt-4 text-lg font-semibold tracking-[-0.035em]">{title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{copy}</p><Button variant={variant} className="mt-5" onClick={() => backendToast(action)}>{action} <ArrowRight className="h-3.5 w-3.5" /></Button></Panel>)}</div></div></AppShell>; }

function ProfilePage() { return <AppShell title="User Profile" eyebrow="Control center"><div className="mx-auto max-w-[900px]"><PageIntro label="Personal workspace" title="Your profile and identity" copy="Your profile identifies the account that owns this workspace. User-scoped data stays connected to this identity, not an AI provider." action={<Button onClick={() => backendToast("Saving profile changes")}><Check className="h-4 w-4" /> Save changes</Button>} /><div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]"><Panel className="p-6"><span className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[color:var(--memory-teal)] text-xl font-bold text-white">AM</span><h3 className="font-display mt-5 text-xl font-semibold tracking-[-0.04em]">Alex Morgan</h3><p className="mt-1 text-xs text-muted-foreground">Personal workspace</p><Button variant="secondary" className="mt-6 w-full" onClick={() => backendToast("Changing profile photo")}><UserRound className="h-4 w-4" /> Change avatar</Button></Panel><Panel className="p-6"><div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold">Full name</span><input defaultValue="Alex Morgan" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-[color:var(--memory-teal)]" /></label><label className="block"><span className="mb-2 block text-xs font-bold">Email address</span><input defaultValue="alex@example.com" type="email" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-[color:var(--memory-teal)]" /></label></div><div className="mt-6 border-t border-border pt-6"><IndexLabel>Account security</IndexLabel><div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-[color:var(--surface-warm)] p-4"><span><span className="block text-xs font-bold">Email verified</span><span className="mt-1 block text-[10px] text-muted-foreground">Verified on Aug 16, 2026</span></span><Pill tone="teal"><Check className="h-3 w-3" /> Verified</Pill></div></div></Panel></div></div></AppShell>; }

function SettingsPage() { const settings = [{ icon: Bell, title: "Notifications", copy: "Choose which workspace events need your attention.", control: "Enabled" }, { icon: SlidersHorizontal, title: "Memory retrieval", copy: "Review how retrieved memory will be presented before a model uses it.", control: "Review mode" }, { icon: ShieldCheck, title: "Session controls", copy: "Control active sessions and sign-in security from your authenticated account.", control: "Managed" }, { icon: LayoutDashboard, title: "Workspace defaults", copy: "Set a preferred entry point and local display choices for this workspace.", control: "Chat" }]; return <AppShell title="Application Settings" eyebrow="Control center"><div className="mx-auto max-w-[1000px]"><PageIntro label="Workspace preferences" title="Tune the workbench to your way of thinking" copy="Interface preferences are local to your account. They do not permit automatic model selection or alter your long-term memory without a clear action." /><div className="space-y-3">{settings.map(({ icon: Icon, title, copy, control }) => <Panel key={title} className="flex items-center gap-4 p-4 sm:p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_10%,transparent)]"><Icon className="h-4 w-4 text-[color:var(--memory-teal)]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{copy}</span></span><button onClick={() => backendToast(`Changing ${title.toLowerCase()}`)} className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-bold transition hover:bg-secondary">{control} <ChevronsUpDown className="ml-1 inline h-3 w-3" /></button></Panel>)}</div><Panel className="mt-6 border-dashed bg-[color:var(--surface-warm)]"><EmptyState icon={Settings2} title="More settings will appear with your connected backend" copy="Service configuration, security policies, and workspace defaults will remain explicit controls rather than hidden automatic behavior." /></Panel></div></AppShell>; }

function LiveAnalyticsPage() { const [stats, setStats] = useState({ conversations: 0, messages: 0, memories: 0 }); useEffect(() => { api.analytics.get().then(setStats).catch(() => toast.error("Failed to load analytics")); }, []); return <AppShell title="Analytics Dashboard" eyebrow="Control center"><div className="mx-auto max-w-[1200px]"><PageIntro label="Workspace activity" title="Understand the shape of your memory" copy="Activity figures are scoped to your authenticated workspace." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Total memories" value={String(stats.memories)} detail="User-owned records" icon={BrainCircuit} /><StatCard label="Conversations" value={String(stats.conversations)} detail="User-owned conversations" icon={MessageSquareText} /><StatCard label="Messages" value={String(stats.messages)} detail="User-owned messages" icon={Bot} /></div></div></AppShell>; }

function LiveMemoryPage() { const [records, setRecords] = useState<MemoryRecord[]>([]); useEffect(() => { api.memories.list().then(setRecords).catch(() => toast.error("Failed to load memories")); }, []); const active = records.filter((record) => record.status === "active"); return <AppShell title="Memory Dashboard" eyebrow="Memory"><div className="mx-auto max-w-[1200px]"><PageIntro label="Long-term memory" title="A clear record of what you keep" copy="Review the context available to future conversations." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total memories" value={String(records.length)} detail="User-owned records" icon={BrainCircuit} /><StatCard label="Pinned context" value={String(active.filter((record) => record.pinned).length)} detail="Shown first when relevant" icon={Pin} /><StatCard label="Categories" value={String(new Set(records.map((record) => record.category)).size)} detail="Organize your context" icon={Tags} /><StatCard label="Archived" value={String(records.length - active.length)} detail="Retained, not retrieved" icon={Archive} /></div><Panel className="mt-6 overflow-hidden">{active.length ? <div className="divide-y divide-border">{active.map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div> : <EmptyState icon={BrainCircuit} title="No memories yet" copy="Approved long-term context will appear here." />}</Panel></div></AppShell>; }

function LiveSearchPage() { const [query, setQuery] = useState(""); const [results, setResults] = useState<MemoryRecord[]>([]); useEffect(() => { const timer = window.setTimeout(() => (query.trim() ? api.memories.search(query) : api.memories.list()).then(setResults).catch(() => toast.error("Memory search failed")), 250); return () => window.clearTimeout(timer); }, [query]); return <AppShell title="Search Memories" eyebrow="Memory"><div className="mx-auto max-w-[1000px]"><PageIntro label="Find context" title="Search the memory layer" copy="Search only long-term memory records." /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories by idea, category, or source…" className="h-14 w-full rounded-2xl border border-input bg-card px-5 text-sm outline-none focus:border-[color:var(--memory-teal)]" /><Panel className="mt-6 overflow-hidden">{results.length ? <div className="divide-y divide-border">{results.filter((memory) => memory.status === "active").map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div> : <EmptyState icon={Search} title="No memory matches that search" copy="Try another phrase or add a memory to begin." />}</Panel></div></AppShell>; }

function ConnectedMemoryPage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Other");
  const [source, setSource] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.memories.list().then(setRecords).catch(() => setError("Failed to load memories.")).finally(() => setIsLoading(false));
  }, []);

  const createMemory = async () => {
    if (!content.trim()) {
      setError("Memory content is required.");
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const record = await api.memories.create({ content: content.trim(), category, source_conversation_id: source.trim() || null, importance: 0.5, confidence: 0.7 });
      setRecords((current) => [record, ...current]);
      setContent("");
      setSource("");
      toast.success("Memory created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create memory.");
    } finally {
      setIsCreating(false);
    }
  };

  const active = records.filter((record) => record.status === "active");
  return <AppShell title="Memory Dashboard" eyebrow="Memory" action={<Button onClick={createMemory} disabled={isCreating}><Plus className="h-4 w-4" /> {isCreating ? "Creating..." : "Add memory"}</Button>}><div className="mx-auto max-w-[1200px]"><PageIntro label="Long-term memory" title="A clear record of what you keep" copy="Review the context available to future conversations." /><Panel className="mb-6 p-5"><div className="grid gap-3 lg:grid-cols-[1fr_180px_1fr_auto]"><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Capture a durable memory" rows={2} className="resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-[color:var(--memory-teal)]" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none"><option>Other</option><option>Personal</option><option>Education</option><option>Career</option><option>Preferences</option><option>Projects</option><option>Goals</option><option>Skills</option></select><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Source conversation ID (optional)" className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-[color:var(--memory-teal)]" /><Button onClick={createMemory} disabled={isCreating}><Plus className="h-4 w-4" /> Create</Button></div>{error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}</Panel>{isLoading ? <Panel className="p-8 text-center text-sm text-muted-foreground">Loading memories...</Panel> : active.length ? <Panel className="overflow-hidden"><div className="divide-y divide-border">{active.map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div></Panel> : <Panel><EmptyState icon={BrainCircuit} title="No memories yet" copy="Approved long-term context will appear here." /></Panel>}</div></AppShell>;
}

function ConnectedSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      const request = query.trim() ? api.memories.search(query, 8) : api.memories.list();
      request.then((records) => { if (!cancelled) setResults(records); }).catch(() => { if (!cancelled) setError("Memory search failed."); }).finally(() => { if (!cancelled) setIsLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  return <AppShell title="Search Memories" eyebrow="Memory"><div className="mx-auto max-w-[1000px]"><PageIntro label="Find context" title="Search the memory layer" copy="Search only long-term memory records." /><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder="Search memories by idea, category, or source…" className="h-14 w-full rounded-2xl border border-input bg-card px-5 text-sm outline-none focus:border-[color:var(--memory-teal)]" />{error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}<Panel className="mt-6 overflow-hidden">{isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Searching memories...</p> : results.length ? <div className="divide-y divide-border">{results.filter((memory) => memory.status === "active").map((memory) => <MemoryRow key={memory.id} memory={memory} />)}</div> : <EmptyState icon={Search} title="No memory matches that search" copy="Try another phrase or add a memory to begin." />}</Panel></div></AppShell>;
}

function ConnectedDetailsPage() {
  const [, params] = useRoute("/memory/:id");
  const [, navigate] = useLocation();
  const [memory, setMemory] = useState<MemoryRecord | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.memories.list().then((records) => {
      const selected = records.find((record) => record.id === params?.id) ?? null;
      setMemory(selected);
      setContent(selected?.content ?? "");
      setCategory(selected?.category ?? "");
      if (!selected) setError("Memory not found.");
    }).catch(() => setError("Failed to load memory.")).finally(() => setIsLoading(false));
  }, [params?.id]);

  const updateMemory = async () => {
    if (!memory || !content.trim()) return;
    setIsSaving(true);
    try {
      const updated = await api.memories.update(memory.id, { content: content.trim(), category });
      setMemory(updated);
      setEditing(false);
      toast.success("Memory updated");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const archiveOrRestore = async () => {
    if (!memory) return;
    try {
      const updated = memory.status === "archived" ? await api.memories.restore(memory.id) : await api.memories.archive(memory.id);
      setMemory(updated);
      toast.success(updated.status === "archived" ? "Memory archived" : "Memory restored");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Failed to update memory."); }
  };

  const pinMemory = async () => {
    if (!memory) return;
    try { setMemory(await api.memories.pin(memory.id)); toast.success("Memory pinned"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Failed to pin memory."); }
  };

  const deleteMemory = async () => {
    if (!memory) return;
    try { await api.memories.remove(memory.id); toast.success("Memory deleted"); navigate("/memory"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Failed to delete memory."); }
  };

  if (isLoading) return <AppShell title="Memory Details" eyebrow="Memory"><Panel className="mx-auto max-w-[1040px] p-8 text-center text-sm text-muted-foreground">Loading memory...</Panel></AppShell>;
  if (!memory) return <AppShell title="Memory Details" eyebrow="Memory"><Panel className="mx-auto max-w-[1040px] p-8 text-center"><p className="text-sm">{error || "Memory not found."}</p><Button className="mt-5" onClick={() => navigate("/memory")}>Back to memories</Button></Panel></AppShell>;
  return <AppShell title="Memory Details" eyebrow="Memory"><div className="mx-auto max-w-[1040px]"><button onClick={() => navigate("/memory")} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground"><ArrowRight className="h-3.5 w-3.5 rotate-180" /> All memories</button><Panel className="p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><Pill tone="teal">{memory.category}</Pill><Pill tone={memory.status === "archived" ? "neutral" : "teal"}>{memory.status}</Pill>{memory.pinned && <Pill tone="teal"><Pin className="h-3 w-3" /> Pinned</Pill>}</div>{editing ? <div className="mt-6 space-y-4"><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-[color:var(--memory-teal)]" /><input value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none" /><div className="flex gap-2"><Button onClick={updateMemory} disabled={isSaving}>{isSaving ? "Saving..." : "Save changes"}</Button><Button variant="secondary" onClick={() => { setContent(memory.content); setCategory(memory.category); setEditing(false); }}>Cancel</Button></div></div> : <><div className="mt-6 flex items-start justify-between gap-4"><div><h2 className="font-display text-[32px] font-semibold tracking-[-0.055em]">{memory.title}</h2><p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-7 text-muted-foreground">{memory.content}</p></div><IconButton label="Edit memory" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></IconButton></div><div className="mt-8 border-t border-border pt-6 text-xs"><p className="text-muted-foreground">Source: <span className="font-bold text-foreground">{memory.source}</span></p><p className="mt-2 text-muted-foreground">Created {memory.createdAt} · Updated {memory.updatedAt}</p></div><div className="mt-6 flex flex-wrap gap-2"><Button variant="secondary" onClick={archiveOrRestore}>{memory.status === "archived" ? <Undo2 className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{memory.status === "archived" ? "Restore memory" : "Archive memory"}</Button><Button variant="secondary" onClick={pinMemory}><Pin className="h-4 w-4" /> {memory.pinned ? "Pinned" : "Pin memory"}</Button><Button variant="danger" onClick={deleteMemory}><Trash2 className="h-4 w-4" /> Delete memory</Button></div></>}{error && <p className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}</Panel></div></AppShell>;
}

function ConnectedCategoriesPage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  useEffect(() => { api.memories.list().then(setRecords).catch(() => toast.error("Failed to load memories")); }, []);
  const groups = Array.from(records.reduce((grouped, record) => { grouped.set(record.category, (grouped.get(record.category) ?? 0) + 1); return grouped; }, new Map<string, number>()));
  return <AppShell title="Memory Categories" eyebrow="Memory"><div className="mx-auto max-w-[1100px]"><PageIntro label="Organize your context" title="Categories that fit your work" copy="Browse the categories represented in your long-term memory." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{groups.map(([name, count]) => <Link href="/memory/search" key={name} className="rounded-2xl border border-border bg-card p-5"><p className="font-display text-[23px] font-semibold">{name}</p><p className="mt-3 text-sm text-muted-foreground">{count} memor{count === 1 ? "y" : "ies"}</p></Link>)}</div>{!groups.length && <Panel><EmptyState icon={Tags} title="No categories yet" copy="Create a memory to begin organizing your context." /></Panel>}</div></AppShell>;
}

function ConnectedTimelinePage() {
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  useEffect(() => { api.memories.list().then(setRecords).catch(() => toast.error("Failed to load memories")); }, []);
  return <AppShell title="Memory Timeline" eyebrow="Memory"><div className="mx-auto max-w-[980px]"><PageIntro label="The memory thread" title="See how your long-term context evolved" copy="Review records by creation date." /><div className="space-y-3">{records.map((memory) => <Panel key={memory.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/memory/${memory.id}`} className="text-sm font-bold hover:underline">{memory.title}</Link><p className="mt-2 text-xs text-muted-foreground">{memory.content}</p></div><Pill tone={memory.status === "archived" ? "neutral" : "teal"}>{memory.createdAt}</Pill></div></Panel>)}{!records.length && <EmptyState icon={Clock3} title="No memories yet" copy="Create a memory to begin your timeline." />}</div></div></AppShell>;
}

function ConnectedPrivacyPage() {
  const downloadExport = async (kind: "memories" | "conversations") => {
    try {
      const blob = kind === "memories" ? await api.memories.export() : await api.conversations.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ai-memory-hub-${kind}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${kind === "memories" ? "Memory" : "Conversation"} export prepared`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  return <AppShell title="Privacy Center" eyebrow="Control center"><div className="mx-auto max-w-[1100px]"><PageIntro label="Your data controls" title="Control the record, on your terms" copy="Export your user-owned memories and conversations from the authenticated backend." /><div className="grid gap-4 sm:grid-cols-2"><Panel className="p-5"><Download className="h-5 w-5 text-[color:var(--memory-teal)]" /><p className="mt-4 text-sm font-bold">Export memories</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Download your long-term memory records.</p><Button className="mt-5" variant="secondary" onClick={() => downloadExport("memories")}><Download className="h-4 w-4" /> Prepare memory export</Button></Panel><Panel className="p-5"><FileText className="h-5 w-5 text-[color:var(--memory-teal)]" /><p className="mt-4 text-sm font-bold">Export conversations</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Download your conversation history.</p><Button className="mt-5" variant="secondary" onClick={() => downloadExport("conversations")}><Download className="h-4 w-4" /> Prepare conversation export</Button></Panel></div></div></AppShell>;
}

function LiveProfilePage() { const { user, refresh } = useAuth(); const [name, setName] = useState(user?.full_name ?? ""); const save = () => api.profile.update({ full_name: name || null }).then(() => refresh()).then(() => toast.success("Profile saved")).catch(() => toast.error("Failed to save profile")); return <AppShell title="User Profile" eyebrow="Control center"><div className="mx-auto max-w-[900px]"><PageIntro label="Personal workspace" title="Your profile and identity" copy="Your profile identifies the account that owns this workspace." action={<Button onClick={save}><Check className="h-4 w-4" /> Save changes</Button>} /><Panel className="p-6"><label className="block max-w-md"><span className="mb-2 block text-xs font-bold">Full name</span><input value={name} onChange={(event) => setName(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-[color:var(--memory-teal)]" /></label><p className="mt-5 text-xs text-muted-foreground">{user?.email}</p></Panel></div></AppShell>; }

function LiveConversationsPage() { const [items, setItems] = useState<ConversationSummary[]>([]); useEffect(() => { api.conversations.list().then(setItems).catch(() => toast.error("Failed to load conversations")); }, []); return <AppShell title="Conversation History" eyebrow="Workspace"><div className="mx-auto max-w-[1160px]"><PageIntro label="Full record" title="Your conversation history" copy="Review the chronological record kept for your account." action={<Button variant="secondary" onClick={() => api.conversations.export().then(() => toast.success("Conversation export prepared")).catch(() => toast.error("Export failed"))}><Download className="h-4 w-4" /> Export history</Button>} /><Panel className="overflow-hidden"><div className="divide-y divide-border">{items.map((conversation) => <Link key={conversation.id} href="/chat" className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/60"><MessageSquareText className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{conversation.title}</span><span className="mt-1 block text-xs text-muted-foreground">{conversation.model} · {conversation.updatedAt}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}{!items.length && <EmptyState icon={MessageSquareText} title="No conversations yet" copy="Start a chat to create your first conversation." />}</div></Panel></div></AppShell>; }

export function WorkspaceRoute({ page }: { page: "chat" | "conversations" | "memory" | "search" | "categories" | "timeline" | "details" | "models" | "providers" | "keys" | "analytics" | "privacy" | "profile" | "settings" }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, isLoading, navigate]);
  if (isLoading || !isAuthenticated) return <div className="min-h-screen bg-background" />;
  const pages = { chat: <ChatPage />, conversations: <LiveConversationsPage />, memory: <ConnectedMemoryPage />, search: <ConnectedSearchPage />, categories: <ConnectedCategoriesPage />, timeline: <ConnectedTimelinePage />, details: <ConnectedDetailsPage />, models: <ModelSelectorPage />, providers: <ProvidersPage />, keys: <ApiKeysPage />, analytics: <LiveAnalyticsPage />, privacy: <ConnectedPrivacyPage />, profile: <LiveProfilePage />, settings: <SettingsPage /> };
  return pages[page];
}
