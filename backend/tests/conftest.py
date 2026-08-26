import os
from datetime import date, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("Set EXPO_PUBLIC_BACKEND_URL or EXPO_BACKEND_URL before running integration tests")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL") or os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD") or os.environ.get("ADMIN_INITIAL_PASSWORD")
if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    raise RuntimeError("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for integration tests")


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client):
    response = api_client.post(
        f"{API}/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, f"Admin login failed: {response.status_code} {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def next_sunday_str():
    today = date.today()
    days_ahead = (6 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


@pytest.fixture(scope="session")
def next_monday_str():
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
