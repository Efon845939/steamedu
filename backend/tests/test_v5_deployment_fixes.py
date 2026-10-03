"""Iteration 8 — verification of the deployment-readiness fixes:
   1. GET /api/teacher/students  (batched $in queries instead of N+1)
   2. GET /api/leaderboard/teachers (Mongo aggregation instead of full scan)
   3. POST /api/seed-data (fully idempotent, no delete_many)
"""
import os

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = backend_env.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME")

TEACHER = {"username": "teacher_demo", "password": "TeacherDemo123!"}


def _login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login {username} failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def teacher_token():
    return _login(**TEACHER)


@pytest.fixture(scope="session")
def dbc():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def run(value):
    """Kept for readability: ground-truth helpers are synchronous (pymongo)."""
    return value


COLLECTIONS = ["quizzes", "activities", "content", "challenges", "tournaments",
               "tournament_entries", "quiz_attempts", "certificates", "user_badges",
               "ideas", "challenge_completions", "activity_results", "users"]


# ---------------- 1. teacher/students batched query ----------------
class TestTeacherStudents:
    def test_students_list_matches_db_ground_truth(self, teacher_token, dbc):
        r = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0

        def truth():
            teacher = dbc.users.find_one({"username": "teacher_demo"})
            students = list(dbc.users.find({"teacher_id": teacher["id"]}))
            out = {}
            for s in students:
                attempts = list(dbc.quiz_attempts.find({"user_id": s["id"]}, {"_id": 0}))
                best = {}
                for a in attempts:
                    best[a["quiz_id"]] = max(best.get(a["quiz_id"], 0), a["score"])
                acts = list(dbc.activity_results.find({"user_id": s["id"]}, {"_id": 0}))
                out[s["username"]] = {
                    "quizzes_completed": len(best),
                    "avg_score": round(sum(best.values()) / len(best)) if best else 0,
                    "activities_completed": len({x["activity_id"] for x in acts}),
                }
            return out

        expected = truth()
        got = {row["username"]: row for row in rows}
        assert set(got) == set(expected), f"api={sorted(got)} db={sorted(expected)}"
        for uname, exp in expected.items():
            for field in ("quizzes_completed", "avg_score", "activities_completed"):
                assert got[uname][field] == exp[field], f"{uname}.{field}: api={got[uname][field]} db={exp[field]}"

    def test_demo_students_present_with_expected_fields(self, teacher_token):
        rows = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30).json()
        by_name = {r["username"]: r for r in rows}
        for uname in ("alex_chen", "maya_r", "sam_patel", "teststudent"):
            assert uname in by_name, f"{uname} missing from mentored students"
            row = by_name[uname]
            assert "_id" not in row
            assert isinstance(row["quizzes_completed"], int)
            assert isinstance(row["avg_score"], int)
            assert isinstance(row["activities_completed"], int)
            assert row["id"] and row["full_name"]

    @pytest.mark.parametrize("uname", ["maya_r", "teststudent"])
    def test_cross_check_with_stats_student_endpoint(self, teacher_token, uname):
        rows = requests.get(f"{API}/teacher/students", headers=_hdr(teacher_token), timeout=30).json()
        row = next(r for r in rows if r["username"] == uname)
        s = requests.get(f"{API}/stats/student/{row['id']}", headers=_hdr(teacher_token), timeout=30)
        assert s.status_code == 200, s.text
        stats = s.json()
        # /stats/student filters the catalogue by the student's age group, so its counts
        # can only be <= the unfiltered teacher/students counts.
        assert row["quizzes_completed"] >= stats["quizzes_completed"], (uname, row, stats)
        assert row["activities_completed"] >= stats["activities_completed"], (uname, row, stats)

    def test_student_cannot_call_teacher_students(self):
        tok = _login("teststudent", "TestPass123!")
        r = requests.get(f"{API}/teacher/students", headers=_hdr(tok), timeout=30)
        assert r.status_code == 403, r.status_code


