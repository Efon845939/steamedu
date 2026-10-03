"""Misconception diagnostic engine — step 2 (Debug Arena + teacher diagnostics).

Runs in-process against mongomock, so it needs no live server:
    pip install mongomock-motor httpx pytest
    pytest backend/tests/test_arena_diagnostics.py
"""
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


@pytest.fixture(scope="module")
def teacher(client):
    headers = _new_teacher(client, "teacher_arena")
    assert client.post("/api/seed-data", headers=headers).status_code == 200
    return headers


@pytest.fixture(scope="module")
def arena(client, teacher):
    return {c["title"]: c for c in client.get("/api/arena/challenges", headers=teacher).json()}


@pytest.fixture(scope="module")
def diagnostic_quiz(client, teacher):
    return next(q for q in client.get("/api/quizzes").json() if q["title"] == DIAGNOSTIC_TITLE)


def _seed_challenge(title):
    return next(c for c in ARENA_CHALLENGES if c["title"] == title)


def _attempt(client, headers, challenge_id, **body):
    r = client.post(f"/api/arena/challenges/{challenge_id}/attempt", json=body, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _quiz_answers(tag=None):
    """All-correct answers for the diagnostic quiz, except options tagged `tag`."""
    seed = next(q for q in QUIZZES if q["title"] == DIAGNOSTIC_TITLE)["questions"]
    answers = []
    for i, q in enumerate(seed):
        tagged = [opt for opt, t in q.get("misconceptions", {}).items() if t == tag]
        answers.append({"question_index": i, "selected": tagged[0] if tagged else q["correct_answer"]})
    hits = sum(1 for a, q in zip(answers, seed) if a["selected"] != q["correct_answer"])
    return answers, hits


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


# ---------------- Arena ----------------
def test_arena_requires_login_and_hides_answers(client, teacher, arena):
    assert client.get("/api/arena/challenges").status_code in (401, 403)
    assert len(arena) == len(ARENA_CHALLENGES)
    for c in arena.values():
        assert not HIDDEN & c.keys(), c["title"]
        single = client.get(f"/api/arena/challenges/{c['id']}", headers=teacher).json()
        assert not HIDDEN & single.keys(), c["title"]


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
    assert ranking and all("misconceptions" not in e for e in ranking)
    mine = next(t for t in client.get("/api/tournaments", headers=student).json() if t["id"] == contest_id)
    assert "misconceptions" not in mine["my_entry"]
