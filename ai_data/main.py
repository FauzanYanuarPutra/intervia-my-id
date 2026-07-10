import requests
import pandas as pd
import json

# =========================
# 1. UN COMTRADE (TRADE DATA)
# =========================
def get_comtrade_data(country="IDN", year=2023):
    url = "https://comtradeapi.un.org/public/v1/preview/flow"

    params = {
        "reporterCode": country,
        "period": year,
        "partnerCode": "all",
        "cmdCode": "TOTAL",
        "flowCode": "M,X"  # import & export
    }

    try:
        r = requests.get(url, params=params)
        data = r.json()
        return data
    except Exception as e:
        print("Comtrade error:", e)
        return None


# =========================
# 2. WORLD BANK DATA
# =========================
def get_world_bank_data(country="IDN"):
    url = f"https://api.worldbank.org/v2/country/{country}/indicator/NY.GDP.MKTP.CD?format=json"

    try:
        r = requests.get(url)
        data = r.json()
        return data
    except Exception as e:
        print("World Bank error:", e)
        return None


# =========================
# 3. OPENALEX (RESEARCH DATA)
# =========================
def get_openalex(query="artificial intelligence", per_page=5):
    url = "https://api.openalex.org/works"

    params = {
        "search": query,
        "per-page": per_page
    }

    try:
        r = requests.get(url, params=params)
        data = r.json()
        return data
    except Exception as e:
        print("OpenAlex error:", e)
        return None


# =========================
# 4. OPEN LIBRARY (BOOK DATA)
# =========================
def get_openlibrary(query="business"):
    url = f"https://openlibrary.org/search.json?q={query}"

    try:
        r = requests.get(url)
        data = r.json()
        return data
    except Exception as e:
        print("OpenLibrary error:", e)
        return None


# =========================
# 5. RUN ALL PIPELINE
# =========================
def run_pipeline():
    print("Fetching data...\n")

    trade = get_comtrade_data()
    world_bank = get_world_bank_data()
    research = get_openalex()
    books = get_openlibrary()

    result = {
        "trade_data": trade,
        "world_bank": world_bank,
        "research": research,
        "books": books
    }

    # SAVE RAW JSON
    with open("lajukan_data.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Saved: lajukan_data.json")

    # =========================
    # SIMPLE SUMMARY OUTPUT
    # =========================

    summary = {
        "trade_status": "OK" if trade else "FAILED",
        "world_bank_status": "OK" if world_bank else "FAILED",
        "research_count": len(research.get("results", [])) if research else 0,
        "book_count": books.get("numFound", 0) if books else 0
    }

    df = pd.DataFrame([summary])
    df.to_csv("lajukan_summary.csv", index=False)

    print("Saved: lajukan_summary.csv")
    print(df)


# =========================
# RUN
# =========================
if __name__ == "__main__":
    run_pipeline()