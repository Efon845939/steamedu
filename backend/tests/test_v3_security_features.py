"""V3 round: security hardening + new features (weekly recap, spotlight, point events)."""
import os
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:  # live-server suite: skip instead of breaking a plain `pytest` run
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)
API = f"{base_url.rstrip('/')}/api"

TEACHER_CODE = os.environ.get("TEACHER_SIGNUP_CODE", "TEST-CODE")
STUDENT = {"username": "teststudent", "password": "TestPass123!"}
TEACHER = {"username": "teacher_demo", "password": "TeacherDemo123!"}


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {username}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


def _register(role="student", age=17, code=None, password="TestPass123!"):
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_{suffix}@qa.example.com",
        "username": f"TEST_{suffix}",
        "password": password,
        "full_name": f"TEST User {suffix}",
        "role": role,
    }
    if role == "student":
        payload["age"] = age
    if code:
        payload["teacher_code"] = code
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    return r, payload


@pytest.fixture(scope="session")
def student_token():
    return _login(**STUDENT)


@pytest.fixture(scope="session")
def teacher_token():
    return _login(**TEACHER)


# ---------------- SECURITY ----------------
class TestSecurity:
    def test_login_bruteforce_lockout(self):
        """5 failed attempts on a username -> 6th returns 429 (throwaway username)."""
        r, payload = _register()
        assert r.status_code == 200, r.text
        uname = payload["username"]
        codes = []
        for _ in range(5):
            resp = requests.post(f"{API}/auth/login", json={"username": uname, "password": "wrong-pass"}, timeout=30)
            codes.append(resp.status_code)
        assert codes == [401] * 5, codes
        sixth = requests.post(f"{API}/auth/login", json={"username": uname, "password": "wrong-pass"}, timeout=30)
        assert sixth.status_code == 429, f"{sixth.status_code} {sixth.text[:200]}"
        assert "too many" in sixth.json()["detail"].lower()
        # even the CORRECT password is blocked while locked (expected lockout behaviour)
        locked = requests.post(f"{API}/auth/login", json={"username": uname, "password": payload["password"]}, timeout=30)
        assert locked.status_code == 429

    def test_other_users_unaffected_by_lockout(self):
        """Locking one username must not lock other accounts."""
        tok = _login(**STUDENT)
        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30)
        assert me.status_code == 200
        assert me.json()["username"] == "teststudent"

    def test_register_short_password_400(self):
        r, _ = _register(password="abc")
        assert r.status_code == 400, f"{r.status_code} {r.text[:300]}"
        assert "6 characters" in r.json()["detail"]

    def test_seed_data_student_forbidden(self, student_token):
        r = requests.post(f"{API}/seed-data", headers=_hdr(student_token), timeout=60)
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_seed_data_requires_auth(self):
        r = requests.post(f"{API}/seed-data", timeout=30)
        assert r.status_code in (401, 403)

    def test_user_search_redos_safe(self, teacher_token):
        start = time.time()
        r = requests.get(f"{API}/users/search", params={"q": "(a+)+$"}, headers=_hdr(teacher_token), timeout=30)
        elapsed = time.time() - start
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert isinstance(r.json(), list)
        assert elapsed < 5, f"search took {elapsed:.1f}s"
        # metacharacters treated literally -> no match
        assert r.json() == []

    def test_search_special_chars_no_500(self, teacher_token):
        for q in ["[", "\\", ".*", "maya"]:
            r = requests.get(f"{API}/users/search", params={"q": q}, headers=_hdr(teacher_token), timeout=30)
            assert r.status_code == 200, f"q={q} -> {r.status_code} {r.text[:150]}"

    def test_jwt_secret_is_strong(self):
        from dotenv import dotenv_values as dv
        secret = dv("/app/backend/.env").get("JWT_SECRET_KEY", "")
        assert len(secret) >= 32, len(secret)
        assert secret not in ("secret", "your-secret-key", "change-me")

    def test_invalid_token_rejected(self):
        r = requests.get(f"{API}/auth/me", headers=_hdr("garbage.token.value"), timeout=30)
        assert r.status_code == 401

    def test_auth_regression_teacher(self, teacher_token):
        me = requests.get(f"{API}/auth/me", headers=_hdr(teacher_token), timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == "teacher"
        prot = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30)
        assert prot.status_code == 200


