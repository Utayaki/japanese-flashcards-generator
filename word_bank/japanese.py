from __future__ import annotations

HALFWIDTH_START = 0xFF00
HALFWIDTH_END = 0xFFEF
KANA_EXTRA = frozenset("ー")
KANJI_EXTRA = frozenset("々〇〻〆")

# Unicode Unified_Ideograph ranges (BMP + SIP), matching \p{Unified_Ideograph}.
_IDEOGRAPH_RANGES = (
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0x20000, 0x2A6DF),
    (0x2A700, 0x2B73F),
    (0x2B740, 0x2B81F),
    (0x2B820, 0x2CEAF),
    (0x2CEB0, 0x2EBEF),
    (0x30000, 0x3134F),
    (0x31350, 0x323AF),
)


def _is_halfwidth(ch: str) -> bool:
    return HALFWIDTH_START <= ord(ch) <= HALFWIDTH_END


def is_kana(ch: str) -> bool:
    if _is_halfwidth(ch):
        return False
    if ch in KANA_EXTRA:
        return True
    code = ord(ch)
    return 0x3040 <= code <= 0x309F or 0x30A0 <= code <= 0x30FF


def is_kanji(ch: str) -> bool:
    if _is_halfwidth(ch):
        return False
    if ch in KANJI_EXTRA:
        return True
    code = ord(ch)
    return any(start <= code <= end for start, end in _IDEOGRAPH_RANGES)


def is_allowed(ch: str) -> bool:
    return is_kana(ch) or is_kanji(ch)
