"""Debug Arena — student-written ("peer") scenarios, teacher review, rewards, flags, leaderboards, worksheet.

Runs in-process against mongomock, so it needs no live server:
    pip install mongomock-motor httpx pytest
    pytest backend/tests/test_peer_arena.py
"""
import itertools
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
from seed_data import ARENA_CHALLENGES  # noqa: E402

VALID = {
    "title": "How fast after two seconds?",
    "subject": "Science",
    "problem": "A 2 kg ball is dropped from rest. Ignoring air resistance, how fast is it moving after 2 seconds? (g = 10 m/s²)",
    "steps": [
        "The ball starts from rest, so its initial speed is 0 m/s.",
        "A heavier ball falls faster, so a 2 kg ball gains 20 m/s every second.",
        "After 2 seconds its speed is 2 × 20 = 40 m/s.",
    ],
    "explanations": [
        "Without air resistance every object gains about 10 m/s each second, whatever its mass.",
        "The ball should slow down as it falls.",
        "Speed should be divided by time, not multiplied.",
    ],
    "flawed_step": 1,
    "correct_explanation": "Without air resistance every object gains about 10 m/s each second, whatever its mass.",
    "misconception": "heavier-falls-faster",
    "debrief": "Mass does not change free-fall acceleration, so v = 10 × 2 = 20 m/s.",
    "time_limit_seconds": 90,
}
SOLVER_KEYS = set(server._PUBLIC_ARENA_FIELDS) | {"attempted", "best_score", "solvers", "is_mine", "can_attempt"}
_names = itertools.count()


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_registration_rate_limit():
    # Every TestClient request comes from one IP, so the in-memory registration limit would trip
    server._rate_buckets.clear()


@pytest.fixture(scope="module")
def seeded(client):
    teacher = _register(client, _name("seeder"), role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])
    assert client.post("/api/seed-data", headers=teacher).status_code == 200
    rows = client.get("/api/arena/challenges", params={"source": "system"}, headers=teacher).json()
    return {r["title"]: r["id"] for r in rows}


def _name(prefix):
    return f"peer_{prefix}_{next(_names)}"


