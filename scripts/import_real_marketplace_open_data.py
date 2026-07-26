#!/usr/bin/env python3
"""Build SQL COPY seed files from real Indonesia open/public data sources."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import html
import io
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable


OPEN_DATA_OWNER_ID = "00000000-0000-0000-0000-000000000801"
DEFAULT_CONFIG = "config/real_marketplace_open_data.sources.json"
DEFAULT_OUT = "data/generated/real_marketplace_open_data.sql"
DEFAULT_COMMUNITY_OUT = "data/generated/real_community_reels_open_data.sql"
USER_AGENT = "LajukanOpenDataImporter/1.0 (+https://www.lajukan.com)"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif")
VIDEO_EXTENSIONS = (".webm", ".ogv", ".ogg")
ALLOWED_PROVIDER_IMAGE_HOSTS = {
    "commons.wikimedia.org",
    "upload.wikimedia.org",
}


@dataclass(frozen=True)
class ProviderStore:
    source_id: str
    source_record_id: str
    name: str
    slug: str
    description: str
    city: str
    address: str
    lat: float
    lng: float
    segment: str
    search_text: str
    source_url: str
    source_license: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class BuyerRequest:
    source_id: str
    source_record_id: str
    title: str
    slug: str
    summary: str
    body: str
    category: str
    marketplace_category_slug: str
    marketplace_subcategory_slug: str
    city: str
    location: str
    budget_cents: int | None
    tags: list[str]
    search_text: str
    source_url: str
    source_license: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class CommonsMediaSeed:
    source_id: str
    source_record_id: str
    title: str
    slug: str
    caption: str
    tag: str
    product_name: str
    product_price: str
    product_href: str
    media_url: str
    media_type: str
    source_url: str
    source_license: str
    license_url: str
    author: str
    city: str
    category_slug: str
    tone: str
    icon_key: str
    hook: str
    metadata: dict[str, Any]


def clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).replace("\x00", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or default


def clean_html_text(value: Any, default: str = "") -> str:
    text = html.unescape(clean_text(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or default


def first_text(record: dict[str, Any], keys: Iterable[str], default: str = "") -> str:
    for key in keys:
        value = clean_text(record.get(key))
        if value:
            return value
    return default


def slugify(value: str, fallback: str) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:96].strip("-") or fallback


def stable_hash(value: str, length: int = 12) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:length]


def stable_sql_id(prefix: str, value: str, length: int = 18) -> str:
    return f"{prefix}-{stable_hash(value, length)}"


def as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(str(value).replace(",", "."))
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def as_int_rupiah_cents(value: Any) -> int | None:
    if value is None:
        return None
    raw = re.sub(r"[^0-9,.-]", "", str(value)).replace(".", "").replace(",", ".")
    if not raw:
        return None
    try:
        rupiah = float(raw)
    except ValueError:
        return None
    return int(round(rupiah * 100)) if rupiah > 0 else None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = clean_text(value).lower()
    return text in {"1", "true", "t", "yes", "y", "aktif"}


def as_number(value: Any) -> float | None:
    if value is None:
        return None
    text = clean_text(value)
    if not text:
        return None
    # Most API values are JSON numbers. If a string is sent, accept both
    # Indonesian thousands separators and decimal commas.
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        number = float(re.sub(r"[^0-9.-]", "", text))
    except ValueError:
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def rupiah_million_to_cents(value: Any) -> int | None:
    number = as_number(value)
    if number is None or number <= 0:
        return None
    return int(round(number * 1_000_000 * 100))


def format_idr_cents(value: int | None, label: str = "pagu") -> str:
    if not value:
        return ""
    rupiah = value // 100
    return f"{label} sekitar Rp {rupiah:,}".replace(",", ".")


def fetch_json(url: str, *, method: str = "GET", data: bytes | None = None, timeout: int = 60) -> Any:
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset, errors="replace"))


def fetch_json_request(
    url: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 60,
) -> Any:
    request_headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
        **(headers or {}),
    }
    request = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset, errors="replace"))


def is_public_image_url(value: str) -> bool:
    url = clean_text(value)
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    if parsed.netloc.lower() not in ALLOWED_PROVIDER_IMAGE_HOSTS:
        return False
    path = urllib.parse.unquote(parsed.path).lower()
    return path.endswith(IMAGE_EXTENSIONS) or "commons.wikimedia.org/wiki/special:filepath/" in url.lower()


def is_google_place_photo_proxy_url(value: str) -> bool:
    text = clean_text(value)
    if not text:
        return False
    parsed = urllib.parse.urlparse(text)
    return parsed.path == "/api/media/google-place-photo" and "place_id=" in parsed.query


def metadata_image_value(metadata: dict[str, Any]) -> str:
    for key in ("cover_image_url", "image_url", "media_url"):
        value = clean_text(metadata.get(key))
        if is_public_image_url(value) or is_google_place_photo_proxy_url(value):
            return value
    for key in ("image_urls", "gallery_images", "media_urls"):
        values = metadata.get(key)
        if not isinstance(values, list):
            continue
        for value in values:
            text = clean_text(value)
            if is_public_image_url(text) or is_google_place_photo_proxy_url(text):
                return text
    return ""


def metadata_has_real_visual(metadata: dict[str, Any]) -> bool:
    if metadata_image_value(metadata):
        return True
    return bool(metadata.get("google_place_id") and metadata.get("google_place_has_photos"))


def media_type_from_url_or_mime(url: str, mime: str = "") -> str:
    normalized_mime = clean_text(mime).lower()
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path).lower()
    if normalized_mime.startswith("video/") or path.endswith(VIDEO_EXTENSIONS):
        return "video"
    if normalized_mime.startswith("image/") or path.endswith(IMAGE_EXTENSIONS):
        return "image"
    return ""


def is_allowed_commons_license(license_name: str, license_url: str = "") -> bool:
    text = f"{license_name} {license_url}".lower()
    if any(blocked in text for blocked in ("non-free", "fair use", "copyrighted")):
        return False
    return any(
        token in text
        for token in (
            "cc by",
            "cc-by",
            "cc0",
            "public domain",
            "pd-author",
            "pd-user",
            "odbl",
        )
    )


def commons_file_url(value: str) -> str:
    text = clean_text(value)
    if not text or text.lower().startswith("category:"):
        return ""
    if text.startswith("http://") or text.startswith("https://"):
        return text if is_public_image_url(text) else ""
    if text.lower().startswith("file:"):
        file_name = text[5:].strip()
    else:
        file_name = text.strip()
    if not file_name:
        return ""
    return (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        f"{urllib.parse.quote(file_name.replace(' ', '_'))}?width=1200"
    )


def osm_image_urls(tags: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    for key in (
        "image",
        "image:0",
        "image:1",
        "image:url",
        "photo",
        "photo:url",
        "wikimedia_commons",
    ):
        value = clean_text(tags.get(key))
        if not value:
            continue
        if key == "wikimedia_commons" or value.lower().startswith("file:"):
            value = commons_file_url(value)
        if is_public_image_url(value):
            candidates.append(value)
    return list(dict.fromkeys(candidates))


def add_osm_image_metadata(metadata: dict[str, Any], tags: dict[str, Any]) -> None:
    image_urls = osm_image_urls(tags)
    if not image_urls:
        return
    source_url = clean_text(tags.get("image")) or clean_text(tags.get("wikimedia_commons")) or image_urls[0]
    metadata.update(
        {
            "image_url": image_urls[0],
            "cover_image_url": image_urls[0],
            "image_urls": image_urls,
            "gallery_images": image_urls,
            "image_source_provider": "osm_or_wikimedia_commons",
            "image_attribution": "OpenStreetMap/Wikimedia Commons",
            "image_credit": {
                "provider": "OpenStreetMap/Wikimedia Commons",
                "source_url": source_url,
                "attribution": "OpenStreetMap contributors and linked image source",
                "license": "Verify the linked image license before production publication",
                "note": "Imported from OSM image or wikimedia_commons tags; source is real but still needs production review.",
            },
        }
    )


def build_overpass_query(source: dict[str, Any], bbox: list[float], limit: int) -> str:
    clauses: list[str] = []
    bbox_text = ",".join(str(part) for part in bbox)
    for selector in source.get("selectors", []):
        key = selector["key"]
        values = selector.get("values") or []
        if values:
            choices = "|".join(re.escape(value) for value in values)
            value_filter = f'["{key}"~"^({choices})$"]'
        else:
            value_filter = f'["{key}"]'
        for element_type in ("node", "way", "relation"):
            clauses.append(f'  {element_type}["name"]{value_filter}({bbox_text});')
    timeout = int(source.get("timeout_seconds") or 90)
    return "\n".join(
        [
            f"[out:json][timeout:{timeout}];",
            "(",
            *clauses,
            ");",
            f"out center tags qt {limit};",
        ]
    )


def osm_segment(tags: dict[str, Any]) -> tuple[str, str, str]:
    shop = clean_text(tags.get("shop")).lower()
    amenity = clean_text(tags.get("amenity")).lower()
    craft = clean_text(tags.get("craft")).lower()
    office = clean_text(tags.get("office")).lower()
    tourism = clean_text(tags.get("tourism")).lower()
    token = shop or amenity or craft or office or tourism or "provider"
    if shop == "estate_agent" or office == "estate_agent" or tourism:
        return "property", "Tempat Usaha", "business-places"
    if amenity == "bank" or office or craft:
        return "service", "Cari Jasa", "services"
    if shop in {"hardware", "doityourself", "computer", "electronics"}:
        return "equipment", "Mesin & Alat", "machines-tools"
    if shop in {
        "bakery",
        "butcher",
        "greengrocer",
        "seafood",
        "fabric",
        "tailor",
        "furniture",
        "stationery",
        "copyshop",
        "chemist",
        "cosmetics",
        "paint",
        "agrarian",
        "trade",
        "mall",
    } or amenity in {"marketplace", "pharmacy"}:
        return "supplies", "Bahan & Supplier", "materials-suppliers"
    if amenity in {"restaurant", "cafe", "fast_food"}:
        return "food-beverage", "Bahan & Supplier", "materials-suppliers"
    return token, "Penyedia", "materials-suppliers"


def osm_address(tags: dict[str, Any], fallback_city: str) -> str:
    parts = [
        tags.get("addr:street"),
        tags.get("addr:housenumber"),
        tags.get("addr:suburb"),
        tags.get("addr:city"),
    ]
    address = ", ".join(clean_text(part) for part in parts if clean_text(part))
    return address or clean_text(tags.get("addr:full")) or fallback_city or "Indonesia"


def iter_overpass_providers(source: dict[str, Any], max_rows: int | None) -> Iterable[ProviderStore]:
    endpoints = source.get("endpoints") or [source["endpoint"]]
    timeout = int(source.get("timeout_seconds") or 90)
    per_bbox_limit = int(source.get("per_bbox_limit") or 750)
    seen: set[str] = set()
    emitted = 0
    for bbox_entry in source.get("bboxes", []):
        if max_rows is not None and emitted >= max_rows:
            break
        remaining = per_bbox_limit if max_rows is None else min(per_bbox_limit, max_rows - emitted)
        if remaining <= 0:
            break
        query = build_overpass_query(source, bbox_entry["bbox"], remaining)
        payload = urllib.parse.urlencode({"data": query}).encode("utf-8")
        data = None
        last_error: Exception | None = None
        for endpoint in endpoints:
            try:
                data = fetch_json(endpoint, method="POST", data=payload, timeout=timeout)
                break
            except Exception as exc:  # Public Overpass mirrors can rate-limit or timeout.
                last_error = exc
                print(
                    f"warning: overpass fetch failed for {bbox_entry.get('name')} via {endpoint}: {exc}",
                    file=sys.stderr,
                )
        if data is None:
            if last_error is not None:
                raise last_error
            continue
        for element in data.get("elements", []):
            tags = element.get("tags") or {}
            name = clean_text(tags.get("name"))
            if len(name) < 3:
                continue
            source_record_id = f"osm:{element.get('type')}:{element.get('id')}"
            if source_record_id in seen:
                continue
            lat = as_float(element.get("lat") or (element.get("center") or {}).get("lat"))
            lng = as_float(element.get("lon") or (element.get("center") or {}).get("lon"))
            if lat is None or lng is None:
                continue
            seen.add(source_record_id)
            city = first_text(tags, ["addr:city", "is_in:city"], bbox_entry.get("city") or "Indonesia")
            address = osm_address(tags, city)
            segment, label, category_slug = osm_segment(tags)
            source_url = f"https://www.openstreetmap.org/{element.get('type')}/{element.get('id')}"
            slug = slugify(f"real-osm-{element.get('type')}-{element.get('id')}-{name}", source_record_id)
            keyword_text = " ".join(
                clean_text(tags.get(key))
                for key in ("shop", "amenity", "craft", "office", "tourism", "cuisine")
                if clean_text(tags.get(key))
            )
            search_text = clean_text(
                f"{name} {city} {address} {keyword_text} penyedia usaha supplier jasa usaha bahan usaha tempat usaha {label}"
            )
            metadata = {
                "seed_pack": "real_indonesia_bulk_open_data",
                "record_kind": "osm_provider_reference",
                "source_id": source["id"],
                "source_record_id": source_record_id,
                "source_url": source_url,
                "source_license": source.get("license"),
                "source_license_url": source.get("license_url"),
                "attribution": source.get("attribution"),
                "is_transactional": False,
                "verified": False,
                "contact_policy": "private_phone_not_imported",
                "market_side": "supply",
                "listing_side": "supply",
                "marketplace_category_slug": category_slug,
                "segment": segment,
                "keywords": search_text,
                "search_text": search_text,
                "osm_tags": {
                    key: tags[key]
                    for key in ("shop", "amenity", "craft", "office", "tourism", "cuisine")
                    if key in tags
                },
            }
            add_osm_image_metadata(metadata, tags)
            emitted += 1
            yield ProviderStore(
                source_id=source["id"],
                source_record_id=source_record_id,
                name=name,
                slug=slug,
                description=f"Referensi penyedia real dari OpenStreetMap: {label}. Verifikasi detail sebelum transaksi.",
                city=city,
                address=address,
                lat=lat,
                lng=lng,
                segment=segment,
                search_text=search_text,
                source_url=source_url,
                source_license=source.get("license", "OpenStreetMap ODbL"),
                metadata=metadata,
            )


def extract_records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("data", "result", "results", "items", "records", "aaData"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = extract_records(value)
            if nested:
                return nested
    return []


def infer_buyer_category(text: str) -> tuple[str, str, str, list[str]]:
    lower = text.lower()
    if re.search(
        r"\b(alat tulis|atk|alat/bahan|bahan|kertas|cover|map|benda pos|materai|"
        r"spanduk|banner|fotocopy|fotokopi|cetak|piagam|makanan|minuman|snack)\b",
        lower,
    ):
        return "supplies", "materials-suppliers", "local-suppliers", ["supplier bahan usaha", "pengadaan barang"]
    if re.search(r"\b(mesin|peralatan|sparepart|suku cadang|kendaraan|komputer|laptop|printer|server)\b", lower):
        return "equipment", "machines-tools", "business-tools", ["mesin alat usaha", "pengadaan alat"]
    if re.search(r"\b(gedung|bangunan|kantor|lahan|sewa ruang|renovasi)\b", lower):
        return "property", "business-places", "offices", ["tempat usaha", "pengadaan lokasi"]
    if re.search(r"\b(jasa|konsultan|pemeliharaan|perawatan|pelatihan|sewa|internet|aplikasi)\b", lower):
        return "service", "services", "operations", ["jasa usaha", "pengadaan jasa"]
    if re.search(r"\b(franchise|kemitraan|reseller|distributor|katalog|umkk|umk)\b", lower):
        return "opportunity", "business-opportunities", "partnerships", [
            "peluang usaha franchise kemitraan reseller",
            "pengadaan pemerintah",
        ]
    return "supplies", "materials-suppliers", "local-suppliers", ["supplier bahan usaha", "pengadaan barang"]


def iter_date_windows(start: str, end: str, days: int) -> Iterable[tuple[str, str]]:
    current = dt.date.fromisoformat(start)
    final = dt.date.fromisoformat(end)
    step = dt.timedelta(days=max(1, days))
    while current <= final:
        window_end = min(current + step - dt.timedelta(days=1), final)
        yield current.isoformat(), window_end.isoformat()
        current = window_end + dt.timedelta(days=1)


def iter_lpse_buyer_requests(source: dict[str, Any], max_rows: int | None) -> Iterable[BuyerRequest]:
    endpoint = source["endpoint"]
    year = int(source["year"])
    chunk_days = int(source.get("chunk_days") or 7)
    emitted = 0
    seen: set[str] = set()
    for start, end in iter_date_windows(source["start_date"], source["end_date"], chunk_days):
        if max_rows is not None and emitted >= max_rows:
            break
        query = urllib.parse.urlencode({"tahun": str(year), "date": start, "dateEnd": end})
        url = f"{endpoint}?{query}"
        payload = fetch_json(url, timeout=int(source.get("timeout_seconds") or 90))
        for record in extract_records(payload):
            if max_rows is not None and emitted >= max_rows:
                break
            title = first_text(
                record,
                ["nama_paket", "namaPaket", "nama", "paket", "paket_pekerjaan", "nama_pengadaan"],
            )
            if len(title) < 5:
                continue
            source_record_id = first_text(
                record,
                ["kd_rup", "kode_rup", "id_rup", "rup_id", "id", "kode"],
                stable_hash(json.dumps(record, ensure_ascii=False, sort_keys=True)),
            )
            stable_id = f"{source['id']}:{source_record_id}"
            if stable_id in seen:
                continue
            seen.add(stable_id)
            buyer = first_text(
                record,
                ["nama_klpd", "klpd", "nama_satker", "satker", "nama_kldi", "kldi", "instansi"],
                "Instansi pengadaan",
            )
            location = first_text(
                record,
                ["lokasi", "kabupaten_kota", "nama_kabupaten_kota", "provinsi", "nama_provinsi"],
                "Indonesia",
            )
            city = location.split(",")[0].strip()[:80] or "Indonesia"
            budget_cents = as_int_rupiah_cents(
                first_text(record, ["pagu", "pagu_anggaran", "total_pagu", "nilai_pagu", "anggaran"])
            )
            method = first_text(record, ["metode_pengadaan", "metode", "jenis_pengadaan", "tipe_pengadaan"])
            category, category_slug, subcategory_slug, tags = infer_buyer_category(f"{title} {method} {location}")
            budget_label = f"Anggaran publik {budget_cents // 100:,} IDR".replace(",", ".") if budget_cents else ""
            summary = clean_text(f"{buyer} mencari penyedia untuk: {title}. {budget_label}")
            body = clean_text(
                f"Rujukan kebutuhan pembeli dari data pengadaan publik. Paket: {title}. "
                f"Instansi: {buyer}. Lokasi: {location}. Metode: {method or 'lihat sumber resmi'}. "
                "Data ini tidak membuat koneksi otomatis; verifikasi jadwal, status, dan syarat di sumber resmi."
            )
            source_url = first_text(record, ["url", "link", "source_url"], source.get("source_url") or endpoint)
            slug = slugify(f"real-lpse-rup-{source_record_id}-{title}", f"real-lpse-rup-{stable_hash(stable_id)}")
            search_text = clean_text(
                f"{title} {buyer} {location} {method} {' '.join(tags)} pembeli kebutuhan pengadaan penyedia"
            )
            metadata = {
                "seed_pack": "real_indonesia_bulk_open_data",
                "record_kind": "public_procurement_buyer_need",
                "source_id": source["id"],
                "source_record_id": source_record_id,
                "source_url": source_url,
                "source_license": source.get("license"),
                "source_window_start": start,
                "source_window_end": end,
                "is_transactional": False,
                "contact_policy": "no_private_contact_seeded",
                "market_side": "demand",
                "listing_side": "demand",
                "request_status": "source_reference",
                "buyer_name": buyer,
                "budget_label": budget_label,
                "marketplace_category_slug": category_slug,
                "marketplace_subcategory_slug": subcategory_slug,
                "city": city,
                "location": location,
                "search_text": search_text,
                "raw_keys": sorted(record.keys()),
            }
            emitted += 1
            yield BuyerRequest(
                source_id=source["id"],
                source_record_id=source_record_id,
                title=title,
                slug=slug,
                summary=summary,
                body=body,
                category=category,
                marketplace_category_slug=category_slug,
                marketplace_subcategory_slug=subcategory_slug,
                city=city,
                location=location,
                budget_cents=budget_cents,
                tags=tags,
                search_text=search_text,
                source_url=source_url,
                source_license=source.get("license", "Public procurement reference"),
                metadata=metadata,
            )


def normalize_field_name(value: str) -> str:
    text = re.sub(r"\s*\([^)]*\)", "", clean_text(value).lower())
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text


def satrup_field_map(payload: dict[str, Any]) -> dict[str, int]:
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    fields = metadata.get("fields") if isinstance(metadata.get("fields"), list) else []
    mapping: dict[str, int] = {}
    for index, field in enumerate(fields):
        field_name = normalize_field_name(str(field))
        if field_name:
            mapping[field_name] = index
    return mapping


def satrup_row_value(row: list[Any], mapping: dict[str, int], *keys: str, default: Any = None) -> Any:
    for key in keys:
        index = mapping.get(key)
        if index is not None and index < len(row):
            value = row[index]
            if value not in (None, ""):
                return value
    return default


def iter_satrup_satkers(payload: dict[str, Any]) -> Iterable[dict[str, Any]]:
    mapping = satrup_field_map(payload)
    rows = payload.get("data") if isinstance(payload.get("data"), list) else []
    for raw_row in rows:
        if not isinstance(raw_row, list):
            continue
        if as_bool(satrup_row_value(raw_row, mapping, "is_deleted", default=False)):
            continue
        package_count = int(as_number(satrup_row_value(raw_row, mapping, "jum_penyedia", default=0)) or 0)
        if package_count <= 0:
            continue
        yield {
            "kd_satker": clean_text(satrup_row_value(raw_row, mapping, "kd_satker", default="")),
            "nama_satker": clean_text(satrup_row_value(raw_row, mapping, "nama_satker", default="Instansi pengadaan")),
            "jum_penyedia": package_count,
            "jum_total": int(as_number(satrup_row_value(raw_row, mapping, "jum_total", default=package_count)) or package_count),
            "pagu_penyedia_juta": as_number(satrup_row_value(raw_row, mapping, "pagu_penyedia", default=None)),
            "pagu_total_juta": as_number(satrup_row_value(raw_row, mapping, "pagu_total", default=None)),
        }


def parse_satrup_detail_location(value: Any, fallback_city: str, fallback_province: str) -> tuple[str, str]:
    city = fallback_city
    parts: list[str] = []
    text = clean_text(value)
    if text:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list) and parsed:
            first = parsed[0] if isinstance(parsed[0], dict) else {}
            detail = clean_text(first.get("detil_lokasi"))
            district = clean_text(first.get("kbp_nama")).replace(" (Kab.)", "")
            province = clean_text(first.get("prp_nama"), fallback_province)
            city = district or fallback_city
            parts = [detail, district, province]
    if not parts:
        parts = [fallback_city, fallback_province]
    location = ", ".join(dict.fromkeys(part for part in parts if part))
    return city, location or f"{fallback_city}, {fallback_province}"


def iter_satrup_status_rup_requests(source: dict[str, Any], max_rows: int | None) -> Iterable[BuyerRequest]:
    year = int(source.get("year") or dt.date.today().year)
    query = urllib.parse.urlencode({"tahun": str(year)})
    url = f"{source['endpoint']}?{query}"
    payload = fetch_json(url, timeout=int(source.get("timeout_seconds") or 120))
    if not isinstance(payload, dict):
        return
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    official_source = clean_text(metadata.get("official_source"), "sirup.inaproc.id")
    sync_details = metadata.get("sync_details") if isinstance(metadata.get("sync_details"), dict) else {}
    data_timestamp = clean_text(
        metadata.get("data_timestamp")
        or metadata.get("sync_timestamp")
        or metadata.get("last_sync")
        or sync_details.get("backup_timestamp")
    )
    city = clean_text(source.get("city"), "Tanah Laut")
    province = clean_text(source.get("province"), "Kalimantan Selatan")
    emitted = 0
    seen: set[str] = set()

    for satker in iter_satrup_satkers(payload):
        if max_rows is not None and emitted >= max_rows:
            break
        package_count = int(satker["jum_penyedia"])
        satker_code = clean_text(satker["kd_satker"])
        buyer = clean_text(satker["nama_satker"], "Instansi pengadaan")
        source_record_id = f"satrup-status-rup:{year}:{satker_code or stable_hash(buyer)}"
        if source_record_id in seen:
            continue
        seen.add(source_record_id)

        pagu_juta = satker.get("pagu_penyedia_juta")
        budget_cents = rupiah_million_to_cents(pagu_juta)
        total_packages = int(satker.get("jum_total") or package_count)
        total_budget_juta = satker.get("pagu_total_juta")
        category, category_slug, subcategory_slug, tags = infer_buyer_category(buyer)
        location = f"{city}, {province}"
        title = f"Pembeli pengadaan: {buyer} ({year})"
        budget_label = format_idr_cents(budget_cents, "pagu penyedia")
        summary = clean_text(
            f"{buyer} memiliki {package_count} paket penyedia dalam RUP {year}. {budget_label}"
        )
        body = clean_text(
            f"Referensi pembeli dari status RUP {year} {city}. Satker: {buyer}. "
            f"Paket penyedia: {package_count}. Total paket satker: {total_packages}. "
            f"{budget_label}. Sumber resmi di metadata API: {official_source}. "
            "Data ini agregat per satker, bukan paket transaksi Lajukan; cek sumber resmi untuk jadwal, syarat, dan status terbaru."
        )
        slug = slugify(
            f"real-satrup-rup-{year}-{satker_code}-{buyer}",
            f"real-satrup-rup-{year}-{stable_hash(source_record_id)}",
        )
        search_text = clean_text(
            f"{title} {summary} {body} {' '.join(tags)} pembeli kebutuhan pengadaan penyedia supplier jasa usaha"
        )
        metadata_row = {
            "seed_pack": "real_indonesia_bulk_open_data",
            "record_kind": "public_procurement_buyer_aggregate",
            "source_id": source["id"],
            "source_record_id": source_record_id,
            "source_url": source.get("source_url") or url,
            "source_api_url": url,
            "source_license": source.get("license"),
            "official_source": official_source,
            "data_timestamp": data_timestamp,
            "is_transactional": False,
            "contact_policy": "no_private_contact_seeded",
            "market_side": "demand",
            "listing_side": "demand",
            "request_status": "source_reference",
            "buyer_name": buyer,
            "package_count": package_count,
            "total_package_count": total_packages,
            "pagu_penyedia_juta": as_number(pagu_juta),
            "pagu_total_juta": as_number(total_budget_juta),
            "budget_label": budget_label,
            "marketplace_category_slug": category_slug,
            "marketplace_subcategory_slug": subcategory_slug,
            "city": city,
            "province": province,
            "location": location,
            "search_text": search_text,
        }
        emitted += 1
        yield BuyerRequest(
            source_id=source["id"],
            source_record_id=source_record_id,
            title=title,
            slug=slug,
            summary=summary,
            body=body,
            category=category,
            marketplace_category_slug=category_slug,
            marketplace_subcategory_slug=subcategory_slug,
            city=city,
            location=location,
            budget_cents=budget_cents,
            tags=["pembeli", "kebutuhan pengadaan", "RUP", *tags],
            search_text=search_text,
            source_url=source.get("source_url") or url,
            source_license=source.get("license", "Public procurement reference"),
            metadata=metadata_row,
        )


def iter_satrup_rup_penyedia_requests(source: dict[str, Any], max_rows: int | None) -> Iterable[BuyerRequest]:
    year = int(source.get("year") or dt.date.today().year)
    status_query = urllib.parse.urlencode({"tahun": str(year)})
    status_url = f"{source['status_endpoint']}?{status_query}"
    status_payload = fetch_json(status_url, timeout=int(source.get("timeout_seconds") or 120))
    if not isinstance(status_payload, dict):
        return
    city_fallback = clean_text(source.get("city"), "Tanah Laut")
    province = clean_text(source.get("province"), "Kalimantan Selatan")
    request_sleep = float(source.get("request_sleep_seconds") or 0)
    emitted = 0
    seen: set[str] = set()

    for satker in iter_satrup_satkers(status_payload):
        if max_rows is not None and emitted >= max_rows:
            break
        satker_code = clean_text(satker.get("kd_satker"))
        if not satker_code:
            continue
        query = urllib.parse.urlencode({"tahun": str(year), "kd_satker": satker_code})
        api_url = f"{source['endpoint']}?{query}"
        payload = fetch_json(api_url, timeout=int(source.get("timeout_seconds") or 120))
        metadata = payload.get("metadata") if isinstance(payload, dict) and isinstance(payload.get("metadata"), dict) else {}
        last_sync = clean_text(metadata.get("last_sync") or metadata.get("snapshot_id"))
        records = extract_records(payload)
        for record in records:
            if max_rows is not None and emitted >= max_rows:
                break
            if as_bool(record.get("status_delete_rup")) or not as_bool(record.get("status_aktif_rup", True)):
                continue
            kd_rup = clean_text(record.get("kd_rup"))
            title_raw = first_text(record, ["nama_paket", "nama", "paket_pekerjaan"], "")
            if not kd_rup or len(title_raw) < 5:
                continue
            source_record_id = f"satrup-rup-penyedia:{year}:{kd_rup}"
            if source_record_id in seen:
                continue
            seen.add(source_record_id)

            buyer = first_text(record, ["nama_satker"], clean_text(satker.get("nama_satker"), "Instansi pengadaan"))
            method = first_text(record, ["metode_pengadaan"], "lihat sumber resmi")
            procurement_type = first_text(record, ["jenis_pengadaan"], "")
            work_text = first_text(record, ["urarian_pekerjaan", "uraian_pekerjaan", "spesifikasi_pekerjaan"], "")
            spec_text = first_text(record, ["spesifikasi_pekerjaan"], "")
            volume = first_text(record, ["volume_pekerjaan"], "")
            city, location = parse_satrup_detail_location(record.get("detail_lokasi"), city_fallback, province)
            combined_for_category = clean_text(
                f"{title_raw} {work_text} {spec_text} {procurement_type} {method} "
                f"{record.get('nama_kegiatan') or ''} {record.get('nama_subkegiatan') or ''}"
            )
            category, category_slug, subcategory_slug, tags = infer_buyer_category(combined_for_category)
            budget_cents = as_int_rupiah_cents(record.get("pagu"))
            budget_label = format_idr_cents(budget_cents, "pagu")
            ukm_status = first_text(record, ["status_ukm"], "")
            pdn_status = first_text(record, ["status_pdn"], "")
            title = f"Pembeli mencari: {title_raw}"
            summary = clean_text(
                f"{buyer} membutuhkan penyedia untuk {procurement_type or 'pengadaan'}. "
                f"{budget_label}. Metode: {method}. {ukm_status}"
            )
            body = clean_text(
                f"Referensi paket RUP penyedia {year}. Pembeli: {buyer}. Paket: {title_raw}. "
                f"Uraian: {work_text or 'lihat sumber resmi'}. Spesifikasi: {spec_text or 'lihat sumber resmi'}. "
                f"Volume: {volume or 'lihat sumber resmi'}. Lokasi: {location}. "
                f"Metode: {method}. Jenis: {procurement_type or 'lihat sumber resmi'}. "
                f"{budget_label}. Data ini bukan lead otomatis Lajukan; verifikasi syarat, jadwal, dan status di sumber resmi."
            )
            slug = slugify(
                f"real-satrup-rup-penyedia-{year}-{kd_rup}-{title_raw}",
                f"real-satrup-rup-penyedia-{year}-{stable_hash(source_record_id)}",
            )
            tag_values = [
                "pembeli",
                "kebutuhan pengadaan",
                "RUP",
                *(tags or []),
                procurement_type,
                method,
                ukm_status,
                pdn_status,
            ]
            cleaned_tags = [tag for tag in dict.fromkeys(clean_text(tag) for tag in tag_values) if tag]
            search_text = clean_text(
                f"{title} {summary} {body} {' '.join(cleaned_tags)} penyedia supplier jasa usaha bahan usaha"
            )
            metadata_row = {
                "seed_pack": "real_indonesia_bulk_open_data",
                "record_kind": "public_procurement_buyer_need",
                "source_id": source["id"],
                "source_record_id": source_record_id,
                "source_url": source.get("source_url") or api_url,
                "source_api_url": api_url,
                "source_license": source.get("license"),
                "source_module": metadata.get("module"),
                "source_type": metadata.get("type"),
                "source_snapshot_id": metadata.get("snapshot_id"),
                "source_last_sync": last_sync,
                "is_transactional": False,
                "contact_policy": "no_private_contact_seeded",
                "market_side": "demand",
                "listing_side": "demand",
                "request_status": "source_reference",
                "buyer_name": buyer,
                "buyer_satker_code": satker_code,
                "kd_rup": kd_rup,
                "year": year,
                "procurement_type": procurement_type,
                "procurement_method": method,
                "status_ukm": ukm_status,
                "status_pdn": pdn_status,
                "budget_label": budget_label,
                "marketplace_category_slug": category_slug,
                "marketplace_subcategory_slug": subcategory_slug,
                "city": city,
                "province": province,
                "location": location,
                "volume": volume,
                "published_at_source": first_text(record, ["tgl_pengumuman_paket"], ""),
                "selection_start": first_text(record, ["tgl_awal_pemilihan"], ""),
                "selection_end": first_text(record, ["tgl_akhir_pemilihan"], ""),
                "contract_start": first_text(record, ["tgl_awal_kontrak"], ""),
                "contract_end": first_text(record, ["tgl_akhir_kontrak"], ""),
                "search_text": search_text,
            }
            emitted += 1
            yield BuyerRequest(
                source_id=source["id"],
                source_record_id=source_record_id,
                title=title,
                slug=slug,
                summary=summary,
                body=body,
                category=category,
                marketplace_category_slug=category_slug,
                marketplace_subcategory_slug=subcategory_slug,
                city=city,
                location=location,
                budget_cents=budget_cents,
                tags=cleaned_tags,
                search_text=search_text,
                source_url=source.get("source_url") or api_url,
                source_license=source.get("license", "Public procurement reference"),
                metadata=metadata_row,
            )
        if request_sleep > 0:
            time.sleep(request_sleep)


def google_places_api_key(source: dict[str, Any]) -> str:
    env_name = clean_text(source.get("api_key_env"), "GOOGLE_MAPS_API_KEY")
    return clean_text(os.environ.get(env_name) or os.environ.get("GOOGLE_PLACES_API_KEY"))


def google_place_photo_proxy_url(source: dict[str, Any], place_id: str) -> str:
    path = clean_text(source.get("photo_proxy_path"), "/api/media/google-place-photo")
    query = urllib.parse.urlencode(
        {
            "placeId": place_id.removeprefix("places/"),
            "maxWidth": int(source.get("max_width_px") or 800),
        }
    )
    return f"{path}?{query}"


def google_place_text_query(store: ProviderStore) -> str:
    return clean_text(f"{store.name} {store.address} {store.city} Indonesia")


def fetch_google_place_for_store(
    source: dict[str, Any],
    store: ProviderStore,
    api_key: str,
) -> dict[str, Any] | None:
    endpoint = clean_text(source.get("text_search_endpoint"), "https://places.googleapis.com/v1/places:searchText")
    body: dict[str, Any] = {
        "textQuery": google_place_text_query(store),
        "languageCode": "id",
        "regionCode": "ID",
    }
    if store.lat and store.lng:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": store.lat, "longitude": store.lng},
                "radius": float(source.get("location_bias_radius_m") or 750),
            }
        }
    payload = fetch_json_request(
        endpoint,
        method="POST",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "places.id,places.name,places.displayName,places.formattedAddress,"
                "places.googleMapsUri,places.photos.name,places.photos.authorAttributions"
            ),
        },
        timeout=int(source.get("timeout_seconds") or 20),
    )
    places = payload.get("places") if isinstance(payload, dict) else None
    if not isinstance(places, list):
        return None
    return next((place for place in places if isinstance(place, dict)), None)


def has_attribution_free_google_photo(place: dict[str, Any]) -> bool:
    photos = place.get("photos")
    if not isinstance(photos, list):
        return False
    for photo in photos:
        if not isinstance(photo, dict):
            continue
        attributions = photo.get("authorAttributions")
        if attributions is None:
            return True
        if isinstance(attributions, list) and not attributions:
            return True
    return False


def apply_google_places_photo_enrichment(
    source: dict[str, Any],
    stores: list[ProviderStore],
) -> list[ProviderStore]:
    api_key = google_places_api_key(source)
    if not api_key:
        print(
            f"warning: {source.get('id')} skipped because {source.get('api_key_env', 'GOOGLE_MAPS_API_KEY')} is not set",
            file=sys.stderr,
        )
        return stores

    max_rows = int(source.get("max_rows") or 50)
    request_sleep = float(source.get("request_sleep_seconds") or 0.15)
    enriched: list[ProviderStore] = []
    changed = 0
    for store in stores:
        if changed >= max_rows or store.metadata.get("image_url"):
            enriched.append(store)
            continue
        try:
            place = fetch_google_place_for_store(source, store, api_key)
        except Exception as exc:
            print(f"warning: google place lookup failed for {store.name}: {exc}", file=sys.stderr)
            enriched.append(store)
            continue
        if not place or not has_attribution_free_google_photo(place):
            enriched.append(store)
            continue
        place_id = clean_text(place.get("id")) or clean_text(place.get("name")).removeprefix("places/")
        if not place_id:
            enriched.append(store)
            continue
        image_url = google_place_photo_proxy_url(source, place_id)
        metadata = {
            **store.metadata,
            "image_url": image_url,
            "cover_image_url": image_url,
            "image_source_provider": "google_maps",
            "image_attribution": "Google Maps",
            "google_place_id": place_id,
            "google_maps_uri": clean_text(place.get("googleMapsUri")),
            "google_place_has_photos": True,
            "google_places_policy_url": source.get("policy_url"),
            "google_places_photo_note": (
                "Runtime proxy fetches a fresh photo name from Places API; raw Google photo names "
                "and downloaded photo files are not persisted."
            ),
        }
        enriched.append(replace(store, metadata=metadata))
        changed += 1
        if request_sleep > 0:
            time.sleep(request_sleep)
    if changed:
        print(f"enriched {changed} provider images from Google Places", file=sys.stderr)
    return enriched


def commons_metadata_value(extmetadata: dict[str, Any], key: str) -> str:
    value = extmetadata.get(key)
    if isinstance(value, dict):
        return clean_html_text(value.get("value"))
    return clean_html_text(value)


def fetch_commons_file_info(source: dict[str, Any], file_title: str) -> dict[str, Any] | None:
    endpoint = clean_text(source.get("endpoint"), "https://commons.wikimedia.org/w/api.php")
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "prop": "imageinfo",
        "titles": file_title,
        "iiprop": "url|mime|extmetadata",
        "redirects": "1",
    }
    url = f"{endpoint}?{urllib.parse.urlencode(params)}"
    payload = fetch_json(url, timeout=int(source.get("timeout_seconds") or 30))
    pages = (payload.get("query") or {}).get("pages") if isinstance(payload, dict) else None
    if not isinstance(pages, list) or not pages:
        return None
    page = pages[0]
    if not isinstance(page, dict) or page.get("missing"):
        return None
    imageinfo = page.get("imageinfo")
    if not isinstance(imageinfo, list) or not imageinfo:
        return None
    info = imageinfo[0]
    if not isinstance(info, dict):
        return None
    extmetadata = info.get("extmetadata")
    return {
        "page_title": clean_text(page.get("title"), file_title),
        "url": clean_text(info.get("url")),
        "description_url": clean_text(info.get("descriptionurl"))
        or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(file_title.replace(' ', '_'))}",
        "mime": clean_text(info.get("mime")),
        "extmetadata": extmetadata if isinstance(extmetadata, dict) else {},
    }


def iter_wikimedia_commons_media(
    source: dict[str, Any],
    max_rows: int | None,
) -> Iterable[CommonsMediaSeed]:
    items = source.get("items")
    if not isinstance(items, list):
        return
    request_sleep = float(source.get("request_sleep_seconds") or 0)
    emitted = 0
    seen: set[str] = set()
    for raw_item in items:
        if max_rows is not None and emitted >= max_rows:
            break
        if not isinstance(raw_item, dict):
            continue
        file_title = first_text(raw_item, ["file", "title", "media_title"])
        if not file_title:
            continue
        if not file_title.lower().startswith("file:"):
            file_title = f"File:{file_title}"
        if file_title.lower() in seen:
            continue
        seen.add(file_title.lower())

        info = fetch_commons_file_info(source, file_title)
        if not info:
            print(f"warning: commons file skipped because metadata was unavailable: {file_title}", file=sys.stderr)
            continue
        media_url = clean_text(info.get("url"))
        media_type = media_type_from_url_or_mime(media_url, clean_text(info.get("mime")))
        if not media_url or media_type not in {"image", "video"}:
            print(f"warning: commons file skipped because media type is unsupported: {file_title}", file=sys.stderr)
            continue

        extmetadata = info.get("extmetadata") if isinstance(info.get("extmetadata"), dict) else {}
        license_name = (
            commons_metadata_value(extmetadata, "LicenseShortName")
            or commons_metadata_value(extmetadata, "UsageTerms")
            or clean_text(source.get("license"), "Wikimedia Commons")
        )
        license_url = commons_metadata_value(extmetadata, "LicenseUrl")
        if not is_allowed_commons_license(license_name, license_url):
            print(f"warning: commons file skipped because license needs review: {file_title} ({license_name})", file=sys.stderr)
            continue

        source_url = clean_text(info.get("description_url"))
        author = (
            commons_metadata_value(extmetadata, "Artist")
            or commons_metadata_value(extmetadata, "Credit")
            or clean_text(raw_item.get("author"), "Wikimedia Commons contributor")
        )
        title = clean_text(raw_item.get("post_title")) or clean_html_text(
            commons_metadata_value(extmetadata, "ObjectName"),
            clean_text(info.get("page_title"), file_title).replace("File:", ""),
        )
        caption = clean_text(raw_item.get("caption")) or clean_html_text(
            commons_metadata_value(extmetadata, "ImageDescription"),
            f"Media real dari Wikimedia Commons untuk konteks usaha Indonesia. Verifikasi sumber dan lisensi sebelum dipakai produksi.",
        )
        category_slug = slugify(
            clean_text(raw_item.get("category_slug"), "services"),
            "services",
        )
        slug = slugify(
            f"real-commons-{clean_text(info.get('page_title'), file_title)}",
            f"real-commons-{stable_hash(file_title)}",
        )
        source_record_id = f"commons:{clean_text(info.get('page_title'), file_title)}"
        metadata = {
            "seed_pack": "real_indonesia_bulk_open_data",
            "record_kind": "real_open_media_reference",
            "source_id": source["id"],
            "source_record_id": source_record_id,
            "source_url": source_url,
            "source_license": license_name,
            "source_license_url": license_url,
            "media_url": media_url,
            "media_type": media_type,
            "media_mime": clean_text(info.get("mime")),
            "media_provider": "Wikimedia Commons",
            "media_author": author,
            "is_transactional": False,
            "contact_policy": "no_private_contact_seeded",
            "marketplace_category_slug": category_slug,
            "subject_city": clean_text(raw_item.get("city"), "Indonesia"),
            "attribution": f"Wikimedia Commons / {author}",
            "source": {
                "provider": "Wikimedia Commons",
                "title": clean_text(info.get("page_title"), file_title),
                "url": source_url,
                "direct_media_url": media_url,
                "author": author,
                "license": license_name,
                "license_url": license_url,
                "access": "free_public_media",
            },
        }
        emitted += 1
        yield CommonsMediaSeed(
            source_id=source["id"],
            source_record_id=source_record_id,
            title=title[:160],
            slug=slug,
            caption=caption[:500],
            tag=clean_text(raw_item.get("tag"), "Data Publik")[:80],
            product_name=clean_text(raw_item.get("product_name"), "Referensi usaha Indonesia")[:120],
            product_price=clean_text(raw_item.get("product_price"), "Sumber bebas, bukan listing berbayar")[:120],
            product_href=clean_text(raw_item.get("product_href"), f"/id/explore/{category_slug}"),
            media_url=media_url,
            media_type=media_type,
            source_url=source_url,
            source_license=license_name,
            license_url=license_url,
            author=author[:160],
            city=clean_text(raw_item.get("city"), "Indonesia")[:80],
            category_slug=category_slug,
            tone=clean_text(raw_item.get("tone"), "emerald")[:32],
            icon_key=clean_text(raw_item.get("icon_key"), "community")[:32],
            hook=clean_text(
                raw_item.get("hook"),
                "Gunakan sebagai referensi visual dan diskusi, bukan klaim stok, harga, atau kontak.",
            )[:220],
            metadata=metadata,
        )
        if request_sleep > 0:
            time.sleep(request_sleep)


def csv_block(rows: list[list[Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(rows)
    return buffer.getvalue()


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_nullable_text(value: str | None) -> str:
    cleaned = clean_text(value)
    return sql_literal(cleaned) if cleaned else "NULL"


def sql_json(value: Any) -> str:
    return f"{sql_literal(json.dumps(value, ensure_ascii=False, separators=(',', ':')))}::jsonb"


def sql_text_array(values: Iterable[str]) -> str:
    cleaned = [clean_text(value) for value in values if clean_text(value)]
    if not cleaned:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ", ".join(sql_literal(value) for value in cleaned) + "]::text[]"


COMMUNITY_BUCKETS = {
    "materials-suppliers": {
        "category_id": "real-c-komunitas-usaha-supplier-lokal",
        "category_name": "Komunitas Usaha Supplier Lokal",
        "category_slug": "komunitas-usaha-supplier-lokal",
        "category_description": "Rujukan komunitas usaha untuk bahan, pemasok, asal produk, dan data komoditas Indonesia.",
        "icon": "package",
        "color": "#059669",
        "position": 120,
        "group_id": "real-g-komunitas-usaha-supplier-bahan-lokal",
        "group_name": "Komunitas Usaha: Supplier & Bahan Lokal",
        "group_slug": "komunitas-usaha-supplier-bahan-lokal",
        "group_description": "Grup rujukan komunitas usaha untuk bahan baku, Indikasi Geografis, publikasi BPS, dan asal produk Indonesia.",
        "cover_url": None,
    },
    "machines-tools": {
        "category_id": "real-c-komunitas-usaha-mesin-alat",
        "category_name": "Komunitas Usaha Mesin & Alat",
        "category_slug": "komunitas-usaha-mesin-alat",
        "category_description": "Rujukan komunitas usaha untuk mesin produksi, peralatan IKM, dan pengadaan alat.",
        "icon": "tools",
        "color": "#7c3aed",
        "position": 130,
        "group_id": "real-g-komunitas-usaha-mesin-alat-ikm",
        "group_name": "Komunitas Usaha: Mesin, Alat, dan IKM",
        "group_slug": "komunitas-usaha-mesin-alat-ikm",
        "group_description": "Grup rujukan komunitas usaha untuk mesin produksi, peralatan IKM, dan rencana pengadaan alat yang perlu dibaca hati-hati.",
        "cover_url": None,
    },
    "business-places": {
        "category_id": "real-c-komunitas-usaha-tempat",
        "category_name": "Komunitas Usaha Tempat & Pasar",
        "category_slug": "komunitas-usaha-tempat-pasar",
        "category_description": "Rujukan komunitas usaha untuk pasar, lokasi usaha, sentra produksi, dan tempat publik Indonesia.",
        "icon": "map-pin",
        "color": "#2563eb",
        "position": 140,
        "group_id": "real-g-komunitas-usaha-tempat-pasar",
        "group_name": "Komunitas Usaha: Tempat, Pasar, dan Sentra",
        "group_slug": "komunitas-usaha-tempat-pasar-sentra",
        "group_description": "Grup rujukan komunitas usaha untuk membaca lokasi pasar nyata, sentra usaha, dan peluang tempat usaha tanpa klaim kontak privat.",
        "cover_url": None,
    },
    "business-opportunities": {
        "category_id": "real-c-komunitas-usaha-peluang-kemitraan",
        "category_name": "Komunitas Usaha Peluang & Kemitraan",
        "category_slug": "komunitas-usaha-peluang-kemitraan",
        "category_description": "Rujukan komunitas usaha untuk peluang, reseller, kemitraan, dan pasar pengadaan yang perlu diverifikasi.",
        "icon": "handshake",
        "color": "#d97706",
        "position": 150,
        "group_id": "real-g-komunitas-usaha-peluang-kemitraan",
        "group_name": "Komunitas Usaha: Peluang, Reseller, dan Kemitraan",
        "group_slug": "komunitas-usaha-peluang-reseller-kemitraan",
        "group_description": "Grup rujukan komunitas usaha untuk membaca peluang reseller, kemitraan, e-Katalog, OSS/KBLI, dan business matching tanpa janji keuntungan.",
        "cover_url": None,
    },
    "services": {
        "category_id": "real-c-komunitas-usaha-data-publik",
        "category_name": "Komunitas Usaha & Data Publik",
        "category_slug": "komunitas-usaha-data-publik",
        "category_description": "Rujukan komunitas usaha untuk membaca data publik Indonesia sebelum mengambil keputusan bisnis.",
        "icon": "community",
        "color": "#0f766e",
        "position": 110,
        "group_id": "real-g-komunitas-usaha-data-indonesia",
        "group_name": "Komunitas Usaha: Data Publik Indonesia",
        "group_slug": "komunitas-usaha-data-publik-indonesia",
        "group_description": "Grup rujukan komunitas usaha untuk membaca BPS, OSS/BKPM, LKPP, Wikimedia Commons, dan sumber publik Indonesia.",
        "cover_url": None,
    },
}


def community_bucket_for(category_slug: str) -> dict[str, Any]:
    return COMMUNITY_BUCKETS.get(category_slug, COMMUNITY_BUCKETS["services"])


def write_community_sql(out_path: str, media_items: list[CommonsMediaSeed]) -> None:
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    used_buckets = {
        community_bucket_for(item.category_slug)["category_id"]: community_bucket_for(item.category_slug)
        for item in media_items
    }
    if not used_buckets:
        used_buckets = {"real-c-komunitas-usaha-data-publik": COMMUNITY_BUCKETS["services"]}

    parts: list[str] = [
        "-- Generated by scripts/import_real_marketplace_open_data.py",
        f"-- Generated at {now}",
        "BEGIN;",
        "SET search_path = forum, reel, public, events;",
        "INSERT INTO forum.lajukan_forum_users (",
        "  id, username, name, avatar_url, title, reputation, base_reputation, badges, metadata, created_at, updated_at",
        ") VALUES (",
        f"  {sql_literal(OPEN_DATA_OWNER_ID)}, 'lajukan_bulk_open_data', 'Lajukan Bulk Open Data', '',",
        "  'Kurator data publik', 0, 0, ARRAY['open-data'],",
        "  '{\"seed_pack\":\"real_indonesia_bulk_open_data\",\"account_type\":\"system_seed_curator\",\"contact_policy\":\"no_private_contact_seeded\"}'::jsonb,",
        "  NOW(), NOW()",
        ") ON CONFLICT (id) DO UPDATE",
        "SET username = EXCLUDED.username,",
        "    name = EXCLUDED.name,",
        "    avatar_url = EXCLUDED.avatar_url,",
        "    title = EXCLUDED.title,",
        "    badges = EXCLUDED.badges,",
        "    metadata = COALESCE(lajukan_forum_users.metadata, '{}'::jsonb) || EXCLUDED.metadata,",
        "    updated_at = NOW();",
    ]

    category_values = []
    group_values = []
    group_ids = []
    for bucket in used_buckets.values():
        category_values.append(
            "("
            f"{sql_literal(bucket['category_id'])}, {sql_literal(bucket['category_name'])}, "
            f"{sql_literal(bucket['category_slug'])}, {sql_literal(bucket['category_description'])}, "
            f"{sql_literal(bucket['icon'])}, {sql_literal(bucket['color'])}, {int(bucket['position'])}, "
            "0, 0, NOW(), NOW()"
            ")"
        )
        group_values.append(
            "("
            f"{sql_literal(bucket['group_id'])}, {sql_literal(bucket['category_id'])}, "
            f"{sql_literal(bucket['group_name'])}, {sql_literal(bucket['group_slug'])}, "
            f"{sql_literal(bucket['group_description'])}, 'public', 'public', 'open', "
            f"{sql_nullable_text(bucket.get('cover_url'))}, "
            "ARRAY['Cantumkan sumber dan lisensi saat berbagi data.', 'Jangan menulis nomor kontak pribadi tanpa izin.', 'Bedakan rujukan publik dari penawaran transaksi aktif.']::text[], "
            f"{sql_literal(OPEN_DATA_OWNER_ID)}, 'active', NOW(), NOW()"
            ")"
        )
        group_ids.append(bucket["group_id"])

    parts.extend(
        [
            "INSERT INTO forum.lajukan_forum_categories (",
            "  id, name, slug, description, icon, color, position, thread_count, post_count, created_at, updated_at",
            ") VALUES",
            ",\n".join(category_values),
            "ON CONFLICT (id) DO UPDATE",
            "SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description,",
            "    icon = EXCLUDED.icon, color = EXCLUDED.color, position = EXCLUDED.position, updated_at = NOW();",
            "INSERT INTO forum.lajukan_groups (",
            "  id, category_id, name, slug, description, privacy, posting_permission, membership_permission,",
            "  cover_url, rules, created_by_user_id, status, created_at, updated_at",
            ") VALUES",
            ",\n".join(group_values),
            "ON CONFLICT (category_id) DO UPDATE",
            "SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description,",
            "    privacy = EXCLUDED.privacy, posting_permission = EXCLUDED.posting_permission,",
            "    membership_permission = EXCLUDED.membership_permission, cover_url = EXCLUDED.cover_url,",
            "    rules = EXCLUDED.rules, status = EXCLUDED.status, updated_at = NOW();",
            "INSERT INTO forum.lajukan_group_members (group_id, user_id, role, status, notifications_enabled, joined_at, updated_at)",
            f"SELECT id, {sql_literal(OPEN_DATA_OWNER_ID)}, 'owner', 'active', TRUE, NOW(), NOW()",
            "FROM forum.lajukan_groups",
            f"WHERE id = ANY({sql_text_array(group_ids)})",
            "ON CONFLICT (group_id, user_id) DO UPDATE",
            "SET role = EXCLUDED.role, status = EXCLUDED.status, notifications_enabled = EXCLUDED.notifications_enabled, updated_at = NOW();",
        ]
    )

    if media_items:
        tag_values = sorted(
            {
                (
                    slugify(item.tag, f"tag-{stable_hash(item.tag)}"),
                    item.tag,
                    f"Topik rujukan {item.tag} dari seed media publik.",
                )
                for item in media_items
            }
        )
        parts.extend(
            [
                "INSERT INTO forum.lajukan_forum_tags (id, name, slug, description, color, usage_count) VALUES",
                ",\n".join(
                    "("
                    f"{sql_literal(f'real-tag-{slug}')}, {sql_literal(name)}, {sql_literal(slug)}, "
                    f"{sql_literal(description)}, '#64748b', 0"
                    ")"
                    for slug, name, description in tag_values
                ),
                "ON CONFLICT (slug) DO UPDATE",
                "SET name = EXCLUDED.name, description = EXCLUDED.description, usage_count = EXCLUDED.usage_count;",
            ]
        )

        thread_values = []
        post_values = []
        thread_tag_values = []
        reel_values = []
        for index, item in enumerate(media_items):
            bucket = community_bucket_for(item.category_slug)
            thread_id = stable_sql_id("real-thread", item.source_record_id)
            post_id = stable_sql_id("real-post", item.source_record_id)
            reel_id = stable_sql_id("real-reel", item.source_record_id)
            thread_slug = slugify(f"diskusi-{item.slug}", thread_id)
            tag_slug = slugify(item.tag, f"tag-{stable_hash(item.tag)}")
            image_urls = [item.media_url] if item.media_type == "image" else []
            thread_content = (
                f"{item.caption}\n\n"
                f"Sumber: {item.source_url}\n"
                f"Lisensi: {item.source_license}\n"
                f"Catatan: ini rujukan publik untuk diskusi usaha, bukan klaim vendor, stok, harga, atau kontak."
            )
            thread_values.append(
                "("
                f"{sql_literal(thread_id)}, {sql_literal(item.title)}, {sql_literal(thread_slug)}, "
                f"{sql_literal(bucket['category_id'])}, {sql_literal(OPEN_DATA_OWNER_ID)}, "
                f"NOW() - INTERVAL '{index + 1} hours', NOW() - INTERVAL '{index + 1} hours', "
                "0, 1, 0, 0, FALSE, FALSE, FALSE, 'open', "
                f"{sql_text_array(image_urls)}"
                ")"
            )
            post_values.append(
                "("
                f"{sql_literal(post_id)}, {sql_literal(thread_id)}, {sql_literal(OPEN_DATA_OWNER_ID)}, "
                f"{sql_literal(thread_content)}, NOW() - INTERVAL '{index + 1} hours', NOW(), "
                "0, NULL, FALSE, '{}'::jsonb, "
                f"{sql_text_array(image_urls)}"
                ")"
            )
            thread_tag_values.append(
                f"({sql_literal(thread_id)}, {sql_literal(tag_slug)}, 0)"
            )
            reel_metadata = {
                **item.metadata,
                "community_thread_id": thread_id,
                "generated_by": "import_real_marketplace_open_data.py",
            }
            reel_values.append(
                "("
                f"{sql_literal(reel_id)}, {sql_literal(OPEN_DATA_OWNER_ID)}, "
                f"{sql_literal(f'Wikimedia Commons / {item.author}')}, {sql_literal(item.title)}, "
                f"{sql_literal(item.caption)}, {sql_literal(item.tag)}, {sql_literal(item.product_name)}, "
                f"{sql_literal(item.product_price)}, {sql_literal(item.product_href)}, "
                f"{sql_literal(item.media_url)}, {sql_literal(item.source_url)}, 0, 0, 0, "
                f"{sql_literal(item.tone)}, {sql_literal(item.icon_key)}, {sql_literal(item.media_url)}, "
                f"{sql_literal(item.media_type)}, {sql_literal(item.hook)}, 'natural', 'upload', 'none', "
                "NULL, NULL, "
                f"{sql_json(reel_metadata)}, '', '', {sql_literal(item.product_name)}, {sql_literal(item.city)}, "
                "NULL, '', 'published', "
                f"NOW() - INTERVAL '{index + 1} hours', NOW() - INTERVAL '{index + 1} hours', NOW()"
                ")"
            )

        parts.extend(
            [
                "INSERT INTO forum.lajukan_forum_threads (",
                "  id, title, slug, category_id, author_id, created_at, last_activity_at, views, reply_count,",
                "  like_count, bookmark_count, is_pinned, is_locked, is_solved, status, image_urls",
                ") VALUES",
                ",\n".join(thread_values),
                "ON CONFLICT (id) DO UPDATE",
                "SET title = EXCLUDED.title, slug = EXCLUDED.slug, category_id = EXCLUDED.category_id,",
                "    last_activity_at = EXCLUDED.last_activity_at, status = EXCLUDED.status, image_urls = EXCLUDED.image_urls;",
                "INSERT INTO forum.lajukan_forum_posts (",
                "  id, thread_id, author_id, content, created_at, updated_at, like_count, reply_to_post_id,",
                "  is_answer, reactions, image_urls",
                ") VALUES",
                ",\n".join(post_values),
                "ON CONFLICT (id) DO UPDATE",
                "SET content = EXCLUDED.content, updated_at = NOW(), reactions = EXCLUDED.reactions, image_urls = EXCLUDED.image_urls;",
                "INSERT INTO forum.lajukan_forum_thread_tags (thread_id, tag_slug, position) VALUES",
                ",\n".join(thread_tag_values),
                "ON CONFLICT (thread_id, tag_slug) DO UPDATE SET position = EXCLUDED.position;",
                "INSERT INTO reel.lajukan_reels (",
                "  id, creator_user_id, creator, title, caption, tag, product_name, product_price, product_href,",
                "  video_src, source_url, likes_count, comments_count, shares_count, tone, icon_key, media_url,",
                "  media_type, hook, filter_preset, capture_mode, live_status, live_title, live_scheduled_at,",
                "  metadata, store_id, store_slug, store_name, store_city, store_phone, storefront_path, status,",
                "  published_at, created_at, updated_at",
                ") VALUES",
                ",\n".join(reel_values),
                "ON CONFLICT (id) DO UPDATE",
                "SET creator_user_id = EXCLUDED.creator_user_id, creator = EXCLUDED.creator, title = EXCLUDED.title,",
                "    caption = EXCLUDED.caption, tag = EXCLUDED.tag, product_name = EXCLUDED.product_name,",
                "    product_price = EXCLUDED.product_price, product_href = EXCLUDED.product_href,",
                "    video_src = EXCLUDED.video_src, source_url = EXCLUDED.source_url, tone = EXCLUDED.tone,",
                "    icon_key = EXCLUDED.icon_key, media_url = EXCLUDED.media_url, media_type = EXCLUDED.media_type,",
                "    hook = EXCLUDED.hook, metadata = EXCLUDED.metadata, store_name = EXCLUDED.store_name,",
                "    store_city = EXCLUDED.store_city, status = EXCLUDED.status, updated_at = NOW();",
                "UPDATE forum.lajukan_forum_categories c",
                "SET thread_count = counted.thread_count, post_count = counted.post_count, updated_at = NOW()",
                "FROM (",
                "  SELECT category_id, COUNT(*)::int AS thread_count, COALESCE(SUM(reply_count + 1), 0)::int AS post_count",
                "  FROM forum.lajukan_forum_threads",
                f"  WHERE category_id = ANY({sql_text_array([bucket['category_id'] for bucket in used_buckets.values()])})",
                "  GROUP BY category_id",
                ") counted",
                "WHERE c.id = counted.category_id;",
            ]
        )

    parts.extend(["COMMIT;", ""])
    path.write_text("\n".join(parts), encoding="utf-8")


def write_sql(out_path: str, stores: list[ProviderStore], requests: list[BuyerRequest]) -> None:
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    parts: list[str] = [
        "-- Generated by scripts/import_real_marketplace_open_data.py",
        f"-- Generated at {now}",
        "BEGIN;",
        "INSERT INTO users_read_model (",
        "  user_id, email, username, full_name, avatar_url, email_verified,",
        "  phone_verified, identity_verified, transaction_eligible, status,",
        "  metadata, identity_version, identity_updated_at, synced_at",
        ") VALUES (",
        f"  {sql_literal(OPEN_DATA_OWNER_ID)},",
        "  'bulk-open-data@lajukan.seed',",
        "  'lajukan_bulk_open_data',",
        "  'Lajukan Bulk Open Data',",
        "  '',",
        "  TRUE, FALSE, FALSE, FALSE, 'active',",
        "  '{\"seed_pack\":\"real_indonesia_bulk_open_data\",\"account_type\":\"system_seed_curator\",\"contact_policy\":\"no_private_contact_seeded\"}'::jsonb,",
        "  1, NOW(), NOW()",
        ") ON CONFLICT (user_id) DO UPDATE",
        "SET email = EXCLUDED.email,",
        "    username = EXCLUDED.username,",
        "    full_name = EXCLUDED.full_name,",
        "    avatar_url = EXCLUDED.avatar_url,",
        "    status = EXCLUDED.status,",
        "    metadata = COALESCE(users_read_model.metadata, '{}'::jsonb) || EXCLUDED.metadata,",
        "    synced_at = NOW();",
    ]
    if stores:
        parts.extend(provider_store_sql(stores))
    if requests:
        parts.extend(buyer_request_sql(requests))
    parts.extend(["COMMIT;", ""])
    path.write_text("\n".join(parts), encoding="utf-8")


def provider_store_sql(stores: list[ProviderStore]) -> list[str]:
    rows = csv_block(
        [
            [
                row.source_id,
                row.source_record_id,
                row.name,
                row.slug,
                row.description,
                row.city,
                row.address,
                row.lat,
                row.lng,
                row.segment,
                row.search_text,
                row.source_url,
                row.source_license,
                json.dumps(row.metadata, ensure_ascii=False, separators=(",", ":")),
            ]
            for row in stores
        ]
    ).rstrip("\n")
    return [
        "CREATE TEMP TABLE stage_real_provider_stores (",
        "  source_id text, source_record_id text, name text, slug text, description text,",
        "  city text, address text, lat double precision, lng double precision,",
        "  segment text, search_text text, source_url text, source_license text, metadata jsonb",
        ") ON COMMIT DROP;",
        "COPY stage_real_provider_stores (source_id, source_record_id, name, slug, description, city, address, lat, lng, segment, search_text, source_url, source_license, metadata) FROM STDIN WITH (FORMAT csv, NULL '');",
        rows,
        "\\.",
        "INSERT INTO umkm_stores (",
        "  owner_user_id, name, slug, description, city, address, lat, lng, phone,",
        "  is_active, online_order_enabled, offline_order_enabled, metadata, created_at, updated_at",
        ")",
        "SELECT",
        f"  {sql_literal(OPEN_DATA_OWNER_ID)}::uuid,",
        "  name, slug, description, city, address, lat, lng, NULL,",
        "  TRUE, FALSE, FALSE,",
        "  metadata || jsonb_build_object('source_url', source_url, 'source_license', source_license, 'imported_at', NOW()),",
        "  NOW(), NOW()",
        "FROM stage_real_provider_stores",
        "ON CONFLICT (slug) DO UPDATE",
        "SET name = EXCLUDED.name,",
        "    description = EXCLUDED.description,",
        "    city = EXCLUDED.city,",
        "    address = EXCLUDED.address,",
        "    lat = EXCLUDED.lat,",
        "    lng = EXCLUDED.lng,",
        "    phone = NULL,",
        "    is_active = TRUE,",
        "    online_order_enabled = FALSE,",
        "    offline_order_enabled = FALSE,",
        "    metadata = EXCLUDED.metadata,",
        "    updated_at = NOW();",
    ]


def buyer_request_sql(requests: list[BuyerRequest]) -> list[str]:
    rows = csv_block(
        [
            [
                row.source_id,
                row.source_record_id,
                row.title,
                row.slug,
                row.summary,
                row.body,
                row.category,
                row.marketplace_category_slug,
                row.marketplace_subcategory_slug,
                row.city,
                row.location,
                row.budget_cents or "",
                json.dumps(row.tags, ensure_ascii=False, separators=(",", ":")),
                row.search_text,
                row.source_url,
                row.source_license,
                json.dumps(row.metadata, ensure_ascii=False, separators=(",", ":")),
            ]
            for row in requests
        ]
    ).rstrip("\n")
    return [
        "CREATE TEMP TABLE stage_real_buyer_requests (",
        "  source_id text, source_record_id text, title text, slug text, summary text, body text,",
        "  category text, marketplace_category_slug text, marketplace_subcategory_slug text,",
        "  city text, location text, budget_cents bigint, tags jsonb, search_text text,",
        "  source_url text, source_license text, metadata jsonb",
        ") ON COMMIT DROP;",
        "COPY stage_real_buyer_requests (source_id, source_record_id, title, slug, summary, body, category, marketplace_category_slug, marketplace_subcategory_slug, city, location, budget_cents, tags, search_text, source_url, source_license, metadata) FROM STDIN WITH (FORMAT csv, NULL '');",
        rows,
        "\\.",
        "INSERT INTO content_items (",
        "  owner_id, content_type, slug, title, summary, body, pricing_mode, price_cents,",
        "  price_unit, original_price_cents, seller_type, minimum_order, promo_label,",
        "  promo_start_at, promo_end_at, currency, tags, cover_image, category, content_status,",
        "  rating, review_count, marketplace_category_id, marketplace_subcategory_id,",
        "  listing_intent, listing_status, completion_percentage, last_saved_at, published_at,",
        "  attributes, contact_snapshot, metadata, created_at, updated_at",
        ")",
        "SELECT",
        f"  {sql_literal(OPEN_DATA_OWNER_ID)}::uuid,",
        "  'request', slug, title, summary, body, 'request', budget_cents,",
        "  'project', NULL, 'public_procurement_buyer', NULL, NULL, NULL, NULL,",
        "  'IDR', ARRAY(SELECT jsonb_array_elements_text(tags)),",
        "  COALESCE(metadata->>'cover_image_url', metadata->>'image_url', metadata->>'media_url'),",
        "  category, 'active',",
        "  0, 0,",
        "  (SELECT id FROM marketplace_categories WHERE slug = marketplace_category_slug LIMIT 1),",
        "  (SELECT ms.id FROM marketplace_subcategories ms JOIN marketplace_categories mc ON mc.id = ms.category_id WHERE mc.slug = marketplace_category_slug AND ms.slug = marketplace_subcategory_slug LIMIT 1),",
        "  'request', 'published', 100, NOW(), NOW(),",
        "  jsonb_build_object('record_kind', 'public_procurement_buyer_need', 'source_id', source_id, 'source_record_id', source_record_id, 'source_url', source_url),",
        "  jsonb_build_object('source_only', true, 'contact_policy', 'no_private_contact_seeded'),",
        "  metadata || jsonb_build_object('source_url', source_url, 'source_license', source_license, 'imported_at', NOW()),",
        "  NOW(), NOW()",
        "FROM stage_real_buyer_requests",
        "ON CONFLICT (slug) DO UPDATE",
        "SET title = EXCLUDED.title,",
        "    summary = EXCLUDED.summary,",
        "    body = EXCLUDED.body,",
        "    price_cents = EXCLUDED.price_cents,",
        "    tags = EXCLUDED.tags,",
        "    category = EXCLUDED.category,",
        "    content_status = EXCLUDED.content_status,",
        "    marketplace_category_id = EXCLUDED.marketplace_category_id,",
        "    marketplace_subcategory_id = EXCLUDED.marketplace_subcategory_id,",
        "    listing_intent = EXCLUDED.listing_intent,",
        "    listing_status = EXCLUDED.listing_status,",
        "    attributes = EXCLUDED.attributes,",
        "    contact_snapshot = EXCLUDED.contact_snapshot,",
        "    metadata = EXCLUDED.metadata,",
        "    updated_at = NOW();",
    ]


def enabled_sources(config: dict[str, Any], source_ids: set[str]) -> list[dict[str, Any]]:
    selected = []
    for source in config.get("sources", []):
        if source_ids:
            if source.get("id") in source_ids:
                selected.append(source)
        elif source.get("enabled_by_default"):
            selected.append(source)
    return selected


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--out", default=DEFAULT_OUT)
    parser.add_argument("--community-out", default=DEFAULT_COMMUNITY_OUT)
    parser.add_argument("--source", action="append", default=[], help="Source id to run. Defaults to enabled_by_default sources.")
    parser.add_argument("--max-providers", type=int, default=1000, help="Use -1 for unlimited.")
    parser.add_argument("--max-buyers", type=int, default=1000, help="Use -1 for unlimited.")
    parser.add_argument("--max-community-media", type=int, default=80, help="Use -1 for unlimited.")
    parser.add_argument("--sleep", type=float, default=1.0, help="Seconds between remote source windows.")
    parser.add_argument("--summary-only", action="store_true", help="Print selected source plan without fetching.")
    parser.add_argument("--strict", action="store_true", help="Fail the whole import if any enabled source fails.")
    parser.add_argument("--no-community-out", action="store_true", help="Skip community/reels SQL output.")
    parser.add_argument(
        "--allow-image-less-records",
        action="store_true",
        help="Allow reference-only marketplace rows without a real external image. Default seed output skips them.",
    )
    args = parser.parse_args(argv)

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    sources = enabled_sources(config, set(args.source))
    if args.summary_only:
        print(json.dumps({"sources": [source["id"] for source in sources]}, indent=2))
        return 0

    stores: list[ProviderStore] = []
    requests: list[BuyerRequest] = []
    media_items: list[CommonsMediaSeed] = []
    image_enrichers: list[dict[str, Any]] = []
    remaining_providers = args.max_providers if args.max_providers >= 0 else None
    remaining_buyers = args.max_buyers if args.max_buyers >= 0 else None
    remaining_community_media = args.max_community_media if args.max_community_media >= 0 else None

    for source in sources:
        kind = source.get("kind")
        role = source.get("role")
        print(f"fetching {source.get('id')} ({kind}/{role})", file=sys.stderr)
        try:
            if kind == "osm_overpass" and role == "provider":
                before = len(stores)
                stores.extend(iter_overpass_providers(source, remaining_providers))
                added = len(stores) - before
                if remaining_providers is not None:
                    remaining_providers = max(0, remaining_providers - added)
            elif kind == "lpse_sirup_api" and role == "buyer":
                before = len(requests)
                requests.extend(iter_lpse_buyer_requests(source, remaining_buyers))
                added = len(requests) - before
                if remaining_buyers is not None:
                    remaining_buyers = max(0, remaining_buyers - added)
            elif kind == "satrup_status_rup" and role == "buyer":
                before = len(requests)
                requests.extend(iter_satrup_status_rup_requests(source, remaining_buyers))
                added = len(requests) - before
                if remaining_buyers is not None:
                    remaining_buyers = max(0, remaining_buyers - added)
            elif kind == "satrup_rup_penyedia" and role == "buyer":
                before = len(requests)
                requests.extend(iter_satrup_rup_penyedia_requests(source, remaining_buyers))
                added = len(requests) - before
                if remaining_buyers is not None:
                    remaining_buyers = max(0, remaining_buyers - added)
            elif kind == "google_places_photo_enrichment" and role == "provider_image_enrichment":
                image_enrichers.append(source)
            elif kind == "wikimedia_commons_media" and role == "community_reels":
                before = len(media_items)
                media_items.extend(iter_wikimedia_commons_media(source, remaining_community_media))
                added = len(media_items) - before
                if remaining_community_media is not None:
                    remaining_community_media = max(0, remaining_community_media - added)
            else:
                print(f"skipping unsupported/default-disabled source {source.get('id')}", file=sys.stderr)
        except Exception as exc:
            if args.strict:
                raise
            print(f"warning: source {source.get('id')} skipped after error: {exc}", file=sys.stderr)
        if args.sleep > 0:
            time.sleep(args.sleep)

    for source in image_enrichers:
        try:
            stores = apply_google_places_photo_enrichment(source, stores)
        except Exception as exc:
            if args.strict:
                raise
            print(f"warning: source {source.get('id')} skipped after error: {exc}", file=sys.stderr)

    skipped_provider_stores = 0
    skipped_buyer_requests = 0
    if not args.allow_image_less_records:
        skipped_provider_stores = len(stores)
        stores = [store for store in stores if metadata_has_real_visual(store.metadata)]
        skipped_provider_stores -= len(stores)
        skipped_buyer_requests = len(requests)
        requests = [request for request in requests if metadata_has_real_visual(request.metadata)]
        skipped_buyer_requests -= len(requests)
        if skipped_provider_stores:
            print(f"skipped {skipped_provider_stores} provider rows without a real external image", file=sys.stderr)
        if skipped_buyer_requests:
            print(f"skipped {skipped_buyer_requests} buyer rows without a real external image", file=sys.stderr)

    write_sql(args.out, stores, requests)
    if not args.no_community_out:
        write_community_sql(args.community_out, media_items)
    print(
        json.dumps(
            {
                "out": args.out,
                "community_out": None if args.no_community_out else args.community_out,
                "provider_stores": len(stores),
                "buyer_requests": len(requests),
                "allow_image_less_records": args.allow_image_less_records,
                "skipped_provider_stores_without_images": skipped_provider_stores,
                "skipped_buyer_requests_without_images": skipped_buyer_requests,
                "community_media": len(media_items),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
