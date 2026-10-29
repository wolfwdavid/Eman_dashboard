"""Unit tests for did_agent.scoring — prompt shaping by bucket, actionable_now derivation, _coerce clamping.

No network, no real OpenAI client: a tiny SimpleNamespace stub records the create() kwargs so the
tests can inspect the exact messages that would be sent to the model.
"""

import json
from types import SimpleNamespace

import pytest

from did_agent.models import Grant
from did_agent.scoring import (
    DID_ORG_PROFILE,
    DID_ORG_PROFILE_BASE,
    DID_ORG_PROFILE_LEGAL,
    _actionable,
    _coerce,
    _prompt,
    score_grant,
)


class FakeClient:
    """Minimal OpenAI-compatible stub: records create() kwargs, returns canned content."""

    def __init__(self, content: str):
        self.calls: list[dict] = []

        def create(**kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

        self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))


def _grant(bucket: str, c3: str = "No") -> Grant:
    return Grant(funder="Awesome Foundation Disability Chapter", requires_501c3=c3, bucket=bucket)


def _model_json(actionable: bool, score: int = 20) -> str:
    return json.dumps(
        {
            "score": score,
            "likelihood": "Low",
            "actionable_now": actionable,
            "rationale": "501c3 pending",
            "key_factors": ["pending"],
        }
    )


# --- _prompt -------------------------------------------------------------------------------------


def test_open_now_prompt_omits_legal_lines_and_confirms_eligibility():
    text = _prompt(_grant("OPEN_NOW"), False)
    assert "PENDING" not in text
    assert "NOT yet secured" not in text
    assert "currently has a fiscal sponsor" not in text
    assert "confirmed" in text.lower()
    assert "Eman Rimawi" in text  # BASE org facts are kept
    assert "Funder/Program: Awesome Foundation" in text  # GRANT block is kept


def test_after_501c3_prompt_keeps_legal_lines():
    text = _prompt(_grant("AFTER_501C3", c3="Yes"), False)
    assert "PENDING" in text
    assert "DID currently has a fiscal sponsor: False" in text


def test_via_fiscal_sponsor_prompt_unchanged():
    text = _prompt(_grant("VIA_FISCAL_SPONSOR", c3="Or fiscal sponsor"), False)
    assert "PENDING" in text


def test_profile_constant_is_base_plus_legal():
    assert DID_ORG_PROFILE == DID_ORG_PROFILE_BASE + DID_ORG_PROFILE_LEGAL
    assert "PENDING" in DID_ORG_PROFILE  # draft_application keeps the full profile
    assert "PENDING" not in DID_ORG_PROFILE_BASE


# --- _actionable ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("bucket", "has_sponsor", "model_says", "expected"),
    [
        ("OPEN_NOW", False, False, True),
        ("OPEN_NOW", False, True, True),
        ("VIA_FISCAL_SPONSOR", False, True, False),
        ("VIA_FISCAL_SPONSOR", True, False, True),
        ("AFTER_501C3", True, True, False),
        ("NOT_ELIGIBLE", True, True, False),
        ("UNKNOWN", False, True, True),
        ("UNKNOWN", False, False, False),
    ],
)
def test_actionable_rules(bucket, has_sponsor, model_says, expected):
    assert _actionable(bucket, has_sponsor, model_says) is expected


# --- score_grant ---------------------------------------------------------------------------------


def test_score_grant_open_now_overrides_model_false():
    client = FakeClient(_model_json(actionable=False, score=20))
    result = score_grant(client, _grant("OPEN_NOW"), "fake-model", has_fiscal_sponsor=False)
    assert result["actionable_now"] is True
    assert result["score"] == 20  # the score itself is not altered by this change
    user_msg = client.calls[0]["messages"][1]["content"]
    assert "PENDING" not in user_msg


def test_score_grant_not_eligible_forces_false():
    client = FakeClient(_model_json(actionable=True))
    result = score_grant(client, _grant("NOT_ELIGIBLE", c3="Yes"), "fake-model", has_fiscal_sponsor=True)
    assert result["actionable_now"] is False


def test_score_grant_unknown_defers_to_model():
    client = FakeClient(_model_json(actionable=True))
    result = score_grant(client, _grant("UNKNOWN", c3="Unknown"), "fake-model", has_fiscal_sponsor=False)
    assert result["actionable_now"] is True


def test_score_grant_bad_json_still_derives_actionable():
    client = FakeClient("not json at all")
    result = score_grant(client, _grant("OPEN_NOW"), "fake-model", has_fiscal_sponsor=False)
    assert result["score"] == 0
    assert result["likelihood"] == "Low"
    assert result["actionable_now"] is True


# --- _coerce -------------------------------------------------------------------------------------


def test_coerce_clamps_and_defaults():
    assert _coerce({"score": 250})["score"] == 100
    assert _coerce({"score": -5})["score"] == 0
    assert _coerce({"score": "abc"})["score"] == 0
    assert _coerce({"score": "42.7"})["score"] == 42
    assert _coerce({"likelihood": "Maybe"})["likelihood"] == "Low"
    assert len(_coerce({"key_factors": list(range(12))})["key_factors"]) == 8
    assert _coerce({})["actionable_now"] is False
