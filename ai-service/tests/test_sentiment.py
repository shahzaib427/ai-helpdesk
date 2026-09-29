"""Tests for the rule-based sentiment classifier."""
from app.agents.sentiment import analyze_sentiment


class TestAnalyzeSentiment:
    def test_positive(self):
        assert analyze_sentiment("thanks so much, that was really helpful!") == "POSITIVE"
        assert analyze_sentiment("this works great, exactly what I needed") == "POSITIVE"

    def test_negative(self):
        assert analyze_sentiment("this is ridiculous, terrible service") == "NEGATIVE"
        assert analyze_sentiment("I'm so frustrated, still not working") == "NEGATIVE"
        assert analyze_sentiment("I was charged twice for this order") == "NEGATIVE"

    def test_neutral(self):
        assert analyze_sentiment("where is order 5012") == "NEUTRAL"
        assert analyze_sentiment("what is your return policy") == "NEUTRAL"

    def test_mixed_signal_favours_negative(self):
        # "thanks" is positive-coded but "useless" is negative-coded — in a
        # support context this reads as sarcasm/frustration, not gratitude.
        assert analyze_sentiment("thanks for nothing, this is useless") == "NEGATIVE"

    def test_empty_message_is_neutral(self):
        assert analyze_sentiment("") == "NEUTRAL"
