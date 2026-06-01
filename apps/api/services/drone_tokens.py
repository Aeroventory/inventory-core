from __future__ import annotations

import secrets
import threading
import time


class StreamTokenStore:
    def __init__(self, ttl_seconds: int = 60) -> None:
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._tokens: dict[str, float] = {}

    def issue(self) -> tuple[str, float]:
        token = secrets.token_urlsafe(32)
        expires_at = time.time() + self.ttl_seconds
        with self._lock:
            self._prune_locked()
            self._tokens[token] = expires_at
        return token, expires_at

    def validate(self, token: str | None) -> bool:
        if not token:
            return False
        now = time.time()
        with self._lock:
            expires_at = self._tokens.get(token)
            if expires_at is None or expires_at <= now:
                self._tokens.pop(token, None)
                return False
            return True

    def _prune_locked(self) -> None:
        now = time.time()
        expired = [token for token, expires_at in self._tokens.items() if expires_at <= now]
        for token in expired:
            self._tokens.pop(token, None)
