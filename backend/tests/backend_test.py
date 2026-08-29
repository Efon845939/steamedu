"""Backend API tests for STEAM Education Platform."""
import os
import re
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    u = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?username(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not u or not pw:
        pytest.skip("credentials not found")
    return {"username": u.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="session")
def quiz_answer_key():
    """Correct answers are no longer exposed via the API, read them from Mongo
    to verify the server still stores and scores against them."""
    from pymongo import MongoClient
    backend_env = dotenv_values("/app/backend/.env")
    mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME missing")
    client = MongoClient(mongo_url)
    key = {}
    for quiz in client[db_name].quizzes.find():
        key[quiz["id"]] = [q.get("correct_answer") for q in quiz.get("questions", [])]
    client.close()
    return key


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json=test_credentials)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token_type"] == "bearer"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20

    def test_login_invalid(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "nope_xyz", "password": "bad"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_missing_field(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "x"})
        assert r.status_code == 422

    def test_register_and_login(self, api_client):
        uniq = str(int(time.time() * 1000))
        payload = {
            "email": f"TEST_user{uniq}@steam.edu",
            "username": f"TEST_user{uniq}",
            "password": "FreshPass123!",
            "full_name": "TEST New User",
        }
        r = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["username"] == payload["username"]
        assert d["email"] == payload["email"]
        assert d["full_name"] == payload["full_name"]
        assert d["is_active"] is True
        assert "password" not in d
        assert isinstance(d["id"], str)
        assert "_id" not in d

        lr = api_client.post(f"{BASE_URL}/api/auth/login",
                             json={"username": payload["username"], "password": payload["password"]})
        assert lr.status_code == 200, lr.text
        tok = lr.json()["access_token"]
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert me.status_code == 200
        assert me.json()["username"] == payload["username"]

    def test_register_duplicate(self, api_client, test_credentials):
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": "teststudent@steam.edu",
            "username": test_credentials["username"],
            "password": "whatever123",
            "full_name": "Dup",
        })
        assert r.status_code == 400

    def test_register_invalid_email(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": "not-an-email", "username": "TEST_bademail",
            "password": "x123456", "full_name": "Bad Email"})
        assert r.status_code == 422

    def test_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)

    def test_me_invalid_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code == 401


