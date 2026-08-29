# STEAM Learning Platform - PRD

## Original Problem Statement
Design an interactive STEM/STEAM-focused educational web platform for high school–college students. The platform should support creative thinking through:
- Mini quizzes and multiple-choice questions
- Simple interactive activities (drag-and-drop matching)
- A section for students to share their own ideas
- Educational content (short articles, experiments, math problems)
- Simple username/password authentication
- Fun, student-friendly, mobile-responsive design (playful emerald/teal palette)

Language: **English** (user explicitly confirmed).

## User Personas
- **Primary**: High school and college students exploring STEAM subjects.
- **Secondary**: Younger students / general learners.

## Tech Stack
- **Backend**: FastAPI + MongoDB (motor)
- **Auth**: JWT + bcrypt
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Drag & Drop**: `@hello-pangea/dnd` (React 19 compatible)

## Implemented Features
- JWT auth (register/login/me) with bcrypt password hashing
- Quiz CRUD + submit attempt + server-side score computation (correct_answer stripped from GET responses)
- Ideas CRUD + like counter
- Activities API + drag-and-drop matching UI
- Content Hub (articles/experiments/math problems, curated static)
- Dashboard with stats and quick actions (Learning Progress/Streak labeled as Demo)
- Idempotent `/api/seed-data` (auth-protected) - 3 quizzes + 3 activities

## Recent Fixes (2026-02)
- Swapped `react-beautiful-dnd` → `@hello-pangea/dnd` (React 19 defaultProps incompatibility)
- Fixed Navbar active-route highlight (exact match on `/`)
- Wired up ContentHub CTA buttons to navigate to /activities and /quiz
- Protected `POST /api/seed-data` with `get_current_user` dependency
- Stripped `correct_answer` from `GET /api/quizzes` responses
- Labeled Dashboard mock stats as "(Demo)"

## Testing Status
- Backend: 29/29 pytest tests pass (`/app/backend/tests/backend_test.py`)
- Frontend: All e2e Playwright flows pass on desktop + mobile

## Backlog / Roadmap
### P1
- Persist quiz/activity attempts per user for real Dashboard stats
- Move Content Hub articles/experiments to Mongo collection (currently frontend static)
- Add Pydantic model for quiz questions and attempt payloads

### P2
- Per-user like tracking on ideas (prevent multi-like from same user)
- "Learn More" modal on idea cards
- User profile page + Leaderboard for quiz scores
- Hide already-matched items in Activities drag column

## Test Credentials
See `/app/memory/test_credentials.md` (teststudent / TestPass123!)
