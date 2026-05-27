# Trello Clone System Plan

## 1. System Architecture & Repository Structure

We will use a **Monorepo** approach to manage the entire full-stack application in a single repository.

- `/backend` - Go REST API and WebSocket server.
- `/web` - Next.js frontend application.
- `/mobile` - React Native (Expo) mobile application.
- **Infrastructure:** Docker & Docker Compose to orchestrate and run the Database, Backend, and Web Frontend simultaneously.

## 2. Detailed Tech Stack

- **Backend:**
  - **Language:** Go (Golang)
  - **Web Framework:** Fiber (for fast routing and middleware).
  - **Database Tooling:** GORM for interacting with PostgreSQL.
  - **Real-time:** `gorilla/websocket` for real-time bi-directional communication.
- **Database:** PostgreSQL (Relational data structures).
- **Object Storage:** Cloudflare R2 (S3-compatible) for storing images, user avatars, board backgrounds, and card attachments.
- **Web Frontend:**
  - **Framework:** Next.js (React) using the App Router.
  - **Styling:** Tailwind CSS.
  - **UI Components:** **shadcn/ui** for rapid, consistent, and accessible UI building.
  - **Color Palette:** Graphite Milk (Minimalist Monochromatic):
    - Milk White: `#FAFAF8` (Primary background)
    - Soft Gray: `#DADADA` (Borders and card outlines)
    - Concrete Gray: `#B0B3B8` (Secondary text and inactive icons)
    - Graphite Gray: `#43464B` (Secondary buttons, list headers, and hover states)
    - Obsidian Black: `#0F1012` (Primary text, headers, and active states)
  - **Forms & Validation:** **React Hook Form** combined with **Zod** schema validation.
  - **State Management:** **Zustand** for lightweight global state (e.g., user session, theme).
  - **Data Fetching:** **React Query** (TanStack Query) for caching API responses, handling loading states, and optimistic UI updates.
  - **Drag & Drop:** `@hello-pangea/dnd` for smooth list and card interactions.
- **Mobile App:** React Native (Expo) to build for iOS and Android simultaneously using shared logic.

## 3. Core Features & Deep Dive

### A. Authentication & User Management

- **Standard Login:** Email and Password authentication (passwords hashed via `bcrypt`).
- **Email Verification:** Integration with **Resend** to send verification emails upon registration.
- **Social Login:** **Google Auth (OAuth 2.0)** integration for 1-click sign up/in.
- **Session Management:** JWT (JSON Web Tokens).
  - _Web:_ Stored in secure, HTTP-only cookies to prevent XSS attacks.
  - _Mobile:_ Stored using Expo SecureStore.

### B. Workspaces & Boards

- Users can create multiple Workspaces.
- Workspaces contain multiple Boards.
- Boards have customizable backgrounds (colors or images) and visibility settings (Private vs. Workspace-visible).

### C. Lists & Cards

- **Lists:** Horizontal columns within a board. Can be reordered via drag-and-drop.
- **Cards:** Tasks within lists. Can be dragged vertically within a list or horizontally across lists.
- **Card Details:** Support for descriptions (Markdown), checklists, due dates, custom labels (colors/names), and assigning members.

### D. Real-Time Synchronization

- When User A moves a card, the backend broadcasts a WebSocket message. User B's screen (if on the same board) updates instantly without refreshing, handled elegantly via React Query's cache invalidation or manual cache updates.

## 4. Development Roadmap

### Phase 1: Backend Foundation & Auth (Backend focus)

1. [DONE] Initialize Go project and PostgreSQL database.
2. [DONE] Setup User models and Authentication routes (Email/Pass + Google OAuth).
3. [DONE] Implement JWT generation and validation middleware.
4. [DONE] Create CRUD REST API endpoints for Workspaces and Boards.

### Phase 2: Web Client Foundation (Frontend focus)

1. [DONE] Initialize Next.js, Tailwind, and shadcn/ui.
2. [DONE] Set up React Hook Form + Zod for Login/Signup screens.
3. [DONE] Configure React Query and Zustand.
4. [DONE] Build Dashboard UI to fetch and display Workspaces and Boards.

### Phase 3: Core Trello Mechanics (Full-stack)

1. [DONE] Build API endpoints for Lists and Cards.
2. [DONE] Build the Board Canvas UI in Next.js.
3. [DONE] Implement drag-and-drop logic for lists and cards on the frontend.
4. [DONE] Hook up drag-and-drop events to the Go API to persist order changes in the database.

### Phase 4: Real-time & Polish

