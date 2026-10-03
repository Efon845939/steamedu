"""V2 STEAM platform backend regression tests (pytest)."""
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

TEACHER_CODE = "STEAM-TEACH-2026"
STUDENT = {"username": "teststudent", "password": "TestPass123!"}
TEACHER = {"username": "teacher_demo", "password": "TeacherDemo123!"}
MAYA = {"username": "maya_r", "password": "StudentDemo123!"}
ALEX = {"username": "alex_chen", "password": "StudentDemo123!"}


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {username}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(role="student", age=16, code=None, suffix=None):
    suffix = suffix or uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_{suffix}@qa.example.com",
        "username": f"TEST_{suffix}",
        "password": "TestPass123!",
        "full_name": f"TEST User {suffix}",
        "role": role,
    }
    if role == "student":
        payload["age"] = age
    if code:
        payload["teacher_code"] = code
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    return r, payload


@pytest.fixture(scope="session", autouse=True)
def purge_leftover_test_data():
    """Remove TEST_ challenges/tournaments left by previous runs so date-scoped
    lookups (teacher+quiz+today) stay unambiguous."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import dotenv_values as dv
    be = dv("/app/backend/.env")

    async def _purge():
        c = AsyncIOMotorClient(be["MONGO_URL"])
        d = c[be["DB_NAME"]]
        await d.challenges.delete_many({"title": {"$regex": "^TEST_"}})
        await d.tournaments.delete_many({"title": {"$regex": "^TEST_"}})
        c.close()
    asyncio.run(_purge())
    yield


@pytest.fixture(scope="session")
def student_token():
    return _login(**STUDENT)


@pytest.fixture(scope="session")
def teacher_token():
    return _login(**TEACHER)


@pytest.fixture(scope="session")
def teacher_me(teacher_token):
    return requests.get(f"{API}/auth/me", headers=_hdr(teacher_token), timeout=30).json()


@pytest.fixture(scope="session")
def quizzes():
    r = requests.get(f"{API}/quizzes", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- Auth / registration ----------------
class TestAuth:
    def test_student_register_age_group(self):
        r, payload = _register(role="student", age=14)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "student"
        assert data["age"] == 14
        assert data["age_group"] == "13-15"
        assert data["points"] == 0
        # login works
        tok = _login(payload["username"], payload["password"])
        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
        assert me["age_group"] == "13-15"

    def test_student_register_without_age_fails(self):
        suffix = uuid.uuid4().hex[:8]
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_{suffix}@qa.example.com", "username": f"TEST_{suffix}",
            "password": "TestPass123!", "full_name": "No Age", "role": "student"}, timeout=30)
        assert r.status_code == 400, r.text

    def test_teacher_register_without_code_403(self):
        r, _ = _register(role="teacher")
        assert r.status_code == 403, r.text
        assert "code" in r.json()["detail"].lower()

    def test_teacher_register_wrong_code_403(self):
        r, _ = _register(role="teacher", code="WRONG-CODE")
        assert r.status_code == 403

    def test_teacher_register_with_code_succeeds(self):
        r, payload = _register(role="teacher", code=TEACHER_CODE)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "teacher"
        assert data["verified"] is False
        assert data["age_group"] is None
        tok = _login(payload["username"], payload["password"])
        assert tok

    def test_invalid_role_400(self):
        suffix = uuid.uuid4().hex[:8]
        r = requests.post(f"{API}/auth/register", json={
            "email": f"TEST_{suffix}@qa.example.com", "username": f"TEST_{suffix}",
            "password": "TestPass123!", "full_name": "X", "role": "admin", "age": 15}, timeout=30)
        assert r.status_code == 400

    def test_duplicate_username_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": "dup_teststudent@qa.example.com", "username": "teststudent",
            "password": "TestPass123!", "full_name": "X", "role": "student", "age": 15}, timeout=30)
        assert r.status_code == 400

    def test_login_bad_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"username": "teststudent", "password": "nope"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403)

    def test_bcrypt_hash_format(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        be = dv("/app/backend/.env")

        async def _check():
            c = AsyncIOMotorClient(be["MONGO_URL"])
            u = await c[be["DB_NAME"]].users.find_one({"username": "teststudent"})
            c.close()
            return u
        u = asyncio.run(_check())
        assert u is not None
        assert u["password"].startswith("$2b$"), u["password"][:10]


# ---------------- Quizzes / attempts / points / streak ----------------
class TestQuizzes:
    def test_quizzes_strip_correct_answer(self, quizzes):
        assert len(quizzes) >= 11, f"expected 11 quizzes, got {len(quizzes)}"
        for q in quizzes:
            for question in q["questions"]:
                assert "correct_answer" not in question, q["title"]
            assert "_id" not in q

    def test_quiz_age_group_filter(self):
        r = requests.get(f"{API}/quizzes", params={"age_group": "13-15"}, timeout=30)
        assert r.status_code == 200
        for q in r.json():
            assert "13-15" in q["age_groups"] or "all" in q["age_groups"]

    def test_quiz_404(self):
        r = requests.get(f"{API}/quizzes/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_attempt_points_first_then_retake(self, quizzes):
        # fresh student so first-attempt semantics are deterministic
        r, payload = _register(role="student", age=17)
        assert r.status_code == 200
        tok = _login(payload["username"], payload["password"])
        quiz = next(q for q in quizzes if q["subject"] == "Mathematics")
        full = requests.get(f"{API}/quizzes/{quiz['id']}", timeout=30).json()
        answers = [{"question_index": i, "selected": q["options"][0]} for i, q in enumerate(full["questions"])]

        first = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                              headers=_hdr(tok), timeout=30)
        assert first.status_code == 200, first.text
        d1 = first.json()
        assert d1["first_attempt"] is True
        assert d1["points_earned"] == d1["score"]
        assert d1["streak_days"] >= 1
        assert "_id" not in d1

        second = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                               headers=_hdr(tok), timeout=30)
        assert second.status_code == 200
        d2 = second.json()
        assert d2["first_attempt"] is False
        assert d2["points_earned"] == 0

        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
        assert me["points"] == d1["score"]
        assert me["streak_days"] >= 1

    def test_attempt_grading_correct(self, teacher_token, quizzes):
        """Verify score computed server-side using known correct answers from DB."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        be = dv("/app/backend/.env")
        quiz = quizzes[0]

        async def _get():
            c = AsyncIOMotorClient(be["MONGO_URL"])
            q = await c[be["DB_NAME"]].quizzes.find_one({"id": quiz["id"]})
            c.close()
            return q
        raw = asyncio.run(_get())
        answers = [{"selected": q["correct_answer"]} for q in raw["questions"]]
        r2, payload = _register(role="student", age=17)
        tok = _login(payload["username"], payload["password"])
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                          headers=_hdr(tok), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["score"] == 100

    def test_attempt_requires_auth(self, quizzes):
        r = requests.post(f"{API}/quizzes/{quizzes[0]['id']}/attempt", json={"answers": []}, timeout=30)
        assert r.status_code in (401, 403)


