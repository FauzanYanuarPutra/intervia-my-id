from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
from tqdm import tqdm
import subprocess
import psutil
import socket
import datetime
import re

ROOT = Path(".").resolve()

OUTPUT_DIR = ROOT / "audit_output"
OUTPUT_DIR.mkdir(exist_ok=True)

IGNORE_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".turbo",
}

CODE_EXTENSIONS = {
    ".rs": "Rust",
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".sql": "SQL",
    ".py": "Python",
    ".sh": "Shell",
    ".ps1": "PowerShell",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".md": "Markdown",
    ".html": "HTML",
    ".css": "CSS",
}

print("=" * 70)
print("INTERVIA PROJECT AUDIT")
print("=" * 70)
print(f"Root : {ROOT}")
print()

# ==========================================================
# STEP 1
# ==========================================================

print("[1/7] Discovering files...")

all_files = []

for folder in ROOT.rglob("*"):
    if folder.is_dir():
        if folder.name in IGNORE_DIRS:
            continue

for path in ROOT.rglob("*"):
    if not path.is_file():
        continue

    skip = False

    for parent in path.parents:
        if parent.name in IGNORE_DIRS:
            skip = True
            break

    if skip:
        continue

    all_files.append(path)

print(f"Found {len(all_files):,} files")
print()

# ==========================================================
# STEP 2
# ==========================================================

print("[2/7] Analyzing source code...")

folder_sizes = {}
language_stats = {}
extension_stats = {}

total_size = 0
total_lines = 0

for file in tqdm(
    all_files,
    desc="Scanning",
    unit="file",
    ncols=100
):

    try:
        size = file.stat().st_size
    except:
        continue

    total_size += size

    top_folder = file.relative_to(ROOT).parts[0]

    folder_sizes[top_folder] = (
        folder_sizes.get(top_folder, 0) + size
    )

    ext = file.suffix.lower()

    extension_stats[ext] = (
        extension_stats.get(ext, 0) + 1
    )

    if ext in CODE_EXTENSIONS:

        try:
            with open(
                file,
                "r",
                encoding="utf-8",
                errors="ignore"
            ) as f:
                lines = sum(1 for _ in f)

        except:
            lines = 0

        total_lines += lines

        lang = CODE_EXTENSIONS[ext]

        if lang not in language_stats:
            language_stats[lang] = {
                "files": 0,
                "lines": 0,
            }

        language_stats[lang]["files"] += 1
        language_stats[lang]["lines"] += lines

print()

# ==========================================================
# STEP 3
# ==========================================================

print("[3/7] Reading system resources...")

memory = psutil.virtual_memory()

disk = psutil.disk_usage(
    str(ROOT.anchor)
)

host_ram_gb = round(memory.total / 1024**3, 2)
host_ram_used_gb = round(
    (memory.total - memory.available) / 1024**3,
    2,
)

host_disk_gb = round(
    disk.total / 1024**3,
    2,
)

host_disk_used_gb = round(
    disk.used / 1024**3,
    2,
)

print(
    f"RAM: {host_ram_used_gb} / {host_ram_gb} GB"
)

print(
    f"Disk: {host_disk_used_gb} / {host_disk_gb} GB"
)

print()

# ==========================================================
# STEP 4
# ==========================================================

print("[4/7] Reading Docker information...")

docker_storage = "Unknown"
docker_containers = 0

docker_rows = []

try:

    stats = subprocess.run(
        [
            "docker",
            "stats",
            "--no-stream",
            "--format",
            "{{.Name}},{{.CPUPerc}},{{.MemUsage}}"
        ],
        capture_output=True,
        text=True,
    )

    for line in stats.stdout.splitlines():

        parts = line.split(",")

        if len(parts) != 3:
            continue

        docker_rows.append({
            "container": parts[0],
            "cpu": parts[1],
            "memory": parts[2]
        })

    docker_containers = len(docker_rows)

except:
    pass

try:

    df = subprocess.run(
        ["docker", "system", "df"],
        capture_output=True,
        text=True,
    )

    docker_storage = df.stdout

except:
    pass

print(
    f"Containers running: {docker_containers}"
)

print()

# ==========================================================
# STEP 5
# ==========================================================

print("[5/7] Creating CSV files...")

