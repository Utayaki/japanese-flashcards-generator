from __future__ import annotations


class DatabaseError(RuntimeError):
    """Raised when the store cannot complete a valid operation."""


class ValidationError(ValueError):
    """Raised when input does not match the word document model."""
