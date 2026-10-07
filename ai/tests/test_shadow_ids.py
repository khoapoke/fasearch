"""A5: stable UUID5 identities, distinct per product, repeat-safe."""

from src.core.shadow_ids import stable_point_id

CAT = "catalog-20260908-pilot-v1"
MODEL = "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"


def test_uuid5_stable_across_calls():
    a = stable_point_id(CAT, MODEL, "dataset-a-10011-v1")
    b = stable_point_id(CAT, MODEL, "dataset-a-10011-v1")
    assert a == b


def test_uuid5_distinct_per_product():
    ids = {stable_point_id(CAT, MODEL, f"dataset-a-{pid}-v1")
           for pid in ("10011", "10012", "10021")}
    assert len(ids) == 3


def test_uuid5_changes_with_publication():
    a = stable_point_id(CAT, MODEL, "dataset-a-10011-v1")
    b = stable_point_id("other-catalog", MODEL, "dataset-a-10011-v1")
    assert a != b
