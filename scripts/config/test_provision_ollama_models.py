from __future__ import annotations

import unittest

from provision_ollama_models import ensure_model, installed_model_names


class OllamaModelProvisioningTests(unittest.TestCase):
    def test_existing_configured_model_is_reused_without_pull(self) -> None:
        calls: list[tuple[str, str]] = []

        def requester(method: str, url: str, payload: dict[str, object] | None, timeout: float) -> object:
            calls.append((method, url))
            return {"models": [{"name": "qwen3:4b"}]}

        self.assertFalse(ensure_model("http://ollama:11434/", "qwen3:4b", requester=requester))
        self.assertEqual(calls, [("GET", "http://ollama:11434/api/tags")])

    def test_missing_model_is_pulled_once_and_verified(self) -> None:
        responses = iter([{"models": []}, {"status": "success"}, {"models": [{"model": "qwen3:4b"}]}])
        calls: list[tuple[str, str, dict[str, object] | None]] = []

        def requester(method: str, url: str, payload: dict[str, object] | None, timeout: float) -> object:
            calls.append((method, url, payload))
            return next(responses)

        self.assertTrue(ensure_model("http://ollama:11434", "qwen3:4b", requester=requester))
        self.assertEqual(calls[1], ("POST", "http://ollama:11434/api/pull", {"name": "qwen3:4b", "stream": False}))

    def test_invalid_tag_payload_fails_closed(self) -> None:
        self.assertEqual(installed_model_names({"models": "invalid"}), set())


if __name__ == "__main__":
    unittest.main()