1. [DONE] Set up WebSocket server in Go.
2. [DONE] Connect Next.js frontend to WebSockets to listen for board changes.
3. [DONE] Add finishing touches (Card labels, due dates, checklists).
4. [DONE] Change all color to black, gray and white only
5. [DONE] add theme swithcer (light, dark,system)

### Phase 5: Mobile Application

1. [DONE] Initialize React Native (Expo) project.
2. [DONE] Build Mobile Login and Dashboard screens reusing the API.
3. [DONE] Build Mobile Board view with mobile-optimized drag-and-drop.

### Phase 6: Notifications & Activity Logs

1. [DONE] Create `activities`, `comments`, and `notifications` models in Go (PostgreSQL).
2. [DONE] Build APIs for posting comments (`POST /api/cards/:id/comments`) and fetching activity logs.
3. [DONE] Set up Resend API client in Go backend for email dispatching (assignments, mentions).
4. [DONE] Implement a background worker in Go to scan for due dates daily and email reminders.
5. [DONE] Create UI for the Inbox (Bell notification panel) and Activity Log on Web and Mobile clients.
6. [DONE] Sync Inbox notifications dynamically via WebSockets.

### Phase 7: Attachments, Covers & Calendar Planner

1. [DONE] Integrate Cloudflare R2 client in Go for file uploads (`POST /api/cards/:id/attachments`).
2. [DONE] Add attachment rendering and cover selection inside Web and Mobile card modals.
3. [DONE] Build a Calendar Planner view page (Web and Mobile) aggregating cards by their due dates.

### Phase 8: Automation Engine (Butler-like rules)

1. [DONE] Add rules schema (e.g. When checklist is 100% completed, move card to list X).
2. [DONE] Build rule execution engine on the Go backend triggered by card/checklist mutations.

## 5. Feature Comparison with Original Trello

### Implemented Core Features:

- **Kanban Board Core**: Workspaces, Boards, Lists, and Cards with full CRUD operations.
- **Drag-and-Drop**: Web reordering of lists/cards and basic mobile positioning sorting.
- **Card Details**: Descriptions, multi-item Checklists, Due Dates, and customizable Labels.
- **Real-Time Updates**: Live synchronization of board state across clients using Go WebSockets.
- **Multi-Platform**: Next.js Web App and Expo Mobile App (both using monochromatic design system).
- **Inbox & Notifications**: Bell notification panel for user assignments, comments, and due date alerts (with Resend email notifications).
- **Planner / Calendar View**: Board calendar layout view showing cards by their due dates.
- **Activity Log & Comments**: Card comments section and tracking history logs of card movements.
- **Attachments**: Custom file and cover image uploading utilizing Cloudflare R2 storage.
- **Automation Engine**: Butler-like automation rules (e.g., automatically archiving card or moving card when checklists are 100% completed).

### Not Implemented (Future Roadmap):

- None (All core Phases 1-8 of the systems plan are successfully implemented).

## 6. Verification & Bug Fix Logs (2026-05-27)

### What We Tested
- **User Authentication**: Logged in and tested form switching with user `agusprnyt2@gmail.com`.
- **Workspace & Board Management**: Created workspace and board "Automation Test Board" (windowed) and "Fullscreen Board" (fullscreen).
- **Kanban Board Core**: Created "To Do" and "Done" lists; created cards and moved them between lists.
- **Card Details & Checklist**: Added due dates and created multi-item checklists.
- **Butler Automation Engine**: Created automation rules (e.g. `When checklist is 100% completed` -> `move card to list "Done"`).
- **Automation Execution & Responsiveness**: Checked all checklist items. The system executed the Butler rules immediately in both standard and fullscreen Chrome resolutions.
- **Calendar / Planner View**: Verified that cards correctly place on their due date grids in the board calendar layout.
- **Resolution Testing**: Verified responsiveness and styling layouts under maximized/fullscreen window resolution (1920x1080 viewport).

### What We Found
- A React key reconciliation bug on the root AuthPage during transition between login and registration forms: the email input value from the login form was incorrectly persisting and populating the Full Name input field in the registration form.
- The `CardModal` and `AutomationModal` dialog containers were rendering with a very small/narrow width (`sm:max-w-sm` fallback from the base dialog component), causing sidebar buttons to wrap text awkwardly and date pickers to overflow boundaries.

### What We Fixed
- Resolved the AuthPage form DOM node reuse issue by assigning unique `key` props (`key="login-form"` and `key="register-form"`) to the `<form>` elements.
- Cleaned up state transitions by triggering `reset()` on both forms when toggling between login and registration views.
- Adjusted modal styling on `CardModal` and `AutomationModal` dialog content wrappers to use `w-full max-w-3xl sm:max-w-3xl` classes to override the base fallback dialog size, producing a spacious desktop view.



