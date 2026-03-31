#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from pathlib import Path


CODEX_NAV = """              <li>
                <a href="#section-codex">
                  <img src="/public/api_keys.svg" alt="Codex Proxy" />
                  <span>Codex Proxy</span>
                </a>
              </li>
"""

CODEX_SECTION = """          <div id="section-codex" class="section">
            <x-component path="settings/external/codex.html"></x-component>
          </div>
"""

CODEX_PROVIDER_BLOCK = """  codex_proxy:
    name: OpenAI Codex Proxy
    litellm_provider: openai
"""


def _copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def _copy_runtime_tree(src_root: Path, dst_root: Path) -> None:
    for src in src_root.rglob("*"):
        if src.is_dir():
            continue
        rel = src.relative_to(src_root)
        _copy(src, dst_root / rel)


def _patch_external_settings(ext_file: Path) -> None:
    text = ext_file.read_text(encoding="utf-8")

    nav_anchor = 'href="#section-api-keys"'
    if '#section-codex' not in text:
        idx = text.find(nav_anchor)
        if idx == -1:
            raise RuntimeError(f"Expected API Keys nav anchor not found in {ext_file}")
        li_start = text.rfind("<li>", 0, idx)
        if li_start == -1:
            raise RuntimeError(f"Could not locate nav insertion point in {ext_file}")
        text = text[:li_start] + CODEX_NAV + text[li_start:]

    section_anchor = '<div id="section-api-keys" class="section">'
    if 'id="section-codex"' not in text:
        idx = text.find(section_anchor)
        if idx == -1:
            raise RuntimeError(f"Expected API Keys section anchor not found in {ext_file}")
        text = text[:idx] + CODEX_SECTION + text[idx:]

    ext_file.write_text(text, encoding="utf-8")


def _patch_model_providers(conf_file: Path) -> None:
    text = conf_file.read_text(encoding="utf-8")
    if "codex_proxy:" in text:
        return

    anchor = "  azure:\n"
    idx = text.find(anchor)
    if idx == -1:
        embedding_anchor = "\nembedding:\n"
        idx = text.find(embedding_anchor)
        if idx == -1:
            raise RuntimeError(f"Expected chat insertion anchor not found in {conf_file}")
    text = text[:idx] + CODEX_PROVIDER_BLOCK + text[idx:]
    conf_file.write_text(text, encoding="utf-8")


def _patch_missing_key_banner(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if '"codex_proxy"' in text:
        return
    # Handle both list (old A0) and set (new A0) formats
    old_list = 'LOCAL_PROVIDERS = ["ollama", "lm_studio"]'
    old_set = 'LOCAL_PROVIDERS = {"ollama", "lm_studio"}'
    if old_list in text:
        text = text.replace(old_list, 'LOCAL_PROVIDERS = ["ollama", "lm_studio", "codex_proxy"]', 1)
    elif old_set in text:
        text = text.replace(old_set, 'LOCAL_PROVIDERS = {"ollama", "lm_studio", "codex_proxy"}', 1)
    else:
        # Don't crash — codex_proxy can work without this patch
        return
    path.write_text(text, encoding="utf-8")


def _patch_settings_store(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    guard = 'if (key === "codex_proxy") return;'
    if guard in text:
        return

    anchor = "if (seen.has(key)) return;"
    replacement = f'      {guard}\n{anchor}'
    if anchor not in text:
        raise RuntimeError(f"Expected apiKeyProviders anchor not found in {path}")
    path.write_text(text.replace(anchor, replacement, 1), encoding="utf-8")


def install_runtime(a0_root: Path, plugin_root: Path) -> None:
    runtime = plugin_root / "runtime"
    if not runtime.is_dir():
        raise RuntimeError(f"Missing runtime directory: {runtime}")

    # A0 restructured: python/{helpers,api,tools,extensions} → root-level dirs
    # Copy runtime files to new locations; fall back to old paths for compat
    python_target = a0_root / "python" if (a0_root / "python").is_dir() else a0_root
    _copy_runtime_tree(runtime / "python", python_target)
    _copy_runtime_tree(runtime / "webui", a0_root / "webui")

    _patch_external_settings(a0_root / "webui/components/settings/external/external-settings.html")
    _patch_model_providers(a0_root / "conf/model_providers.yaml")
    # Banner file moved to plugins/_model_config/ in new A0
    banner_path = a0_root / "plugins/_model_config/extensions/python/banners/_20_missing_api_key.py"
    if not banner_path.exists():
        banner_path = a0_root / "extensions/python/banners/_20_missing_api_key.py"
    if not banner_path.exists():
        banner_path = a0_root / "python/extensions/banners/_20_missing_api_key.py"
    if banner_path.exists():
        _patch_missing_key_banner(banner_path)
    _patch_settings_store(a0_root / "webui/components/settings/settings-store.js")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--a0-root", required=True)
    parser.add_argument("--plugin-root", required=True)
    args = parser.parse_args()

    a0_root = Path(args.a0_root).resolve()
    plugin_root = Path(args.plugin_root).resolve()

    # New A0 has helpers/ at root; old has python/
    if not ((a0_root / "helpers").is_dir() or (a0_root / "python").is_dir()):
        raise RuntimeError(f"Target does not look like Agent0 root: {a0_root}")

    install_runtime(a0_root, plugin_root)
    print("Codex plugin runtime installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
