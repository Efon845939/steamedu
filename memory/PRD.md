# STEAM Learning Platform — PRD

## Original Problem Statement
Interactive STEM/STEAM-focused educational web platform for high school–college students. Core: mini quizzes, drag-and-drop activities, idea sharing, educational content, username/password auth, student-friendly mobile-responsive design.

## User Personas
- **Student** (registers with age → age group 13-15 / 16-18 / 18+): learns via age-matched quizzes/activities/content, earns points & streaks, competes in tournaments, shares ideas, chats with teachers.
- **Teacher** (registers with special code `STEAM-TEACH-2026`): mentors students (adds them via chat), creates daily challenges, hosts tournaments; earns a verified checkmark (≥2 students + ≥3 challenges) that unlocks open/professional tournaments.

## Core Requirements (all explicit user requests)
1. ✅ Real progress tracking — quiz/activity results saved per user; dashboard shows real stats (points, streak, progress %, per-subject progress) — NOT demo numbers
2. ✅ Two login types (teacher needs signup code; students can't sign up as teachers)
3. ✅ Age at signup → different quizzes/activities/articles/tournaments/rankings per age group
4. ✅ Chat between teachers & students; teachers add students as mentees via chat
5. ✅ Daily challenges from teachers (both quiz-linked and simple tasks)
6. ✅ Tournaments (open + class scope); verified-teacher checkmark; winners get certificates
7. ✅ Teacher leaderboards — Best (75% pro tournaments, 25% student streak/quiz scores), Most Popular (students who competed in their tournaments)
8. ✅ Student leaderboards per age group + general (all ages), per subject
9. ✅ Real content (articles/experiments/math problems) — in-app summary + full body + external "read more" links (27 items across 5 STEAM areas)
10. ✅ Content hub with filters: click an area (e.g. Math) → articles, problems, experiments, quizzes, activities in that area
11. ✅ Top bar only: Home, Content, Dashboard, Ideas + login
12. ✅ Ideas hub: popular/new sorting, category filters, detail page with comments, fair likes (one per student, toggle)

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`, seed content in `seed_data.py`), MongoDB (motor), JWT Bearer (PyJWT + bcrypt, 7-day tokens)
- **Frontend**: React 19 + Shadcn UI + Tailwind + `@hello-pangea/dnd` + sonner toasts; helpers in `src/lib/steam.js`
- **Key collections**: users (role/age_group/teacher_id/verified/points/streak_days), quizzes, quiz_attempts, activities, activity_results, content, ideas (liked_by), idea_comments, messages, challenges, challenge_completions, tournaments, tournament_entries, certificates

## Key API Endpoints
- Auth: POST /api/auth/register (role, age, teacher_code), /api/auth/login, GET /api/auth/me
- Learning: GET /api/quizzes|/activities|/content (subject + age_group filters), POST /api/quizzes/{id}/attempt (points+streak+challenge auto-complete), POST /api/activities/{id}/complete
- Stats: GET /api/stats/me, GET /api/stats/student/{id} (teacher-only)
- Social: GET/POST chat endpoints, GET /api/users/search, POST /api/teacher/add-student/{id}
- Challenges: POST /api/challenges, GET /api/challenges/mine|/today, POST /api/challenges/{id}/complete
- Tournaments: POST/GET /api/tournaments, join, submit (one-shot), GET /api/certificates/me
- Leaderboards: GET /api/leaderboard/students?age_group=&subject=, GET /api/leaderboard/teachers
- Ideas: GET/POST /api/ideas, GET /api/ideas/{id}, POST like (toggle), POST comments
- Seed: POST /api/seed-data (TEACHER role required, idempotent)

## Points System
Quiz first attempt = score pts • Activity first completion = 50 pts • Challenge = challenge pts (default 20) • Tournament submit = 30 pts • Tournament win = 100 pts + certificate. Streak increments once per active day.

## What's Been Implemented
- **2026-06 (session 1)**: V1 MVP — auth, quizzes, DnD activities, ideas, content hub; DND lib migration; secured seed; quiz answer stripping (29/29 tests)
- **2026-06 (session 2)**: FULL V2 — roles/teacher code/age groups, real progress + points + streaks, chat + mentorship, daily challenges, contests + certificates + verification, student & teacher leaderboards, fair likes + idea comments + detail page, 27 real content items with external links, per-area Content Hub with age filters, simplified navbar, role-based dashboards. Tested 58/58 backend + 9/9 E2E (iteration_4).
- **2026-06 (session 2, security audit)**: Rotated JWT secret to high-entropy value; login brute-force lockout (5 fails/5min per username+IP → 429); registration rate limit (50/10min/IP); server-side password min length; regex-escaped user search (ReDoS); CORS allow_credentials off for wildcard; demo-account seeding behind SEED_DEMO_ACCOUNTS env flag; /api/seed-data now teacher-only.
- **2026-06 (session 2, V3 features)**: Printable certificates (styled modal + Print/Save-as-PDF via print CSS); Weekly Recap ("Your Week in Review" card, /api/stats/weekly powered by new point_events log with reasons); Idea Teacher Spotlight (one Teacher's Pick per teacher, pin/unpin, Teacher's Picks section on Ideas page); renamed Tournaments → **Contests** everywhere in UI with a Contests link in the navbar (/contests route, /tournaments redirects; API routes unchanged). **Tested: 79/79 backend (21 new + 58 regression), all E2E flows pass (iteration_5)**. Post-test: tie-aware ranking display unified with submit rank.

## Backlog
- **P2**: Contest detail deep-linking (URL per contest); vertical centering of quiz/activity result cards; remove matched items from left DnD column instead of greying
- **P2**: Production rate limiting via Redis/Mongo (current is in-process memory); indexes on point_events(user_id, created_at), quiz_attempts(user_id, completed_at), users(role, points); pagination on list endpoints
- **P3**: Downloadable certificate as PNG; minimum activity threshold before teachers appear on leaderboards; point-event reason enum
- **P3**: Split server.py into routers (auth/learning/social/contests)

## Notes
- Teacher signup code lives in backend/.env → TEACHER_SIGNUP_CODE
- SEED_DEMO_ACCOUNTS=true in backend/.env (set false in production to skip demo accounts)
- JWT secret rotated 2026-06 (old tokens invalid)
- Credentials: /app/memory/test_credentials.md
- Demo data: teacher_demo (verified) with 4 students, 3 today-challenges, 2 active pro contests, 4 seeded ideas
