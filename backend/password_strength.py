#!/usr/bin/env python3
"""
Password strength validation for KalzTunz.
Provides a simple validator used by auth.py during registration.
"""

import re
from typing import Tuple, List


class PasswordValidator:
    """Validate password complexity."""

    MIN_LENGTH = 8
    MAX_LENGTH = 128

    def validate(self, password: str) -> Tuple[bool, List[str], int]:
        """
        Validate password strength.

        Returns:
            (is_valid, error_messages, strength_score_0_to_100)
        """
        errors: List[str] = []
        score = 0

        if len(password) < self.MIN_LENGTH:
            errors.append(f"Password must be at least {self.MIN_LENGTH} characters")
        elif len(password) > self.MAX_LENGTH:
            errors.append(f"Password must not exceed {self.MAX_LENGTH} characters")
        else:
            score += 20

        if not re.search(r"[a-z]", password):
            errors.append("Must contain a lowercase letter")
        else:
            score += 20

        # Uppercase is recommended but not required — not required for registration
        if re.search(r"[A-Z]", password):
            score += 20  # bonus points only

        if not re.search(r"\d", password):
            errors.append("Must contain a digit")
        else:
            score += 20

        if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]", password):
            errors.append("Must contain a special character")
        else:
            score += 20

        return len(errors) == 0, errors, score


# Module-level singleton used by auth.py
password_validator = PasswordValidator()