folder_df = pd.DataFrame([
    {
        "folder": k,
        "size_gb": round(v / 1024**3, 3)
    }
    for k, v in folder_sizes.items()
]).sort_values(
    "size_gb",
    ascending=False
)

folder_df.to_csv(
    OUTPUT_DIR / "folder_sizes.csv",
    index=False
)

lang_df = pd.DataFrame([
    {
        "language": lang,
        "files": data["files"],
        "lines": data["lines"]
    }
    for lang, data in language_stats.items()
]).sort_values(
    "lines",
    ascending=False
)

lang_df.to_csv(
    OUTPUT_DIR / "language_stats.csv",
    index=False
)

if docker_rows:

    pd.DataFrame(
        docker_rows
    ).to_csv(
        OUTPUT_DIR / "docker_stats.csv",
        index=False
    )

summary_rows = [
    ["Generated", str(datetime.datetime.now())],
    ["Hostname", socket.gethostname()],
    ["Total Files", len(all_files)],
    ["Total LOC", total_lines],
    ["Project Size GB", round(total_size / 1024**3, 2)],
    ["RAM Total GB", host_ram_gb],
    ["RAM Used GB", host_ram_used_gb],
    ["Disk Total GB", host_disk_gb],
    ["Disk Used GB", host_disk_used_gb],
    ["Docker Containers", docker_containers],
]

pd.DataFrame(
    summary_rows,
    columns=["Metric", "Value"]
).to_csv(
    OUTPUT_DIR / "project_summary.csv",
    index=False
)

if isinstance(docker_storage, str):
    with open(
        OUTPUT_DIR / "docker_storage.txt",
        "w",
        encoding="utf-8"
    ) as f:
        f.write(docker_storage)

print()

# ==========================================================
# STEP 6
# ==========================================================

print("[6/7] Generating charts...")

plt.figure(figsize=(12, 6))

top_folders = folder_df.head(10)

plt.barh(
    top_folders["folder"],
    top_folders["size_gb"]
)

plt.title(
    "Largest Project Folders (GB)"
)

plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "folder_sizes.png"
)

plt.close()

plt.figure(figsize=(12, 6))

top_langs = lang_df.head(10)

plt.barh(
    top_langs["language"],
    top_langs["lines"]
)

plt.title(
    "Lines Of Code By Language"
)

plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "language_stats.png"
)

plt.close()

print()

# ==========================================================
# STEP 7
# ==========================================================

print("[7/7] Final summary")
print()

project_size_gb = round(
    total_size / 1024**3,
    2
)

largest_folder = (
    folder_df.iloc[0]["folder"]
    if not folder_df.empty
    else "-"
)

largest_folder_size = (
    folder_df.iloc[0]["size_gb"]
    if not folder_df.empty
    else 0
)

top_language = (
    lang_df.iloc[0]["language"]
    if not lang_df.empty
    else "-"
)

top_language_loc = (
    lang_df.iloc[0]["lines"]
    if not lang_df.empty
    else 0
)

print("=" * 70)
print("PROJECT SUMMARY")
print("=" * 70)

print(f"Files                : {len(all_files):,}")
print(f"LOC                  : {total_lines:,}")
print(f"Project Size         : {project_size_gb} GB")
print()
print(f"Largest Folder       : {largest_folder}")
print(f"Largest Folder Size  : {largest_folder_size} GB")
print()
print(f"Top Language         : {top_language}")
print(f"Top Language LOC     : {top_language_loc:,}")
print()
print(f"Docker Containers    : {docker_containers}")
print()
print(f"RAM Used             : {host_ram_used_gb} GB")
print(f"RAM Total            : {host_ram_gb} GB")
print()
print(f"Disk Used            : {host_disk_used_gb} GB")
print(f"Disk Total           : {host_disk_gb} GB")
print()

print("=" * 70)
print("OUTPUT")
print("=" * 70)

print(OUTPUT_DIR / "project_summary.csv")
print(OUTPUT_DIR / "folder_sizes.csv")
print(OUTPUT_DIR / "language_stats.csv")
print(OUTPUT_DIR / "docker_stats.csv")
print(OUTPUT_DIR / "folder_sizes.png")
print(OUTPUT_DIR / "language_stats.png")
print()

print("Audit completed successfully.")