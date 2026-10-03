"""Iteration 9 — verification of the 7 fixes reported in iteration_8.

Covers:
  #1 AttemptSubmit/QuizAnswer pydantic validation on quiz + tournament submit
  #2 scoped seed upserts (teacher quiz with seed title not hijacked)
  #3 demo quiz attempts use $setOnInsert only
  #4 ensure_indexes() tolerant + indexes present
  #5 Mongo-backed login lockout (429 after 5 fails, survives restart, cleared on success)
"""
import os
import subprocess
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

TEACHER = {"username": "teacher_demo", "password": "TeacherDemo123!"}
STUDENT = {"username": "teststudent", "password": "TestPass123!"}
ALEX = {"username": "alex_chen", "password": "StudentDemo123!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {creds['username']}: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def dbc():
    client = MongoClient(backend_env["MONGO_URL"])
    yield client[backend_env["DB_NAME"]]
    client.close()


@pytest.fixture(scope="module")
def teacher_token():
    return _login(TEACHER)


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT)


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- FIX #1 : attempt payload validation ----------------
class TestAttemptValidation:
    @pytest.fixture(scope="class")
    def quiz(self):
        r = requests.get(f"{API}/quizzes", timeout=30)
        assert r.status_code == 200
        qs = r.json()
        assert qs, "no quizzes seeded"
        return qs[0]

    def test_malformed_answers_returns_422(self, student_token, quiz):
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": [0, 0, 0]},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text[:300]}"

    def test_answers_wrong_type_returns_422(self, student_token, quiz):
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": "abc"},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 422

    def test_missing_body_returns_422(self, student_token, quiz):
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", headers=H(student_token), timeout=30)
        assert r.status_code == 422

    def test_int_selected_grades_correctly(self, student_token, quiz, dbc):
        full = dbc.quizzes.find_one({"id": quiz["id"]}, {"_id": 0})
        answers = [{"question_index": i, "selected": q["correct_answer"]}
                   for i, q in enumerate(full["questions"])]
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["score"] == 100, body
        assert "points_earned" in body and "first_attempt" in body
        if body["first_attempt"]:
            assert body["points_earned"] > 0

    def test_string_selected_still_grades(self, student_token, quiz, dbc):
        full = dbc.quizzes.find_one({"id": quiz["id"]}, {"_id": 0})
        answers = [{"question_index": i, "selected": str(q["correct_answer"])}
                   for i, q in enumerate(full["questions"])]
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["score"] == 100, r.json()

    def test_first_attempt_awards_points_fresh_user(self, quiz, dbc):
        uname = f"TEST_pts_{uuid.uuid4().hex[:6]}"
        reg = requests.post(f"{API}/auth/register", json={
            "username": uname, "password": "TestPass123!", "email": f"{uname}@steam.edu",
            "full_name": "TEST Points", "role": "student", "age": 16}, timeout=30)
        assert reg.status_code in (200, 201), reg.text[:300]
        token = _login({"username": uname, "password": "TestPass123!"})
        full = dbc.quizzes.find_one({"id": quiz["id"]}, {"_id": 0})
        answers = [{"question_index": i, "selected": q["correct_answer"]}
                   for i, q in enumerate(full["questions"])]
        try:
            r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                              headers=H(token), timeout=30)
            assert r.status_code == 200, r.text[:300]
            body = r.json()
            assert body["first_attempt"] is True
            assert body["score"] == 100
            assert body["points_earned"] == 100, body
            u = dbc.users.find_one({"username": uname})
            assert u.get("points", 0) >= 100, f"points not persisted: {u.get('points')}"
            assert dbc.point_events.count_documents({"user_id": u["id"], "reason": "quiz"}) == 1
        finally:
            u = dbc.users.find_one({"username": uname})
            if u:
                dbc.quiz_attempts.delete_many({"user_id": u["id"]})
                dbc.users.delete_one({"username": uname})

    def test_empty_answers_is_zero_not_500(self, student_token, quiz):
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": []},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["score"] == 0

    def test_tournament_malformed_payload_422(self, student_token, teacher_token):
        ts = requests.get(f"{API}/tournaments", headers=H(student_token), timeout=30).json()
        active = [t for t in ts if t.get("status") == "active"]
        if not active:
            pytest.skip("no active tournament")
        t = active[0]
        requests.post(f"{API}/tournaments/{t['id']}/join", headers=H(student_token), timeout=30)
        r = requests.post(f"{API}/tournaments/{t['id']}/submit", json={"answers": [0, 1]},
                          headers=H(student_token), timeout=30)
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text[:300]}"


