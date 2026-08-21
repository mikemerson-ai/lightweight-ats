# Implementation Plan: Lightweight ATS

This implementation plan breaks down the development of the Lightweight ATS into 6 structured, sequential phases. Each phase contains bite-sized tasks designed for efficient execution and token optimization in Antigravity.

---

## Phase 1: Project Setup & Supabase Architecture
- [x] **Task 1.1: Next.js & UI Initialization (with Reliance Branding)**
  - Initialize Next.js (App Router, TypeScript, Tailwind CSS).
  - Install core UI packages (`lucide-react`, `clsx`, `tailwind-merge`, `recharts`).
  - Configure Tailwind with Reliance brand colors (Navy `#0F2C59`, Teal `#0EA5E9`, Amber `#F59E0B`, Slate `#F8FAFC`).
  - Configure `.antigravityignore` and `.geminiignore` in the project root.
- [x] **Task 1.2: Supabase Client & Environment Variables**
  - Install `@supabase/supabase-js` and `@supabase/ssr`.
  - Create `.env.local` template (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
  - Set up browser and server Supabase client utilities in `@/lib/supabase/`.
- [x] **Task 1.3: Database Migration (SQL Schema)**
  - Execute SQL migration in Supabase for tables: `jobs`, `candidates`, `document_checklists`, `scorecard_templates`, `evaluations`, and `activity_logs`.
  - Add database indexes for global search (Name, Email, Skills, Status) and PostgreSQL stored procedures for compliance verification.

---

## Phase 2: Job Requisitions, Global Search & Sourced Candidate Ingestion
- [x] **Task 2.1: Job Requisition Server Actions & Data Access**
  - Write Server Actions (`createJob`, `getJobs`, `toggleJobStatus`) to manage job openings.
- [x] **Task 2.2: Global Search & Filter Toolbar**
  - Build `SearchBar.tsx` with instant search-as-you-type functionality querying candidate names, skills, and email addresses.
- [x] **Task 2.3: Quick-Add Sourced Candidate Modal**
  - Build `QuickAddSourcedModal.tsx` supporting fast candidate entry (Name, Channel, Target Job, Profile URL, Initial Outreach Notes).
  - Add optional drag-and-drop resume attachment field to trigger instant Gemini AI parsing.

---

## Phase 3: Drag-and-Drop Kanban Pipeline UI & Compliance Guardrails
- [ ] **Task 3.1: Install & Set Up `@dnd-kit`**
  - Install `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`.
  - Create Client-side wrapper to prevent Next.js SSR hydration mismatches.
- [ ] **Task 3.2: Kanban Components & Source Badge Rendering**
  - Build `CandidateCard.tsx` with source badges (`[LinkedIn]`, `[Indeed]`, `[Direct App]`) and drag hooks.
  - Build `KanbanColumn.tsx` droppable containers for all 8 pipeline stages.
  - Build main `KanbanBoard.tsx` with top-level source channel filter dropdown.
- [ ] **Task 3.3: "Hired" Stage Guardrail & Disqualification Workflow**
  - Implement compliance check function on `onDragEnd` to block movement to "Hired" if checklist items are missing or expired.
  - Build `DisqualificationModal.tsx` prompting for categorized rejection reasons (*Did not meet requirements*, *Missing qualifications*, *Salary Mismatch*, *Location/Commute*, *Other*).

---

## Phase 4: Gemini 2.5 Flash AI Parsing & Smart Conflict Resolution
- [ ] **Task 4.1: Gemini SDK & Parsing Route**
  - Install `@google/genai` SDK.
  - Create API route/Server Action (`/api/parse-document`) for Gemini 2.5 Flash with structured JSON output schema.
- [ ] **Task 4.2: Field Conflict Review Modal & Auto-Append Engine**
  - Build auto-append logic for blank database fields.
  - Build `FieldConflictModal.tsx` side-by-side comparison UI displaying current database values vs. new document values with selective overwrite checkboxes.

---

## Phase 5: Profile Drawer, Document Compliance & Scorecards
- [ ] **Task 5.1: Candidate Profile Drawer & In-Line Editing**
  - Build slide-out `CandidateDrawer.tsx` with tabbed navigation and full field editability.
- [ ] **Task 5.2: Categorized Document Checklist & Expiration Tracker**
  - Build `DocumentChecklistTab.tsx` grouped by category (*Onboarding Records*, *Compliance*, *Security*, *Medical*, *Training*).
  - Add fields for SharePoint 201 URLs, Date Issued, and Expiration Dates with active alerts for TB, Physicals, IDs, Background Check renewals, and CPR.
- [ ] **Task 5.3: DNH Warning Banner & Centralized Activity Stream**
  - Implement red warning banner for candidates tagged as `Do-Not-Hire` or `Rehire`.
  - Build `ActivityStream.tsx` logging recruiter outreach notes, call logs, and stage change history.
- [ ] **Task 5.4: Custom Scorecards & Evaluations**
  - Build `ScorecardBuilder.tsx` and `EvaluationForm.tsx` with 1–5 star rating scales.

---

## Phase 6: Recruitment Analytics Dashboard & Vercel Deployment
- [ ] **Task 6.1: Analytics Dashboard View**
  - Build summary KPI cards (Total Applicants, Active Candidates, Disqualified Count, Open Reqs).
  - Build pipeline funnel charts and sourcing channel performance charts using `recharts`.
  - Build Compliance Expiration Alert widget highlighting items expiring within 30 days.
- [ ] **Task 6.2: Production Build & Vercel Deployment**
  - Run local TypeScript/ESLint checks (`npm run build`).
  - Deploy to Vercel and configure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).