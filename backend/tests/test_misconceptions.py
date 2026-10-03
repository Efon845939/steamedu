"""Misconception diagnostic engine — step 1 (tagging + logging).

Runs in-process against mongomock, so it needs no live server:
    pip install mongomock-motor httpx pytest
    pytest backend/tests/test_misconceptions.py
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


@pytest.fixture(scope="module")
def student(client):
    teacher = _register(client, "teacher_m", role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])
    assert client.post("/api/seed-data", headers=teacher).status_code == 200
    return _register(client, "student_m")


@pytest.fixture(scope="module")
def diagnostic_quiz(client, student):
    quizzes = client.get("/api/quizzes").json()
    return next(q for q in quizzes if q["title"] == DIAGNOSTIC_TITLE)


def _seed_quiz(title):
    return next(q for q in QUIZZES if q["title"] == title)


def test_seed_tags_are_valid():
    for quiz in QUIZZES:
        for question in quiz["questions"]:
            for option, tag in question.get("misconceptions", {}).items():
                assert option in question["options"], option
                assert option != question["correct_answer"], option
                assert tag in MISCONCEPTIONS, tag


def test_answer_key_and_tags_hidden(client, diagnostic_quiz):
    assert diagnostic_quiz["diagnostic"] is True
    for question in diagnostic_quiz["questions"]:
        assert "correct_answer" not in question
        assert "misconceptions" not in question
    single = client.get(f"/api/quizzes/{diagnostic_quiz['id']}").json()
    assert all("misconceptions" not in q for q in single["questions"])


def test_wrong_tagged_answers_are_logged(client, student, diagnostic_quiz):
    seed = _seed_quiz(DIAGNOSTIC_TITLE)["questions"]
    answers = [{"question_index": 0, "selected": "A forward force that keeps it moving"},
               {"question_index": 1, "selected": "The 1 kg ball"},
               {"question_index": 2, "selected": "Equal in size"}]
    r = client.post(f"/api/quizzes/{diagnostic_quiz['id']}/attempt", json={"answers": answers}, headers=student)
    assert r.status_code == 200, r.text
    logged = r.json()["misconceptions"]
    # Q0 tagged wrong option -> logged; Q1 untagged wrong option -> skipped; Q2 correct -> skipped
    assert logged == [{"question_index": 0, "selected": "A forward force that keeps it moving",
                       "tag": seed[0]["misconceptions"]["A forward force that keeps it moving"]}]


def test_all_correct_logs_nothing(client, student, diagnostic_quiz):
    seed = _seed_quiz(DIAGNOSTIC_TITLE)["questions"]
    answers = [{"question_index": i, "selected": q["correct_answer"]} for i, q in enumerate(seed)]
    r = client.post(f"/api/quizzes/{diagnostic_quiz['id']}/attempt", json={"answers": answers}, headers=student)
    assert r.json()["score"] == 100
    assert r.json()["misconceptions"] == []


def test_untagged_quiz_still_works(client, student):
    quiz = next(q for q in client.get("/api/quizzes").json() if q["title"] != DIAGNOSTIC_TITLE)
    answers = [{"question_index": 0, "selected": "definitely wrong"}]
    r = client.post(f"/api/quizzes/{quiz['id']}/attempt", json={"answers": answers}, headers=student)
    assert r.status_code == 200
    assert r.json()["misconceptions"] == []
