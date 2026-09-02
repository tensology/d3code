from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from d3code_api.config import load_config, select_profile
from d3code_api.server import app


class FastApiRuntimeTests(unittest.TestCase):
    def test_missing_config_uses_muse_glimmer(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            config = load_config(Path(home) / "missing.jsonc")
            self.assertEqual(config.default_model, "ollama/muse-glimmer:30b-mlx")

    def test_loads_shared_jsonc_config(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            path = Path(home) / "config.jsonc"
            path.write_text(
                """
                {
                  // shared with the Node CLI and IDE
                  "version": 1,
                  "defaultModel": "openai/gpt-5",
                  "defaultSafety": "trust",
                  "defaultProfile": "office",
                  "profiles": [
                    {
                      "name": "office",
                      "type": "ssh",
                      "host": "office.crystallogic.org",
                      "port": 2266,
                      "account": "DM",
                      "sessionMode": "persistent",
                      "promptPattern": ":",
                    },
                  ],
                  "modelSecrets": {},
                }
                """,
                encoding="utf8",
            )
            config = load_config(path)
            self.assertEqual(config.default_safety, "trust")
            profile = select_profile(config)
            self.assertIsNotNone(profile)
            self.assertEqual(profile.host, "office.crystallogic.org")
            self.assertEqual(profile.session_mode, "persistent")

    def test_fastapi_reports_python_runtime_and_routes(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            previous = os.environ.get("D3CODE_HOME")
            os.environ["D3CODE_HOME"] = home
            try:
                Path(home, "config.jsonc").write_text(
                    '{"version":1,"defaultSafety":"ask","profiles":[{"name":"local","type":"local","account":"DM"}]}',
                    encoding="utf8",
                )
                client = TestClient(app)
                health = client.get("/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["runtime"], "fastapi-python")
                routing = client.get("/tool-routing")
                self.assertEqual(routing.status_code, 200)
                payload = routing.json()
                self.assertEqual(payload["runtime"], "fastapi-python")
                self.assertTrue(any(route["mechanism"] == "d3py-uopy" for route in payload["routes"]))
                root = client.get("/")
                self.assertEqual(root.status_code, 200)
                self.assertIn("FastAPI backend", root.text)
                self.assertIn("Build BASIC", root.text)
                self.assertIn("SB+ Discover", root.text)
                self.assertIn('id="capabilitiesPanel"', root.text)
                status = client.get("/api/status")
                self.assertEqual(status.status_code, 200)
                self.assertEqual(status.json()["backend"], "fastapi-python")
                runtime = client.get("/api/python-runtime")
                self.assertEqual(runtime.status_code, 200)
                self.assertEqual(runtime.json()["runtime"], "fastapi-python")
                tools = client.get("/api/tools")
                self.assertEqual(tools.status_code, 200)
                self.assertTrue(any(tool["name"] == "d3_sbplus_discover" for tool in tools.json()["tools"]))
                plan = client.post("/api/sbplus/plan", json={"process": "CUSTOMER.MAINT", "file": "CUSTOMERS"})
                self.assertEqual(plan.status_code, 200)
                self.assertIn("CUSTOMER.MAINT", plan.json()["result"])
                build = client.post("/api/basic/build", json={"file": "BP", "item": "TEST", "source": "RETURN", "confirmed": True})
                self.assertEqual(build.status_code, 501)
            finally:
                if previous is None:
                    os.environ.pop("D3CODE_HOME", None)
                else:
                    os.environ["D3CODE_HOME"] = previous


if __name__ == "__main__":
    unittest.main()
