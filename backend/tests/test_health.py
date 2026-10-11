"""Health endpoint used by the deploy guide and uptime monitors. In-process, no live server."""
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


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_reports_db_down(client, monkeypatch):
    async def boom(*_a, **_k):
        raise RuntimeError("no db")

    monkeypatch.setattr(server.db, "command", boom)
    r = client.get("/api/health")
    assert r.status_code == 503
