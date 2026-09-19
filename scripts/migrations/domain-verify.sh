#!/usr/bin/env bash
set -Eeuo pipefail

required=(LEGACY_PGHOST LEGACY_PGPORT LEGACY_PGUSER LEGACY_PGPASSWORD TARGET_PGHOST TARGET_PGPORT TARGET_PGUSER TARGET_PGPASSWORD)
for key in "${required[@]}"; do
  [[ -n "${!key:-}" ]] || { echo "missing $key" >&2; exit 2; }
done

DOMAIN="${DOMAIN:-all}"
TMP_DIR="${TMPDIR:-/tmp}/lajukan-domain-verify-$$"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

q_legacy() {
  PGPASSWORD="$LEGACY_PGPASSWORD" psql -X -At -v ON_ERROR_STOP=1     -h "$LEGACY_PGHOST" -p "$LEGACY_PGPORT" -U "$LEGACY_PGUSER" -d marketplace_db     -c "$1"
}

q_target() {
  local db="$1"
  local query="$2"
  PGPASSWORD="$TARGET_PGPASSWORD" psql -X -At -v ON_ERROR_STOP=1     -h "$TARGET_PGHOST" -p "$TARGET_PGPORT" -U "$TARGET_PGUSER" -d "$db"     -c "$query"
}

compare() {
  local label="$1" db="$2" legacy_query="$3" target_query="$4"
  local l t
  l="$(q_legacy "$legacy_query")"
  t="$(q_target "$db" "$target_query")"
  printf '%s\n' "$l" > "$TMP_DIR/legacy"
  printf '%s\n' "$t" > "$TMP_DIR/target"
  if ! diff -u "$TMP_DIR/legacy" "$TMP_DIR/target" > "$TMP_DIR/diff"; then
    echo "MISMATCH: $label"
    cat "$TMP_DIR/diff"
    return 1
  fi
  echo "OK: $label => $t"
}

verify_news() {
  compare "news content" news_db     "SELECT count(*) FROM content_items WHERE content_type IN ('news','article')"     "SELECT count(*) FROM content_items WHERE content_type IN ('news','article')"
  compare "news editorial events" news_db     "SELECT count(*) FROM news_editorial_events e JOIN content_items c ON c.id=e.content_id WHERE c.content_type IN ('news','article')"     "SELECT count(*) FROM news_editorial_events e JOIN content_items c ON c.id=e.content_id WHERE c.content_type IN ('news','article')"
  compare "news article versions" news_db     "SELECT count(*) FROM news_article_versions v JOIN content_items c ON c.id=v.content_id WHERE c.content_type IN ('news','article')"     "SELECT count(*) FROM news_article_versions v JOIN content_items c ON c.id=v.content_id WHERE c.content_type IN ('news','article')"
  compare "news source references" news_db     "SELECT count(*) FROM news_source_references r JOIN content_items c ON c.id=r.content_id WHERE c.content_type IN ('news','article')"     "SELECT count(*) FROM news_source_references r JOIN content_items c ON c.id=r.content_id WHERE c.content_type IN ('news','article')"
  compare "news content monetary invariant" news_db     "SELECT count(*), COALESCE(sum(price_cents),0) FROM content_items WHERE content_type IN ('news','article')"     "SELECT count(*), COALESCE(sum(price_cents),0) FROM content_items WHERE content_type IN ('news','article')"
}

verify_order() {
  compare "order rows" order_db     "SELECT count(*) FROM orders"     "SELECT count(*) FROM orders"
  compare "order items" order_db     "SELECT count(*) FROM order_items"     "SELECT count(*) FROM order_items"
  compare "order transitions" order_db     "SELECT count(*) FROM order_state_transitions"     "SELECT count(*) FROM order_state_transitions"
  compare "order total invariant" order_db     "SELECT count(*), COALESCE(sum(total_amount),0) FROM orders"     "SELECT count(*), COALESCE(sum(total_amount),0) FROM orders"
  compare "order attribution invariant" order_db     "SELECT count(*), count(business_id), count(source_type), count(source_surface) FROM orders"     "SELECT count(*), count(business_id), count(source_type), count(source_surface) FROM orders"
}

verify_payment() {
  compare "payment transactions" payment_db     "SELECT count(*) FROM transactions"     "SELECT count(*) FROM transactions"
  compare "wallet accounts" payment_db     "SELECT count(*) FROM wallet_accounts"     "SELECT count(*) FROM wallet_accounts"
  compare "wallet topups" payment_db     "SELECT count(*) FROM wallet_topups"     "SELECT count(*) FROM wallet_topups"
  compare "wallet ledger" payment_db     "SELECT count(*) FROM wallet_ledger_entries"     "SELECT count(*) FROM wallet_ledger_entries"
  compare "wallet withdrawals" payment_db     "SELECT count(*) FROM wallet_withdrawals"     "SELECT count(*) FROM wallet_withdrawals"
  compare "payment disputes" payment_db     "SELECT count(*) FROM transaction_disputes"     "SELECT count(*) FROM transaction_disputes"
  compare "transaction amount invariant" payment_db     "SELECT count(*), COALESCE(sum(amount_cents),0) FROM transactions"     "SELECT count(*), COALESCE(sum(amount_cents),0) FROM transactions"
  compare "ledger amount invariant" payment_db     "SELECT count(*), COALESCE(sum(amount_cents),0) FROM wallet_ledger_entries"     "SELECT count(*), COALESCE(sum(amount_cents),0) FROM wallet_ledger_entries"
}

verify_profile() {
  compare "profile businesses" profile_db     "SELECT count(*) FROM businesses"     "SELECT count(*) FROM businesses"
  compare "profile business locations" profile_db     "SELECT count(*) FROM business_locations"     "SELECT count(*) FROM business_locations"
  compare "profile business profiles" profile_db     "SELECT count(*) FROM business_profiles"     "SELECT count(*) FROM business_profiles"
}

verify_crm() {
  compare "crm leads" crm_db     "SELECT count(*) FROM crm_leads"     "SELECT count(*) FROM crm_leads"
}

verify_communication() {
  compare "communication notifications" communication_db     "SELECT count(*) FROM user_notifications"     "SELECT count(*) FROM user_notifications"
}

verify_trust() {
  compare "trust profiles" trust_db     "SELECT count(*) FROM super_app_trust_profiles"     "SELECT count(*) FROM super_app_trust_profiles"
}

verify_promotion() {
  compare "promotion banners" promotion_db     "SELECT count(*) FROM banners"     "SELECT count(*) FROM banners"
}

run_domain() {
  case "$1" in
    news) verify_news ;;
    order) verify_order ;;
    payment) verify_payment ;;
    profile) verify_profile ;;
    crm) verify_crm ;;
    communication) verify_communication ;;
    trust) verify_trust ;;
    promotion) verify_promotion ;;
    support) verify_support ;;
    review) verify_review ;;
    *) echo "unknown domain: $1" >&2; return 2 ;;
  esac
}

if [[ "$DOMAIN" == "all" ]]; then
  for d in profile news order payment crm communication trust promotion support review; do
    echo "== VERIFY $d =="
    run_domain "$d"
  done
else
  run_domain "$DOMAIN"
fi

echo "DOMAIN VERIFICATION PASSED"
