"""Production entry point with deployment-specific request handling.

This module keeps the hardened application from ``main`` while adapting
booking rate limits to Render's reverse-proxy environment.
"""

from __future__ import annotations

from fastapi import Request

import main as hardened


_original_rate_limit = hardened.rate_limit


async def production_rate_limit(key: str, limit: int, seconds: int) -> None:
    """Use fresh, practical booking limits without weakening admin login limits."""
    if key.startswith("booking-ip:"):
        versioned_key = key.replace("booking-ip:", "booking-v2-ip:", 1)
        await _original_rate_limit(versioned_key, 30, 3600)
        return

    if key.startswith("booking-phone:"):
        versioned_key = key.replace("booking-phone:", "booking-v2-phone:", 1)
        await _original_rate_limit(versioned_key, 8, 3600)
        return

    await _original_rate_limit(key, limit, seconds)


hardened.rate_limit = production_rate_limit
app = hardened.app


@app.middleware("http")
async def use_forwarded_client_ip(request: Request, call_next):
    """Expose the original client IP supplied by Render's reverse proxy."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip()
    if client_ip:
        current_port = request.client.port if request.client else 0
        request.scope["client"] = (client_ip, current_port)
    return await call_next(request)
