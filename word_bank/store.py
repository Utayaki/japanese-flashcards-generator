from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from mongita import MongitaClientDisk

from word_bank.errors import ValidationError
from word_bank.japanese import fold_search, is_allowed, is_kana, is_kanji

MAX_SPELLING = 12
MAX_EXPLANATION = 2000
MAX_MAPPING_KANA = 48
DEFAULT_LEXICAL_ITEM_TYPE = "nominal"
LEXICAL_ITEM_TYPES: dict[str, dict[str, str]] = {
    "nominal": {"button": "Nominal", "singular": "nominal", "plural": "nominals"},
}


def _require_str(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be a string")
    return value


def _coerce_id(word_id: str) -> ObjectId | str:
    try:
        return ObjectId(word_id)
    except (InvalidId, TypeError, ValueError):
        return word_id


def parse_word_payload(payload: dict[str, Any]) -> dict[str, Any]:
    spelling = _require_str(payload, "spelling").strip()
    explanation = _require_str(payload, "explanation").strip()
    raw_mappings = payload.get("readingMappings")
    raw_type = payload.get("lexicalItemType", DEFAULT_LEXICAL_ITEM_TYPE)

    if not isinstance(raw_type, str) or raw_type not in LEXICAL_ITEM_TYPES:
        raise ValidationError("invalid lexicalItemType")

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
        if not kana_chars:
            raise ValidationError("each kanji group needs a reading")
        if len(kana_chars) > MAX_MAPPING_KANA:
            raise ValidationError("reading mapping kana is too long")
        mappings.append({"kanji": kanji, "kana": kana})

    _assert_mappings_cover_spelling(chars, mappings)
    return {
        "spelling": spelling,
        "explanation": explanation,
        "readingMappings": mappings,
        "lexicalItemType": raw_type,
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


def _word_type(doc: dict[str, Any]) -> str:
    value = doc.get("lexicalItemType") or DEFAULT_LEXICAL_ITEM_TYPE
    if value not in LEXICAL_ITEM_TYPES:
        return DEFAULT_LEXICAL_ITEM_TYPE
    return value


def _public_word(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "spelling": doc["spelling"],
        "explanation": doc["explanation"],
        "readingMappings": doc["readingMappings"],
        "lexicalItemType": _word_type(doc),
        "createdAt": doc["createdAt"],
    }


def _kana_runs(spelling: str) -> list[str]:
    runs: list[str] = []
    current: list[str] = []
    for ch in spelling:
        if is_kana(ch):
            current.append(ch)
        elif current:
            runs.append("".join(current))
            current = []
    if current:
        runs.append("".join(current))
    return runs


def _full_reading(spelling: str, mappings: list[dict[str, str]]) -> str:
    chars = list(spelling)
    i = 0
    out: list[str] = []
    for mapping in mappings:
        kanji_chars = list(mapping.get("kanji") or "")
        while i < len(chars) and is_kana(chars[i]):
            out.append(chars[i])
            i += 1
        out.append(mapping.get("kana") or "")
        i += len(kanji_chars)
    while i < len(chars):
        out.append(chars[i])
        i += 1
    return "".join(out)


def _rank_field(value: str, query: str, base: int) -> int | None:
    if value == query:
        return base
    if value.startswith(query):
        return base + 1
    if query in value:
        return base + 2
    return None


def _match_rank(word: dict[str, Any], query: str) -> int | None:
    needle = fold_search(query)
    if not needle:
        return None

    best: int | None = None

    def consider(rank: int | None) -> None:
        nonlocal best
        if rank is None:
            return
        best = rank if best is None else min(best, rank)

    consider(_rank_field(fold_search(word["spelling"]), needle, 0))

    mappings = word.get("readingMappings") or []
    haystacks = [_full_reading(word["spelling"], mappings)]
    haystacks.extend(mapping.get("kana") or "" for mapping in mappings)
    runs = _kana_runs(word["spelling"])
    haystacks.extend(runs)
    if runs:
        haystacks.append("".join(runs))
    for hay in haystacks:
        if not hay:
            continue
        consider(_rank_field(fold_search(hay), needle, 3))

    consider(_rank_field(fold_search(word.get("explanation") or ""), needle, 6))
    return best


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

    def _find_doc_locked(self, word_id: str) -> dict[str, Any] | None:
        coerced = _coerce_id(word_id)
        doc = self._words.find_one({"_id": coerced})
        if doc is None and coerced != word_id:
            doc = self._words.find_one({"_id": word_id})
        return doc

    def list_words(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._public_list_locked()

    def get_word(self, word_id: str) -> dict[str, Any] | None:
        with self._lock:
            doc = self._find_doc_locked(word_id)
            return None if doc is None else _public_word(doc)

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

    def update_word(self, word_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        parsed = parse_word_payload(payload)
        with self._lock:
            doc = self._find_doc_locked(word_id)
            if doc is None:
                return None
            self._words.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "spelling": parsed["spelling"],
                        "explanation": parsed["explanation"],
                        "readingMappings": parsed["readingMappings"],
                        "lexicalItemType": parsed["lexicalItemType"],
                    }
                },
            )
            updated = self._words.find_one({"_id": doc["_id"]})
            if updated is None:
                raise ValidationError("failed to save word")
            self._dump_words_locked()
            return _public_word(updated)

    def delete_word(self, word_id: str) -> bool:
        with self._lock:
            doc = self._find_doc_locked(word_id)
            if doc is None:
                return False
            result = self._words.delete_one({"_id": doc["_id"]})
            deleted = result.deleted_count > 0
            if deleted:
                self._dump_words_locked()
            return deleted

    def search_words(
        self,
        lexical_item_type: str,
        query: str,
        *,
        limit: int | None = 5,
    ) -> list[dict[str, Any]]:
        if lexical_item_type not in LEXICAL_ITEM_TYPES:
            raise ValidationError(f"invalid lexicalItemType: {lexical_item_type}")
        if limit is not None and limit < 1:
            raise ValidationError("limit must be positive")

        cleaned = query.strip()
        if not cleaned:
            return []

        with self._lock:
            words = self._public_list_locked()

        ranked: list[tuple[int, str, dict[str, Any]]] = []
        for word in words:
            if word["lexicalItemType"] != lexical_item_type:
                continue
            rank = _match_rank(word, cleaned)
            if rank is None:
                continue
            ranked.append((rank, fold_search(word["spelling"]), word))

        ranked.sort(key=lambda item: (item[0], item[1]))
        if limit is not None:
            ranked = ranked[:limit]
        return [item[2] for item in ranked]
