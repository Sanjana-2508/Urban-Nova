import json
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "awareness_content.json"


def load_awareness_content(only_active: bool = True) -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        items = json.load(f)["items"]
    return [i for i in items if i["active"]] if only_active else items
