import os

import requests


def _login(api_base):
    email = os.environ.get("TEST_ADMIN_EMAIL") or os.environ["ADMIN_EMAIL"]
    password = os.environ.get("TEST_ADMIN_PASSWORD") or os.environ["ADMIN_INITIAL_PASSWORD"]
    return requests.post(
        f"{api_base}/admin/login",
        json={"email": email, "password": password},
    )


def test_admin_routes_require_a_session(api_base):
    for path in ("/admin/me", "/admin/bookings", "/admin/services", "/admin/clients"):
        response = requests.get(f"{api_base}{path}")
        assert response.status_code == 401


def test_logout_revokes_only_the_current_session(api_base):
    login = _login(api_base)
    assert login.status_code == 200, login.text
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    before = requests.get(f"{api_base}/admin/me", headers=headers)
    assert before.status_code == 200

    logout = requests.post(f"{api_base}/admin/logout", headers=headers)
    assert logout.status_code == 200

    after = requests.get(f"{api_base}/admin/me", headers=headers)
    assert after.status_code == 401


def test_public_all_parameter_cannot_expose_inactive_content(api_base, auth_headers):
    payload = {
        "name": "TEST Hidden Service",
        "short_description": "not public",
        "full_description": "not public",
        "price": 100,
        "duration_minutes": 20,
        "buffer_minutes": 5,
        "active": False,
        "display_order": 999,
    }
    created = requests.post(f"{api_base}/admin/services", headers=auth_headers, json=payload)
    assert created.status_code == 200, created.text
    service_id = created.json()["id"]

    try:
        public = requests.get(f"{api_base}/services", params={"all": "true"})
        assert public.status_code == 200
        assert not any(item["id"] == service_id for item in public.json())

        private = requests.get(f"{api_base}/admin/services", headers=auth_headers)
        assert private.status_code == 200
        hidden = next(item for item in private.json() if item["id"] == service_id)
        assert hidden["active"] is False
    finally:
        requests.delete(f"{api_base}/admin/services/{service_id}", headers=auth_headers)


def test_media_upload_is_disabled_without_emergent_storage(api_base, auth_headers):
    response = requests.post(
        f"{api_base}/admin/upload",
        headers={"Authorization": auth_headers["Authorization"]},
        files={"file": ("test.png", b"not-a-real-image", "image/png")},
        data={"category": "gallery"},
    )
    assert response.status_code == 503
    assert "GitHub" in response.json()["detail"]


def test_invalid_status_transition_is_rejected(api_base, api_client, auth_headers, next_sunday_str):
    service = next(item for item in api_client.get(f"{api_base}/services").json() if item["slug"] == "corte")
    slots = api_client.get(
        f"{api_base}/available-slots",
        params={"service_id": service["id"], "date_str": next_sunday_str},
    ).json()["slots"]
    assert slots
    created = api_client.post(
        f"{api_base}/bookings",
        json={
            "service_id": service["id"],
            "date": next_sunday_str,
            "time": slots[-1],
            "name": "TEST Status",
            "phone": "9998200001",
            "address": "TEST Address 456",
            "neighborhood": "Senderos",
            "accepted_policies": True,
            "accepted_privacy": True,
        },
    )
    assert created.status_code == 200, created.text
    booking_id = created.json()["booking"]["id"]

    invalid = requests.put(
        f"{api_base}/admin/bookings/{booking_id}/status",
        headers=auth_headers,
        json={"status": "completed"},
    )
    assert invalid.status_code == 409

    confirm = requests.put(
        f"{api_base}/admin/bookings/{booking_id}/status",
        headers=auth_headers,
        json={"status": "confirmed"},
    )
    assert confirm.status_code == 200

    complete = requests.put(
        f"{api_base}/admin/bookings/{booking_id}/status",
        headers=auth_headers,
        json={"status": "completed"},
    )
    assert complete.status_code == 200
