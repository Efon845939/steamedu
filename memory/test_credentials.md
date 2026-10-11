# Test Credentials

## Teacher signup code
Set via the `TEACHER_SIGNUP_CODE` env var (backend/.env locally, host dashboard in production).
Never write the real value here. Tests default to `TEST-CODE`.

## Teacher (verified, demo)
- **Username**: `teacher_demo`
- **Password**: `TeacherDemo123!`
- **Email**: `teacher@steam.edu`
- **Full name**: `Dr. Sarah Mitchell`
- verified: true (can host open/professional tournaments)

## Students (demo, password `StudentDemo123!` for all)
- `alex_chen` — Alex Chen, age 14 (group 13-15), mentored by teacher_demo
- `maya_r` — Maya Robinson, age 17 (group 16-18), mentored by teacher_demo
- `sam_patel` — Sam Patel, age 19 (group 18+), mentored by teacher_demo

## Main test student
- **Username**: `teststudent`
- **Password**: `TestPass123!`
- **Email**: `teststudent@steam.edu`
- Age 16 (group 16-18), mentored by teacher_demo

## Endpoints
- Register: `POST /api/auth/register` (role: student|teacher; students need `age`, teachers need `teacher_code`)
- Login: `POST /api/auth/login` (username + password) → Bearer token
- Seed: `POST /api/seed-data` (requires a TEACHER Bearer token, e.g. teacher_demo; idempotent)
