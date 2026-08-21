# Product Requirement Document (PRD): Lightweight ATS

## 1. Executive Summary & Purpose
- **Target Audience:** A lean team of 3 internal recruiters.
- **Core Problem:** Managing inbound applicants, outbound sourced talent, 8-stage pipelines, onboarding compliance documents, and background check renewals via spreadsheets leads to dropped candidate communications, compliance risks, and zero visibility into recruitment performance metrics.
- **Goal:** Build a simple, fast, drag-and-drop Applicant Tracking System (ATS) that centralizes candidate profiles, AI multi-document parsing (Resumes & Application Forms) with smart conflict resolution, quick-add sourced talent workflows with outreach notes, global candidate search, stage tracking with automated compliance guardrails, applicant disqualification tracking, custom interview scorecards, SharePoint 201 document checklists with specific compliance expiration tracking, DNH flags, and real-time recruitment analytics dashboards.

---

## 2. Key User Personas & Roles
- **Recruiter (3 Users):** Full shared administrative permissions to manage job openings, parse multi-document candidate files, import outbound sourced talent with outreach notes, search candidates by name/skill, resolve data merge conflicts, manually edit candidate details, drag candidates across pipeline stages, mark applicants as Disqualified with reasons, log activity notes, track DocuSign offer status, manage compliance expiration dates (TB, Physicals, IDs, Background Check renewals, CPR), flag candidate hire eligibility, and view recruitment analytics dashboards.

---

## 3. Core Functional Requirements

### Feature 1: Job Requisition Management & Global Candidate Search
- [ ] Create, edit, archive, and view job openings (Title, Department, Location, Description).
- [ ] Simple status toggle: **Active** vs. **Closed**.
- [ ] **Global Candidate Search Bar:** Instant search-as-you-type querying across candidate First Name, Last Name, Email, Phone Number, Primary Skills, and Status Tags.

### Feature 2: Visual Candidate Pipeline (Kanban Board per Job) & Stage Guardrails
- [ ] Filterable Kanban board displaying candidates per selected Job Opening. Shared pool for direct applicants and sourced candidates.
- [ ] **Candidate Source Badges:** Each candidate card displays a subtle tag indicating origin (e.g., `[LinkedIn]`, `[Indeed]`, `[Referral]`, `[Direct App]`).
- [ ] **Kanban Source Filters:** Top-level dropdown filter to toggle between *All Sources*, *Direct Applicants*, and *Outbound Sourced*.
- [ ] **8 Pipeline Stages:**
  1. **New Application** (Fresh resumes, application forms, or quick-added sourced candidates)
  2. **Screening** (Initial recruiter call)
  3. **Interview** (Department/Managerial rounds)
  4. **Completing Requirements** (Pre-employment paperwork)
  5. **Offer** (Manual DocuSign Envelope Link & Status Toggle: *Offer Sent* -> *DocuSign Signed*)
  6. **Background Checks** (Security & compliance verifications)
  7. **Hired** (Successfully onboarded & 201 file linked — *Protected Stage*)
  8. **Rejected / Disqualified** (Archived with mandatory disposition reason)
- [ ] **Disqualification Disposition:** Direct applicants or sourced candidates can be marked as `Disqualified` with a categorized reason (*Did not meet requirements*, *Missing qualifications*, *Salary Mismatch*, *Location/Commute*, *Other*).
- [ ] **"Hired" Stage Compliance Guardrail:** Moving a candidate card into the **Hired** stage triggers an automated check. If any mandatory document is missing (`Pending`) or any compliance item is **Expired**, the stage movement is blocked, and an alert modal lists the missing/expired requirements.

### Feature 3: Candidate Sourcing Channels & Outbound Sourced Workflows
- [ ] **Mandatory Sourcing Channel Metadata:**
  - *Inbound / Direct:* Job Board / Career Site, Application Form, Walk-in.
  - *Outbound / Sourced:* LinkedIn Recruiter, Indeed Resume Database, Employee Referral, Headhunter / Agency, Talent Pool Rediscovery.
- [ ] **Method A: 1-Click Sourced File Parsing:** Upload a downloaded LinkedIn or Indeed PDF profile directly into Gemini 2.5 Flash, assigning it a source channel and target job.
- [ ] **Method B: Quick-Add Sourced Candidate Modal:**
  - Fast-entry modal for recruiters reaching out to candidates via InMail/Message before obtaining a full resume.
  - **Required Fields:** Full Name, Sourcing Channel (e.g., *LinkedIn InMail*), Target Job Opening, Contact Info / Profile URL.
  - **Recruiter Outreach Notes Field:** Dedicated text box to log initial conversation context, salary expectations, or outreach status. Automatically saved to the Candidate Activity Stream.
  - **Optional File Attachment:** Drag-and-drop resume PDF upload (if available at time of creation). If uploaded, triggers Gemini 2.5 Flash parsing automatically to pre-fill fields.
  - Candidate appears immediately on the Kanban board with a **"Pending Resume / Sourced"** indicator if created without a file.

