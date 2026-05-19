# Functional Specification Document (FSD)

This document specifies the functional requirements, system logic, API routing interfaces, and technical flows for the Trello Clone project.

---

## 1. System Modules & Functional Requirements

The system consists of three core entry points: the **Go Backend**, the **Next.js Web Client**, and the **React Native Mobile App**.

### 1.1 Authentication & User Management
- **Local Signup / Sign-in**: Users can register and authenticate using an email and password.
- **Google OAuth**: Users can log in using Google OAuth credentials (web client).
- **Session Security**: 
  - The backend issues JWT tokens upon successful login.
  - The web client stores JWTs securely.
  - The mobile client persists JWT tokens locally using `AsyncStorage`.
- **User Context**: Both clients query `/api/auth/me` on startup to verify state and fetch user details (avatar, name).

### 1.2 Workspace & Board Management
- **Workspaces**:
  - Logical groups of project boards.
  - Users can create, update, and delete workspaces.
  - Workspaces support inviting members (with roles: `admin` or `member`).
- **Boards**:
  - Boards exist inside workspaces.
  - Users can create new boards with customizable solid color backgrounds (or hex codes).
  - Boards have visibility flags (`private` vs. `workspace`).

### 1.3 Trello Board Canvas (Lists & Cards)
- **Lists (Columns)**:
  - Columns (e.g. "To Do", "Doing", "Done") added to a board.
  - Users can create lists, edit their names, and delete them.
  - Lists contain cards ordered by an integer `position` property.
- **Cards (Tasks)**:
  - Inside a list, users can create cards.
  - **Drag and Drop (Dnd)**: Cards and lists can be dragged horizontally or vertically. Dragging reorders positions and triggers updates persisting order to the PostgreSQL database.
  - **Card Detail View (Modal)**: Clicking a card opens detailed configurations:
    - **Description**: Markdown or plaintext description of the task.
    - **Due Date**: Date selector attaching calendar dates to tasks.
    - **Labels**: Custom color tags (hex value) representing priorities/attributes.
    - **Checklists**: Nested checklists where items can be added and toggled to track sub-task completion.

### 1.4 Real-time Synchronization
- **WebSocket Hub**:
  - The backend runs a concurrent goroutine hub mapping client connections to specific board IDs.
  - When User A performs a mutations (moves card, adds checklist, reorders list), the backend database changes are broadcast as JSON messages to all other WebSocket connections active on that board.
  - The web client receives the socket message and immediately triggers React Query cache invalidation to re-fetch and render the latest board state without requiring manual screen refreshes.

---

## 2. API Routing Specification

### 2.1 Authentication
- `POST /api/auth/register` (Public) - Register new user.
- `POST /api/auth/login` (Public) - User login, returns JWT token.
- `GET /api/auth/me` (Protected) - Fetches authenticated user info.

### 2.2 Workspaces
- `GET /api/workspaces` (Protected) - Fetch workspaces accessible by the user.
- `POST /api/workspaces` (Protected) - Create new workspace.

### 2.3 Boards
- `GET /api/boards/workspace/:workspaceId` (Protected) - Fetch boards inside a workspace.
- `GET /api/boards/:id` (Protected) - Fetch full details of a board (preloaded with lists, cards, checklists, and labels).
- `POST /api/boards` (Protected) - Create new board.

### 2.4 Lists
- `POST /api/lists` (Protected) - Create new list.
- `PUT /api/lists/:id` (Protected) - Edit list details.
- `PUT /api/lists/move` (Protected) - Updates order position of lists.
- `DELETE /api/lists/:id` (Protected) - Delete list.

### 2.5 Cards & Detail Features
- `POST /api/cards` (Protected) - Create new card.
- `PUT /api/cards/:id` (Protected) - Update card metadata (name, description, due date).
- `PUT /api/cards/move` (Protected) - Moves cards between positions/lists.
- `DELETE /api/cards/:id` (Protected) - Delete card.
- `POST /api/cards/:id/labels` (Protected) - Add label to card.
- `DELETE /api/cards/:id/labels/:labelId` (Protected) - Remove label.
- `POST /api/cards/:id/checklists` (Protected) - Add new checklist.
- `POST /checklists/:id/items` (Protected) - Add item to checklist.
- `PUT /checklists/items/:id` (Protected) - Toggle/check off item.
- `DELETE /checklists/:id` (Protected) - Delete checklist.

---

## 3. Core System Data Flows

### 3.1 Real-Time Modification Flow
The diagram below shows how an update made by User A is broadcasted to User B in real-time.

```mermaid
sequenceDiagram
    actor UserA as User A (Browser)
    participant API as Go Fiber API
    participant DB as PostgreSQL
    participant WS as WebSocket Hub
    actor UserB as User B (Browser)

    UserA->>API: PUT /api/cards/move (Card Dragged)
    API->>DB: Save updated card positions
    API->>WS: Send board broadcast trigger (Board ID, Event: "card_updated")
    WS->>UserB: Send WS message {"type": "card_updated"}
    UserB->>API: Trigger React Query Cache Invalidation -> GET /api/boards/:id
    API->>UserB: Return latest board data
    Note over UserB: Screen rerenders with new card locations
```

### 3.2 Mobile Redirection Check Flow
On app startup, the mobile application determines routing based on active credentials.

```mermaid
graph TD
    A([App Launch]) --> B{Token in AsyncStorage?}
    B -- No --> C[Redirect to /login]
    B -- Yes --> D[Query GET /api/auth/me]
    D -- Success 200 --> E[Redirect to /dashboard]
    D -- Failure 401 --> F[Clear Token & Redirect to /login]
```
