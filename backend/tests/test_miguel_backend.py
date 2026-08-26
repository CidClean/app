"""Backend tests for Miguel Suárez barber app (public + admin flows)."""
import pytest
import requests


# ---------------- Public GETs / seed data ----------------

class TestSeedData:
    def test_services_seeded(self, api_base, api_client):
        r = api_client.get(f"{api_base}/services")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 5
        # No mongo _id
        assert all("_id" not in s for s in data)
        # Verify expected slugs, prices, durations
        by_slug = {s["slug"]: s for s in data}
        assert by_slug["corte"]["price"] == 400 and by_slug["corte"]["duration_minutes"] == 40
        assert by_slug["barba"]["price"] == 280 and by_slug["barba"]["duration_minutes"] == 30
        assert by_slug["corte-barba"]["price"] == 550 and by_slug["corte-barba"]["duration_minutes"] == 70
        assert by_slug["corte-barba-facial"]["price"] == 600 and by_slug["corte-barba-facial"]["duration_minutes"] == 90
        assert by_slug["corte-nino"]["price"] == 300 and by_slug["corte-nino"]["duration_minutes"] == 40
        # buffer default 20
        assert all(s.get("buffer_minutes") == 20 for s in data)

    def test_zones_seeded(self, api_base, api_client):
        r = api_client.get(f"{api_base}/zones")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 4
        names = [z["neighborhood"] for z in data]
        for expected in ["Viñedos", "Senderos", "Las Villas", "San Isidro"]:
            assert expected in names
        assert all(z["featured"] is True for z in data)
        assert all("_id" not in z for z in data)

    def test_faqs_seeded(self, api_base, api_client):
        r = api_client.get(f"{api_base}/faqs")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 10
        pending = [f for f in data if f.get("pending_confirmation")]
        assert len(pending) == 2
        assert all("_id" not in f for f in data)

    def test_policies_seeded(self, api_base, api_client):
        r = api_client.get(f"{api_base}/policies")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 11
        assert all("content" in p and "_id" not in p for p in data)

    def test_booking_settings_defaults(self, api_base, api_client):
        r = api_client.get(f"{api_base}/booking-settings")
        assert r.status_code == 200
        data = r.json()
        assert "_id" not in data
        assert data["open_days"] == [0]
        assert data["open_hour"] == 11
        assert data["close_hour"] == 18
        assert data["min_notice_minutes"] == 60
        assert data["slot_step_minutes"] == 15

    def test_site_settings_defaults(self, api_base, api_client):
        r = api_client.get(f"{api_base}/site-settings")
        assert r.status_code == 200
        data = r.json()
        assert "_id" not in data
        assert data["business_name"] == "Miguel Suárez"
        assert data["email"] == "Suarezmaiky25@gmail.com"
        assert data["whatsapp"] == "528714633372"

    def test_testimonials_empty(self, api_base, api_client):
        r = api_client.get(f"{api_base}/testimonials")
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Available slots ----------------

class TestAvailableSlots:
    def test_slots_on_open_sunday(self, api_base, api_client, next_sunday_str):
        # Find the "Corte de cabello" service (40 min)
        services = api_client.get(f"{api_base}/services").json()
        corte = next(s for s in services if s["slug"] == "corte")
        r = api_client.get(f"{api_base}/available-slots", params={
            "service_id": corte["id"], "date_str": next_sunday_str
        })
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == next_sunday_str
        slots = data["slots"]
        assert isinstance(slots, list) and len(slots) > 0
        # first must be >= 11:00, last start must allow 40-min service to end by 18:00 => last start 17:20
        assert slots[0] >= "11:00"
        assert slots[-1] <= "17:20"
        # Ensure no slot starts before 11:00
        assert all(s >= "11:00" for s in slots)

    def test_slots_on_closed_day(self, api_base, api_client, next_monday_str):
        services = api_client.get(f"{api_base}/services").json()
        corte = next(s for s in services if s["slug"] == "corte")
        r = api_client.get(f"{api_base}/available-slots", params={
            "service_id": corte["id"], "date_str": next_monday_str
        })
        assert r.status_code == 200
        data = r.json()
        assert data["slots"] == []
        assert data.get("reason") == "closed"


# ---------------- Bookings ----------------

