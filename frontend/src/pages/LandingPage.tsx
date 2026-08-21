/** Quiet Intelligence Console landing: asymmetric editorial storytelling with warm material depth and dark readable copy. */

import { BrandLockup, BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Check, Database, Fingerprint, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";

const features = [
  { icon: Database, label: "One memory layer", description: "Keep durable context separate from conversation history and carry it between models." },
  { icon: GitBranch, label: "Choose every model", description: "Select the connected cloud or local model you want. Nothing changes without your instruction." },
  { icon: ShieldCheck, label: "Control the record", description: "Review, organize, archive, export, or remove any memory from one focused workspace." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link href="/"><BrandLockup /></Link>
          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-muted-foreground md:flex">
            <a href="#memory" className="transition hover:text-foreground">Memory layer</a>
            <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
            <a href="#models" className="transition hover:text-foreground">Models</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link href="/login" className="hidden px-2.5 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground sm:inline">Sign in</Link>
            <Link href="/register" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--memory-teal)] px-4 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[color:var(--memory-teal-deep)] active:scale-[0.97]">Create your hub <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-[1320px] gap-10 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-4 lg:pb-24 lg:pt-24">
          <div className="relative z-10 max-w-[610px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--memory-teal)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--memory-teal)_8%,transparent)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--memory-teal)]" /> User-controlled AI memory
            </div>
            <h1 className="font-display text-balance max-w-[600px] text-[43px] font-semibold leading-[0.98] tracking-[-0.065em] sm:text-[58px] lg:text-[67px]">
              Your memory, <span className="text-[color:var(--memory-teal)]">available</span> wherever you think.
            </h1>
            <p className="mt-7 max-w-[520px] text-[16px] leading-7 text-muted-foreground sm:text-[17px]">
              Keep one private, portable memory across the AI models you choose—without confusing it with your raw conversation history.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background transition hover:-translate-y-0.5 hover:opacity-90 active:scale-[0.97]">Build your memory hub <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/chat" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold transition hover:bg-secondary">Explore the workspace</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-muted-foreground">
              {['Choose every model', 'Review every memory', 'Export on your terms'].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[color:var(--memory-teal)]" /> {item}</span>)}
            </div>
          </div>
          <div className="relative min-h-[380px] lg:min-h-[545px]">
            <div className="absolute inset-0 -rotate-2 rounded-[28px] border border-border bg-[color:color-mix(in_oklab,var(--memory-teal)_7%,transparent)]" />
            <div role="img" aria-label="An abstract memory thread connecting a protected node to model systems" className="memory-visual memory-visual--hero absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] rounded-[23px] shadow-[0_30px_80px_-40px_rgba(21,39,35,0.42)]" />
            <div className="absolute -bottom-4 left-4 right-4 rounded-2xl border border-white/65 bg-background/80 p-4 shadow-[0_18px_40px_-28px_rgba(21,39,35,0.45)] backdrop-blur-lg sm:left-auto sm:right-6 sm:w-[270px]">
              <p className="index-label">Memory status</p>
              <div className="mt-2 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_13%,transparent)]"><Sparkles className="h-4 w-4 text-[color:var(--memory-teal)]" /></span><div><p className="text-sm font-bold">Context is portable</p><p className="mt-0.5 text-[11px] text-muted-foreground">Across your selected models</p></div></div>
            </div>
          </div>
        </section>

        <section id="memory" className="border-y border-border bg-[color:var(--surface-warm)] py-16 lg:py-24">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
            <div><p className="index-label text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">The memory layer</p><h2 className="font-display mt-4 max-w-[520px] text-[35px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[44px]">Conversation is the trail. Memory is what you choose to keep.</h2><p className="mt-5 max-w-[510px] leading-7 text-muted-foreground">AI Memory Hub separates the full conversation record from the compact, meaningful information you want future models to understand. You can always see where a memory came from.</p></div>
            <div className="rounded-[26px] border border-border bg-card p-3 shadow-[0_22px_60px_-45px_rgba(21,39,35,0.4)]"><div role="img" aria-label="Abstract memory fragments connected by a continuous teal thread" className="memory-visual memory-visual--thread h-[300px] w-full rounded-[18px]" /></div>
          </div>
        </section>

        <section id="models" className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-[540px]"><p className="index-label text-[color:var(--memory-teal-deep)] dark:text-[color:var(--memory-teal-light)]">A deliberate control surface</p><h2 className="font-display mt-4 text-[35px] font-semibold leading-[1.06] tracking-[-0.055em] sm:text-[44px]">One calm place for every model relationship.</h2></div><p className="max-w-[340px] text-sm leading-6 text-muted-foreground">Models appear only after you connect a provider. Switching is explicit, and your context stays with you.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, label, description }, index) => <article key={label} className="group rounded-2xl border border-border bg-card p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_-30px_rgba(21,39,35,0.35)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--memory-teal)_11%,transparent)]"><Icon className="h-5 w-5 text-[color:var(--memory-teal)]" /></span><p className="index-label mt-6">0{index + 1}</p><h3 className="font-display mt-2 text-xl font-semibold tracking-[-0.04em]">{label}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></article>)}</div>
        </section>

        <section id="privacy" className="border-y border-border bg-[color:var(--ink-soft)] py-16 text-white lg:py-24">
          <div className="mx-auto grid max-w-[1320px] gap-10 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16"><div className="order-2 lg:order-1"><div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-3"><div role="img" aria-label="Abstract protected vault with a teal memory thread" className="memory-visual memory-visual--vault h-[300px] w-full rounded-[18px]" /></div></div><div className="order-1 lg:order-2"><div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--memory-teal)]"><Fingerprint className="h-5 w-5" /></div><p className="index-label mt-6 text-white/55">Privacy by design</p><h2 className="font-display mt-3 max-w-[460px] text-[35px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[44px]">Your models use your memory. They do not own it.</h2><p className="mt-5 max-w-[480px] leading-7 text-white/65">Open the Privacy Center to export memories, remove connected credentials, or delete selected records. The decisions remain visible and in your control.</p><Link href="/privacy" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--memory-teal-light)] transition hover:gap-3">See privacy controls <ArrowRight className="h-4 w-4" /></Link></div></div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 lg:py-24"><div className="relative overflow-hidden rounded-[28px] bg-[color:var(--ink-soft)] px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-16"><div className="absolute -right-10 -top-12 h-56 w-56 rounded-full border-[32px] border-[color:var(--memory-teal)]/25" /><BrandMark className="h-12 w-12" /><h2 className="font-display mt-6 max-w-[650px] text-[36px] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-[48px]">Build context that travels with your work.</h2><p className="mt-4 max-w-[510px] leading-7 text-white/70">Start with a deliberate memory layer, then connect the AI providers and local models that fit your work.</p><Link href="/register" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[color:var(--ink-soft)] transition hover:-translate-y-0.5 active:scale-[0.97]">Create your hub <ArrowRight className="h-4 w-4" /></Link></div></section>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><BrandLockup /><p>One portable memory layer for the AI you choose.</p><div className="flex gap-4"><Link href="/privacy">Privacy</Link><Link href="/login">Sign in</Link></div></div></footer>
    </div>
  );
}