# ---------------- 2. teacher leaderboard aggregation ----------------
class TestTeacherLeaderboard:
    def test_structure_and_ranks(self, teacher_token):
        r = requests.get(f"{API}/leaderboard/teachers", headers=_hdr(teacher_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data) >= {"best", "popular"}
        for key in ("best", "popular"):
            rows = data[key]
            assert isinstance(rows, list) and len(rows) > 0, key
            assert [x["rank"] for x in rows] == list(range(1, len(rows) + 1)), key
            for x in rows:
                assert "_id" not in x
                for f in ("user_id", "username", "full_name", "score", "pro_tournaments",
                          "students_count", "tournament_students"):
                    assert f in x, (key, f)
        best_scores = [x["score"] for x in data["best"]]
        assert best_scores == sorted(best_scores, reverse=True)

    def test_teacher_demo_metrics(self, teacher_token, dbc):
        data = requests.get(f"{API}/leaderboard/teachers", headers=_hdr(teacher_token), timeout=30).json()
        row = next((x for x in data["best"] if x["username"] == "teacher_demo"), None)
        assert row is not None, "teacher_demo missing from best list"
        assert row["score"] > 0, row
        assert row["verified"] is True

        def truth():
            t = dbc.users.find_one({"username": "teacher_demo"})
            students = list(dbc.users.find({"role": "student", "teacher_id": t["id"]}))
            tours = list(dbc.tournaments.find({"teacher_id": t["id"]}, {"_id": 0}))
            pro = sum(1 for x in tours if x.get("is_professional"))
            return len(students), pro
        exp_students, exp_pro = truth()
        assert row["students_count"] == exp_students, (row, exp_students)
        assert row["pro_tournaments"] == exp_pro, (row, exp_pro)

    def test_avg_aggregation_matches_manual_average(self, teacher_token, dbc):
        """Verify the Mongo $group pipeline reproduces avg-of-best-per-quiz per student."""
        def truth():
            t = dbc.users.find_one({"username": "teacher_demo"})
            students = list(dbc.users.find({"role": "student", "teacher_id": t["id"]}))
            metrics = []
            for s in students:
                attempts = list(dbc.quiz_attempts.find({"user_id": s["id"]}, {"_id": 0}))
                best = {}
                for a in attempts:
                    best[a["quiz_id"]] = max(best.get(a["quiz_id"], 0), a["score"])
                avg = sum(best.values()) / len(best) if best else 0
                metrics.append(avg + s.get("streak_days", 0) * 10)
            pro = sum(1 for x in list(dbc.tournaments.find({"teacher_id": t["id"]}, {"_id": 0}))
                      if x.get("is_professional"))
            sm = sum(metrics) / len(metrics) if metrics else 0
            return round(0.75 * (pro * 100) + 0.25 * sm, 1)
        expected_score = truth()
        data = requests.get(f"{API}/leaderboard/teachers", headers=_hdr(teacher_token), timeout=30).json()
        row = next(x for x in data["best"] if x["username"] == "teacher_demo")
        assert abs(row["score"] - expected_score) < 0.2, f"api={row['score']} expected={expected_score}"

    def test_popular_sorted_by_tournament_students(self, teacher_token):
        data = requests.get(f"{API}/leaderboard/teachers", headers=_hdr(teacher_token), timeout=30).json()
        keys = [(x["tournament_students"], x["students_count"]) for x in data["popular"]]
        assert keys == sorted(keys, reverse=True), keys

    def test_leaderboard_requires_auth(self):
        r = requests.get(f"{API}/leaderboard/teachers", timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ---------------- 3. seed idempotency ----------------
class TestSeedIdempotency:
    def test_double_seed_preserves_counts_and_progress(self, teacher_token, dbc):
        def snapshot():
            counts = {c: dbc[c].count_documents({}) for c in COLLECTIONS}
            quiz_ids = {q["title"]: q["id"] for q in list(dbc.quizzes.find({}, {"_id": 0, "title": 1, "id": 1}))}
            act_ids = {a["title"]: a["id"] for a in list(dbc.activities.find({}, {"_id": 0, "title": 1, "id": 1}))}
            cont_ids = {c["title"]: c["id"] for c in list(dbc.content.find({}, {"_id": 0, "title": 1, "id": 1}))}
            attempts = sorted((a["user_id"], a["quiz_id"], a["score"])
                              for a in list(dbc.quiz_attempts.find({}, {"_id": 0})))
            entries = sorted((e["tournament_id"], e["student_id"], e.get("score"))
                             for e in list(dbc.tournament_entries.find({}, {"_id": 0})))
            badges = sorted((b["user_id"], b["key"]) for b in list(dbc.user_badges.find({}, {"_id": 0})))
            certs = sorted(c["id"] for c in list(dbc.certificates.find({}, {"_id": 0})))
            comps = sorted((c.get("student_id") or c.get("user_id"), c.get("challenge_id"))
                           for c in list(dbc.challenge_completions.find({}, {"_id": 0})))
            points = {u["username"]: u.get("points", 0)
                      for u in list(dbc.users.find({}, {"_id": 0, "username": 1, "points": 1}))}
            return dict(counts=counts, quiz_ids=quiz_ids, act_ids=act_ids, cont_ids=cont_ids,
                        attempts=attempts, entries=entries, badges=badges, certs=certs,
                        comps=comps, points=points)

        # first seed (establishes a stable baseline), then snapshot, then second seed
        r1 = requests.post(f"{API}/seed-data", headers=_hdr(teacher_token), timeout=120)
        assert r1.status_code == 200, r1.text
        before = snapshot()

        r2 = requests.post(f"{API}/seed-data", headers=_hdr(teacher_token), timeout=120)
        assert r2.status_code == 200, r2.text
        after = snapshot()

        assert after["counts"] == before["counts"], {
            k: (before["counts"][k], after["counts"][k])
            for k in before["counts"] if before["counts"][k] != after["counts"][k]}
        assert after["quiz_ids"] == before["quiz_ids"], "quiz ids changed across seed"
        assert after["act_ids"] == before["act_ids"], "activity ids changed across seed"
        assert after["cont_ids"] == before["cont_ids"], "content ids changed across seed"
        assert after["attempts"] == before["attempts"], "quiz attempts mutated by seed"
        assert after["entries"] == before["entries"], "tournament entries mutated by seed"
        assert after["badges"] == before["badges"], "badges mutated by seed"
        assert after["certs"] == before["certs"], "certificates mutated by seed"
        assert after["comps"] == before["comps"], "challenge completions mutated by seed"
        assert after["points"] == before["points"], {
            k: (before["points"][k], after["points"][k])
            for k in before["points"] if before["points"].get(k) != after["points"].get(k)}

    def test_seed_response_shape(self, teacher_token):
        r = requests.post(f"{API}/seed-data", headers=_hdr(teacher_token), timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quizzes"] > 0 and d["activities"] > 0 and d["content_items"] > 0

    def test_linked_quiz_still_resolves_after_seed(self, teacher_token, dbc):
        """Challenges/contests created earlier must still resolve their linked quiz id."""
        def check():
            quiz_ids = {q["id"] for q in list(dbc.quizzes.find({}, {"_id": 0, "id": 1}))}
            bad = []
            for ch in list(dbc.challenges.find({"quiz_id": {"$ne": None}}, {"_id": 0})):
                if ch.get("quiz_id") and ch["quiz_id"] not in quiz_ids:
                    bad.append(("challenge", ch.get("title")))
            for t in list(dbc.tournaments.find({"quiz_id": {"$ne": None}}, {"_id": 0})):
                if t.get("quiz_id") and t["quiz_id"] not in quiz_ids:
                    bad.append(("tournament", t.get("title")))
            return bad
        assert check() == [], check()

    def test_new_attempt_on_seeded_quiz_survives_seed(self, teacher_token, dbc):
        """A real attempt made by a demo student on a quiz that seed also seeds must not be
        overwritten/removed by a later seed run."""
        stok = _login("alex_chen", "StudentDemo123!")
        quizzes = requests.get(f"{API}/quizzes", headers=_hdr(stok), timeout=30).json()
        quiz = next((q for q in quizzes if q["title"] == "Algebra Foundations"), None)
        assert quiz is not None, "Algebra Foundations quiz missing"
        answers = [{"question_index": i, "selected": 0} for i in range(len(quiz["questions"]))]
        sub = requests.post(f"{API}/quizzes/{quiz['id']}/attempt",
                            headers=_hdr(stok), json={"answers": answers}, timeout=30)
        assert sub.status_code == 200, sub.text
        new_attempt_id = sub.json()["id"]
        new_score = sub.json()["score"]

        def state():
            u = dbc.users.find_one({"username": "alex_chen"})
            docs = list(dbc.quiz_attempts.find({"user_id": u["id"], "quiz_id": quiz["id"]}, {"_id": 0}))
            return {d["id"]: d["score"] for d in docs}

        before = state()
        assert new_attempt_id in before and before[new_attempt_id] == new_score

        r = requests.post(f"{API}/seed-data", headers=_hdr(teacher_token), timeout=120)
        assert r.status_code == 200, r.text
        after = state()
        assert new_attempt_id in after, "seed deleted the student's real quiz attempt"
        assert after[new_attempt_id] == new_score, (
            f"seed overwrote the student's real attempt score: {new_score} -> {after[new_attempt_id]}")

    def test_no_duplicate_catalog_titles(self, dbc):
        def dupes():
            out = {}
            for coll in ("quizzes", "activities", "content"):
                pipeline = [{"$group": {"_id": "$title", "n": {"$sum": 1}}}, {"$match": {"n": {"$gt": 1}}}]
                out[coll] = list(dbc[coll].aggregate(pipeline))
            return out
        d = dupes()
        assert all(not v for v in d.values()), d
