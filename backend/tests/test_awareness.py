from app.cleancity.awareness import load_awareness_content


def test_content_loads_and_has_required_fields():
    items = load_awareness_content()
    assert len(items) > 0
    for item in items:
        for key in ("id", "title", "category", "body", "active"):
            assert key in item
        assert item["title"].strip() and item["body"].strip()


def test_only_active_items_by_default():
    assert all(i["active"] for i in load_awareness_content())
