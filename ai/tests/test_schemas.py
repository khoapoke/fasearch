import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _validator(name: str) -> Draft202012Validator:
    schema = json.loads((REPOSITORY_ROOT / "schemas" / name).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def test_invalid_intent_operator_is_rejected() -> None:
    validator = _validator("intent-card.schema.json")
    constraint = {
        "attribute": "color", "operator": "MAGIC", "priority": "primary", "source": "author_gold"
    }
    errors = list(validator.iter_errors({
        "schema_version": "1.0.0", "query_id": "q1", "raw_query": "áo đỏ",
        "origin": "native_human", "generation_mode": "taxonomy_controlled",
        "must_change": [constraint], "must_preserve": [], "must_not": [], "soft_preference": [],
        "dont_care": [],
        "writing_style": {"register": ["standard"], "orthography": ["clean"], "language_mix": ["none"], "negation_type": ["none"]},
        "freeze": {"frozen": False, "version": "pilot-v1", "content_hash": "12345678"},
    }))
    assert any("MAGIC" in error.message for error in errors)


def test_cannot_judge_cannot_be_grade_zero() -> None:
    validator = _validator("judgment.schema.json")
    record = {
        "schema_version": "1.0.0", "judgment_id": "j1", "query_id": "q1",
        "product_version_id": "p1v1", "product_group_id": "g1", "assessor_id": "a1",
        "status": "CANNOT_JUDGE", "grade": 0,
        "reason_codes": ["INSUFFICIENT_PRODUCT_INFORMATION"], "constraint_assessments": [],
        "guideline_version": "1.0.0", "intent_card_hash": "12345678",
        "created_at": "2026-09-08T00:00:00+07:00",
    }
    with pytest.raises(ValidationError):
        validator.validate(record)


def test_manifest_missing_split_hash_is_rejected() -> None:
    validator = _validator("experiment-manifest.schema.json")
    assert "split_manifest_hash" in validator.schema["properties"]["data"]["required"]


def test_product_outside_mvp_is_rejected() -> None:
    validator = _validator("product.schema.json")
    category_schema = validator.schema["properties"]["category"]
    assert "FOOTWEAR" not in category_schema["enum"]