class TestBookings:
    def _corte(self, api_base, api_client):
        services = api_client.get(f"{api_base}/services").json()
        return next(s for s in services if s["slug"] == "corte")

    def _facial(self, api_base, api_client):
        services = api_client.get(f"{api_base}/services").json()
        return next(s for s in services if s["slug"] == "corte-barba-facial")

    def test_booking_rejects_policies_false(self, api_base, api_client, next_sunday_str):
        corte = self._corte(api_base, api_client)
        payload = {
            "service_id": corte["id"], "date": next_sunday_str, "time": "11:00",
            "name": "TEST_User", "phone": "8711111111", "address": "TEST addr",
            "neighborhood": "Viñedos", "note": "", "accepted_policies": False,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 400

    def test_booking_rejects_after_close_hour(self, api_base, api_client, next_sunday_str):
        # 90-min service starting at 17:00 -> ends 18:30, must be rejected
        facial = self._facial(api_base, api_client)
        payload = {
            "service_id": facial["id"], "date": next_sunday_str, "time": "17:00",
            "name": "TEST_User", "phone": "8711111111", "address": "TEST addr",
            "neighborhood": "Viñedos", "note": "", "accepted_policies": True,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 400

    def test_booking_rejects_non_open_day(self, api_base, api_client, next_monday_str):
        corte = self._corte(api_base, api_client)
        payload = {
            "service_id": corte["id"], "date": next_monday_str, "time": "12:00",
            "name": "TEST_User", "phone": "8711111111", "address": "TEST addr",
            "neighborhood": "Viñedos", "note": "", "accepted_policies": True,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 400

    def test_booking_success_and_conflict(self, api_base, api_client, next_sunday_str, auth_headers):
        corte = self._corte(api_base, api_client)
        # Pick a slot from availability to guarantee valid time (avoid min_notice edge)
        slots = api_client.get(f"{api_base}/available-slots", params={
            "service_id": corte["id"], "date_str": next_sunday_str
        }).json()["slots"]
        assert slots, "expected available slots on next Sunday"
        chosen = slots[len(slots) // 2]  # middle slot
        payload = {
            "service_id": corte["id"], "date": next_sunday_str, "time": chosen,
            "name": "TEST_User", "phone": "8711111111", "address": "TEST addr",
            "neighborhood": "Viñedos", "note": "TEST", "accepted_policies": True,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "booking" in body and "message" in body
        booking = body["booking"]
        assert booking["service_id"] == corte["id"]
        assert booking["service_price"] == 400
        assert "_id" not in booking

        # Conflict on same slot
        r2 = api_client.post(f"{api_base}/bookings", json=payload)
        assert r2.status_code == 409

        # Cleanup: delete via admin (add DELETE endpoint if available) — no public delete;
        # mark cancelled through DB is not possible; use admin endpoint if exists.
        # Since no admin/bookings delete endpoint exists, we accept the created TEST booking.

    def test_booking_verify_persisted_via_admin(self, api_base, api_client, auth_headers):
        r = requests.get(f"{api_base}/admin/bookings", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(b.get("name") == "TEST_User" for b in items)


# ---------------- Admin auth ----------------

class TestAdminAuth:
    def test_login_success(self, api_base, api_client, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_wrong_password(self, api_base, api_client):
        r = api_client.post(f"{api_base}/admin/login",
                            json={"email": "Suarezmaiky25@gmail.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/admin/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"].lower() == "suarezmaiky25@gmail.com"

    def test_me_without_token(self, api_base):
        r = requests.get(f"{api_base}/admin/me")
        assert r.status_code == 401

    def test_admin_bookings_requires_auth(self, api_base):
        r = requests.get(f"{api_base}/admin/bookings")
        assert r.status_code == 401


# ---------------- Admin CRUD ----------------

class TestAdminServicesCRUD:
    def test_create_update_delete_service(self, api_base, auth_headers):
        # Create
        payload = {
            "name": "TEST_Servicio", "short_description": "temp", "full_description": "temp",
            "price": 123, "duration_minutes": 25, "buffer_minutes": 15,
            "active": True, "display_order": 99,
        }
        r = requests.post(f"{api_base}/admin/services", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        sid = created["id"]
        assert created["slug"] == "test-servicio"

        # Update
        payload_upd = {**payload, "name": "TEST_Servicio_Upd", "price": 200}
        r2 = requests.put(f"{api_base}/admin/services/{sid}", headers=auth_headers, json=payload_upd)
        assert r2.status_code == 200

        # Verify via GET
        r3 = requests.get(f"{api_base}/services", params={"all": "true"})
        assert r3.status_code == 200
        found = next((s for s in r3.json() if s["id"] == sid), None)
        assert found is not None and found["price"] == 200 and found["name"] == "TEST_Servicio_Upd"

        # Delete
        r4 = requests.delete(f"{api_base}/admin/services/{sid}", headers=auth_headers)
        assert r4.status_code == 200

        # Verify gone
        r5 = requests.get(f"{api_base}/services", params={"all": "true"})
        assert not any(s["id"] == sid for s in r5.json())


class TestAdminSettings:
    def test_update_booking_settings_and_restore(self, api_base, auth_headers):
        # Update: include weekdays
        new_days = [0, 1, 3, 5]  # Sun, Mon, Wed, Fri
        r = requests.put(f"{api_base}/admin/booking-settings", headers=auth_headers,
                         json={"open_days": new_days})
        assert r.status_code == 200
        assert r.json()["open_days"] == new_days

        # Verify via public GET
        r2 = requests.get(f"{api_base}/booking-settings")
        assert r2.status_code == 200
        assert r2.json()["open_days"] == new_days

        # Restore to [0]
        r3 = requests.put(f"{api_base}/admin/booking-settings", headers=auth_headers,
                          json={"open_days": [0]})
        assert r3.status_code == 200
        assert r3.json()["open_days"] == [0]

    def test_update_site_settings(self, api_base, auth_headers):
        # Get current
        current = requests.get(f"{api_base}/site-settings").json()
        original_slogan = current.get("slogan", "")
        new_slogan = "TEST_SLOGAN_TEMP"
        r = requests.put(f"{api_base}/admin/site-settings", headers=auth_headers,
                         json={"slogan": new_slogan})
        assert r.status_code == 200
        assert r.json()["slogan"] == new_slogan
        # Verify persisted
        r2 = requests.get(f"{api_base}/site-settings")
        assert r2.json()["slogan"] == new_slogan
        # Restore
        r3 = requests.put(f"{api_base}/admin/site-settings", headers=auth_headers,
                          json={"slogan": original_slogan})
        assert r3.status_code == 200