# ---------------- Weekly recap ----------------
class TestWeeklyRecap:
    REQUIRED = ["points_week", "points_by_reason", "quizzes_week", "activities_week",
                "challenges_week", "active_days", "rank_general", "rank_age_group", "total_points"]

    def test_weekly_student_shape(self, student_token):
        r = requests.get(f"{API}/stats/weekly", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in self.REQUIRED:
            assert k in d, f"missing {k}"
        assert isinstance(d["points_week"], int)
        assert isinstance(d["points_by_reason"], dict)
        assert d["rank_general"] >= 1
        assert d["rank_age_group"] >= 1
        assert d["age_group"] == "16-18"
        assert 0 <= d["active_days"] <= 8
        assert "_id" not in d

    def test_weekly_teacher_403(self, teacher_token):
        r = requests.get(f"{API}/stats/weekly", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 403

    def test_weekly_requires_auth(self):
        assert requests.get(f"{API}/stats/weekly", timeout=30).status_code in (401, 403)

    def test_point_events_logged_on_quiz(self):
        """Fresh student: weekly points_week increases by quiz score after first attempt."""
        r, payload = _register(age=17)
        assert r.status_code == 200, r.text
        tok = _login(payload["username"], payload["password"])

        before = requests.get(f"{API}/stats/weekly", headers=_hdr(tok), timeout=30).json()
        assert before["points_week"] == 0
        assert before["quizzes_week"] == 0

        quizzes = requests.get(f"{API}/quizzes", timeout=30).json()
        quiz = quizzes[0]
        full = requests.get(f"{API}/quizzes/{quiz['id']}", timeout=30).json()
        answers = [{"question_index": i, "selected": q["options"][0]} for i, q in enumerate(full["questions"])]
        att = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert att.status_code == 200, att.text
        score = att.json()["score"]
        earned = att.json()["points_earned"]

        after = requests.get(f"{API}/stats/weekly", headers=_hdr(tok), timeout=30).json()
        assert after["points_week"] == earned, (after["points_week"], earned, score)
        assert after["quizzes_week"] == 1
        assert after["active_days"] >= 1
        assert after["total_points"] == earned
        assert after["best_quiz"] is not None
        assert after["best_quiz"]["score"] == score
        assert sum(after["points_by_reason"].values()) == after["points_week"]

    def test_point_events_activity_reason(self):
        r, payload = _register(age=17)
        tok = _login(payload["username"], payload["password"])
        acts = requests.get(f"{API}/activities", timeout=30).json()
        done = requests.post(f"{API}/activities/{acts[0]['id']}/complete", json={"score": 70},
                             headers=_hdr(tok), timeout=30)
        assert done.status_code == 200, done.text
        d = requests.get(f"{API}/stats/weekly", headers=_hdr(tok), timeout=30).json()
        assert d["activities_week"] == 1
        assert d["points_week"] == 50
        assert d["points_by_reason"], d


# ---------------- Idea spotlight ----------------
class TestIdeaSpotlight:
    def test_spotlight_flow(self, teacher_token, student_token):
        ideas = requests.get(f"{API}/ideas", headers=_hdr(teacher_token), timeout=30).json()
        assert len(ideas) >= 2, "need at least 2 ideas"
        a, b = ideas[0]["id"], ideas[1]["id"]

        # start from a clean state (unpin whatever is currently pinned)
        for pinned in requests.get(f"{API}/ideas/spotlights", headers=_hdr(teacher_token), timeout=30).json():
            requests.post(f"{API}/ideas/{pinned['id']}/spotlight", headers=_hdr(teacher_token), timeout=30)

        # pin A
        r1 = requests.post(f"{API}/ideas/{a}/spotlight", headers=_hdr(teacher_token), timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json()["spotlighted"] is True
        sp = r1.json()["spotlight"]
        assert sp["teacher_name"] == "Dr. Sarah Mitchell"

        listed = requests.get(f"{API}/ideas/spotlights", headers=_hdr(student_token), timeout=30)
        assert listed.status_code == 200, listed.text
        ids = [i["id"] for i in listed.json()]
        assert a in ids
        for i in listed.json():
            assert i.get("spotlight") is not None
            assert "_id" not in i

        detail = requests.get(f"{API}/ideas/{a}", headers=_hdr(student_token), timeout=30).json()
        assert detail["spotlight"]["teacher_name"] == "Dr. Sarah Mitchell"

        # pin B -> A unpinned
        r2 = requests.post(f"{API}/ideas/{b}/spotlight", headers=_hdr(teacher_token), timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["spotlighted"] is True
        da = requests.get(f"{API}/ideas/{a}", headers=_hdr(teacher_token), timeout=30).json()
        assert da.get("spotlight") is None, da.get("spotlight")
        ids2 = [i["id"] for i in requests.get(f"{API}/ideas/spotlights", headers=_hdr(teacher_token), timeout=30).json()]
        assert b in ids2 and a not in ids2

        # same idea again -> unpin
        r3 = requests.post(f"{API}/ideas/{b}/spotlight", headers=_hdr(teacher_token), timeout=30)
        assert r3.status_code == 200, r3.text
        assert r3.json()["spotlighted"] is False
        ids3 = [i["id"] for i in requests.get(f"{API}/ideas/spotlights", headers=_hdr(teacher_token), timeout=30).json()]
        assert b not in ids3

    def test_student_cannot_spotlight(self, student_token):
        ideas = requests.get(f"{API}/ideas", headers=_hdr(student_token), timeout=30).json()
        r = requests.post(f"{API}/ideas/{ideas[0]['id']}/spotlight", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_spotlight_404(self, teacher_token):
        r = requests.post(f"{API}/ideas/does-not-exist/spotlight", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 404

    def test_spotlights_requires_auth(self):
        assert requests.get(f"{API}/ideas/spotlights", timeout=30).status_code in (401, 403)


# ---------------- Contest API compatibility (routes still /api/tournaments) ----------------
class TestContestApi:
    def test_tournaments_route_alive(self, student_token):
        r = requests.get(f"{API}/tournaments", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        titles = {t["title"] for t in r.json()}
        assert "Autumn Math Sprint" in titles

    def test_fresh_student_join_and_submit(self):
        r, payload = _register(age=17)
        tok = _login(payload["username"], payload["password"])
        ts = requests.get(f"{API}/tournaments", headers=_hdr(tok), timeout=30).json()
        autumn = next(t for t in ts if t["title"] == "Autumn Math Sprint")
        assert requests.post(f"{API}/tournaments/{autumn['id']}/join", headers=_hdr(tok), timeout=30).status_code == 200
        full = requests.get(f"{API}/quizzes/{autumn['quiz_id']}", timeout=30).json()
        answers = [{"selected": q["options"][0]} for q in full["questions"]]
        sub = requests.post(f"{API}/tournaments/{autumn['id']}/submit", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert sub.status_code == 200, sub.text
        assert sub.json()["rank"] >= 1
        # contest points logged as a point event
        wk = requests.get(f"{API}/stats/weekly", headers=_hdr(tok), timeout=30).json()
        assert wk["points_week"] >= 30