# ---------------- Activities ----------------
class TestActivities:
    def test_list_activities(self):
        r = requests.get(f"{API}/activities", timeout=30)
        assert r.status_code == 200
        acts = r.json()
        assert len(acts) >= 10
        assert all("content" in a for a in acts)

    def test_complete_activity_points(self):
        acts = requests.get(f"{API}/activities", timeout=30).json()
        r, payload = _register(role="student", age=17)
        tok = _login(payload["username"], payload["password"])
        aid = acts[0]["id"]
        first = requests.post(f"{API}/activities/{aid}/complete", json={"score": 80},
                              headers=_hdr(tok), timeout=30)
        assert first.status_code == 200, first.text
        d = first.json()
        assert d["first_completion"] is True
        assert d["points_earned"] == 50
        assert d["streak_days"] >= 1
        again = requests.post(f"{API}/activities/{aid}/complete", json={"score": 90},
                              headers=_hdr(tok), timeout=30).json()
        assert again["first_completion"] is False
        assert again["points_earned"] == 0

    def test_complete_activity_404(self, student_token):
        r = requests.post(f"{API}/activities/nope/complete", json={"score": 1},
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 404


# ---------------- Content ----------------
class TestContent:
    def test_content_count_and_fields(self):
        r = requests.get(f"{API}/content", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 27, len(items)
        for i in items:
            assert "_id" not in i
            assert i.get("body")
            assert i.get("summary")
            assert i["type"] in ("article", "experiment", "problem")

    def test_content_filter_subject_age(self):
        r = requests.get(f"{API}/content", params={"subject": "Mathematics", "age_group": "16-18"}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert items, "no math/16-18 content"
        for i in items:
            assert i["subject"] == "Mathematics"
            assert "16-18" in i["age_groups"] or "all" in i["age_groups"]

    def test_problems_have_solution(self):
        items = requests.get(f"{API}/content", params={"type": "problem"}, timeout=30).json()
        assert items
        assert all(i.get("solution") for i in items)

    def test_content_detail_and_404(self):
        items = requests.get(f"{API}/content", timeout=30).json()
        r = requests.get(f"{API}/content/{items[0]['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == items[0]["id"]
        assert requests.get(f"{API}/content/nope", timeout=30).status_code == 404


# ---------------- Stats ----------------
class TestStats:
    def test_student_stats(self, student_token):
        r = requests.get(f"{API}/stats/me", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "student"
        assert d["total_quizzes"] > 0
        assert d["quizzes_completed"] <= d["total_quizzes"]
        assert 0 <= d["progress"] <= 100
        assert len(d["subject_progress"]) == 5
        assert {s["subject"] for s in d["subject_progress"]} == {
            "Science", "Technology", "Engineering", "Arts", "Mathematics"}
        assert d["teacher_name"] == "Dr. Sarah Mitchell"
        assert d["age_group"] == "16-18"
        assert isinstance(d["recent_attempts"], list)

    def test_teacher_stats(self, teacher_token):
        d = requests.get(f"{API}/stats/me", headers=_hdr(teacher_token), timeout=30).json()
        assert d["role"] == "teacher"
        assert d["verified"] is True
        assert d["students_count"] >= 3
        assert d["challenges_count"] >= 3

    def test_teacher_students_list(self, teacher_token):
        r = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        names = {x["username"] for x in rows}
        assert {"alex_chen", "maya_r", "sam_patel"} <= names
        for x in rows:
            assert "avg_score" in x and "quizzes_completed" in x

    def test_teacher_endpoint_forbidden_for_student(self, student_token):
        r = requests.get(f"{API}/teacher/students", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403


# ---------------- Challenges ----------------
class TestChallenges:
    def test_student_sees_todays_challenges(self, student_token):
        r = requests.get(f"{API}/challenges/today", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        chs = r.json()
        assert len(chs) >= 3, chs
        assert all(c["teacher_name"] == "Dr. Sarah Mitchell" for c in chs)
        types = {c["type"] for c in chs}
        assert "task" in types and "quiz" in types
        for c in chs:
            assert "completed" in c

    def test_teacher_creates_task_challenge_and_student_completes(self, teacher_token, teacher_me):
        r = requests.post(f"{API}/challenges", json={
            "title": "TEST_task challenge", "description": "d", "type": "task", "points": 25},
            headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200, r.text
        ch = r.json()
        assert ch["type"] == "task" and ch["points"] == 25
        assert "_id" not in ch

        # fresh student, attach to teacher
        rr, payload = _register(role="student", age=17)
        sid = rr.json()["id"]
        add = requests.post(f"{API}/teacher/add-student/{sid}", headers=_hdr(teacher_token), timeout=30)
        assert add.status_code == 200, add.text
        tok = _login(payload["username"], payload["password"])

        today = requests.get(f"{API}/challenges/today", headers=_hdr(tok), timeout=30).json()
        assert any(c["id"] == ch["id"] for c in today)

        comp = requests.post(f"{API}/challenges/{ch['id']}/complete", headers=_hdr(tok), timeout=30)
        assert comp.status_code == 200, comp.text
        assert comp.json()["points_earned"] == 25
        dup = requests.post(f"{API}/challenges/{ch['id']}/complete", headers=_hdr(tok), timeout=30)
        assert dup.status_code == 400

        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
        assert me["points"] == 25

    def test_quiz_challenge_autocompletes_on_submit(self, teacher_token, quizzes):
        quiz = quizzes[-1]
        ch = requests.post(f"{API}/challenges", json={
            "title": "TEST_quiz challenge", "type": "quiz", "quiz_id": quiz["id"], "points": 30},
            headers=_hdr(teacher_token), timeout=30)
        assert ch.status_code == 200, ch.text
        chd = ch.json()

        rr, payload = _register(role="student", age=17)
        sid = rr.json()["id"]
        requests.post(f"{API}/teacher/add-student/{sid}", headers=_hdr(teacher_token), timeout=30)
        tok = _login(payload["username"], payload["password"])

        full = requests.get(f"{API}/quizzes/{quiz['id']}", timeout=30).json()
        answers = [{"selected": q["options"][0]} for q in full["questions"]]
        res = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert res.status_code == 200, res.text
        d = res.json()
        assert d["challenge_completed"] == "TEST_quiz challenge", d
        assert d["points_earned"] == d["score"] + 30

        today = requests.get(f"{API}/challenges/today", headers=_hdr(tok), timeout=30).json()
        target = next(c for c in today if c["id"] == chd["id"])
        assert target["completed"] is True
        assert target.get("quiz_title") == quiz["title"]

    def test_quiz_challenge_cannot_be_marked_done(self, student_token):
        chs = requests.get(f"{API}/challenges/today", headers=_hdr(student_token), timeout=30).json()
        quiz_ch = next(c for c in chs if c["type"] == "quiz")
        r = requests.post(f"{API}/challenges/{quiz_ch['id']}/complete",
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 400

    def test_challenge_of_other_teacher_403(self, student_token, teacher_token):
        # create teacher B challenge, teststudent is not their student
        r, payload = _register(role="teacher", code=TEACHER_CODE)
        tok_b = _login(payload["username"], payload["password"])
        ch = requests.post(f"{API}/challenges", json={"title": "TEST_other", "type": "task"},
                           headers=_hdr(tok_b), timeout=30).json()
        res = requests.post(f"{API}/challenges/{ch['id']}/complete",
                            headers=_hdr(student_token), timeout=30)
        assert res.status_code == 403

    def test_create_challenge_invalid(self, teacher_token):
        r = requests.post(f"{API}/challenges", json={"title": "x", "type": "bogus"},
                          headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 400
        r2 = requests.post(f"{API}/challenges", json={"title": "x", "type": "quiz", "quiz_id": "nope"},
                           headers=_hdr(teacher_token), timeout=30)
        assert r2.status_code == 404

    def test_student_cannot_create_challenge(self, student_token):
        r = requests.post(f"{API}/challenges", json={"title": "x", "type": "task"},
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403


# ---------------- Tournaments ----------------
class TestTournaments:
    def test_list_seeded_tournaments(self, student_token):
        r = requests.get(f"{API}/tournaments", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        ts = r.json()
        titles = {t["title"] for t in ts}
        assert "Autumn Math Sprint" in titles
        assert "Science Explorers Cup" in titles
        autumn = next(t for t in ts if t["title"] == "Autumn Math Sprint")
        assert autumn["status"] == "active"
        assert autumn["is_professional"] is True
        assert autumn["age_group"] == "16-18"
        assert autumn["quiz_title"]

    def test_age_group_enforced_on_join(self):
        r, payload = _register(role="student", age=14)  # 13-15
        tok = _login(payload["username"], payload["password"])
        ts = requests.get(f"{API}/tournaments", headers=_hdr(tok), timeout=30).json()
        autumn = next(t for t in ts if t["title"] == "Autumn Math Sprint")
        assert autumn["can_join"] is False
        res = requests.post(f"{API}/tournaments/{autumn['id']}/join", headers=_hdr(tok), timeout=30)
        assert res.status_code == 403, res.text

    def test_join_submit_once_and_ranking(self):
        r, payload = _register(role="student", age=17)
        tok = _login(payload["username"], payload["password"])
        ts = requests.get(f"{API}/tournaments", headers=_hdr(tok), timeout=30).json()
        autumn = next(t for t in ts if t["title"] == "Autumn Math Sprint")
        assert autumn["can_join"] is True

        join = requests.post(f"{API}/tournaments/{autumn['id']}/join", headers=_hdr(tok), timeout=30)
        assert join.status_code == 200, join.text
        dup = requests.post(f"{API}/tournaments/{autumn['id']}/join", headers=_hdr(tok), timeout=30)
        assert dup.status_code == 400

        detail = requests.get(f"{API}/tournaments/{autumn['id']}", headers=_hdr(tok), timeout=30).json()
        assert any(e["student_name"] == "Maya Robinson" and e["score"] == 80 for e in detail["ranking"])
        assert any(e["student_name"] == payload["full_name"] for e in detail["pending"])

        full = requests.get(f"{API}/quizzes/{autumn['quiz_id']}", timeout=30).json()
        answers = [{"selected": q["options"][0]} for q in full["questions"]]
        sub = requests.post(f"{API}/tournaments/{autumn['id']}/submit", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert sub.status_code == 200, sub.text
        d = sub.json()
        assert d["points_earned"] == 30
        assert d["rank"] >= 1
        again = requests.post(f"{API}/tournaments/{autumn['id']}/submit", json={"answers": answers},
                              headers=_hdr(tok), timeout=30)
        assert again.status_code == 400

    def test_submit_without_join_400(self):
        r, payload = _register(role="student", age=17)
        tok = _login(payload["username"], payload["password"])
        ts = requests.get(f"{API}/tournaments", headers=_hdr(tok), timeout=30).json()
        cup = next(t for t in ts if t["title"] == "Science Explorers Cup")
        res = requests.post(f"{API}/tournaments/{cup['id']}/submit", json={"answers": []},
                            headers=_hdr(tok), timeout=30)
        assert res.status_code == 400

    def test_unverified_teacher_open_tournament_403(self, quizzes):
        r, payload = _register(role="teacher", code=TEACHER_CODE)
        tok = _login(payload["username"], payload["password"])
        res = requests.post(f"{API}/tournaments", json={
            "title": "TEST_open", "subject": "Science", "age_group": "all", "scope": "open",
            "quiz_id": quizzes[0]["id"]}, headers=_hdr(tok), timeout=30)
        assert res.status_code == 403, res.text

    def test_class_tournament_scope(self, quizzes):
        # unverified teacher can create class-scope tournament; only own students can join
        rt, tpayload = _register(role="teacher", code=TEACHER_CODE)
        ttok = _login(tpayload["username"], tpayload["password"])
        created = requests.post(f"{API}/tournaments", json={
            "title": "TEST_class tournament", "subject": "Science", "age_group": "all",
            "scope": "class", "quiz_id": quizzes[0]["id"]}, headers=_hdr(ttok), timeout=30)
        assert created.status_code == 200, created.text
        t = created.json()
        assert t["is_professional"] is False

        # outsider student cannot join
        rs, spayload = _register(role="student", age=17)
        stok = _login(spayload["username"], spayload["password"])
        res = requests.post(f"{API}/tournaments/{t['id']}/join", headers=_hdr(stok), timeout=30)
        assert res.status_code == 403, res.text
        # and it is not visible in their list
        visible = {x["id"] for x in requests.get(f"{API}/tournaments", headers=_hdr(stok), timeout=30).json()}
        assert t["id"] not in visible

        # own student can join
        requests.post(f"{API}/teacher/add-student/{rs.json()['id']}", headers=_hdr(ttok), timeout=30)
        ok = requests.post(f"{API}/tournaments/{t['id']}/join", headers=_hdr(stok), timeout=30)
        assert ok.status_code == 200, ok.text

    def test_teacher_cannot_join(self, teacher_token, student_token):
        ts = requests.get(f"{API}/tournaments", headers=_hdr(student_token), timeout=30).json()
        cup = next(t for t in ts if t["title"] == "Science Explorers Cup")
        r = requests.post(f"{API}/tournaments/{cup['id']}/join", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 403

    def test_tournament_404(self, student_token):
        assert requests.get(f"{API}/tournaments/nope", headers=_hdr(student_token), timeout=30).status_code == 404


# ---------------- Ideas ----------------
class TestIdeas:
    def test_list_ideas(self, student_token):
        r = requests.get(f"{API}/ideas", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        ideas = r.json()
        assert len(ideas) >= 4
        for i in ideas:
            assert "_id" not in i
            assert "liked" in i and "comments_count" in i
            assert i["liked_by"] == []

    def test_like_toggle_fair(self, student_token):
        ideas = requests.get(f"{API}/ideas", headers=_hdr(student_token), timeout=30).json()
        idea = ideas[0]
        start = idea["likes"]
        if idea["liked"]:
            requests.post(f"{API}/ideas/{idea['id']}/like", headers=_hdr(student_token), timeout=30)
            start -= 1
        l1 = requests.post(f"{API}/ideas/{idea['id']}/like", headers=_hdr(student_token), timeout=30).json()
        assert l1["liked"] is True and l1["likes"] == start + 1
        l2 = requests.post(f"{API}/ideas/{idea['id']}/like", headers=_hdr(student_token), timeout=30).json()
        assert l2["liked"] is False and l2["likes"] == start
        # re-like then check GET reflects state
        requests.post(f"{API}/ideas/{idea['id']}/like", headers=_hdr(student_token), timeout=30)
        detail = requests.get(f"{API}/ideas/{idea['id']}", headers=_hdr(student_token), timeout=30).json()
        assert detail["liked"] is True
        assert detail["likes"] == start + 1
        requests.post(f"{API}/ideas/{idea['id']}/like", headers=_hdr(student_token), timeout=30)

    def test_create_idea_comment_and_detail(self, student_token):
        created = requests.post(f"{API}/ideas", json={
            "title": "TEST_idea", "description": "TEST desc", "category": "Science"},
            headers=_hdr(student_token), timeout=30)
        assert created.status_code == 200, created.text
        idea = created.json()
        assert idea["likes"] == 0

        c = requests.post(f"{API}/ideas/{idea['id']}/comments", json={"text": "TEST comment"},
                          headers=_hdr(student_token), timeout=30)
        assert c.status_code == 200, c.text
        assert c.json()["text"] == "TEST comment"

        detail = requests.get(f"{API}/ideas/{idea['id']}", headers=_hdr(student_token), timeout=30).json()
        assert len(detail["comments"]) == 1
        assert detail["comments"][0]["text"] == "TEST comment"
        assert detail["comments"][0]["author_role"] == "student"

        empty = requests.post(f"{API}/ideas/{idea['id']}/comments", json={"text": "   "},
                              headers=_hdr(student_token), timeout=30)
        assert empty.status_code == 400

    def test_sort_popular_and_category(self, student_token):
        r = requests.get(f"{API}/ideas", params={"sort": "popular"}, headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        likes = [i["likes"] for i in r.json()]
        assert likes == sorted(likes, reverse=True)
        r2 = requests.get(f"{API}/ideas", params={"category": "Science"},
                          headers=_hdr(student_token), timeout=30).json()
        assert all(i["category"] == "Science" for i in r2)

    def test_idea_404_and_auth(self, student_token):
        assert requests.get(f"{API}/ideas/nope", headers=_hdr(student_token), timeout=30).status_code == 404
        assert requests.get(f"{API}/ideas", timeout=30).status_code in (401, 403)


# ---------------- Leaderboards ----------------
class TestLeaderboards:
    def test_students_by_points(self, student_token):
        r = requests.get(f"{API}/leaderboard/students", params={"age_group": "all"},
                         headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        by_user = {x["username"]: x for x in rows}
        assert "maya_r" in by_user and by_user["maya_r"]["points"] >= 485
        assert by_user["alex_chen"]["points"] >= 310
        assert by_user["sam_patel"]["points"] >= 220
        assert by_user["maya_r"]["points"] > by_user["alex_chen"]["points"] > by_user["sam_patel"]["points"]
        pts = [x["points"] for x in rows]
        assert pts == sorted(pts, reverse=True)
        assert rows[0]["rank"] == 1

    def test_students_age_group_filter(self, student_token):
        rows = requests.get(f"{API}/leaderboard/students", params={"age_group": "13-15"},
                            headers=_hdr(student_token), timeout=30).json()
        assert rows
        assert all(x["age_group"] == "13-15" for x in rows)

    def test_students_by_subject(self, student_token):
        rows = requests.get(f"{API}/leaderboard/students",
                            params={"age_group": "all", "subject": "Mathematics"},
                            headers=_hdr(student_token), timeout=30).json()
        scores = [x["avg_score"] for x in rows]
        assert scores == sorted(scores, reverse=True)
        assert any(x["avg_score"] > 0 for x in rows)

    def test_teachers_leaderboard(self, student_token):
        r = requests.get(f"{API}/leaderboard/teachers", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "best" in d and "popular" in d
        names = {x["full_name"] for x in d["best"]}
        assert "Dr. Sarah Mitchell" in names
        sarah = next(x for x in d["best"] if x["full_name"] == "Dr. Sarah Mitchell")
        assert sarah["verified"] is True
        assert sarah["pro_tournaments"] >= 2
        assert d["best"][0]["rank"] == 1
        assert d["popular"][0]["rank"] == 1
        assert any(x["full_name"] == "Dr. Sarah Mitchell" and x["tournament_students"] >= 1
                   for x in d["popular"])


# ---------------- Chat & Mentorship ----------------
class TestChat:
    def test_search_users(self, teacher_token):
        r = requests.get(f"{API}/users/search", params={"q": "maya"}, headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert any(x["username"] == "maya_r" for x in rows)
        for x in rows:
            assert "password" not in x and "email" not in x
        assert requests.get(f"{API}/users/search", params={"q": "  "},
                            headers=_hdr(teacher_token), timeout=30).json() == []

    def test_send_and_read_flow(self, student_token, teacher_token, teacher_me):
        me = requests.get(f"{API}/auth/me", headers=_hdr(student_token), timeout=30).json()
        text = f"TEST_msg {uuid.uuid4().hex[:6]}"
        send = requests.post(f"{API}/chat/send", json={"recipient_id": teacher_me["id"], "text": text},
                             headers=_hdr(student_token), timeout=30)
        assert send.status_code == 200, send.text
        assert send.json()["read"] is False
        assert "_id" not in send.json()

        convs = requests.get(f"{API}/chat/conversations", headers=_hdr(teacher_token), timeout=30).json()
        conv = next((c for c in convs if c["id"] == me["id"]), None)
        assert conv is not None, convs
        assert conv["unread"] >= 1
        assert conv["last_message"] == text

        thread = requests.get(f"{API}/chat/with/{me['id']}", headers=_hdr(teacher_token), timeout=30).json()
        assert thread["partner"]["username"] == "teststudent"
        assert any(m["text"] == text for m in thread["messages"])

        convs2 = requests.get(f"{API}/chat/conversations", headers=_hdr(teacher_token), timeout=30).json()
        conv2 = next(c for c in convs2 if c["id"] == me["id"])
        assert conv2["unread"] == 0

        # reply from teacher
        reply = requests.post(f"{API}/chat/send", json={"recipient_id": me["id"], "text": "TEST_reply"},
                              headers=_hdr(teacher_token), timeout=30)
        assert reply.status_code == 200

    def test_send_errors(self, student_token, teacher_me):
        assert requests.post(f"{API}/chat/send", json={"recipient_id": "nope", "text": "hi"},
                             headers=_hdr(student_token), timeout=30).status_code == 404
        assert requests.post(f"{API}/chat/send", json={"recipient_id": teacher_me["id"], "text": "  "},
                             headers=_hdr(student_token), timeout=30).status_code == 400

    def test_add_student_mentorship(self, teacher_token, teacher_me):
        r, payload = _register(role="student", age=15)
        sid = r.json()["id"]
        add = requests.post(f"{API}/teacher/add-student/{sid}", headers=_hdr(teacher_token), timeout=30)
        assert add.status_code == 200, add.text
        assert add.json()["teacher_id"] == teacher_me["id"]
        dup = requests.post(f"{API}/teacher/add-student/{sid}", headers=_hdr(teacher_token), timeout=30)
        assert dup.status_code == 400
        tok = _login(payload["username"], payload["password"])
        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
        assert me["teacher_name"] == "Dr. Sarah Mitchell"

    def test_add_student_invalid(self, teacher_token, teacher_me):
        assert requests.post(f"{API}/teacher/add-student/nope",
                             headers=_hdr(teacher_token), timeout=30).status_code == 404
        # cannot add a teacher as student
        assert requests.post(f"{API}/teacher/add-student/{teacher_me['id']}",
                             headers=_hdr(teacher_token), timeout=30).status_code == 404

    def test_student_cannot_add_student(self, student_token):
        r = requests.post(f"{API}/teacher/add-student/whatever", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403


# ---------------- Certificates ----------------
class TestCertificates:
    def test_my_certificates(self, student_token):
        r = requests.get(f"{API}/certificates/me", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
