import subprocess
import json
import re
from collections import defaultdict

# =========================
# Helpers
# =========================

def run(cmd):
    return subprocess.check_output(cmd, shell=True).decode()

def parse_size(size_str):
    """
    Convert docker size strings (MiB, GiB) to MB float
    """
    size_str = size_str.strip()
    match = re.match(r"([\d.]+)\s*(kB|MB|MiB|GB|GiB|B)", size_str)
    if not match:
        return 0.0

    value, unit = match.groups()
    value = float(value)

    unit_map = {
        "B": 1 / (1024 * 1024),
        "kB": 1 / 1024,
        "MB": 1,
        "MiB": 1,
        "GB": 1024,
        "GiB": 1024,
    }

    return value * unit_map.get(unit, 0)

# =========================
# Docker Stats
# =========================

def get_docker_stats():
    raw = run("docker stats --no-stream --format '{{json .}}'")
    stats = []

    for line in raw.strip().split("\n"):
        data = json.loads(line)

        stats.append({
            "name": data["Name"],
            "cpu": float(data["CPUPerc"].replace("%", "")),
            "mem": data["MemUsage"]
        })

    return stats

# =========================
# Docker System DF
# =========================

def get_docker_df():
    raw = run("docker system df -v")
    return raw

# =========================
# Volume sizes (approx via docker inspect)
# =========================

def get_volumes():
    raw = run("docker volume ls -q")
    volumes = raw.strip().split("\n")
    return volumes

# =========================
# Aggregate service usage
# =========================

def analyze_services(stats):
    result = {}

    for s in stats:
        name = s["name"]

        # crude RAM parse (e.g. 187MiB / 1GiB)
        mem_used = s["mem"].split("/")[0].strip()

        result[name] = {
            "cpu": s["cpu"],
            "ram_used": mem_used
        }

    return result

# =========================
# Database Growth Model
# =========================

def compute_db_growth(db_sizes, current_users):
    per_user = {}

    for db, size_gb in db_sizes.items():
        per_user[db] = (size_gb * 1024) / max(current_users, 1)  # MB/user

    return per_user

# =========================
# Projection Engine
# =========================

def project_storage(per_user_mb, users_list):
    results = {}

    for u in users_list:
        total_mb = per_user_mb * u
        results[u] = {
            "mb": total_mb,
            "gb": total_mb / 1024,
            "tb": total_mb / (1024 * 1024)
        }

    return results

def project_ram(base_ram_gb, users_list, current_users):
    results = {}

    for u in users_list:
        scale = u / max(current_users, 1)
        ram = base_ram_gb * (0.6 + 0.4 * scale)  # dampened growth model
        results[u] = round(ram, 2)

    return results

# =========================
# Bottleneck detection
# =========================

def detect_bottlenecks(db_sizes):
    sorted_dbs = sorted(db_sizes.items(), key=lambda x: x[1], reverse=True)

    bottlenecks = []
    for db, size in sorted_dbs[:3]:
        reason = "High storage usage"
        if "chat" in db:
            reason = "Chat grows fastest (high write frequency)"
        elif "minio" in db or "upload" in db:
            reason = "File/object storage heavy growth"
        elif "community" in db:
            reason = "Forum/attachments accumulation"

        bottlenecks.append((db, reason))

    return bottlenecks

# =========================
# MAIN REPORT
# =========================

def main():
    print("\n=== CURRENT DOCKER STATS ===")
    stats = get_docker_stats()
    services = analyze_services(stats)

    for k, v in services.items():
        print(f"{k} -> CPU: {v['cpu']}% | RAM: {v['ram_used']}")

    # =========================
    # INPUTS (MANUAL REAL DATA)
    # =========================

    current_users = 1000  # <- set real value

    db_sizes_gb = {
        "identity_db": 0.8,
        "community_db": 1.1,
        "marketplace_db": 0.5,
        "scylla_db": 0.3,
        "redis": 0.1
    }

    object_storage_gb = 2.0

    # =========================
    # Per-user footprint model
    # =========================

    per_user_mb = 2.7  # based on your breakdown

    users_projection = [1000, 5000, 10000, 50000, 100000, 500000, 1000000]

    storage_projection = project_storage(per_user_mb, users_projection)

    print("\n=== STORAGE PROJECTION ===")
    for u, v in storage_projection.items():
        print(f"{u} users -> {v['gb']:.2f} GB")

    # =========================
    # RAM MODEL
    # =========================

    base_ram = 4  # GB current
    ram_projection = project_ram(base_ram, users_projection, current_users)

    print("\n=== RAM PROJECTION ===")
    for u, r in ram_projection.items():
        print(f"{u} users -> {r} GB RAM")

    # =========================
    # DB GROWTH
    # =========================

    db_growth = compute_db_growth(db_sizes_gb, current_users)

    print("\n=== DB PER USER FOOTPRINT (MB/user) ===")
    for k, v in db_growth.items():
        print(f"{k}: {v:.4f} MB/user")

    # =========================
    # BOTTLENECKS
    # =========================

    print("\n=== BOTTLENECK DETECTION ===")
    bottlenecks = detect_bottlenecks(db_sizes_gb)

    for b in bottlenecks:
        print(f"{b[0]} -> {b[1]}")

    # =========================
    # SUMMARY
    # =========================

    total_db = sum(db_sizes_gb.values())

    print("\n=== SUMMARY ===")
    print(f"Current DB Size: {total_db:.2f} GB")
    print(f"Current Object Storage: {object_storage_gb:.2f} GB")
    print(f"Current Users: {current_users}")
    print(f"Per-user footprint: {per_user_mb} MB")

if __name__ == "__main__":
    main()