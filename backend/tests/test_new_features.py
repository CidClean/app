"""Backend tests for new features: change-password, media upload, hero/about images, booking lat/lng."""
import io
import struct
import zlib
import pytest
import requests


def _make_png_bytes(width: int = 4, height: int = 4) -> bytes:
    """Build a tiny valid PNG in-memory (no external libs)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b""
    for _ in range(height):
        raw += b"\x00" + b"\xff\x00\x00" * width  # filter=0 + red row
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


# ---------------- Change Password ----------------

class TestChangePassword:
    """Password change tests. IMPORTANT: revert to original at end of class."""

    def test_change_password_no_token(self, api_base):
        r = requests.post(f"{api_base}/admin/change-password",
                          json={"current_password": "x", "new_password": "yyyyyyyy"})
        assert r.status_code == 401

    def test_change_password_wrong_current(self, api_base, auth_headers):
        r = requests.post(f"{api_base}/admin/change-password", headers=auth_headers,
                          json={"current_password": "WrongOne!", "new_password": "abcdefgh"})
        assert r.status_code == 401

    def test_change_password_too_short(self, api_base, auth_headers):
        r = requests.post(f"{api_base}/admin/change-password", headers=auth_headers,
                          json={"current_password": "Miguel2026!", "new_password": "short"})
        assert r.status_code == 400

    def test_change_password_success_then_revert(self, api_base, api_client, auth_headers):
        old_pw = "Miguel2026!"
        new_pw = "TempTest2026!"

        # Change
        r = requests.post(f"{api_base}/admin/change-password", headers=auth_headers,
                          json={"current_password": old_pw, "new_password": new_pw})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Old password no longer works
        r_old = api_client.post(f"{api_base}/admin/login",
                                json={"email": "Suarezmaiky25@gmail.com", "password": old_pw})
        assert r_old.status_code == 401

        # New password works
        r_new = api_client.post(f"{api_base}/admin/login",
                                json={"email": "Suarezmaiky25@gmail.com", "password": new_pw})
        assert r_new.status_code == 200
        new_token = r_new.json()["token"]

        # Revert using new token
        revert_headers = {"Authorization": f"Bearer {new_token}", "Content-Type": "application/json"}
        r_rev = requests.post(f"{api_base}/admin/change-password", headers=revert_headers,
                              json={"current_password": new_pw, "new_password": old_pw})
        assert r_rev.status_code == 200, f"REVERT FAILED: {r_rev.text}"

        # Verify old password works again
        r_final = api_client.post(f"{api_base}/admin/login",
                                  json={"email": "Suarezmaiky25@gmail.com", "password": old_pw})
        assert r_final.status_code == 200, "Password revert verification failed!"


# ---------------- Media Upload / Files ----------------

class TestMediaUpload:
    def test_upload_requires_auth(self, api_base):
        png = _make_png_bytes()
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{api_base}/admin/upload", files=files, data={"category": "gallery"})
        assert r.status_code == 401

    def test_upload_rejects_non_image(self, api_base, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        r = requests.post(f"{api_base}/admin/upload", files=files,
                          data={"category": "gallery"}, headers=headers)
        assert r.status_code == 400

    def test_upload_valid_png_and_full_media_lifecycle(self, api_base, admin_token, auth_headers):
        headers = {"Authorization": f"Bearer {admin_token}"}
        png = _make_png_bytes()
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{api_base}/admin/upload", files=files,
                          data={"category": "gallery"}, headers=headers)
        assert r.status_code == 200, r.text
        doc = r.json()

        # Required fields
        for field in ("id", "storage_path", "file_url", "content_type", "size", "category", "active"):
            assert field in doc, f"missing field {field} in upload response"
        assert doc["content_type"] == "image/png"
        assert doc["size"] == len(png)
        assert doc["category"] == "gallery"
        assert doc["active"] is True
        assert doc["file_url"].startswith("/api/files/")
        assert doc["storage_path"] in doc["file_url"]
        assert "_id" not in doc

        media_id = doc["id"]
        storage_path = doc["storage_path"]

        # GET /api/files/{storage_path} → serves bytes
        r_file = requests.get(f"{api_base}/files/{storage_path}")
        assert r_file.status_code == 200, r_file.text
        assert r_file.content == png
        assert r_file.headers.get("Content-Type", "").startswith("image/png")
        # Backend sets `Cache-Control: public, max-age=31536000`, but the preview
        # ingress/Cloudflare rewrites it. Just assert the header is present.
        assert r_file.headers.get("Cache-Control")

        # GET /api/media?category=gallery → contains our item (active only)
        r_list = requests.get(f"{api_base}/media", params={"category": "gallery"})
        assert r_list.status_code == 200
        items = r_list.json()
        assert any(m["id"] == media_id for m in items)
        assert all(m.get("active") is True for m in items)
        assert all("_id" not in m for m in items)

        # GET /api/admin/media → lists all (including we'll soon deactivate)
        r_admin_all = requests.get(f"{api_base}/admin/media", headers=auth_headers)
        assert r_admin_all.status_code == 200
        assert any(m["id"] == media_id for m in r_admin_all.json())

        # PUT /api/admin/media/{id} updates alt_text and active
        r_upd = requests.put(f"{api_base}/admin/media/{media_id}", headers=auth_headers,
                             json={"alt_text": "TEST_ALT", "active": True})
        assert r_upd.status_code == 200

        r_admin_check = requests.get(f"{api_base}/admin/media", headers=auth_headers)
        my = next(m for m in r_admin_check.json() if m["id"] == media_id)
        assert my["alt_text"] == "TEST_ALT"
        assert my["active"] is True

        # DELETE (soft) → mark inactive
        r_del = requests.delete(f"{api_base}/admin/media/{media_id}", headers=auth_headers)
        assert r_del.status_code == 200

        # Public /api/media should NOT include it now
        r_pub2 = requests.get(f"{api_base}/media", params={"category": "gallery"})
        assert not any(m["id"] == media_id for m in r_pub2.json())

        # Admin still sees it, and active=False
        r_admin2 = requests.get(f"{api_base}/admin/media", headers=auth_headers)
        my2 = next(m for m in r_admin2.json() if m["id"] == media_id)
        assert my2["active"] is False


# ---------------- Site settings hero/about image ----------------

class TestSiteSettingsImages:
    def test_set_hero_and_about_urls(self, api_base, api_client, auth_headers):
        original = api_client.get(f"{api_base}/site-settings").json()
        orig_hero = original.get("hero_image_url", "")
        orig_about = original.get("about_image_url", "")

        new_hero = "/api/files/miguel-suarez-barber/uploads/admin/hero_test.png"
        new_about = "/api/files/miguel-suarez-barber/uploads/admin/about_test.png"
        r = requests.put(f"{api_base}/admin/site-settings", headers=auth_headers,
                         json={"hero_image_url": new_hero, "about_image_url": new_about})
        assert r.status_code == 200
        assert r.json()["hero_image_url"] == new_hero
        assert r.json()["about_image_url"] == new_about

        # Public reflects changes
        r_pub = api_client.get(f"{api_base}/site-settings")
        assert r_pub.status_code == 200
        d = r_pub.json()
        assert d["hero_image_url"] == new_hero
        assert d["about_image_url"] == new_about

        # Restore
        r_res = requests.put(f"{api_base}/admin/site-settings", headers=auth_headers,
                             json={"hero_image_url": orig_hero, "about_image_url": orig_about})
        assert r_res.status_code == 200


# ---------------- Booking with lat/lng ----------------

class TestBookingLatLng:
    def _corte(self, api_base, api_client):
        services = api_client.get(f"{api_base}/services").json()
        return next(s for s in services if s["slug"] == "corte")

    def test_booking_persists_lat_lng(self, api_base, api_client, next_sunday_str, auth_headers):
        corte = self._corte(api_base, api_client)
        slots = api_client.get(f"{api_base}/available-slots", params={
            "service_id": corte["id"], "date_str": next_sunday_str
        }).json()["slots"]
        assert slots, "expected slots on next Sunday"
        # Pick a late slot to avoid conflict with previous test bookings
        chosen = slots[-1]

        lat, lng = 25.5428, -103.4068  # Torreón center
        payload = {
            "service_id": corte["id"], "date": next_sunday_str, "time": chosen,
            "name": "TEST_LatLng", "phone": "8712222222", "address": "TEST addr",
            "neighborhood": "Viñedos", "note": "TEST_geo",
            "latitude": lat, "longitude": lng, "accepted_policies": True,
        }
        r = api_client.post(f"{api_base}/bookings", json=payload)
        assert r.status_code == 200, r.text
        booking = r.json()["booking"]
        assert booking["latitude"] == pytest.approx(lat)
        assert booking["longitude"] == pytest.approx(lng)

        # Verify via admin/bookings
        r_admin = requests.get(f"{api_base}/admin/bookings", headers=auth_headers)
        assert r_admin.status_code == 200
        found = next((b for b in r_admin.json() if b.get("name") == "TEST_LatLng"), None)
        assert found is not None
        assert found.get("latitude") == pytest.approx(lat)
        assert found.get("longitude") == pytest.approx(lng)
