import unittest

from runtime_contract import (
    DOMAIN_EXTRACTION_SERVICES,
    _validate_domain_extraction_runtime,
)


def valid_services():
    return {
        name: {
            "environment": {
                "DOMAIN_RUNTIME_MODE": "compatibility",
                "LEGACY_PROXY_ENABLED": "true",
                "LEGACY_UPSTREAM_URL": "http://marketplace_service:8081",
                "DATABASE_URL": f"postgres://user:pass@domain_db:5432/{name.replace('_service', '_db')}",
                "LEGACY_PROXY_TIMEOUT_MS": "5000",
            }
        }
        for name in DOMAIN_EXTRACTION_SERVICES
    }


class DomainExtractionRuntimeContractTests(unittest.TestCase):
    def test_all_target_domains_have_a_compatibility_contract(self):
        services = valid_services()
        errors = []
        _validate_domain_extraction_runtime(services, "production", errors)
        self.assertEqual(errors, [])

    def test_native_mode_is_rejected_before_cutover(self):
        services = valid_services()
        services["payment_service"]["environment"]["DOMAIN_RUNTIME_MODE"] = "native"
        errors = []
        _validate_domain_extraction_runtime(services, "production", errors)
        self.assertTrue(
            any("payment_service" in error and "compatibility-proxy" in error for error in errors),
            errors,
        )

    def test_invalid_proxy_contract_is_rejected(self):
        services = valid_services()
        environment = services["crm_service"]["environment"]
        environment["LEGACY_PROXY_ENABLED"] = "false"
        environment["LEGACY_UPSTREAM_URL"] = "http://example.invalid:8080"
        environment["LEGACY_PROXY_TIMEOUT_MS"] = "50"

        errors = []
        _validate_domain_extraction_runtime(services, "production", errors)

        self.assertEqual(len(errors), 3)
        self.assertTrue(any("crm_service" in error and "LEGACY_PROXY_ENABLED" in error for error in errors))
        self.assertTrue(any("crm_service" in error and "marketplace_service" in error for error in errors))
        self.assertTrue(any("crm_service" in error and "250 and 30000" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
