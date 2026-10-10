"""Pilot report: anonymized, class-level misconception rates before and after a re-teach date.

Runs in-process against mongomock, so it needs no live server:
    pip install -r backend/requirements-dev.txt
    pytest backend/tests/test_pilot_report.py
"""
import csv
import io
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
from seed_data import ARENA_CHALLENGES, QUIZZES  # noqa: E402

DIAGNOSTIC_TITLE = "Forces & Motion: Misconception Check"
TAG = "motion-implies-force"
BEFORE_AT = "2026-10-01T09:00:00+00:00"
AFTER_AT = "2026-10-15T09:00:00+00:00"
WINDOW = {"start": "2026-09-28", "split": "2026-10-08", "end": "2026-10-22"}


def _register(client, username, role="student", **extra):
    body = {"email": f"{username}@example.com", "username": username, "password": "Passw0rd!x",
            "full_name": f"Kid {username.title()}", "role": role, "age": 15, **extra}
    assert client.post("/api/auth/register", json=body).status_code == 200
    r = client.post("/api/auth/login", json={"username": username, "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _new_teacher(client, username):
    return _register(client, username, role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])


def _new_student(client, teacher, username):
    headers = _register(client, username)
    student_id = client.get("/api/auth/me", headers=headers).json()["id"]
    assert client.post(f"/api/teacher/add-student/{student_id}", headers=teacher).status_code == 200
    return headers, student_id


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_registration_rate_limit(client):
    client.portal.call(server.db.register_attempts.delete_many, {})


@pytest.fixture(scope="module")
def seeded(client):
    headers = _new_teacher(client, "teacher_pilot_seed")
    assert client.post("/api/seed-data", headers=headers).status_code == 200
    quiz = next(q for q in client.get("/api/quizzes").json() if q["title"] == DIAGNOSTIC_TITLE)
    arena = {c["title"]: c for c in client.get("/api/arena/challenges", params={"source": "system"},
                                                headers=headers).json()}
    return quiz, arena


def _quiz_answers(*tags):
    seed = next(q for q in QUIZZES if q["title"] == DIAGNOSTIC_TITLE)["questions"]
    answers = []
    for i, q in enumerate(seed):
        tagged = [opt for opt, t in q.get("misconceptions", {}).items() if t in tags]
        answers.append({"question_index": i, "selected": tagged[0] if tagged else q["correct_answer"]})
    return answers


def _stamp(client, collection, user_ids, at):
    """Move every not-yet-stamped record of these students to `at`, so the test controls the timeline."""
    client.portal.call(getattr(server.db, collection).update_many,
                       {"user_id": {"$in": user_ids}, "completed_at": {"$nin": [BEFORE_AT, AFTER_AT]}},
                       {"$set": {"completed_at": at}})


def _report(client, teacher, **params):
    r = client.get("/api/teacher/pilot-report", params={**WINDOW, **params}, headers=teacher)
    assert r.status_code == 200, r.text
    return r


def test_before_after_rates_are_paired_and_anonymous(client, seeded):
    quiz, _ = seeded
    teacher = _new_teacher(client, "teacher_pilot")
    students = [_new_student(client, teacher, f"pilot_{i}") for i in range(6)]
    ids = [sid for _, sid in students]
    url = f"/api/quizzes/{quiz['id']}/attempt"

    for headers, _ in students:  # pre-test: everyone shows the misconception
        assert client.post(url, json={"answers": _quiz_answers(TAG)}, headers=headers).status_code == 200
    _stamp(client, "quiz_attempts", ids, BEFORE_AT)
    for i, (headers, _) in enumerate(students):  # post-test after re-teaching: four of six fixed it
        answers = _quiz_answers() if i < 4 else _quiz_answers(TAG)
        assert client.post(url, json={"answers": answers}, headers=headers).status_code == 200
    _stamp(client, "quiz_attempts", ids, AFTER_AT)

    report = _report(client, teacher).json()
    row = next(r for r in report["misconceptions"] if r["tag"] == TAG)
    assert row["before"] == {"tested": 6, "holding": 6, "rate": 1.0}
    assert row["after"] == {"tested": 6, "holding": 2, "rate": 0.33}
    assert row["paired"] == {"students": 6, "held_before": 6, "held_after": 2, "fixed": 4, "newly_holding": 0}
    assert row["overall"] == {"tested": 6, "holding": 2, "rate": 0.33}  # latest attempt in the window counts

    p = report["participation"]
    assert p["students_enrolled"] == 6
    assert p["before"]["active_students"] == 6 and p["before"]["quiz_attempts"] == 6
    assert p["after"]["assessed_students"] == 6 and p["overall"]["quiz_attempts"] == 12

    # Nothing in the export can name a child
    body = _report(client, teacher).text + _report(client, teacher, format="csv").text
    for sid in ids:
        assert sid not in body
    assert "Kid Pilot" not in body and "pilot_0" not in body


def test_csv_export_downloads_the_same_numbers(client, seeded):
    quiz, _ = seeded
    teacher = _new_teacher(client, "teacher_pilot_csv")
    students = [_new_student(client, teacher, f"pcsv_{i}") for i in range(5)]
    for headers, _ in students:
        assert client.post(f"/api/quizzes/{quiz['id']}/attempt", json={"answers": _quiz_answers(TAG)},
                           headers=headers).status_code == 200
    _stamp(client, "quiz_attempts", [sid for _, sid in students], BEFORE_AT)

    r = _report(client, teacher, format="csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(r.text)))
    head = next(row for row in rows if row and row[0] == "tag")
    line = dict(zip(head, next(row for row in rows if row and row[0] == TAG)))
    assert line["before_tested"] == "5" and line["before_holding"] == "5" and line["before_rate"] == "1.0"
    assert line["after_tested"] == "0" and line["after_holding"] == ""  # nobody measured after: withheld, not 0%


def test_small_groups_are_withheld(client, seeded):
    quiz, _ = seeded
    teacher = _new_teacher(client, "teacher_pilot_small")
    students = [_new_student(client, teacher, f"psmall_{i}") for i in range(2)]
    for headers, _ in students:
        assert client.post(f"/api/quizzes/{quiz['id']}/attempt", json={"answers": _quiz_answers(TAG)},
                           headers=headers).status_code == 200
    _stamp(client, "quiz_attempts", [sid for _, sid in students], BEFORE_AT)

    row = next(r for r in _report(client, teacher).json()["misconceptions"] if r["tag"] == TAG)
    assert row["before"] == {"tested": 2, "holding": None, "rate": None}
    assert row["paired"]["students"] == 0 and row["paired"]["fixed"] is None


def test_arena_retry_after_the_answer_was_shown_is_not_progress(client, seeded):
    _, arena = seeded
    lever = next(c for c in ARENA_CHALLENGES if c["title"] == "Does a Lever Save Work?")
    cid = arena[lever["title"]]["id"]
    teacher = _new_teacher(client, "teacher_pilot_arena")
    students = [_new_student(client, teacher, f"parena_{i}") for i in range(5)]
    ids = [sid for _, sid in students]
    wrong = 0 if lever["flawed_step"] != 0 else 1
    for headers, _ in students:
        assert client.post(f"/api/arena/challenges/{cid}/attempt", json={"selected_step": wrong},
                           headers=headers).status_code == 200
    _stamp(client, "arena_attempts", ids, BEFORE_AT)
    for headers, _ in students:  # they now know the answer; a correct retry must not count as fixed
        assert client.post(f"/api/arena/challenges/{cid}/attempt", json={"selected_step": lever["flawed_step"]},
                           headers=headers).status_code == 200
    _stamp(client, "arena_attempts", ids, AFTER_AT)

    row = next(r for r in _report(client, teacher).json()["misconceptions"] if r["tag"] == lever["misconception"])
    assert row["before"] == {"tested": 5, "holding": 5, "rate": 1.0}
    assert row["after"]["tested"] == 0 and row["paired"]["fixed"] is None


def test_bad_input_and_students_are_refused(client):
    teacher = _new_teacher(client, "teacher_pilot_bad")
    student, _ = _new_student(client, teacher, "pbad_kid")
    url = "/api/teacher/pilot-report"
    assert client.get(url, params={"split": "next week"}, headers=teacher).status_code == 422
    assert client.get(url, params={**WINDOW, "split": "2026-11-30"}, headers=teacher).status_code == 422
    assert client.get(url, params={"start": "2026-10-10", "end": "2026-10-01"}, headers=teacher).status_code == 422
    assert client.get(url, params={"format": "xlsx"}, headers=teacher).status_code == 422
    assert client.get(url, headers=student).status_code == 403
    no_split = client.get(url, headers=teacher).json()
    assert no_split["participation"]["before"] is None and no_split["misconceptions"] == []
