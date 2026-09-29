"""Lightweight, rule-based sentiment classification — a keyword list, not a
model. This is deliberately the same philosophy as router.py's
is_frustrated(): free, deterministic, and precise enough for what it's
actually used for.

What it's used for matters here. This isn't customer-facing (it never
changes what the AI says or does — is_frustrated() in router.py already
owns that decision). It exists purely to give Phase 8's analytics dashboard
something real to aggregate instead of an empty column. A wrong
classification on an ambiguous message costs a slightly-off chart, not a
mishandled customer, which is why a keyword list is an acceptable choice
here in a way it wouldn't be for anything that changes behaviour.
"""
import re

_POSITIVE_PATTERNS = re.compile(
    r"\b(thanks?( you)?|thank you|great|awesome|perfect|excellent|appreciate|"
    r"helpful|wonderful|amazing|love (it|this)|works? (great|well)|exactly what)\b",
    re.IGNORECASE,
)

_NEGATIVE_PATTERNS = re.compile(
    r"\b(ridiculous|unacceptable|terrible|awful|worst|fed up|sick of|"
    r"frustrated|frustrating|annoyed|angry|disappointed|broken|useless|"
    r"still (not|isn'?t) (working|fixed)|waste of (my )?time|charged twice|"
    r"double charged|duplicate charge|no ?one (is )?(helping|responding))\b",
    re.IGNORECASE,
)

SENTIMENTS = ("POSITIVE", "NEUTRAL", "NEGATIVE")


def analyze_sentiment(text: str) -> str:
    """Negative wins over positive when a message somehow matches both
    ("thanks for nothing, this is useless") — a mixed signal in a support
    context is much more likely to be frustration than genuine gratitude."""
    if _NEGATIVE_PATTERNS.search(text):
        return "NEGATIVE"
    if _POSITIVE_PATTERNS.search(text):
        return "POSITIVE"
    return "NEUTRAL"