def _register(client, username, role="student", **extra):
    body = {"email": f"{username}@example.com", "username": username, "password": "Passw0rd!x",
            "full_name": username.title(), "role": role, "age": 15, **extra}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 200, r.text
    r = client.post("/api/auth/login", json={"username": username, "password": "Passw0rd!x"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


def _class(client, n_students=1, verified=False):
    teacher = _register(client, _name("teacher"), role="teacher", teacher_code=os.environ["TEACHER_SIGNUP_CODE"])
    students = []
    for _ in range(max(n_students, 2 if verified else 0)):
        student = _register(client, _name("student"))
        sid = _me(client, student)["id"]
        assert client.post(f"/api/teacher/add-student/{sid}", headers=teacher).status_code == 200
        students.append(student)
    if verified:
        for i in range(3):
            r = client.post("/api/challenges", headers=teacher, json={"title": f"Task {i}", "type": "task"})
            assert r.status_code == 200, r.text
        assert _me(client, teacher)["verified"] is True
    return teacher, students


def _create(client, author, **overrides):
    return client.post("/api/arena/peer", headers=author, json={**VALID, **overrides})


def _created(client, author, **overrides):
    r = _create(client, author, **overrides)
    assert r.status_code == 200, r.text
    return r.json()


def _review(client, teacher, cid, decision="approve", note="", visibility="class"):
    return client.post(f"/api/teacher/arena/{cid}/review", headers=teacher,
                       json={"decision": decision, "note": note, "visibility": visibility})


def _live(client, teacher, author, **overrides):
    doc = _created(client, author, **overrides)
    r = _review(client, teacher, doc["id"])
    assert r.status_code == 200, r.text
    return r.json()


def _attempt(client, headers, cid, **body):
    return client.post(f"/api/arena/challenges/{cid}/attempt", headers=headers, json=body)


def _solve(client, headers, cid, found=True, explanation=True):
    step = VALID["flawed_step"] if found else 0
    expl = VALID["correct_explanation"] if explanation else VALID["explanations"][1]
    r = _attempt(client, headers, cid, selected_step=step, selected_explanation=expl, seconds_used=30)
    assert r.status_code == 200, r.text
    return r.json()


def _mine(client, author, cid):
    return next(s for s in client.get("/api/arena/peer/mine", headers=author).json()["scenarios"] if s["id"] == cid)


def _visible_ids(client, headers, source="peer"):
    return {c["id"] for c in client.get("/api/arena/challenges", params={"source": source}, headers=headers).json()}


# ---------------- Creating ----------------
def test_create_returns_pending_author_view(client):
    _, (author,) = _class(client)
    doc = _created(client, author)
    me = _me(client, author)
    assert doc["status"] == "pending" and doc["source"] == "peer" and doc["visibility"] == "class"
    assert doc["created_by"] == me["id"] == doc["author_id"]
    assert doc["flawed_step"] == 1 and doc["correct_explanation"] == VALID["correct_explanation"]
    assert doc["stats"] == {"solvers": 0, "finders": 0, "author_points": 0}


@pytest.mark.parametrize("change", [
    {"steps": VALID["steps"][:2]},
    {"steps": [f"Step number {i} of the work" for i in range(9)]},
    {"explanations": VALID["explanations"][:1]},
    {"explanations": VALID["explanations"] + ["Fourth option here", "Fifth option here"]},
    {"explanations": [VALID["explanations"][0], VALID["explanations"][0].upper(), "Something else"]},
    {"flawed_step": -1},
    {"flawed_step": 3},
    {"flawed_step": None},
    {"correct_explanation": "Not one of the options at all"},
    {"misconception": "no-such-tag"},
    {"subject": "Arts"},  # heavier-falls-faster is a Science misconception
    {"subject": "Cooking"},
    {"title": "   "},
    {"steps": ["The ball starts from rest.", "The ball starts from rest.", "So it ends at rest."]},
])
def test_invalid_scenarios_rejected(client, change):
    _, (author,) = _class(client)
    r = _create(client, author, **change)
    assert r.status_code == 400, (change, r.text)


def test_body_cannot_set_server_fields_and_text_is_kept(client):
    _, (author,) = _class(client)
    problem = "Is a<b when a = 2 and b = 3? A student works it out step by step below."
    doc = _created(client, author, problem=problem, status="approved", author_id="someone-else",
                   source="system", created_by="system", visibility="public", approval_rewarded=True)
    assert doc["status"] == "pending" and doc["source"] == "peer" and doc["visibility"] == "class"
    assert doc["author_id"] == doc["created_by"] == _me(client, author)["id"]
    assert doc["approval_rewarded"] is False
    assert doc["problem"] == problem


def test_only_students_with_a_teacher_can_write(client, monkeypatch):
    teacher, (author,) = _class(client)
    assert _create(client, teacher).status_code == 403
    loner = _register(client, _name("loner"))
    assert _create(client, loner).status_code == 400

    for _ in range(server.PEER_MAX_PENDING):
        _created(client, author)
    assert _create(client, author).status_code == 429  # too many waiting for review

    _, (busy,) = _class(client)
    monkeypatch.setattr(server, "PEER_DAILY_LIMIT", 1)
    _created(client, busy)
    assert _create(client, busy).status_code == 429  # daily cap


# ---------------- Visibility ----------------
def test_pending_scenario_is_invisible(client):
    teacher, (author, classmate) = _class(client, 2)
    doc = _created(client, author)
    assert doc["id"] not in _visible_ids(client, classmate)
    assert doc["id"] not in _visible_ids(client, teacher)
    assert client.get(f"/api/arena/challenges/{doc['id']}", headers=classmate).status_code == 404
    assert _attempt(client, classmate, doc["id"], selected_step=1).status_code == 404


def test_approved_scenario_reaches_the_class_only_with_whitelisted_fields(client):
    teacher, (author, classmate) = _class(client, 2)
    _, (outsider,) = _class(client)
    loner = _register(client, _name("loner"))
    doc = _live(client, teacher, author)

    row = next(c for c in client.get("/api/arena/challenges", headers=classmate).json() if c["id"] == doc["id"])
    assert set(row) <= SOLVER_KEYS
    assert row["source"] == "peer" and row["author_name"] == doc["author_name"] and row["can_attempt"] is True
    single = client.get(f"/api/arena/challenges/{doc['id']}", headers=classmate).json()
    assert set(single) <= set(server._PUBLIC_ARENA_FIELDS)
    assert doc["id"] not in _visible_ids(client, outsider)
    assert doc["id"] not in _visible_ids(client, loner)


def test_publishing_to_everyone_needs_a_verified_teacher(client):
    teacher, (author,) = _class(client)
    doc = _created(client, author)
    assert _review(client, teacher, doc["id"], visibility="public").status_code == 403

    verified, (vauthor, _) = _class(client, verified=True)
    _, (outsider,) = _class(client)
    pdoc = _created(client, vauthor)
    assert _review(client, verified, pdoc["id"], visibility="public").status_code == 200
    assert pdoc["id"] in _visible_ids(client, outsider)


def test_authors_and_teachers_cannot_solve_peer_scenarios(client):
    teacher, (author, _) = _class(client, 2)
    doc = _live(client, teacher, author)
    assert _attempt(client, author, doc["id"], selected_step=1).status_code == 403
    assert _attempt(client, teacher, doc["id"], selected_step=1).status_code == 403
    own = next(c for c in client.get("/api/arena/challenges", headers=author).json() if c["id"] == doc["id"])
    assert own["is_mine"] is True and own["can_attempt"] is False


def test_explanations_are_shuffled_per_viewer(client, seeded):
    teacher, (author, a, b) = _class(client, 3)
    doc = _live(client, teacher, author)
    for viewer in (a, b):
        uid = _me(client, viewer)["id"]
        first = client.get(f"/api/arena/challenges/{doc['id']}", headers=viewer).json()["explanations"]
        again = client.get(f"/api/arena/challenges/{doc['id']}", headers=viewer).json()["explanations"]
        assert first == again == server._shuffled(VALID["explanations"], f"{doc['id']}:{uid}")
    sys_id = seeded[ARENA_CHALLENGES[0]["title"]]
    shown = client.get(f"/api/arena/challenges/{sys_id}", headers=a).json()["explanations"]
    assert sorted(shown) == sorted(ARENA_CHALLENGES[0]["explanations"])


# ---------------- Review ----------------
def test_review_permissions_and_send_back_cycle(client):
    teacher, (author,) = _class(client)
    other_teacher, _ = _class(client)
    doc = _created(client, author)

    assert _review(client, other_teacher, doc["id"]).status_code == 404
    assert client.get("/api/teacher/arena/review", headers=author).status_code == 403
    queue = client.get("/api/teacher/arena/review", headers=teacher).json()
    item = next(s for s in queue["scenarios"] if s["id"] == doc["id"])
    assert item["flawed_step"] == 1 and item["misconception_info"]["subject"] == "Science"
    assert queue["counts"]["pending"] >= 1

    assert _review(client, teacher, doc["id"], decision="reject").status_code == 400  # note required
    r = _review(client, teacher, doc["id"], decision="reject", note="Step 3 should use g = 10.")
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    mine = _mine(client, author, doc["id"])
    assert mine["review"]["note"] == "Step 3 should use g = 10." and mine["review"]["decision"] == "reject"

    r = client.put(f"/api/arena/peer/{doc['id']}", headers=author, json={**VALID, "title": "Two seconds of falling"})
    assert r.status_code == 200
    assert r.json()["status"] == "pending" and r.json()["review_reason"] == "edited" and r.json()["revisions"] == 1

    assert _review(client, teacher, doc["id"]).status_code == 200
    assert _review(client, teacher, doc["id"]).status_code == 409  # already reviewed
    assert client.put(f"/api/arena/peer/{doc['id']}", headers=author, json=VALID).status_code == 409


def test_approval_pays_the_author_once_and_awards_a_badge(client):
    teacher, (author,) = _class(client)
    before = client.get("/api/stats/me", headers=author).json()["points"]
    doc = _live(client, teacher, author)
    assert client.get("/api/stats/me", headers=author).json()["points"] == before + server.AUTHOR_APPROVAL_POINTS
    assert _mine(client, author, doc["id"])["stats"]["author_points"] == server.AUTHOR_APPROVAL_POINTS
    earned = {b["key"] for b in client.get("/api/badges", headers=author).json()["badges"] if b["earned"]}
    assert "first_trap" in earned


# ---------------- Solving and rewards ----------------
def test_solver_points_peer_hits_and_ratings(client):
    teacher, (author, finder, misser, half_right) = _class(client, 4)
    doc = _live(client, teacher, author)

    found = _solve(client, finder, doc["id"])
    assert found["score"] == 100 and found["points_earned"] == 50 and found["misconceptions"] == []
    assert found["rating"]["delta"] > 0 and found["community"] == {"solvers": 1, "find_rate": 1.0}

    missed = _solve(client, misser, doc["id"], found=False, explanation=False)
    assert missed["score"] == 0 and missed["points_earned"] == 0
    assert missed["misconceptions"] == [{"tag": "heavier-falls-faster", "selected_step": 0, "source": "peer"}]
    assert missed["rating"]["delta"] < 0

    half = _solve(client, half_right, doc["id"], found=False)  # named the concept but missed the step
    assert half["score"] == 50 and half["points_earned"] == 25

    again = _solve(client, finder, doc["id"])
    assert again["first_attempt"] is False and again["points_earned"] == 0 and again["rating"] is None
    assert again["community"]["solvers"] == 3  # a retry is not a new solver


def test_author_paid_per_solver_up_to_the_cap(client, monkeypatch):
    monkeypatch.setattr(server, "AUTHOR_SOLVER_CAP", 1)
    teacher, (author, a, b) = _class(client, 3)
    doc = _live(client, teacher, author)
    _solve(client, a, doc["id"])
    _solve(client, b, doc["id"])
    _solve(client, a, doc["id"])  # retry: not paid
    expected = server.AUTHOR_APPROVAL_POINTS + server.AUTHOR_SOLVER_POINTS
    assert _mine(client, author, doc["id"])["stats"]["author_points"] == expected


def test_tough_but_fair_scenario_earns_the_bonus_once(client):
    teacher, (author, *solvers) = _class(client, 7)
    doc = _live(client, teacher, author)
    for found, solver in zip([True, True, True, False, False], solvers):
        _solve(client, solver, doc["id"], found=found)
    mine = _mine(client, author, doc["id"])
    assert mine["calibrated"] is True and mine["needs_review"] is False and mine["find_rate"] == 0.6
    paid = server.AUTHOR_APPROVAL_POINTS + 5 * server.AUTHOR_SOLVER_POINTS + server.CALIBRATION_BONUS
    assert mine["stats"]["author_points"] == paid

    _solve(client, solvers[5], doc["id"])  # still inside the band: no second bonus
    assert _mine(client, author, doc["id"])["stats"]["author_points"] == paid + server.AUTHOR_SOLVER_POINTS


def test_scenario_nobody_solves_is_not_rewarded(client):
    teacher, (author, *solvers) = _class(client, 6)
    doc = _live(client, teacher, author)
    for solver in solvers:
        _solve(client, solver, doc["id"], found=False)
    mine = _mine(client, author, doc["id"])
    assert mine["calibrated"] is False and mine["needs_review"] is True
    assert mine["stats"]["author_points"] == server.AUTHOR_APPROVAL_POINTS + 5 * server.AUTHOR_SOLVER_POINTS
    queue = client.get("/api/teacher/arena/review", headers=teacher).json()
    assert any(s["id"] == doc["id"] and s["needs_review"] for s in queue["scenarios"])
    assert queue["counts"]["needs_review"] >= 1


# ---------------- Flags ----------------
def test_flags_take_a_scenario_offline_until_the_teacher_looks(client, seeded):
    teacher, (author, a, b, c) = _class(client, 4)
    doc = _live(client, teacher, author)
    cid = doc["id"]
    flag = lambda h, reason="wrong_answer": client.post(  # noqa: E731
        f"/api/arena/challenges/{cid}/flag", headers=h, json={"reason": reason, "note": "Step 2 looks right to me"})

    assert flag(a).status_code == 400  # must try it first
    assert flag(author, "inappropriate").status_code == 403
    assert flag(teacher, "inappropriate").status_code == 403
    sys_id = seeded[ARENA_CHALLENGES[0]["title"]]
    assert client.post(f"/api/arena/challenges/{sys_id}/flag", headers=a,
                       json={"reason": "inappropriate"}).status_code == 400

    _solve(client, a, cid)
    assert flag(a).json() == {"flagged": True, "hidden": False}
    assert flag(a).status_code == 409
    assert flag(b, "inappropriate").json()["hidden"] is False  # no attempt needed for this reason
    _solve(client, c, cid)
    assert flag(c, "confusing").json()["hidden"] is True

    assert client.get(f"/api/arena/challenges/{cid}", headers=b).status_code == 404
    item = next(s for s in client.get("/api/teacher/arena/review", headers=teacher).json()["scenarios"] if s["id"] == cid)
    assert item["review_reason"] == "flagged" and len(item["open_flags"]) == 3

    points_before = _mine(client, author, cid)["stats"]["author_points"]
    assert _review(client, teacher, cid).status_code == 200
    assert client.get(f"/api/arena/challenges/{cid}", headers=b).status_code == 200
    mine = _mine(client, author, cid)
    assert mine["flag_count"] == 0 and mine["stats"]["author_points"] == points_before  # approval paid once


def test_withdrawing(client):
    teacher, (author, classmate) = _class(client, 2)
    untouched = _created(client, author)
    r = client.delete(f"/api/arena/peer/{untouched['id']}", headers=author)
    assert r.json() == {"deleted": True, "status": "deleted"}

    played = _live(client, teacher, author)
    _solve(client, classmate, played["id"])
    assert client.delete(f"/api/arena/peer/{played['id']}", headers=classmate).status_code == 404
    r = client.delete(f"/api/arena/peer/{played['id']}", headers=author)
    assert r.json() == {"deleted": False, "status": "withdrawn"}
    assert played["id"] not in _visible_ids(client, classmate)


# ---------------- Diagnostics ----------------
def test_peer_misses_feed_diagnostics_only_while_vouched_for(client):
    teacher, (author, a, b, c, d) = _class(client, 5)
    doc = _live(client, teacher, author)
    _solve(client, a, doc["id"], found=False)

    def row():
        diag = client.get("/api/teacher/diagnostics", headers=teacher).json()
        return next((r for r in diag["misconceptions"] if r["tag"] == "heavier-falls-faster"), None)

    assert row()["peer_occurrences"] == 1 and row()["students"] == 1
    off = client.get("/api/teacher/diagnostics", params={"include_peer": False}, headers=teacher).json()
    assert all(r["tag"] != "heavier-falls-faster" for r in off["misconceptions"])

    # Three other classmates report it, which takes it offline: unvetted again, so a's miss stops counting
    for h in (b, c, d):
        _solve(client, h, doc["id"])
        assert client.post(f"/api/arena/challenges/{doc['id']}/flag", headers=h,
                           json={"reason": "confusing"}).status_code == 200
    assert row() is None


# ---------------- Worksheet ----------------
def test_worksheet_gives_teachers_a_consistent_answer_key(client, seeded):
    teacher, (author,) = _class(client)
    other_teacher, (other_author,) = _class(client)
    peer = _live(client, teacher, author)
    pending = _created(client, author)
    foreign = _live(client, other_teacher, other_author)
    sys_title = ARENA_CHALLENGES[3]["title"]
    ids = [seeded[sys_title], peer["id"]]

    r = client.get("/api/teacher/worksheet", params={"ids": ",".join(ids)}, headers=teacher)
    assert r.status_code == 200, r.text
    sheet = r.json()
    for item in sheet["items"]:
        assert not {"flawed_step", "correct_explanation", "misconception", "debrief"} & item.keys()
    for item, key in zip(sheet["items"], sheet["answer_key"]):
        letter = next(e["letter"] for e in item["explanations"] if e["text"] == key["correct_explanation"])
        assert letter == key["correct_letter"]
        assert key["flawed_step_label"] == f"Step {key['flawed_step'] + 1}"
    assert sheet["answer_key"][0]["flawed_step"] == ARENA_CHALLENGES[3]["flawed_step"]
    assert sheet["items"][1]["author_name"] == peer["author_name"]

    assert client.get("/api/teacher/worksheet", params={"ids": ",".join([seeded[sys_title]] * 1 + [f"x{i}" for i in range(10)])},
                      headers=teacher).status_code == 400
    assert client.get("/api/teacher/worksheet", params={"ids": pending["id"]}, headers=teacher).status_code == 404
    assert client.get("/api/teacher/worksheet", params={"ids": foreign["id"]}, headers=teacher).status_code == 404
    assert client.get("/api/teacher/worksheet", params={"ids": peer["id"]}, headers=author).status_code == 403


# ---------------- Leaderboards and badges ----------------
def test_leaderboards(client, seeded):
    teacher, (hunter, misser, author, lurker) = _class(client, 4)
    for title in [c["title"] for c in ARENA_CHALLENGES[:3]]:
        seed = next(c for c in ARENA_CHALLENGES if c["title"] == title)
        _attempt(client, hunter, seeded[title], selected_step=seed["flawed_step"],
                 selected_explanation=seed["correct_explanation"])
        _attempt(client, misser, seeded[title], selected_step=(seed["flawed_step"] + 1) % len(seed["steps"]))
    _attempt(client, lurker, seeded[ARENA_CHALLENGES[0]["title"]], selected_step=0)  # under the 3-attempt minimum
    _live(client, teacher, author)
    _created(client, lurker)  # pending: not on the authors board

    hunters = client.get("/api/arena/leaderboard", params={"scope": "class"}, headers=hunter).json()
    names = [r["full_name"] for r in hunters]
    assert names[0] == _me(client, hunter)["full_name"] and len(names) == 2
    assert hunters[0]["bugs_found"] == 3 and hunters[1]["bugs_found"] == 0
    assert hunters[0]["debug_rating"] > hunters[1]["debug_rating"]

    authors = client.get("/api/arena/leaderboard", params={"board": "authors", "scope": "class"}, headers=teacher).json()
    assert [r["full_name"] for r in authors] == [_me(client, author)["full_name"]]
    assert authors[0]["approved_scenarios"] == 1

    loner = _register(client, _name("loner"))
    assert client.get("/api/arena/leaderboard", params={"scope": "class"}, headers=loner).json() == []


def test_bug_hunter_badge_counts_first_tries_only(client, seeded):
    student = _register(client, _name("hunter"))
    first = ARENA_CHALLENGES[0]
    # Miss first, then retry correctly: the retry must not count as a find
    _attempt(client, student, seeded[first["title"]], selected_step=(first["flawed_step"] + 1) % len(first["steps"]))
    _attempt(client, student, seeded[first["title"]], selected_step=first["flawed_step"])
    for seed in ARENA_CHALLENGES[1:]:
        _attempt(client, student, seeded[seed["title"]], selected_step=seed["flawed_step"])
    stats = client.get("/api/stats/me", headers=student).json()
    assert stats["bugs_found"] == 9 and stats["arena_attempted"] == 10
    badges = client.get("/api/badges", headers=student).json()
    assert badges["total"] == 14
    assert not next(b for b in badges["badges"] if b["key"] == "bug_hunter")["earned"]
