-- Reproducible snapshot values from the verified local audit commands.
SELECT eslint_errors, typecheck_errors, ci_workflow_files, unit_tests_passed,
       unit_tests_total, source_health_breaches
FROM (
  VALUES (92, 12, 0, 393, 394, 26)
) AS quality_snapshot(
  eslint_errors,
  typecheck_errors,
  ci_workflow_files,
  unit_tests_passed,
  unit_tests_total,
  source_health_breaches
);

-- Aggregation of the eleven rows in audit-stop-ship.sql.
SELECT domain_group, finding_count
FROM (
  VALUES
    ('Chat', 4),
    ('Identity dan privasi', 2),
    ('Order dan keuangan', 2),
    ('Platform dan data', 2),
    ('Trust dan safety', 1)
) AS stop_ship_by_domain(domain_group, finding_count)
ORDER BY finding_count DESC, domain_group ASC;
