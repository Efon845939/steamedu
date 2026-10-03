"""V4 tests: Class Announcements + Badge Collection (12 badges)."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = f"{base_url.rstrip('/')}/api"

TEACHER_CODE = "STEAM-TEACH-2026"
STUDENT = {"username": "teststudent", "password": "TestPass123!"}
TEACHER = {"username": "teacher_demo", "password": "TeacherDemo123!"}

BADGE_KEYS = {
    "first_quiz", "ten_quizzes", "perfect_score", "first_activity", "streak_7", "streak_30",
    "points_100", "points_500", "points_1000", "first_idea", "teachers_pick", "contest_champion",
}


def _correct_answers(quiz_id):
    """GET /quizzes strips correct answers, so read them straight from Mongo."""
    from pymongo import MongoClient
    be = dotenv_values("/app/backend/.env")
    client = MongoClient(be["MONGO_URL"])
    quiz = client[be["DB_NAME"]].quizzes.find_one({"id": quiz_id})
    client.close()
    assert quiz, f"quiz {quiz_id} not found in DB"
    return [{"question_index": i, "selected": q["correct_answer"]}
            for i, q in enumerate(quiz["questions"])]


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {username}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(role="student", age=16, code=None):
    suffix = uuid.uuid4().hex[:8]
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
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    return payload, _login(payload["username"], payload["password"]), r.json()["id"]


@pytest.fixture(scope="session")
def teacher_token():
    return _login(**TEACHER)


@pytest.fixture(scope="session")
def student_token():
    return _login(**STUDENT)


@pytest.fixture(scope="session")
def fresh_student():
    """Throwaway student with a clean badge/announcement state."""
    payload, token, uid = _register()
    return {"payload": payload, "token": token, "id": uid}


# ---------------- Class Announcements ----------------
class TestAnnouncements:
    def test_teacher_create_list_read_delete_flow(self, teacher_token, student_token):
        title = f"TEST_ Announcement {uuid.uuid4().hex[:6]}"
        created = requests.post(f"{API}/announcements",
                                json={"title": title, "body": "Bring your lab notebooks tomorrow."},
                                headers=_hdr(teacher_token), timeout=30)
        assert created.status_code == 200, created.text[:300]
        doc = created.json()
        ann_id = doc["id"]
        assert doc["title"] == title
        assert doc["read_count"] == 0
        assert doc["recipients"] >= 1
        assert isinstance(doc["teacher_name"], str) and doc["teacher_name"]

        # Teacher list shows it with read counters
        tl = requests.get(f"{API}/announcements", headers=_hdr(teacher_token), timeout=30)
        assert tl.status_code == 200
        mine = [a for a in tl.json() if a["id"] == ann_id]
        assert len(mine) == 1
        assert mine[0]["read_count"] == 0
        assert mine[0]["recipients"] == doc["recipients"]
        assert "_id" not in mine[0]

        # Student sees it unread, recipient list hidden
        sl = requests.get(f"{API}/announcements", headers=_hdr(student_token), timeout=30)
        assert sl.status_code == 200
        s_ann = [a for a in sl.json() if a["id"] == ann_id]
        assert len(s_ann) == 1, "student did not receive teacher announcement"
        assert s_ann[0]["read"] is False
        assert s_ann[0]["recipient_ids"] == []
        assert s_ann[0]["body"] == "Bring your lab notebooks tomorrow."

        unread_before = requests.get(f"{API}/announcements/unread-count",
                                     headers=_hdr(student_token), timeout=30).json()["unread"]
        assert unread_before >= 1

        # Mark read (idempotent)
        m1 = requests.post(f"{API}/announcements/{ann_id}/read", headers=_hdr(student_token), timeout=30)
        assert m1.status_code == 200 and m1.json()["read"] is True
        m2 = requests.post(f"{API}/announcements/{ann_id}/read", headers=_hdr(student_token), timeout=30)
        assert m2.status_code == 200

        after = requests.get(f"{API}/announcements", headers=_hdr(student_token), timeout=30).json()
        assert [a for a in after if a["id"] == ann_id][0]["read"] is True
        unread_after = requests.get(f"{API}/announcements/unread-count",
                                    headers=_hdr(student_token), timeout=30).json()["unread"]
        assert unread_after == unread_before - 1

        # Teacher read counter increased exactly once despite two read calls
        tl2 = requests.get(f"{API}/announcements", headers=_hdr(teacher_token), timeout=30).json()
        assert [a for a in tl2 if a["id"] == ann_id][0]["read_count"] == 1

        # Delete
        d = requests.delete(f"{API}/announcements/{ann_id}", headers=_hdr(teacher_token), timeout=30)
        assert d.status_code == 200 and d.json()["deleted"] is True
        tl3 = requests.get(f"{API}/announcements", headers=_hdr(teacher_token), timeout=30).json()
        assert not [a for a in tl3 if a["id"] == ann_id]
        sl3 = requests.get(f"{API}/announcements", headers=_hdr(student_token), timeout=30).json()
        assert not [a for a in sl3 if a["id"] == ann_id]

    def test_student_cannot_create(self, student_token):
        r = requests.post(f"{API}/announcements", json={"title": "TEST_x", "body": "y"},
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 403, r.text[:200]

    def test_unauthenticated_rejected(self):
        assert requests.get(f"{API}/announcements", timeout=30).status_code in (401, 403)

    def test_empty_title_or_body_rejected(self, teacher_token):
        r = requests.post(f"{API}/announcements", json={"title": "   ", "body": "hello"},
                          headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 400
        r2 = requests.post(f"{API}/announcements", json={"title": "TEST_t", "body": "  "},
                           headers=_hdr(teacher_token), timeout=30)
        assert r2.status_code == 400

    def test_teacher_with_no_students_gets_400(self):
        _, tok, _ = _register(role="teacher", code=TEACHER_CODE)
        r = requests.post(f"{API}/announcements", json={"title": "TEST_none", "body": "no students"},
                          headers=_hdr(tok), timeout=30)
        assert r.status_code == 400
        assert "no students" in r.json()["detail"].lower()
        # A teacher's unread-count is always 0
        assert requests.get(f"{API}/announcements/unread-count", headers=_hdr(tok),
                            timeout=30).json()["unread"] == 0

    def test_teacher_unread_count_zero(self, teacher_token):
        r = requests.get(f"{API}/announcements/unread-count", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200 and r.json()["unread"] == 0

    def test_cross_teacher_delete_forbidden(self, teacher_token):
        created = requests.post(f"{API}/announcements",
                                json={"title": f"TEST_cross {uuid.uuid4().hex[:5]}", "body": "b"},
                                headers=_hdr(teacher_token), timeout=30)
        assert created.status_code == 200
        ann_id = created.json()["id"]
        _, other_tok, _ = _register(role="teacher", code=TEACHER_CODE)
        r = requests.delete(f"{API}/announcements/{ann_id}", headers=_hdr(other_tok), timeout=30)
        assert r.status_code == 403
        # cleanup
        requests.delete(f"{API}/announcements/{ann_id}", headers=_hdr(teacher_token), timeout=30)

    def test_student_delete_forbidden_and_missing_404(self, student_token, teacher_token):
        created = requests.post(f"{API}/announcements",
                                json={"title": f"TEST_sd {uuid.uuid4().hex[:5]}", "body": "b"},
                                headers=_hdr(teacher_token), timeout=30).json()
        assert requests.delete(f"{API}/announcements/{created['id']}",
                               headers=_hdr(student_token), timeout=30).status_code == 403
        requests.delete(f"{API}/announcements/{created['id']}", headers=_hdr(teacher_token), timeout=30)
        assert requests.delete(f"{API}/announcements/does-not-exist",
                               headers=_hdr(teacher_token), timeout=30).status_code == 404

    def test_non_recipient_cannot_mark_read(self, teacher_token):
        created = requests.post(f"{API}/announcements",
                                json={"title": f"TEST_nr {uuid.uuid4().hex[:5]}", "body": "b"},
                                headers=_hdr(teacher_token), timeout=30).json()
        _, outsider, _ = _register()
        r = requests.post(f"{API}/announcements/{created['id']}/read", headers=_hdr(outsider), timeout=30)
        assert r.status_code == 404
        assert not [a for a in requests.get(f"{API}/announcements", headers=_hdr(outsider),
                                            timeout=30).json() if a["id"] == created["id"]]
        requests.delete(f"{API}/announcements/{created['id']}", headers=_hdr(teacher_token), timeout=30)

    def test_mark_read_missing_404(self, student_token):
        r = requests.post(f"{API}/announcements/nope-{uuid.uuid4().hex[:6]}/read",
                          headers=_hdr(student_token), timeout=30)
        assert r.status_code == 404


# ---------------- Badges ----------------
class TestBadges:
    def test_badges_shape_and_consistency(self, student_token):
        r = requests.get(f"{API}/badges", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["total"] == 12
        badges = data["badges"]
        assert len(badges) == 12
        assert {b["key"] for b in badges} == BADGE_KEYS
        assert data["earned_count"] == len([b for b in badges if b["earned"]])
        for b in badges:
            for field in ("key", "name", "description", "icon", "color", "metric", "goal",
                          "earned", "progress"):
                assert field in b, f"missing {field} in {b['key']}"
            assert b["progress"] <= b["goal"]
            if b["earned"]:
                assert b["earned_at"], f"{b['key']} earned without earned_at"
            else:
                assert b["progress"] < b["goal"], f"{b['key']} met goal but not earned"

    def test_badges_idempotent(self, student_token):
        first = requests.get(f"{API}/badges", headers=_hdr(student_token), timeout=30).json()
        second = requests.get(f"{API}/badges", headers=_hdr(student_token), timeout=30).json()
        assert first["earned_count"] == second["earned_count"]
        assert {b["key"]: b["earned_at"] for b in first["badges"]} == \
               {b["key"]: b["earned_at"] for b in second["badges"]}

    def test_fresh_student_starts_with_zero_badges(self, fresh_student):
        data = requests.get(f"{API}/badges", headers=_hdr(fresh_student["token"]), timeout=30).json()
        assert data["earned_count"] == 0
        assert all(b["progress"] == 0 for b in data["badges"])

    def test_first_quiz_and_perfect_score_event_driven(self, fresh_student):
        tok = fresh_student["token"]
        quizzes = requests.get(f"{API}/quizzes", timeout=30).json()
        assert quizzes
        quiz = quizzes[0]
        answers = _correct_answers(quiz["id"])
        res = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert res.status_code == 200, res.text[:300]
        body = res.json()
        assert "new_badges" in body
        keys = {b["key"] for b in body["new_badges"]}
        assert "first_quiz" in keys
        assert body["score"] == 100 and "perfect_score" in keys
        for b in body["new_badges"]:
            assert {"key", "name", "description", "icon", "color"} <= set(b)

        # idempotent: second attempt returns no duplicate badges
        again = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                              headers=_hdr(tok), timeout=30).json()
        assert "first_quiz" not in {b["key"] for b in again["new_badges"]}
        assert "perfect_score" not in {b["key"] for b in again["new_badges"]}

        badges = requests.get(f"{API}/badges", headers=_hdr(tok), timeout=30).json()
        earned = {b["key"] for b in badges["badges"] if b["earned"]}
        assert {"first_quiz", "perfect_score"} <= earned
        fq = [b for b in badges["badges"] if b["key"] == "ten_quizzes"][0]
        assert fq["progress"] == 1 and fq["earned"] is False

    def test_first_activity_badge(self, fresh_student):
        tok = fresh_student["token"]
        activities = requests.get(f"{API}/activities", timeout=30).json()
        assert activities
        res = requests.post(f"{API}/activities/{activities[0]['id']}/complete", json={"score": 80},
                            headers=_hdr(tok), timeout=30)
        assert res.status_code == 200, res.text[:300]
        assert "new_badges" in res.json()
        badges = requests.get(f"{API}/badges", headers=_hdr(tok), timeout=30).json()
        assert [b for b in badges["badges"] if b["key"] == "first_activity"][0]["earned"] is True

    def test_first_idea_and_teachers_pick(self, teacher_token, fresh_student):
        tok = fresh_student["token"]
        idea = requests.post(f"{API}/ideas", json={
            "title": f"TEST_ idea {uuid.uuid4().hex[:6]}",
            "description": "A solar powered water filter for classrooms.",
            "category": "Science",
        }, headers=_hdr(tok), timeout=30)
        assert idea.status_code == 200, idea.text[:300]
        idea_id = idea.json()["id"]
        badges = requests.get(f"{API}/badges", headers=_hdr(tok), timeout=30).json()
        assert [b for b in badges["badges"] if b["key"] == "first_idea"][0]["earned"] is True

        # Clear any existing pick by this teacher so the toggle definitely pins
        existing = requests.get(f"{API}/ideas/spotlights", headers=_hdr(teacher_token), timeout=30).json()
        for e in existing:
            if e.get("spotlight", {}).get("teacher_name"):
                requests.post(f"{API}/ideas/{e['id']}/spotlight", headers=_hdr(teacher_token), timeout=30)

        sp = requests.post(f"{API}/ideas/{idea_id}/spotlight", headers=_hdr(teacher_token), timeout=30)
        assert sp.status_code == 200 and sp.json()["spotlighted"] is True
        badges = requests.get(f"{API}/badges", headers=_hdr(tok), timeout=30).json()
        tp = [b for b in badges["badges"] if b["key"] == "teachers_pick"][0]
        assert tp["earned"] is True, "Teacher's Pick not awarded to the idea author"

        # public per-user badge view only lists earned badges
        pub = requests.get(f"{API}/badges/user/{fresh_student['id']}",
                           headers=_hdr(teacher_token), timeout=30)
        assert pub.status_code == 200
        pubd = pub.json()
        assert pubd["total"] == 12
        assert "teachers_pick" in {b["key"] for b in pubd["badges"]}
        assert pubd["earned_count"] == len(pubd["badges"])
        assert "password" not in pubd["user"] and "hashed_password" not in pubd["user"]

        # cleanup: unpin + delete idea
        requests.post(f"{API}/ideas/{idea_id}/spotlight", headers=_hdr(teacher_token), timeout=30)

    def test_badges_user_404(self, student_token):
        r = requests.get(f"{API}/badges/user/does-not-exist", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 404

    def test_points_badges_reflect_real_points(self, fresh_student):
        tok = fresh_student["token"]
        me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
        badges = requests.get(f"{API}/badges", headers=_hdr(tok), timeout=30).json()["badges"]
        p100 = [b for b in badges if b["key"] == "points_100"][0]
        assert p100["progress"] == min(me["points"], 100)
        assert p100["earned"] is (me["points"] >= 100)

    def test_challenge_complete_returns_new_badges(self, teacher_token, student_token):
        today = requests.get(f"{API}/challenges/today", headers=_hdr(student_token), timeout=30)
        assert today.status_code == 200
        chs = today.json()
        if not chs:
            pytest.skip("no daily challenges available today")
        target = next((c for c in chs if not c.get("completed") and c.get("type") != "quiz"), None)
        if not target:
            pytest.skip("no non-quiz uncompleted challenge available for teststudent")
        res = requests.post(f"{API}/challenges/{target['id']}/complete",
                            headers=_hdr(student_token), timeout=30)
        assert res.status_code == 200, res.text[:300]
        assert isinstance(res.json().get("new_badges"), list)

    def test_stats_me_exposes_badge_counts(self, student_token):
        r = requests.get(f"{API}/stats/me", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["badges_total"] == 12
        badges = requests.get(f"{API}/badges", headers=_hdr(student_token), timeout=30).json()
        assert d["badges_earned"] == badges["earned_count"]

    def test_contest_submit_returns_new_badges(self, fresh_student):
        tok = fresh_student["token"]
        contests = requests.get(f"{API}/tournaments", headers=_hdr(tok), timeout=30)
        assert contests.status_code == 200, contests.text[:200]
        open_contests = [c for c in contests.json() if c.get("status") in (None, "open", "active")]
        pool = open_contests or contests.json()
        if not pool:
            pytest.skip("no contests available")
        cid = pool[0]["id"]
        join = requests.post(f"{API}/tournaments/{cid}/join", headers=_hdr(tok), timeout=30)
        assert join.status_code in (200, 400), join.text[:200]
        detail = requests.get(f"{API}/tournaments/{cid}", headers=_hdr(tok), timeout=30).json()
        answers = _correct_answers(detail["quiz_id"])
        sub = requests.post(f"{API}/tournaments/{cid}/submit", json={"answers": answers},
                            headers=_hdr(tok), timeout=30)
        assert sub.status_code == 200, sub.text[:300]
        assert isinstance(sub.json().get("new_badges"), list)


# ---------------- Regression smoke ----------------
class TestRegressionSmoke:
    @pytest.mark.parametrize("path", [
        "/quizzes", "/activities", "/content",
    ])
    def test_public_lists(self, path):
        r = requests.get(f"{API}{path}", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.mark.parametrize("path", ["/leaderboard/students", "/leaderboard/teachers"])
    def test_leaderboards_require_auth(self, student_token, path):
        assert requests.get(f"{API}{path}", timeout=30).status_code in (401, 403)
        r = requests.get(f"{API}{path}", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    @pytest.mark.parametrize("path", [
        "/stats/me", "/stats/weekly", "/ideas", "/ideas/spotlights", "/certificates/me",
        "/challenges/today", "/announcements",
    ])
    def test_student_authenticated_endpoints(self, student_token, path):
        r = requests.get(f"{API}{path}", headers=_hdr(student_token), timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_teacher_students_and_verification(self, teacher_token):
        s = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30)
        assert s.status_code == 200 and isinstance(s.json(), list) and len(s.json()) >= 1
        v = requests.get(f"{API}/teacher/verification", headers=_hdr(teacher_token), timeout=30)
        assert v.status_code == 200
