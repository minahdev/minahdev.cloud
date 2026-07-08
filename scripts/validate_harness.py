"""
Harness Validator — Star Topology Ontology Checker

MD 파일의 프론트매터(type, links)를 파싱하여 스타 토폴로지 위반을 검출한다.

프론트매터 규약:
    ---
    type: hub        # 또는 spoke
    id: star_craft   # 노드 고유 ID
    links:
      - secom
      - inbody
    ---

검증 항목:
  1. hub가 정확히 1개인가
  2. Spoke → Spoke 직통 링크 존재 여부 (토폴로지 위반)
  3. 고립된 노드 존재 여부 (어디서도 참조되지 않는 노드)
  4. 순환 참조 존재 여부 (A → B → A)
  5. 프론트매터 필수 필드 누락 여부
"""

from __future__ import annotations

import sys
from collections import defaultdict, deque
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML 필요 — pip install pyyaml")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
DOCS_DIRS = [
    ROOT / "minahai" / "_docs",
    ROOT / "minahview" / "_docs",
    ROOT / "minahflutter" / "_docs",
    ROOT / "_docs",
]

REQUIRED_FIELDS = {"type", "id"}
VALID_TYPES = {"hub", "spoke"}


def parse_frontmatter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    try:
        return yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        return None


def collect_nodes(docs_dirs: list[Path]) -> list[dict]:
    nodes = []
    for docs_dir in docs_dirs:
        if not docs_dir.exists():
            continue
        for md_file in docs_dir.rglob("*.md"):
            fm = parse_frontmatter(md_file)
            if fm is None:
                continue
            fm["_path"] = str(md_file.relative_to(ROOT))
            nodes.append(fm)
    return nodes


def validate(nodes: list[dict]) -> list[str]:
    errors: list[str] = []
    warnings: list[str] = []

    # ── 1. 필수 필드 누락 검사
    valid_nodes = []
    for node in nodes:
        path = node.get("_path", "?")
        missing = REQUIRED_FIELDS - set(node.keys())
        if missing:
            errors.append(f"[MISSING_FIELD] {path} — 누락된 필드: {missing}")
            continue
        if node["type"] not in VALID_TYPES:
            errors.append(f"[INVALID_TYPE] {path} — type은 hub 또는 spoke여야 함 (현재: {node['type']})")
            continue
        valid_nodes.append(node)

    node_map: dict[str, dict] = {n["id"]: n for n in valid_nodes}

    # ── 2. Hub 개수 검사 (정확히 1개)
    hubs = [n for n in valid_nodes if n["type"] == "hub"]
    if len(hubs) == 0:
        warnings.append("[NO_HUB] type: hub 노드가 없음")
    elif len(hubs) > 1:
        hub_ids = [h["id"] for h in hubs]
        errors.append(f"[MULTI_HUB] Hub가 {len(hubs)}개 감지됨: {hub_ids} — Hub는 1개여야 함")

    hub_ids = {h["id"] for h in hubs}
    spoke_ids = {n["id"] for n in valid_nodes if n["type"] == "spoke"}

    # 링크 그래프 구성
    graph: dict[str, list[str]] = defaultdict(list)
    for node in valid_nodes:
        src = node["id"]
        for dst in node.get("links") or []:
            graph[src].append(dst)

    # ── 3. Spoke → Spoke 직통 링크 금지
    for src in spoke_ids:
        for dst in graph.get(src, []):
            if dst in spoke_ids:
                src_path = node_map[src]["_path"]
                errors.append(
                    f"[SPOKE_TO_SPOKE] {src_path} — spoke '{src}' → spoke '{dst}' 직통 링크 금지 "
                    f"(star_craft를 경유할 것)"
                )

    # ── 4. 고립 노드 검사 (Hub에서도 링크 없고, 아무도 참조 안 함)
    referenced: set[str] = set()
    for src, dsts in graph.items():
        for dst in dsts:
            referenced.add(dst)
    for node in valid_nodes:
        nid = node["id"]
        if nid not in hub_ids and nid not in referenced:
            warnings.append(f"[ISOLATED] {node['_path']} — '{nid}'은 어떤 노드에서도 참조되지 않음")

    # ── 5. 순환 참조 검사 (BFS)
    def has_cycle(start: str) -> list[str] | None:
        visited = {start}
        queue: deque[list[str]] = deque([[start]])
        while queue:
            path_so_far = queue.popleft()
            current = path_so_far[-1]
            for neighbor in graph.get(current, []):
                if neighbor == start:
                    return path_so_far + [neighbor]
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(path_so_far + [neighbor])
        return None

    checked: set[str] = set()
    for nid in node_map:
        if nid in checked:
            continue
        cycle = has_cycle(nid)
        if cycle:
            errors.append(f"[CYCLE] 순환 참조 감지: {' → '.join(cycle)}")
        checked.add(nid)

    return errors, warnings


def main() -> None:
    print("=== Harness Validator — Star Topology Check ===\n")

    nodes = collect_nodes(DOCS_DIRS)

    if not nodes:
        print("프론트매터가 있는 MD 파일을 찾지 못했음.")
        print("각 _docs/*.md 파일 상단에 다음 형식의 프론트매터를 추가하세요:\n")
        print("  ---")
        print("  type: hub   # 또는 spoke")
        print("  id: star_craft")
        print("  links:")
        print("    - secom")
        print("  ---")
        sys.exit(0)

    print(f"검사 대상 노드: {len(nodes)}개\n")

    errors, warnings = validate(nodes)

    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")

    if not errors and not warnings:
        print("OK  토폴로지 위반 없음.")
    elif not errors:
        print(f"\n경고 {len(warnings)}개 — 오류 없음.")
    else:
        print(f"\n오류 {len(errors)}개, 경고 {len(warnings)}개")
        sys.exit(1)


if __name__ == "__main__":
    main()