# ---------------- FIX #2 / #3 : scoped seed upserts ----------------
class TestSeedScoping:
    def test_teacher_quiz_with_seed_title_not_hijacked(self, teacher_token, dbc):
        seed_quiz = dbc.quizzes.find_one({"created_by": "system"}, {"_id": 0})
        assert seed_quiz, "no system quiz found"
        title = seed_quiz["title"]
        teacher = dbc.users.find_one({"username": TEACHER["username"]})
        new_id = str(uuid.uuid4())
        dbc.quizzes.insert_one({
            "id": new_id, "title": title, "subject": "Mathematics", "age_group": "16-18",
            "difficulty": "easy", "created_by": teacher["id"],
            "questions": [{"question": "TEST 1+1?", "options": ["1", "2"],
                           "correct_answer": 1, "explanation": "TEST"}],
        })
        try:
            r = requests.post(f"{API}/seed-data", headers=H(teacher_token), timeout=120)
            assert r.status_code == 200, r.text[:300]
            doc = dbc.quizzes.find_one({"id": new_id}, {"_id": 0})
            assert doc is not None, "teacher quiz deleted by seed"
            assert doc["created_by"] == teacher["id"], "teacher quiz re-tagged created_by=system by seed"
            assert doc["questions"][0]["question"] == "TEST 1+1?", "teacher quiz content overwritten by seed"
            assert dbc.quizzes.count_documents({"title": title, "created_by": "system"}) == 1
        finally:
            dbc.quizzes.delete_one({"id": new_id})

    def test_seed_idempotent_counts_and_ids(self, teacher_token, dbc):
        requests.post(f"{API}/seed-data", headers=H(teacher_token), timeout=120)
        before = {
            "quizzes": dbc.quizzes.count_documents({}),
            "activities": dbc.activities.count_documents({}),
            "content": dbc.content.count_documents({}),
            "tournaments": dbc.tournaments.count_documents({}),
        }
        ids_before = sorted(d["id"] for d in dbc.quizzes.find({}, {"id": 1}))
        r = requests.post(f"{API}/seed-data", headers=H(teacher_token), timeout=120)
        assert r.status_code == 200, r.text[:300]
        after = {
            "quizzes": dbc.quizzes.count_documents({}),
            "activities": dbc.activities.count_documents({}),
            "content": dbc.content.count_documents({}),
            "tournaments": dbc.tournaments.count_documents({}),
        }
        assert before == after, (before, after)
        assert ids_before == sorted(d["id"] for d in dbc.quizzes.find({}, {"id": 1}))

    def test_demo_student_genuine_attempt_survives_seed(self, teacher_token, dbc):
        token = _login(ALEX)
        quiz = dbc.quizzes.find_one({"created_by": "system"}, {"_id": 0})
        full = quiz
        # deliberately one wrong answer so the score is distinctive
        answers = [{"question_index": i, "selected": q["correct_answer"]}
                   for i, q in enumerate(full["questions"])]
        opts = full["questions"][0]["options"]
        correct0 = full["questions"][0]["correct_answer"]
        answers[0]["selected"] = next(o for o in opts if o != correct0)
        r = requests.post(f"{API}/quizzes/{quiz['id']}/attempt", json={"answers": answers},
                          headers=H(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        attempt_id = r.json()["id"]
        score = r.json()["score"]
        requests.post(f"{API}/seed-data", headers=H(teacher_token), timeout=120)
        doc = dbc.quiz_attempts.find_one({"id": attempt_id}, {"_id": 0})
        assert doc is not None, "genuine demo attempt removed by seed"
        assert doc["score"] == score, f"attempt score overwritten by seed: {doc['score']} != {score}"
        assert len(doc["answers"]) == len(answers), "attempt answers wiped by seed"
        dbc.quiz_attempts.delete_one({"id": attempt_id})


# ---------------- FIX #4 : indexes ----------------
class TestIndexes:
    def test_service_up(self):
        r = requests.get(f"{API}/quizzes", timeout=30)
        assert r.status_code == 200

    def test_expected_indexes_exist(self, dbc):
        ar = dbc.announcement_reads.index_information()
        assert any(v.get("unique") and {"announcement_id", "student_id"} == {k for k, _ in v["key"]}
                   for v in ar.values()), ar
        ub = dbc.user_badges.index_information()
        assert any(v.get("unique") and {"user_id", "key"} == {k for k, _ in v["key"]}
                   for v in ub.values()), ub
        lf = dbc.login_failures.index_information()
        assert any(v.get("expireAfterSeconds") for v in lf.values()), lf

    def test_no_index_error_in_logs(self):
        out = subprocess.run(["tail", "-n", "400", "/var/log/supervisor/backend.err.log"],
                             capture_output=True, text=True).stdout
        assert "Traceback" not in out or "Index" not in out, out[-800:]


# ---------------- FIX #5 : Mongo-backed lockout ----------------
class TestLoginLockout:
    def test_lockout_429_survives_restart_and_clears(self, dbc):
        uname = f"TEST_lockout_{uuid.uuid4().hex[:8]}"
        codes = []
        for _ in range(5):
            codes.append(requests.post(f"{API}/auth/login",
                                       json={"username": uname, "password": "bad"}, timeout=30).status_code)
        assert codes == [401] * 5, codes
        sixth = requests.post(f"{API}/auth/login", json={"username": uname, "password": "bad"},
                              timeout=30)
        assert sixth.status_code == 429, f"6th attempt {sixth.status_code}: {sixth.text[:200]}"

        assert dbc.login_failures.count_documents({"key": {"$regex": uname.lower()}}) >= 5

        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True, text=True)
        for _ in range(30):
            time.sleep(2)
            try:
                if requests.get(f"{API}/quizzes", timeout=10).status_code == 200:
                    break
            except Exception:
                continue
        else:
            pytest.fail("backend did not come back up after restart")

        after = requests.post(f"{API}/auth/login", json={"username": uname, "password": "bad"}, timeout=30)
        assert after.status_code == 429, f"lockout lost after restart: {after.status_code}"
        dbc.login_failures.delete_many({"key": {"$regex": uname.lower()}})

    def test_correct_login_clears_failures(self, dbc):
        for _ in range(3):
            r = requests.post(f"{API}/auth/login",
                              json={"username": STUDENT["username"], "password": "wrongpass"}, timeout=30)
            assert r.status_code == 401
        assert dbc.login_failures.count_documents({"key": {"$regex": STUDENT["username"]}}) >= 3
        assert _login(STUDENT)
        assert dbc.login_failures.count_documents({"key": {"$regex": STUDENT["username"]}}) == 0
