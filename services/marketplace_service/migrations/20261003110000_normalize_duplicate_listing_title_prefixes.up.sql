-- Keep user-authored listing titles intact while repairing only the exact
-- duplicated intent-prefix pattern produced by older listing flows.
UPDATE content_items
SET title = regexp_replace(
  btrim(title),
  '^(Butuh|Membutuhkan|Mencari|Menawarkan|Need|Looking for|Providing|Offering)[[:space:]]+\\1(?=[[:space:]]|$)[[:space:]]*',
  '\\1 ',
  1,
  0,
  'i'
)
WHERE title ~* '^(Butuh|Membutuhkan|Mencari|Menawarkan|Need|Looking for|Providing|Offering)[[:space:]]+\\1(?=[[:space:]]|$)';