### Feature 4: AI Multi-Document Parsing, Smart Auto-Merge & Manual Editing
- [ ] **Multi-Document Extraction:** Upload PDF Resumes or Application Forms via **Gemini 2.5 Flash API**.
- [ ] **Auto-Append Logic:** If a parsed field (e.g., Middle Name, References, Driver's License #) is blank in the current database profile, auto-fill it instantly without recruiter prompt.
- [ ] **Field Conflict Review Modal:** If an uploaded document (e.g., Application Form) contains data that differs from existing database records:
  - Present a side-by-side comparison modal displaying **Current Profile Data** vs. **New Document Data**.
  - Provide interactive checkboxes pre-selected for the Application Form (as the primary source of truth).
  - Recruiter clicks **"Accept & Apply Selected Updates"** to execute selective overwrites.
- [ ] **In-Line Manual Editing:** Recruiters can manually edit, update, or correct any field on a candidate's profile at any time directly inside the profile drawer.
- [ ] **Candidate Status Tagging:** `Eligible for Hire`, `Do-Not-Hire`, `Former Employee / Rehire`.
- [ ] **DNH Warning Banner:** Mandatory fields for Date Flagged, Recruiter Name, and Reason/Notes. Red warning alert displayed on profile if flagged.

### Feature 5: Centralized Activity Stream & Notes
- [ ] Chronological activity log inside candidate profile for manual call notes, initial sourcing notes, status changes, and recruiter updates.

### Feature 6: Custom Scorecards & Evaluation Templates
- [ ] **Scorecard Builder:** Interface to create role-specific criteria lists.
- [ ] **Evaluation Form:** 1–5 star rating per criterion plus written commentary attached to candidate profile.

### Feature 7: Categorized Document Checklist & Expiration Tracker
- [ ] Interactive tab inside candidate profile with fields for **Status** (`Pending`, `Submitted`, `N/A`), **SharePoint 201 Link**, **Date Issued/Signed**, and **Expiration Date**.
- [ ] **Tracked Compliance Documents (With Expiration Tracking):**
  1. **Validity of IDs / Licenses:** Driver's License/State ID, Professional Licenses (RN/LPN/etc.).
  2. **Medical Clearances:** TB Test, Physical Exam.
  3. **Background Check Renewal:** Criminal Record Check renewal (5-year cycle).
  4. **Training & Certifications:** CPR & First Aid Certification.
- [ ] **Non-Expiring / Standard Checklist Items:**
  - *Onboarding Records:* Application Form, Offer Letter (DocuSign Link), Employee Handbook, Reference Check, Competency Test (Optional).
  - *Compliance/Tax Records:* Social Security ID, Form I-9, Form W-4.
  - *Security Checks:* OIG, SAM, Medicheck, E-Verify Case Processing, FBI Background Check (Optional, non-tracked).

### Feature 8: Real-Time Recruitment Analytics & Dashboard Reports
- [ ] **Summary KPI Cards:** Total Applicants, Active Candidates, Disqualified Count, Offers Pending vs. Signed, and Open Job Requisitions.
- [ ] **Pipeline Stage Breakdown:** Graphical funnel displaying candidate counts across all 8 pipeline stages.
- [ ] **Sourcing Channel Performance:** Bar/Donut chart breaking down candidate volume and conversion rate by channel (*LinkedIn*, *Indeed*, *Direct App*, *Referral*).
- [ ] **Compliance Expiration Alert Widget:** Dashboard table highlighting documents expiring within 30 days or overdue renewals for **TB Tests, Physical Exams, IDs/Licenses, Background Check Renewals, and CPR/First Aid Certifications**.

---

## 4. Technical Architecture, Hosting & UI/UX Design System
- **Frontend Framework:** Next.js (App Router) with TypeScript & Tailwind CSS.
- **UI & Drag-and-Drop:** Shadcn UI + Recharts + `@dnd-kit`.
- **Database:** Supabase (Free Tier PostgreSQL).
- **Document Storage:** External Company SharePoint (URL links stored in Supabase).
- **AI Processing:** Gemini 2.5 Flash API via Google AI Studio (`@google/genai` SDK).
- **Deployment:** Vercel (Free Hobby Tier).

### Brand Identity & Design System (Reliance Theme)
- **Visual Style:** Clean, healthcare-grade professional UI with soft borders, structured tables, and scannable cards.
- **Color Palette:**
  - `primary`: Deep Healthcare Navy (`#0F2C59`) – Headers, primary action buttons, active navigation.
  - `secondary`: Clean Medical Teal/Blue (`#0EA5E9`) – Active pipeline badges, selection rings, icons.
  - `accent-warning`: Compliance Amber (`#F59E0B`) – Expiring licenses, DNH warning badges, background check flags.
  - `accent-danger`: Crimson Red (`#EF4444`) – Expired compliance items, disqualified tags, hard blocks.
  - `accent-success`: Emerald Green (`#10B981`) – Completed documents, signed offers, "Hired" stage.
  - `background`: Slate Crisp Light (`#F8FAFC`) with Pure White cards (`#FFFFFF`).
- **Typography:** `Inter` or `Plus Jakarta Sans` with clean weight hierarchy (`font-medium` for labels, `font-semibold` for headers/candidate names).

---

## 5. Success Criteria
1. Global search bar resolves candidate queries instantly across active and archived records.
2. Disqualified applicants are categorized with specific reasons and excluded from active funnel counts.
3. Hired stage guardrail blocks movement if required documents are missing or expired.
4. System runs entirely within free-tier thresholds (Vercel, Supabase, Google AI Studio).