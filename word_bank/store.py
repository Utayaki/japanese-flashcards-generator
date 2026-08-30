from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from mongita import MongitaClientDisk

from word_bank.errors import ValidationError
from word_bank.japanese import is_allowed, is_kana, is_kanji

MAX_SPELLING = 12
MAX_EXPLANATION = 2000
MAX_MAPPING_KANA = 48


def _require_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string")
    return value


def parse_word_payload(payload: dict[str, Any]) -> dict[str, Any]:
    spelling = _require_str(payload, "spelling").strip()
    explanation = _require_str(payload, "explanation").strip()
    raw_mappings = payload.get("readingMappings")

    if not spelling:
        raise ValidationError("spelling is required")
    chars = list(spelling)
    if len(chars) > MAX_SPELLING:
        raise ValidationError(f"spelling is longer than {MAX_SPELLING} characters")
    if not all(is_allowed(ch) for ch in chars):
        raise ValidationError("spelling may contain only hiragana, katakana, and kanji")

    if not explanation:
        raise ValidationError("explanation is required")
    if len(explanation) > MAX_EXPLANATION:
        raise ValidationError("explanation is too long")

    if not isinstance(raw_mappings, list):
        raise ValidationError("readingMappings must be a list")

    mappings: list[dict[str, str]] = []
    for item in raw_mappings:
        if not isinstance(item, dict):
            raise ValidationError("each reading mapping must be an object")
        kanji = item.get("kanji")
        kana = item.get("kana")
        if not isinstance(kanji, str) or not kanji:
            raise ValidationError("each reading mapping needs a kanji string")
        if not isinstance(kana, str):
            raise ValidationError("each reading mapping needs a kana string")
        kanji_chars = list(kanji)
        kana_chars = list(kana)
        if not all(is_kanji(ch) for ch in kanji_chars):
            raise ValidationError("reading mapping kanji may contain only kanji")
        if not all(is_kana(ch) for ch in kana_chars):
            raise ValidationError("reading mapping kana may contain only kana")
        if len(kana_chars) > MAX_MAPPING_KANA:
            raise ValidationError("reading mapping kana is too long")
        mappings.append({"kanji": kanji, "kana": kana})

    _assert_mappings_cover_spelling(chars, mappings)
    return {
        "spelling": spelling,
        "explanation": explanation,
        "readingMappings": mappings,
    }


def _assert_mappings_cover_spelling(chars: list[str], mappings: list[dict[str, str]]) -> None:
    i = 0
    for mapping in mappings:
        kanji_chars = list(mapping["kanji"])
        while i < len(chars) and is_kana(chars[i]):
            i += 1
        end = i + len(kanji_chars)
        if chars[i:end] != kanji_chars:
            raise ValidationError("reading mappings do not match the spelling")
        i = end
    while i < len(chars):
        if not is_kana(chars[i]):
            raise ValidationError("reading mappings do not cover every kanji in the spelling")
        i += 1


def _public_word(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "spelling": doc["spelling"],
        "explanation": doc["explanation"],
        "readingMappings": doc["readingMappings"],
        "createdAt": doc["createdAt"],
    }


class WordStore:
    def __init__(self, data_dir: str, dump_path: str | Path) -> None:
        Path(data_dir).mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._dump_path = Path(dump_path)
        self._client = MongitaClientDisk(host=data_dir)
        self._words = self._client.japanese_learning.words
        with self._lock:
            self._dump_words_locked()

    def _public_list_locked(self) -> list[dict[str, Any]]:
        docs = list(self._words.find({}))
        docs.sort(key=lambda doc: str(doc.get("createdAt", "")), reverse=True)
        return [_public_word(doc) for doc in docs]

    def _dump_words_locked(self) -> None:
        payload = json.dumps(self._public_list_locked(), ensure_ascii=False, indent=2) + "\n"
        tmp_path = self._dump_path.with_name(self._dump_path.name + ".tmp")
        tmp_path.write_text(payload, encoding="utf-8")
        tmp_path.replace(self._dump_path)

    def list_words(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._public_list_locked()

    def create_word(self, payload: dict[str, Any]) -> dict[str, Any]:
        parsed = parse_word_payload(payload)
        parsed["createdAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        with self._lock:
            result = self._words.insert_one(parsed)
            doc = self._words.find_one({"_id": result.inserted_id})
            if doc is None:
                raise ValidationError("failed to save word")
            self._dump_words_locked()
            return _public_word(doc)
