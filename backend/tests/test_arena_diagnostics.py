"""Misconception diagnostic engine — step 2 (Debug Arena + teacher diagnostics).

Runs in-process against mongomock, so it needs no live server:
    pip install mongomock-motor httpx pytest
    pytest backend/tests/test_arena_diagnostics.py
"""
import asyncio
import os
import sys
import uuid

import pytest

mongomock_motor = pytest.importorskip("mongomock_motor")

os.environ.setdefault("MONGO_URL", "mongodb://localhost")
os.environ.setdefault("DB_NAME", f"test_{uuid.uuid4().hex[:6]}")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-" + "x" * 32)
os.environ.setdefault("TEACHER_SIGNUP_CODE", "TEST-CODE")

import motor.motor_asyncio  # noqa: E402

motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402
from seed_data import ARENA_CHALLENGES, MISCONCEPTIONS, QUIZZES  # noqa: E402

DIAGNOSTIC_TITLE = "Forces & Motion: Misconception Check"
HIDDEN = {"flawed_step", "correct_explanation", "misconception", "debrief"}


def _register(client, username, role="student", **extra):
    body = {"email": f"{username}@example.com", "username": username, "password": "Passw0rd!x",
            "full_name": username.title(), "role": role, "age": 15, **extra}
    assert client.post("/api/auth/register", json=body).status_code == 200
    r = client.post("/api/auth/login", json={"username": username, "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _new_teacher(client, username):
    return _register(client, username, role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])


def _new_student(client, teacher, username):
    headers = _register(client, username)
    student_id = client.get("/api/auth/me", headers=headers).json()["id"]
    assert client.post(f"/api/teacher/add-student/{student_id}", headers=teacher).status_code == 200
    return headers


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_registration_rate_limit(client):
    # Every TestClient request comes from one IP, so the registration limit would trip
    client.portal.call(server.db.register_attempts.delete_many, {})


@pytest.fixture(scope="module")
def teacher(client):
    headers = _new_teacher(client, "teacher_arena")
    assert client.post("/api/seed-data", headers=headers).status_code == 200
    return headers


@pytest.fixture(scope="module")
def arena(client, teacher):
    rows = client.get("/api/arena/challenges", params={"source": "system"}, headers=teacher).json()
    return {c["title"]: c for c in rows}


@pytest.fixture(scope="module")
def diagnostic_quiz(client, teacher):
    return next(q for q in client.get("/api/quizzes").json() if q["title"] == DIAGNOSTIC_TITLE)


def _seed_challenge(title):
    return next(c for c in ARENA_CHALLENGES if c["title"] == title)


def _attempt(client, headers, challenge_id, **body):
    r = client.post(f"/api/arena/challenges/{challenge_id}/attempt", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _quiz_answers(*tags):
    """All-correct answers for the diagnostic quiz, except options tagged with one of `tags`."""
    seed = next(q for q in QUIZZES if q["title"] == DIAGNOSTIC_TITLE)["questions"]
    answers = []
    for i, q in enumerate(seed):
        tagged = [opt for opt, t in q.get("misconceptions", {}).items() if t in tags]
        answers.append({"question_index": i, "selected": tagged[0] if tagged else q["correct_answer"]})
    hits = sum(1 for a, q in zip(answers, seed) if a["selected"] != q["correct_answer"])
    return answers, hits


def _quiz_tags():
    seed = next(q for q in QUIZZES if q["title"] == DIAGNOSTIC_TITLE)["questions"]
    return {t for q in seed for t in q.get("misconceptions", {}).values()}


def _student_id(client, headers):
    return client.get("/api/auth/me", headers=headers).json()["id"]


def _concepts(diagnostics):
    return {row["tag"]: row for row in diagnostics["concepts"]}


def _diagnostics(client, teacher):
    r = client.get("/api/teacher/diagnostics", headers=teacher)
    assert r.status_code == 200, r.text
    return r.json()


def _by_tag(diagnostics):
    return {row["tag"]: row for row in diagnostics["misconceptions"]}


# ---------------- Seed ----------------
def test_seed_arena_challenges_are_valid():
    assert len({c["title"] for c in ARENA_CHALLENGES}) == len(ARENA_CHALLENGES)
    for c in ARENA_CHALLENGES:
        assert 0 <= c["flawed_step"] < len(c["steps"]), c["title"]
        assert c["correct_explanation"] in c["explanations"], c["title"]
        assert c["misconception"] in MISCONCEPTIONS, c["title"]
        assert c["time_limit_seconds"] > 0, c["title"]
    assert {c["subject"] for c in ARENA_CHALLENGES} == set(server.SUBJECTS)
    assert all(m["subject"] in server.SUBJECTS for m in MISCONCEPTIONS.values())


def test_seed_arena_answers_cant_be_guessed_from_form():
    """A blind guess must not beat the content: otherwise the heatmap measures test-taking, not misconceptions."""
    n = len(ARENA_CHALLENGES)
    longest = sum(1 for c in ARENA_CHALLENGES
                  if len(c["correct_explanation"]) > max(len(e) for e in c["explanations"] if e != c["correct_explanation"]))
    assert longest <= n // 2, "the right explanation is too often the longest one"
    for c in ARENA_CHALLENGES:
        shortest = min(len(e) for e in c["explanations"])
        assert len(c["correct_explanation"]) <= 1.2 * shortest, c["title"]
    for position in ("first", "last", "second-to-last"):
        idx = {"first": lambda c: 0, "last": lambda c: len(c["steps"]) - 1,
               "second-to-last": lambda c: len(c["steps"]) - 2}[position]
        hits = sum(1 for c in ARENA_CHALLENGES if c["flawed_step"] == idx(c))
        assert hits <= n // 2, f"the flawed step is the {position} step too often"


# ---------------- Arena ----------------
def test_arena_requires_login_and_hides_answers(client, teacher, arena):
    assert client.get("/api/arena/challenges").status_code in (401, 403)
    assert len(arena) == len(ARENA_CHALLENGES)
    student = _new_student(client, teacher, "arena_viewer")
    rows = client.get("/api/arena/challenges", params={"source": "system"}, headers=student).json()
    assert len(rows) == len(ARENA_CHALLENGES)
    for c in rows:
        assert not HIDDEN & c.keys(), c["title"]
        single = client.get(f"/api/arena/challenges/{c['id']}", headers=student).json()
        assert not HIDDEN & single.keys(), c["title"]
    # Teachers also see which misconception a challenge targets (to aim worksheets), never the answer key
    for c in arena.values():
        assert HIDDEN & c.keys() == {"misconception"}, c["title"]
        assert c["misconception"]["tag"] == _seed_challenge(c["title"])["misconception"]


def test_wrong_step_logs_misconception_and_reveals_answer(client, teacher, arena):
    student = _new_student(client, teacher, "arena_wrong")
    seed = _seed_challenge("Two Bulbs in Series")
    wrong_step = (seed["flawed_step"] + 1) % len(seed["steps"])
    res = _attempt(client, student, arena[seed["title"]]["id"], selected_step=wrong_step,
                   selected_explanation=seed["correct_explanation"], seconds_used=40)
    assert res["score"] == 50
    assert res["misconceptions"] == [{"tag": seed["misconception"], "selected_step": wrong_step, "source": "arena"}]
    assert res["flawed_step"] == seed["flawed_step"]
    assert res["correct_explanation"] == seed["correct_explanation"]
    assert res["misconception"]["tag"] == seed["misconception"]
    assert res["misconception"]["subject"] == "Engineering"
    assert res["debrief"] == seed["debrief"]
    assert res["first_attempt"] is True and res["points_earned"] == 50


def test_full_marks_logs_nothing_and_points_only_once(client, teacher, arena):
    student = _new_student(client, teacher, "arena_right")
    seed = ARENA_CHALLENGES[0]
    cid = arena[seed["title"]]["id"]
    body = {"selected_step": seed["flawed_step"], "selected_explanation": seed["correct_explanation"]}
    first = _attempt(client, student, cid, **body)
    assert first["score"] == 100 and first["misconceptions"] == [] and first["points_earned"] == 100
    again = _attempt(client, student, cid, **body)
    assert again["first_attempt"] is False and again["points_earned"] == 0
    row = next(c for c in client.get("/api/arena/challenges", headers=student).json() if c["id"] == cid)
    assert row["attempted"] is True and row["best_score"] == 100


def test_timeout_without_pick_logs_nothing(client, teacher, arena):
    student = _new_student(client, teacher, "arena_timeout")
    res = _attempt(client, student, arena[ARENA_CHALLENGES[1]["title"]]["id"], seconds_used=99999)
    assert res["score"] == 0
    assert res["misconceptions"] == []
    assert res["seconds_used"] == 3600


def test_out_of_range_step_rejected(client, teacher, arena):
    student = _new_student(client, teacher, "arena_range")
    cid = arena[ARENA_CHALLENGES[0]["title"]]["id"]
    r = client.post(f"/api/arena/challenges/{cid}/attempt", json={"selected_step": 99}, headers=student)
    assert r.status_code == 400


# ---------------- Diagnostics ----------------
def test_diagnostics_counts_latest_attempts_of_own_students(client, teacher, arena, diagnostic_quiz):
    me = _new_teacher(client, "teacher_diag")
    other = _new_teacher(client, "teacher_other")
    student_a = _new_student(client, me, "diag_a")
    student_b = _new_student(client, me, "diag_b")
    outsider = _new_student(client, other, "diag_out")

    tag = "motion-implies-force"
    tagged, hits = _quiz_answers(tag)
    assert hits >= 2  # the quiz tags this misconception on more than one question
    quiz_url = f"/api/quizzes/{diagnostic_quiz['id']}/attempt"
    for headers in (student_a, student_b, outsider):
        assert client.post(quiz_url, json={"answers": tagged}, headers=headers).status_code == 200
    lever = _seed_challenge("Does a Lever Save Work?")
    _attempt(client, student_a, arena[lever["title"]]["id"], selected_step=0)

    diag = _diagnostics(client, me)
    assert diag["students_total"] == 2 and diag["students_assessed"] == 2
    rows = _by_tag(diag)
    assert set(rows) == {tag, lever["misconception"]}
    assert diag["misconceptions"][0]["tag"] == tag  # most students first
    assert rows[tag]["students"] == 2 and rows[tag]["occurrences"] == 2 * hits
    assert rows[tag]["student_names"] == ["Diag_A", "Diag_B"]
    assert rows[tag]["subject"] == "Science"
    assert rows[tag]["description"] == MISCONCEPTIONS[tag]["description"]
    assert rows[lever["misconception"]]["students"] == 1

    # A retakes the quiz and gets it right: only the latest attempt counts
    correct, _ = _quiz_answers()
    assert client.post(quiz_url, json={"answers": correct}, headers=student_a).status_code == 200
    diag = _diagnostics(client, me)
    rows = _by_tag(diag)
    assert rows[tag]["students"] == 1 and rows[tag]["occurrences"] == hits
    assert rows[tag]["student_names"] == ["Diag_B"]
    assert diag["students_assessed"] == 2

    # Heatmap: A was tested on the concept and is now clear; B still holds it
    a_id, b_id = _student_id(client, student_a), _student_id(client, student_b)
    concept = _concepts(diag)[tag]
    assert concept["tested_count"] == 2 and concept["holding_count"] == 1 and concept["rate"] == 0.5
    assert a_id in concept["tested_ids"] and a_id not in concept["holding_ids"]
    assert concept["holding_ids"] == [b_id]
    assert _quiz_tags() <= set(_concepts(diag))  # every tag the quiz can reveal shows up, even with nobody holding it
    assert {r["id"] for r in diag["roster"]} == {a_id, b_id} and diag["students_tested"] == 2
    assert diag["alerts"] == []  # two students is too small a sample for an alert

    assert client.get("/api/teacher/diagnostics", headers=student_a).status_code == 403


def test_contest_entries_feed_diagnostics_but_stay_private(client, teacher, diagnostic_quiz):
    me = _new_teacher(client, "teacher_contest")
    student = _new_student(client, me, "contest_kid")
    r = client.post("/api/tournaments", headers=me, json={
        "title": "Forces Cup", "subject": "Science", "age_group": "all", "scope": "class",
        "quiz_id": diagnostic_quiz["id"], "duration_days": 3})
    assert r.status_code == 200, r.text
    contest_id = r.json()["id"]
    assert client.post(f"/api/tournaments/{contest_id}/join", headers=student).status_code == 200

    tag = "heavier-falls-faster"
    answers, hits = _quiz_answers(tag)
    r = client.post(f"/api/tournaments/{contest_id}/submit", json={"answers": answers}, headers=student)
    assert r.status_code == 200, r.text

    diag = _diagnostics(client, me)
    assert diag["students_assessed"] == 1
    assert _by_tag(diag)[tag]["occurrences"] == hits

    ranking = client.get(f"/api/tournaments/{contest_id}", headers=student).json()["ranking"]
    assert ranking and all("misconceptions" not in e and "answers" not in e for e in ranking)
    mine = next(t for t in client.get("/api/tournaments", headers=student).json() if t["id"] == contest_id)
    assert "misconceptions" not in mine["my_entry"] and "answers" not in mine["my_entry"]
    assert client.post(f"/api/tournaments/{contest_id}/submit", json={"answers": answers},
                       headers=student).status_code == 400  # one shot


def test_blank_arena_attempt_tests_nothing(client, teacher, arena):
    me = _new_teacher(client, "teacher_blank")
    student = _new_student(client, me, "blank_kid")
    lever = _seed_challenge("Does a Lever Save Work?")
    _attempt(client, student, arena[lever["title"]]["id"], seconds_used=120)  # timer ran out, nothing picked
    diag = _diagnostics(client, me)
    assert lever["misconception"] not in _concepts(diag)
    assert diag["students_tested"] == 0 and diag["roster"][0]["tested_count"] == 0


def test_contest_marks_every_quiz_concept_as_tested(client, teacher, diagnostic_quiz):
    me = _new_teacher(client, "teacher_contest_heat")
    student = _new_student(client, me, "contest_heat_kid")
    contest = client.post("/api/tournaments", headers=me, json={
        "title": "Heat Cup", "subject": "Science", "age_group": "all", "scope": "class",
        "quiz_id": diagnostic_quiz["id"], "duration_days": 3}).json()
    assert client.post(f"/api/tournaments/{contest['id']}/join", headers=student).status_code == 200
    answers, _ = _quiz_answers()
    assert client.post(f"/api/tournaments/{contest['id']}/submit", json={"answers": answers}, headers=student).status_code == 200
    concepts = _concepts(_diagnostics(client, me))
    assert set(concepts) == _quiz_tags()
    assert all(r["tested_count"] == 1 and r["holding_count"] == 0 for r in concepts.values())


def test_alerts_need_a_real_sample(client, teacher, diagnostic_quiz):
    me = _new_teacher(client, "teacher_alerts")
    kids = [_new_student(client, me, f"alert_kid_{i}") for i in range(5)]
    quiz_url = f"/api/quizzes/{diagnostic_quiz['id']}/attempt"
    for i, kid in enumerate(kids):
        # Everyone holds motion-implies-force; only two hold heavier-falls-faster
        tags = ("motion-implies-force", "heavier-falls-faster") if i < 2 else ("motion-implies-force",)
        answers, _ = _quiz_answers(*tags)
        assert client.post(quiz_url, json={"answers": answers}, headers=kid).status_code == 200

    diag = _diagnostics(client, me)
    alerts = {a["tag"]: a for a in diag["alerts"]}
    assert alerts["motion-implies-force"]["level"] == "red"
    assert alerts["motion-implies-force"]["tested_count"] == 5 and alerts["motion-implies-force"]["rate"] == 1.0
    # 2 of 5 is 40%, but fewer than 3 students hold it, so it's only worth watching
    assert alerts["heavier-falls-faster"]["level"] == "watch" and alerts["heavier-falls-faster"]["holding_count"] == 2
    assert set(alerts) == {"motion-implies-force", "heavier-falls-faster"}
    assert diag["alert_rule"]["min_tested"] == server.DIAG_ALERT_MIN_TESTED
    assert diag["concepts"][0]["tag"] == "motion-implies-force"  # highest rate first


# ---------------- Health-check regressions ----------------
def test_teacher_cannot_take_over_another_teachers_student(client):
    mine, theirs = _new_teacher(client, "teacher_keep"), _new_teacher(client, "teacher_grab")
    kid = _new_student(client, mine, "kept_kid")
    kid_id = _student_id(client, kid)
    r = client.post(f"/api/teacher/add-student/{kid_id}", headers=theirs)
    assert r.status_code == 400 and r.json()["detail"] == "Student already has a teacher"
    assert client.post(f"/api/teacher/add-student/{kid_id}", headers=mine).json()["detail"] == "Already your student"
    assert client.get("/api/auth/me", headers=kid).json()["teacher_name"] == "Teacher_Keep"
    assert _diagnostics(client, theirs)["students_total"] == 0


def test_parallel_submits_pay_only_the_first_attempt(client, teacher, arena, monkeypatch):
    student = _new_student(client, teacher, "arena_parallel")
    seed = ARENA_CHALLENGES[2]
    cid = arena[seed["title"]]["id"]
    body = {"selected_step": seed["flawed_step"], "selected_explanation": seed["correct_explanation"]}

    # Real Motor yields to the event loop on every query; mongomock never does, which hides races
    collection_cls = type(server.db.arena_attempts)
    original = collection_cls.find_one

    async def yielding_find_one(self, *args, **kwargs):
        result = await original(self, *args, **kwargs)
        await asyncio.sleep(0.01)
        return result
    monkeypatch.setattr(collection_cls, "find_one", yielding_find_one)

    async def burst():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as ac:
            return await asyncio.gather(*[ac.post(f"/api/arena/challenges/{cid}/attempt", json=body, headers=student)
                                          for _ in range(5)])
    responses = client.portal.call(burst)
    assert [r.status_code for r in responses] == [200] * 5
    assert sum(r.json()["first_attempt"] for r in responses) == 1
    assert sum(r.json()["points_earned"] for r in responses) == 100
    me = client.get("/api/auth/me", headers=student).json()
    assert me["points"] == 100
    assert client.get("/api/stats/me", headers=student).json()["debug_rating"] == \
        next(r.json()["rating"]["after"] for r in responses if r.json()["first_attempt"])


def test_arena_retry_cannot_erase_a_logged_misconception(client, arena):
    me = _new_teacher(client, "teacher_retry")
    kid = _new_student(client, me, "retry_kid")
    late = _new_student(client, me, "late_kid")
    seed = _seed_challenge("Does a Lever Save Work?")
    cid = arena[seed["title"]]["id"]
    wrong = (seed["flawed_step"] + 1) % len(seed["steps"])

    first = _attempt(client, kid, cid, selected_step=wrong)
    _attempt(client, kid, cid, seconds_used=120)  # blank retry: no evidence
    _attempt(client, kid, cid, selected_step=first["flawed_step"],  # retry with the revealed answer
             selected_explanation=first["correct_explanation"])
    _attempt(client, late, cid, seconds_used=120)  # blank first try, then a real one
    _attempt(client, late, cid, selected_step=wrong)

    concept = _concepts(_diagnostics(client, me))[seed["misconception"]]
    assert set(concept["holding_ids"]) == set(concept["tested_ids"]) == {_student_id(client, kid), _student_id(client, late)}


def test_contests_test_only_the_concepts_a_student_answered(client, diagnostic_quiz):
    me = _new_teacher(client, "teacher_contest_answered")
    blank, legacy = _new_student(client, me, "contest_blank"), _new_student(client, me, "contest_legacy")
    contest = client.post("/api/tournaments", headers=me, json={
        "title": "Empty Cup", "subject": "Science", "age_group": "all", "scope": "class",
        "quiz_id": diagnostic_quiz["id"], "duration_days": 3}).json()
    for kid in (blank, legacy):
        assert client.post(f"/api/tournaments/{contest['id']}/join", headers=kid).status_code == 200
    assert client.post(f"/api/tournaments/{contest['id']}/submit", json={"answers": []}, headers=blank).status_code == 200
    diag = _diagnostics(client, me)
    assert diag["concepts"] == [] and diag["students_tested"] == 0 and diag["students_assessed"] == 1

    # An entry submitted before answers were stored: the old contest UI forced an answer to every
    # question, so it tests every concept (counting only its hits would read as a 100% rate)
    legacy_id = _student_id(client, legacy)
    client.portal.call(server.db.tournament_entries.update_one,
                       {"tournament_id": contest["id"], "student_id": legacy_id},
                       {"$set": {"score": 80, "completed_at": "2026-09-01T10:00:00+00:00",
                                 "misconceptions": [{"question_index": 0, "selected": "x", "tag": "impetus"}]}})
    concepts = _concepts(_diagnostics(client, me))
    assert set(concepts) == _quiz_tags()
    assert all(r["tested_ids"] == [legacy_id] for r in concepts.values())
    assert concepts["impetus"]["holding_ids"] == [legacy_id]
    assert all(r["holding_count"] == 0 for tag, r in concepts.items() if tag != "impetus")


def test_registration_limit_is_shared_through_the_database(client, monkeypatch):
    monkeypatch.setattr(server, "REGISTER_MAX", 2)
    client.portal.call(server.db.register_attempts.delete_many, {})
    body = lambda u: {"email": f"{u}@example.com", "username": u, "password": "Passw0rd!x",  # noqa: E731
                      "full_name": u, "role": "student", "age": 15}
    assert client.post("/api/auth/register", json=body("reg_limit_a")).status_code == 200
    assert client.post("/api/auth/register", json=body("reg_limit_b")).status_code == 200
    assert client.post("/api/auth/register", json=body("reg_limit_c")).status_code == 429
    assert client.portal.call(server.db.register_attempts.count_documents, {}) == 3  # refused tries count too
    assert not hasattr(server, "_rate_buckets")  # no per-process state left to drift between instances


def test_parallel_contest_submits_are_one_shot(client, diagnostic_quiz, monkeypatch):
    me = _new_teacher(client, "teacher_contest_race")
    kid = _new_student(client, me, "contest_race_kid")
    contest = client.post("/api/tournaments", headers=me, json={
        "title": "Race Cup", "subject": "Science", "age_group": "all", "scope": "class",
        "quiz_id": diagnostic_quiz["id"], "duration_days": 3}).json()
    assert client.post(f"/api/tournaments/{contest['id']}/join", headers=kid).status_code == 200
    before = client.get("/api/auth/me", headers=kid).json()["points"]
    answers, _ = _quiz_answers()

    collection_cls = type(server.db.tournament_entries)
    original = collection_cls.find_one

    async def yielding_find_one(self, *args, **kwargs):
        result = await original(self, *args, **kwargs)
        await asyncio.sleep(0.01)
        return result
    monkeypatch.setattr(collection_cls, "find_one", yielding_find_one)

    async def burst():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as ac:
            return await asyncio.gather(*[ac.post(f"/api/tournaments/{contest['id']}/submit",
                                                  json={"answers": answers}, headers=kid) for _ in range(3)])
    codes = sorted(r.status_code for r in client.portal.call(burst))
    assert codes == [200, 400, 400]
    assert client.get("/api/auth/me", headers=kid).json()["points"] == before + server.TOURNAMENT_POINTS
