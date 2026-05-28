# Web Frontend Test Report

## Authentication
- **Status:** Passed
- **Details:** Successfully signed in using the provided credentials (`agusprnyt2@gmail.com` / `agudagud`).

## Workspace & Board Management
- **Status:** Passed
- **Details:** Successfully created a new workspace named **"Test Workspace"** and a new board titled **"Test Board"** inside it.

## List Management
- **Status:** Passed
- **Details:** Successfully created multiple lists: **"To Do"** and **"Done"**.

## Card Management
- **Status:** Passed
- **Details:** 
  - Added a card **"Test Card"** to the **"To Do"** list.
  - Opened card details, added a more detailed description to the card, and saved it successfully.
  - Created another card **"Done Card"** inside the **"Done"** list.

## Drag-and-Drop Interaction
- **Status:** Passed
- **Details:** Successfully performed cross-list drag-and-drop by dragging **"Test Card"** from the "To Do" list directly into the "Done" list (positioned below "Done Card").

## Additional Features
- **Status:** Passed
- **Details:** Explored user profile dropdown, visited **Settings**, and navigated the **"Calendar"** view, which displayed the current monthly calendar view successfully. Returning to the dashboard also worked as expected.

## Summary
The web application is fully functional across core features including authentication, entity creation (workspaces, boards, lists, cards), drag-and-drop interactions, and navigation between different views. No errors or broken layouts were encountered during the automated test flow.

## TODO
- [x] Implement email verification using Resend before allowing account creation when users register using email.
