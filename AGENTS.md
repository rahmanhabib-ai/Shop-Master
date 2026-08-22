# Project Rules & AI Agent Instructions (AGENTS.md)

## Core Coding Principles & Strict Directives

1. **Mandatory Workflow Protocol (Plan -> Review -> Explicit Permission -> Execute)**:
   - **No Direct Code Generation Without Consent**: AI Agent will NEVER write code, create files, or edit existing files directly upon receiving a functional or architecture request.
   - **Step 1 - Thorough Requirement Analysis**: Understand the user's requirement completely.
   - **Step 2 - Detailed Plan Presentation**: Explain the implementation plan, architecture, and step-by-step roadmap in clear Bengali to the user first.
   - **Step 3 - Confirmation & Understanding Validation**: Confirm with the user that the AI fully understood the scope and architectural design.
   - **Step 4 - Wait for Direct User Permission**: Only proceed to modify/write code when the user explicitly responds with consent (e.g., "হ্যাঁ, তুমি এইভাবে লেখো", "কোড লেখো", "অনুমতি দিলাম").
   - **Step 5 - Step-by-Step Surgical Execution**: Execute code changes incrementally with zero breaking changes, adhering to continuous validation.

2. **Zero Code/Feature Deletion & Cumulative Merging**:
   - When adding new features, modifying files, or fixing bugs, **NEVER** delete, omit, overwrite, or drop any existing features, functions, menus, pages, options, or data schemas.
   - Always merge previous working code and new additions into a perfectly harmonized, complete system.
   - If a system has a bug, fix the root cause without removing any existing functionality or user options.

3. **Strict Scope Discipline (No Unsolicited Additions)**:
   - Implement only what the user explicitly asks for—nothing more, nothing less.
   - Do not add unsolicited pages, tabs, background logic, or features without direct permission.

4. **Admin & User Dashboard Synchronization (Customer First)**:
   - When updating or configuring Admin Panel features, **ALWAYS** inspect and synchronize corresponding functionality in the User Panel (`/app`).
   - Customer experience and dashboard stability take top priority—never break or leave user-facing features out of sync with admin operations.

5. **Master-Cache Architecture Adherence**:
   - Strictly follow the Master-Cache (Hostinger Master DB + Local Ultra-Fast Cache AI Engine) roadmap for all data model definitions, sync bridge routines, Admin panel, and User panel features.

6. **GitHub Sync & Continuous Versioning Commitment**:
   - Whenever any code modifications, fixes, or settings updates are made, ensure file changes and version updates are cleanly tracked so that Git detects new commits for GitHub export and Hostinger auto-deployments.

7. **Messaging Gateway Architecture (Baileys Multi-Device & Official WhatsApp API)**:
   - Modernize WhatsApp Messaging Gateway with dual support:
     - **Baileys Multi-Device (Primary/Free)**: Direct QR code pairing via Node.js background socket without any paid 3rd-party API reliance.
     - **Official WhatsApp Cloud API (Alternative)**: Meta Business Cloud API configuration for enterprise users.
     - **How to Use Guide**: Interactive visual guide and help popups for both methods.
   - Maintain unified background dispatching via `/api/gateways/dispatch` so POS, billing, and automated reminders work seamlessly.

8. **No Code Blocks or Snippets in Chatbot Responses**:
   - The AI Agent must **NEVER** output raw code blocks, file contents, diff snippets, or code scripts into the conversational chat box.
   - All code updates must strictly be performed directly into the project codebase files using surgical file editing tools. The chat message must only contain concise, professional Bengali explanations of the actions taken.

9. **Self-Sanitation / Proofing**:
   - Before concluding any turn, always run `compile_applet` and `lint_applet` to confirm zero regression errors.

