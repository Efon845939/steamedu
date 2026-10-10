"""Class-trial readiness: the "sure or guessing?" check and Turkish text on the diagnostic quiz.

Runs in-process against mongomock, so it needs no live server:
    pip install -r backend/requirements-dev.txt
    pytest backend/tests/test_confidence_tr.py
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
from seed_data import MISCONCEPTIONS, QUIZZES  # noqa: E402

DIAGNOSTIC_TITLE = "Forces & Motion: Misconception Check"
SEED_QUIZ = next(q for q in QUIZZES if q["title"] == DIAGNOSTIC_TITLE)
TAG = "heavier-falls-faster"  # tagged on exactly one question, so one answer decides it


def _register(client, username, role="student", **extra):
    body = {"email": f"{username}@example.com", "username": username, "password": "Passw0rd!x",
            "full_name": username.title(), "role": role, "age": 15, **extra}
    assert client.post("/api/auth/register", json=body).status_code == 200
    r = client.post("/api/auth/login", json={"username": username, "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_registration_rate_limit(client):
    client.portal.call(server.db.register_attempts.delete_many, {})


@pytest.fixture(scope="module")
def teacher(client):
    headers = _register(client, "teacher_conf", role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])
    assert client.post("/api/seed-data", headers=headers).status_code == 200
    return headers


@pytest.fixture(scope="module")
def quiz(client, teacher):
    return next(q for q in client.get("/api/quizzes").json() if q["title"] == DIAGNOSTIC_TITLE)


def _student(client, teacher, username):
    headers = _register(client, username)
    sid = client.get("/api/auth/me", headers=headers).json()["id"]
    assert client.post(f"/api/teacher/add-student/{sid}", headers=teacher).status_code == 200
    return headers


def _answers(confident):
    """Correct everywhere except the heavier-falls-faster question, answered wrong with the given confidence."""
    out = []
    for i, q in enumerate(SEED_QUIZ["questions"]):
        wrong = next((opt for opt, tag in q.get("misconceptions", {}).items() if tag == TAG), None)
        if wrong:
            out.append({"question_index": i, "selected": wrong, "confident": confident})
        else:
            out.append({"question_index": i, "selected": q["correct_answer"], "confident": True})
    return out


def _concept(client, teacher):
    diag = client.get("/api/teacher/diagnostics", headers=teacher).json()
    return {c["tag"]: c for c in diag["concepts"]}.get(TAG)


def test_turkish_text_matches_every_question():
    assert SEED_QUIZ["tr"]["title"] and SEED_QUIZ["tr"]["description"]
    for q in SEED_QUIZ["questions"]:
        # The UI shows tr.options[i] but submits options[i], so the lists must line up one to one
        assert len(q["tr"]["options"]) == len(q["options"]) == len(set(q["tr"]["options"]))
        assert q["tr"]["question"]
    assert all(entry.get("description_tr") for entry in MISCONCEPTIONS.values())


def test_quiz_api_serves_turkish_but_no_answers(client, quiz):
    assert quiz["tr"]["title"] == SEED_QUIZ["tr"]["title"]
    for q in quiz["questions"]:
        assert q["tr"]["options"] and "correct_answer" not in q and "misconceptions" not in q


def test_guess_is_kept_apart_and_tests_nothing(client, teacher, quiz):
    url = f"/api/quizzes/{quiz['id']}/attempt"
    guesser = _student(client, teacher, "conf_guess")
    r = client.post(url, json={"answers": _answers(confident=False)}, headers=guesser)
    assert r.status_code == 200
    assert r.json()["misconceptions"] == []
    assert [g["tag"] for g in r.json()["guessed_misconceptions"]] == [TAG]
    assert _concept(client, teacher) is None  # a guess neither shows the belief nor dilutes the rate

    believer = _student(client, teacher, "conf_sure")
    r = client.post(url, json={"answers": _answers(confident=True)}, headers=believer)
    assert [m["tag"] for m in r.json()["misconceptions"]] == [TAG]
    concept = _concept(client, teacher)
    assert concept["tested_count"] == 1 and concept["holding_count"] == 1
    assert concept["description_tr"] == MISCONCEPTIONS[TAG]["description_tr"]


def test_unasked_confidence_still_counts(client, teacher, quiz):
    # Contests and older clients send no confidence at all: those answers count as before
    plain = _student(client, teacher, "conf_plain")
    answers = [{k: v for k, v in a.items() if k != "confident"} for a in _answers(confident=True)]
    r = client.post(f"/api/quizzes/{quiz['id']}/attempt", json={"answers": answers}, headers=plain)
    assert [m["tag"] for m in r.json()["misconceptions"]] == [TAG]
    assert r.json()["guessed_misconceptions"] == []
