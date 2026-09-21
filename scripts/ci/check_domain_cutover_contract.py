from __future__ import annotations

"""Validate the domain strangler cutover contract without touching databases."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATUS_FILE = ROOT / "docs" / "architecture" / "domain-cutover-status.json"
CUTOVER = ROOT / "scripts" / "migrations" / "domain-cutover.sh"
VERIFY = ROOT / "scripts" / "migrations" / "domain-verify.sh"
SQL_DIR = ROOT / "scripts" / "migrations" / "sql"

STATUS_VALUES = {"backfill-scripted", "deferred"}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    status = load_json(STATUS_FILE)
    domains = status.get("domains", {})
    errors: list[str] = []

    if not isinstance(domains, dict) or not domains:
        errors.append("domain-cutover-status.json must contain a non-empty domains map.")
        domains = {}

    cutover_text = CUTOVER.read_text(encoding="utf-8")
    verify_text = VERIFY.read_text(encoding="utf-8")

    runner_cases = set(re.findall(r"^    ([a-z]+)\)$", cutover_text, re.MULTILINE))
    verifier_functions = set(re.findall(r"^verify_([a-z]+)\(\)", verify_text, re.MULTILINE))

    required_safety = 'TARGET_RESET_CONFIRMATION=I_UNDERSTAND_TARGET_RESET'
    if required_safety not in cutover_text:
        errors.append("domain-cutover.sh is missing the explicit TARGET_RESET confirmation guard.")

    for domain, item in sorted(domains.items()):
        if not isinstance(item, dict):
            errors.append(f"{domain}: status entry must be an object.")
            continue

        state = item.get("status")
        if state not in STATUS_VALUES:
            errors.append(f"{domain}: unsupported cutover status {state!r}.")
            continue

        if state == "backfill-scripted":
            sql_path = SQL_DIR / f"{domain}.sql"
            if not sql_path.is_file():
                errors.append(
                    f"{domain}: status is backfill-scripted but "
                    f"{sql_path.relative_to(ROOT)} is missing."
                )
            if domain not in runner_cases:
                errors.append(
                    f"{domain}: status is backfill-scripted but "
                    "domain-cutover.sh has no runner case."
                )
            if domain not in verifier_functions:
                errors.append(
                    f"{domain}: status is backfill-scripted but "
                    f"domain-verify.sh has no verify_{domain}()."
                )

        if state == "deferred" and domain in runner_cases:
            errors.append(
                f"{domain}: deferred domain must not silently appear as an "
                "executable SQL cutover case."
            )

    all_loop = re.search(r"for d in ([^;]+); do", cutover_text)
    if all_loop:
        all_domains = set(re.findall(r"[a-z]+", all_loop.group(1)))
        scripted = {
            d
            for d, item in domains.items()
            if isinstance(item, dict) and item.get("status") == "backfill-scripted"
        }
        if all_domains != scripted:
            errors.append(
                "domain-cutover.sh all-domain loop does not match the "
                f"backfill-scripted status map: runner={sorted(all_domains)} "
                f"scripted={sorted(scripted)}"
            )
    else:
        errors.append("domain-cutover.sh all-domain loop could not be located.")

    for critical in ("payment", "trust"):
        item = domains.get(critical)
        if isinstance(item, dict) and item.get("status") == "backfill-scripted":
            if f"verify_{critical}()" not in verify_text:
                errors.append(
                    f"{critical}: critical domain verification function is missing."
                )

    if errors:
        print("DOMAIN CUTOVER CONTRACT FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    scripted = sum(
        1
        for item in domains.values()
        if isinstance(item, dict) and item.get("status") == "backfill-scripted"
    )
    deferred = sum(
        1
        for item in domains.values()
        if isinstance(item, dict) and item.get("status") == "deferred"
    )
    print(
        "Domain cutover contract OK: "
        f"{scripted} domains have executable backfill+verification paths; "
        f"{deferred} domains are explicitly deferred."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
