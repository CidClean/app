"""Tests for content blocks (hero/about) and auto-registered clients (from bookings)."""
import os
import requests
import pytest
from datetime import date, timedelta
from pymongo import MongoClient
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _leaks_id(obj):
    """Recursively detect any _id key."""
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_leaks_id(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_leaks_id(x) for x in obj)
    return False


# ---------------- CONTENT BLOCKS ----------------

class TestContentBlocks:
    def test_list_content_blocks_public(self, api_client, api_base):
        r = api_client.get(f"{api_base}/content-blocks")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        keys = {b["section_key"] for b in items}
        assert "about" in keys, f"'about' missing. Got: {keys}"
        assert "hero" in keys, f"'hero' missing. Got: {keys}"
        for b in items:
            assert set(["section_key", "eyebrow", "title", "content", "active"]).issubset(b.keys())
            assert not _leaks_id(b)

    def test_get_about_block(self, api_client, api_base):
        r = api_client.get(f"{api_base}/content-blocks/about")
        assert r.status_code == 200
        b = r.json()
        assert b["section_key"] == "about"
        assert b.get("title")
        assert b.get("content")
        assert not _leaks_id(b)

    def test_get_nonexistent_block_returns_404(self, api_client, api_base):
        r = api_client.get(f"{api_base}/content-blocks/does-not-exist-xyz")
        assert r.status_code == 404

    def test_update_content_block_without_token_401(self, api_client, api_base):
        r = api_client.put(f"{api_base}/admin/content-blocks/about", json={"title": "hack"})
        assert r.status_code == 401

    def test_update_and_revert_about_block(self, api_client, api_base, auth_headers):
        # Snapshot original
        original = api_client.get(f"{api_base}/content-blocks/about").json()
        try:
            new_title = "TEST_TITLE_ABOUT"
            new_content = "TEST_CONTENT_ABOUT_BODY"
            r = api_client.put(
                f"{api_base}/admin/content-blocks/about",
                json={"title": new_title, "content": new_content},
                headers=auth_headers,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["title"] == new_title
            assert body["content"] == new_content
            assert not _leaks_id(body)
            # Verify via public GET
            check = api_client.get(f"{api_base}/content-blocks/about").json()
            assert check["title"] == new_title
            assert check["content"] == new_content
        finally:
            # Revert
            rev = api_client.put(
                f"{api_base}/admin/content-blocks/about",
                json={
                    "eyebrow": original.get("eyebrow", ""),
                    "title": original.get("title", ""),
                    "content": original.get("content", ""),
                    "cta_label": original.get("cta_label", ""),
                    "cta_url": original.get("cta_url", ""),
                    "active": original.get("active", True),
                },
                headers=auth_headers,
            )
            assert rev.status_code == 200
            after = api_client.get(f"{api_base}/content-blocks/about").json()
            assert after["title"] == original["title"]
            assert after["content"] == original["content"]


# ---------------- CLIENTS (auto-registered from bookings) ----------------

def _next_open_day_str():
    """Next Sunday (open_days default = [0] JS-style = Sunday)."""
    today = date.today()
    days_ahead = (6 - today.weekday()) % 7  # Python: Sun=6
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def test_service(api_client, api_base):
    r = api_client.get(f"{api_base}/services")
    assert r.status_code == 200
    services = r.json()
    assert services
    # pick shortest duration to fit multiple bookings in one day
    return sorted(services, key=lambda s: s["duration_minutes"])[0]


def _get_available_slots(api_client, api_base, service_id, date_str):
    r = api_client.get(f"{api_base}/available-slots", params={"service_id": service_id, "date_str": date_str})
    assert r.status_code == 200, r.text
    return r.json().get("slots", [])


def _cleanup_test_clients_and_bookings():
    # Only clean phone_key/phone starting with "999" (our test data namespace)
    _db.clients.delete_many({"phone_key": {"$regex": "^999"}})
    _db.bookings.delete_many({"phone": {"$regex": "^999"}})


class TestClientsAutoRegistration:
    """Bookings should auto-populate the clients collection keyed by phone (normalized)."""

    PHONE_A_RAW = "999 100 0001"   # will normalize to 9991000001
    PHONE_A_ALT = "9991000001"      # same person, different formatting
    PHONE_B_RAW = "9992000002"

    def setup_method(self, method):
        _cleanup_test_clients_and_bookings()

    def teardown_method(self, method):
        _cleanup_test_clients_and_bookings()

    def test_first_booking_creates_client(self, api_client, api_base, test_service):
        date_str = _next_open_day_str()
        slots = _get_available_slots(api_client, api_base, test_service["id"], date_str)
        if not slots:
            pytest.skip(f"No slots available on {date_str}")
        payload = {
            "service_id": test_service["id"],
            "date": date_str,
            "time": slots[0],
            "name": "TEST_ClientA",
            "phone": self.PHONE_A_RAW,
            "address": "TEST Address 1",
            "neighborhood": "Viñedos",
            "note": "",
            "accepted_policies": True,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 200, r.text
        # Verify client created in db (via admin endpoint below in next test)
        client_doc = _db.clients.find_one({"phone_key": "9991000001"}, {"_id": 0})
        assert client_doc is not None, "Client was not auto-created"
        assert client_doc["bookings_count"] == 1
        assert client_doc["name"] == "TEST_ClientA"
        assert client_doc["last_address"] == "TEST Address 1"
        assert client_doc["last_neighborhood"] == "Viñedos"

    def test_second_booking_same_phone_normalized_increments_count(self, api_client, api_base, test_service):
        date_str = _next_open_day_str()
        slots = _get_available_slots(api_client, api_base, test_service["id"], date_str)
        if len(slots) < 2:
            pytest.skip("Not enough slots for 2 bookings on same day")
        # First booking with spaces
        p1 = {
            "service_id": test_service["id"],
            "date": date_str,
            "time": slots[0],
            "name": "TEST_ClientA",
            "phone": self.PHONE_A_RAW,  # "999 100 0001"
            "address": "TEST Address 1",
            "neighborhood": "Viñedos",
            "accepted_policies": True,
        }
        r1 = api_client.post(f"{api_base}/bookings", json=p1)
        assert r1.status_code == 200, r1.text

        # Re-fetch slots to get a non-conflicting time
        slots2 = _get_available_slots(api_client, api_base, test_service["id"], date_str)
        if not slots2:
            pytest.skip("No further slots available after first booking")
        p2 = {
            "service_id": test_service["id"],
            "date": date_str,
            "time": slots2[0],
            "name": "TEST_ClientA_Updated",
            "phone": self.PHONE_A_ALT,  # "9991000001"
            "address": "TEST Address 2 Updated",
            "neighborhood": "Senderos",
            "accepted_policies": True,
        }
        r2 = api_client.post(f"{api_base}/bookings", json=p2)
        assert r2.status_code == 200, r2.text

        # Verify: only ONE client row exists for both formats
        matches = list(_db.clients.find({"phone_key": "9991000001"}, {"_id": 0}))
        assert len(matches) == 1, f"Expected 1 client for normalized phone, got {len(matches)}"
        c = matches[0]
        assert c["bookings_count"] == 2
        assert c["name"] == "TEST_ClientA_Updated"
        assert c["last_address"] == "TEST Address 2 Updated"
        assert c["last_neighborhood"] == "Senderos"

    def test_admin_clients_list_without_token_401(self, api_client, api_base):
        r = api_client.get(f"{api_base}/admin/clients")
        assert r.status_code == 401

    def test_admin_clients_list_and_detail_and_update_and_delete(self, api_client, api_base, auth_headers, test_service):
        date_str = _next_open_day_str()
        slots = _get_available_slots(api_client, api_base, test_service["id"], date_str)
        if not slots:
            pytest.skip("No slots on next open day")
        booking_a = {
            "service_id": test_service["id"],
            "date": date_str,
            "time": slots[0],
            "name": "TEST_ClientA",
            "phone": self.PHONE_A_RAW,
            "address": "TEST Address A",
            "neighborhood": "Viñedos",
            "accepted_policies": True,
        }
        assert api_client.post(f"{api_base}/bookings", json=booking_a).status_code == 200

        # Re-fetch to avoid conflict for ClientB
        slots2 = _get_available_slots(api_client, api_base, test_service["id"], date_str)
        if not slots2:
            pytest.skip("No further slots after first booking")
        booking_b = {
            "service_id": test_service["id"],
            "date": date_str,
            "time": slots2[0],
            "name": "TEST_ClientB",
            "phone": self.PHONE_B_RAW,
            "address": "TEST Address B",
            "neighborhood": "Las Villas",
            "accepted_policies": True,
        }
        assert api_client.post(f"{api_base}/bookings", json=booking_b).status_code == 200

        # LIST
        r = api_client.get(f"{api_base}/admin/clients", headers=auth_headers)
        assert r.status_code == 200
        clients_list = r.json()
        assert not _leaks_id(clients_list)
        my_clients = [c for c in clients_list if c.get("phone_key", "").startswith("999")]
        assert len(my_clients) >= 2
        # Ordered by last_seen_at desc → ClientB should appear before ClientA in our two 999 rows
        idx_a = next(i for i, c in enumerate(my_clients) if c["phone_key"] == "9991000001")
        idx_b = next(i for i, c in enumerate(my_clients) if c["phone_key"] == "9992000002")
        assert idx_b < idx_a, "Clients not ordered by last_seen_at desc"

        client_a = next(c for c in my_clients if c["phone_key"] == "9991000001")
        cid_a = client_a["id"]

        # DETAIL
        r = api_client.get(f"{api_base}/admin/clients/{cid_a}", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "client" in body and "bookings" in body
        assert body["client"]["id"] == cid_a
        assert len(body["bookings"]) >= 1
        assert not _leaks_id(body)

        # UPDATE notes + tags
        r = api_client.put(
            f"{api_base}/admin/clients/{cid_a}",
            json={"notes": "TEST_notes_value", "tags": ["vip", "TEST_tag"]},
            headers=auth_headers,
        )
        assert r.status_code == 200
        updated = _db.clients.find_one({"id": cid_a}, {"_id": 0})
        assert updated["notes"] == "TEST_notes_value"
        assert updated["tags"] == ["vip", "TEST_tag"]

        # DELETE client (bookings should remain)
        bookings_before = _db.bookings.count_documents({"phone": self.PHONE_A_RAW})
        r = api_client.delete(f"{api_base}/admin/clients/{cid_a}", headers=auth_headers)
        assert r.status_code == 200
        assert _db.clients.find_one({"id": cid_a}) is None
        bookings_after = _db.bookings.count_documents({"phone": self.PHONE_A_RAW})
        assert bookings_after == bookings_before, "Deleting client must NOT delete their bookings"


# ---------------- Final safety cleanup ----------------

def teardown_module(module):
    _cleanup_test_clients_and_bookings()