# ---------------- Quizzes ----------------
class TestQuizzes:
    def test_list_quizzes(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/quizzes")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        titles = [q["title"] for q in data]
        for expected in ["Basic Science Quiz", "Mathematics Challenge", "Technology & Engineering"]:
            assert expected in titles, f"missing quiz {expected}; got {titles}"
        assert len(data) == 3, f"expected 3 quizzes, got {len(data)}"
        for q in data:
            assert "_id" not in q
            assert len(q["questions"]) > 0
            for qq in q["questions"]:
                assert "question" in qq and "options" in qq
                # SECURITY: correct_answer must never leak in GET responses
                assert "correct_answer" not in qq, f"correct_answer leaked in quiz {q['title']}"

    def test_get_quiz_by_id_no_correct_answer_leak(self, api_client):
        quizzes = api_client.get(f"{BASE_URL}/api/quizzes").json()
        for q in quizzes:
            detail = api_client.get(f"{BASE_URL}/api/quizzes/{q['id']}")
            assert detail.status_code == 200
            for qq in detail.json()["questions"]:
                assert "correct_answer" not in qq, f"correct_answer leaked in GET /quizzes/{q['id']}"

    def test_get_quiz_by_id(self, api_client):
        quizzes = api_client.get(f"{BASE_URL}/api/quizzes").json()
        qid = quizzes[0]["id"]
        r = api_client.get(f"{BASE_URL}/api/quizzes/{qid}")
        assert r.status_code == 200
        assert r.json()["id"] == qid

    def test_get_quiz_not_found(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/quizzes/does-not-exist")
        assert r.status_code == 404

    def test_submit_attempt_all_correct(self, api_client, auth_headers, quiz_answer_key):
        quizzes = api_client.get(f"{BASE_URL}/api/quizzes").json()
        quiz = quizzes[0]
        key = quiz_answer_key[quiz["id"]]
        answers = [{"question_index": i, "selected": key[i]}
                   for i in range(len(quiz["questions"]))]
        r = api_client.post(f"{BASE_URL}/api/quizzes/{quiz['id']}/attempt",
                            json={"answers": answers}, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["score"] == 100, d
        assert d["quiz_id"] == quiz["id"]
        assert "_id" not in d

    def test_submit_attempt_partial(self, api_client, auth_headers, quiz_answer_key):
        quizzes = api_client.get(f"{BASE_URL}/api/quizzes").json()
        quiz = quizzes[0]
        key = quiz_answer_key[quiz["id"]]
        answers = [{"question_index": i, "selected": (key[0] if i == 0 else "WRONG")}
                   for i in range(len(quiz["questions"]))]
        r = api_client.post(f"{BASE_URL}/api/quizzes/{quiz['id']}/attempt",
                            json={"answers": answers}, headers=auth_headers)
        assert r.status_code == 200
        expected = int((1 / len(quiz["questions"])) * 100)
        assert r.json()["score"] == expected

    def test_attempt_requires_auth(self, api_client):
        quizzes = api_client.get(f"{BASE_URL}/api/quizzes").json()
        r = api_client.post(f"{BASE_URL}/api/quizzes/{quizzes[0]['id']}/attempt", json={"answers": []})
        assert r.status_code in (401, 403)

    def test_attempt_invalid_quiz(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/quizzes/bogus-id/attempt",
                            json={"answers": []}, headers=auth_headers)
        assert r.status_code == 404


# ---------------- Activities ----------------
class TestActivities:
    def test_list_activities(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/activities")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 3, f"expected 3 activities, got {len(data)}"
        for a in data:
            assert "_id" not in a
            assert a["content"]["items"] and a["content"]["matches"]
            assert a["difficulty"] in ("Easy", "Medium", "Hard")

    def test_filter_by_subject(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/activities", params={"subject": "Science"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(a["subject"] == "Science" for a in data)

    def test_filter_by_difficulty(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/activities", params={"difficulty": "Hard"})
        assert r.status_code == 200
        assert all(a["difficulty"] == "Hard" for a in r.json())

    def test_filter_no_match(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/activities", params={"subject": "Nonexistent"})
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Ideas ----------------
class TestIdeas:
    created = []

    def test_create_and_list_idea(self, api_client, auth_headers):
        payload = {"title": "TEST_Solar Cooker", "description": "TEST idea description for QA",
                   "category": "Engineering"}
        r = api_client.post(f"{BASE_URL}/api/ideas", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["category"] == payload["category"]
        assert d["likes"] == 0
        assert d["author_name"]
        assert "_id" not in d
        TestIdeas.created.append(d["id"])

        lr = api_client.get(f"{BASE_URL}/api/ideas")
        assert lr.status_code == 200
        ids = [i["id"] for i in lr.json()]
        assert d["id"] in ids, "created idea not persisted/listed"

    def test_filter_ideas_by_category(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/ideas", params={"category": "Engineering"})
        assert r.status_code == 200
        assert all(i["category"] == "Engineering" for i in r.json())

    def test_create_idea_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ideas", json={"title": "x", "description": "y", "category": "Art"})
        assert r.status_code in (401, 403)

    def test_like_idea_increments(self, api_client, auth_headers):
        payload = {"title": "TEST_Like Target", "description": "TEST likes", "category": "Science"}
        idea = api_client.post(f"{BASE_URL}/api/ideas", json=payload, headers=auth_headers).json()
        TestIdeas.created.append(idea["id"])
        r = api_client.post(f"{BASE_URL}/api/ideas/{idea['id']}/like", headers=auth_headers)
        assert r.status_code == 200, r.text
        listed = api_client.get(f"{BASE_URL}/api/ideas").json()
        match = next(i for i in listed if i["id"] == idea["id"])
        assert match["likes"] == 1, match

    def test_like_missing_idea(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/ideas/bogus-id/like", headers=auth_headers)
        assert r.status_code == 404

    def test_create_idea_validation(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/ideas", json={"title": "only title"}, headers=auth_headers)
        assert r.status_code == 422


# ---------------- Seed ----------------
class TestSeed:
    def test_seed_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/seed-data")
        assert r.status_code in (401, 403), f"seed endpoint open to anonymous: {r.status_code}"

    def test_seed_invalid_token(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/seed-data",
                            headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code in (401, 403)

    def test_seed_idempotent(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/seed-data", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quizzes_added"] == 3 and d["activities_added"] == 3
        assert len(api_client.get(f"{BASE_URL}/api/quizzes").json()) == 3
        assert len(api_client.get(f"{BASE_URL}/api/activities").json()) == 3
