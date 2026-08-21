# AI Memory Hub — Interface Direction

## Three stylistic approaches

### 1. Quiet Intelligence Console
**Very Brief Intro:** A composed, editorial workspace with warm neutrals, deep ink, and a sharply defined teal signal color. It makes persistent memory feel calm, private, and navigable rather than mysterious.

**Probability:** 0.07

### 2. Luminous Knowledge Atlas
**Very Brief Intro:** An expansive mapping interface that treats memories as an illuminated constellation. It emphasizes discovery, relationships, and a sense of scale.

**Probability:** 0.03

### 3. Archive Studio
**Very Brief Intro:** A refined digital archive inspired by library catalogues and research notebooks. It uses measured type, dense information design, and subtle paper-like depth.

**Probability:** 0.09

## Chosen approach: Quiet Intelligence Console

### Design Movement
**Contemporary editorial software**: a blend of Swiss information design and the tactile restraint of high-end research tools. The interface feels like a personal knowledge instrument, not a generic chatbot.

### Core Principles
1. **Ownership through clarity:** user memory is always named, sourced, dated, and controllable.
2. **Calm hierarchy:** whitespace, calm surfaces, and deliberate type sizes keep large volumes of information readable.
3. **Earned color:** a single teal signal color highlights memory-related actions, active states, and trusted connections; it is never used as decoration.
4. **Context without clutter:** persistent rails establish location, while focused canvases keep one primary task legible at a time.

### Color Philosophy
The primary experience uses a warm mineral white background, charcoal ink, misty gray surfaces, and **Memory Verdigris** as the ownable signal. This quietly technical palette expresses privacy and confidence without relying on loud gradients. Dark mode becomes a dark-slate reading environment with softened, not pure-white, text to reduce visual fatigue.

### Layout Paradigm
The product is built as a **three-zone workbench**: an information rail for location and conversations, an adaptable main canvas for the active task, and an optional contextual inspector for model or memory details. Public pages translate the same idea into asymmetric editorial blocks rather than a centered marketing template.

### Signature Elements
1. **The Memory Thread:** a thin vertical connective line, used in timeline and source relationships to show continuity.
2. **Verdigris focus ring:** a soft teal keyline that marks active, selected, or retrieved memory without filling every surface.
3. **Index labels:** compact uppercase metadata labels for source, date, category, provider, and privacy state.

### Interaction Philosophy
Every consequential action is explicit. Provider connection, model selection, memory deletion, and archive restoration all use clear labels and confirmation-oriented controls. Micro-interactions are direct: subtle surface lifts, pressed buttons, and concise feedback; no playful motion that suggests data is moving when it is not.

### Animation
Navigation rails and drawers use 180–240 ms transform-and-opacity transitions with a snappy ease-out curve. Panels enter from their relationship to the trigger, lists can cascade in at 40 ms intervals, and loading states use understated skeletal movement. Keyboard-triggered controls remain instant, and all non-essential movement respects `prefers-reduced-motion`.

### Typography System
**Sora** is the display face for product identity, page titles, and numerical emphasis; its geometric structure supports a precise, intelligent character. **Manrope** is the reading and interface face for body copy, navigation, controls, and metadata. Titles use tight tracking and medium-to-bold weights; index labels use uppercase, expanded tracking, and muted color; long text retains generous line height.

### Brand Essence
**AI Memory Hub is the private control surface for people who want one portable memory across every AI they use.**

**Personality:** composed, exacting, protective.

### Brand Voice
The voice is concise, explicit, and quietly reassuring. Headlines state a benefit without hype; CTAs describe the exact action; microcopy explains what will happen to user data.

Example lines:

> “Your memory, available wherever you think.”

> “Connect a provider without exposing a credential to the browser.”

### Wordmark & Logo
The mark is a **continuous double-arc thread** that creates a small protected node at its center, signaling durable context moving safely between models. The wordmark pairs the mark with a customized Sora logotype in which the crossbar of the “A” mirrors the mark’s connective thread.

### Signature Brand Color
**Memory Verdigris — `#0F9D89`**. This deep, mineral teal is used for retrieval, active state, confirmation, and user-control signals.

## Frontend boundaries

The React frontend will represent all UI state and call a typed service boundary in `frontend/src/services/api.ts`. The service functions define the future FastAPI contracts and deliberately throw a typed unavailable error when no backend is connected. Components will not fabricate persistence, credentials, user-scoped results, or hidden model switching. Initial rendered content is illustrative interface data only, clearly labelled where an API connection is required.

The route map will provide public marketing and authentication experiences alongside private workbench views for chat, conversation history, memory dashboard/search/categories/timeline/detail, model selection, provider settings, API key management, analytics, privacy, profile, and application settings.

## Style Decisions

- **Workbench density:** private screens begin with an immediately usable rail, canvas, and context area. The navigation rail is fixed and the canvas begins directly under its working header, avoiding decorative blank space.
- **Verdigris discipline:** Memory Verdigris `#0F9D89` is limited to selection, retrieval, confirmation, active controls, and primary user-controlled actions. Broad framing surfaces use dark slate or mineral neutrals.
- **Memory Thread usage:** a continuous thread appears in the timeline and the provenance of memory records, reinforcing that a record can be traced to its source without blurring it into the full conversation history.
