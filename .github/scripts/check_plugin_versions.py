#!/usr/bin/env python3
"""版本门禁：校验插件市场元数据与插件源码自报版本四处一致。

MoviePilot 安装/更新读取根 package.json 的 version 与 __init__.py 的 plugin_version，
而插件目录 package.v2.json 也是发布资产的一部分。任一不一致都会导致：
- 远程有新 commit 时 MP 提示可更新
- 但拉取后版本号仍显示旧值（即仓库修复前踩到的坑）

本脚本在 git push 前（pre-push）运行，覆盖四处版本源：
  1. 根 package.json 的 DanmuCustom.version
  2. 根 package.v2.json 的 DanmuCustom.version
  3. 插件目录 plugins.v2/<id>/package.v2.json 的 version
  4. 插件源码 plugins.v2/<id>/__init__.py 的类级 plugin_version
并对 history 是否包含当前版本做附加校验，防止漏写更新记录。
"""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

PLUGIN_BASE = Path("plugins.v2")
ROOT_PACKAGE_FILES = [Path("package.json"), Path("package.v2.json")]


def _load_json(path: Path) -> dict | None:
    """读取 JSON 文件；不存在时返回 None。"""
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def _plugin_dir(plugin_id: str) -> Path:
    """按插件 id 定位源码目录（小写）。"""
    return PLUGIN_BASE / plugin_id.lower()


def _source_version(init_file: Path) -> str | None:
    """从 __init__.py 类级属性中提取 plugin_version 字面量（AST 静态解析，不执行代码）。"""
    tree = ast.parse(init_file.read_text(encoding="utf-8"), filename=str(init_file))
    for class_node in (node for node in tree.body if isinstance(node, ast.ClassDef)):
        for node in class_node.body:
            value_node = None
            if isinstance(node, ast.Assign):
                if any(isinstance(target, ast.Name) and target.id == "plugin_version" for target in node.targets):
                    value_node = node.value
            elif (
                isinstance(node, ast.AnnAssign)
                and isinstance(node.target, ast.Name)
                and node.target.id == "plugin_version"
            ):
                value_node = node.value
            if isinstance(value_node, ast.Constant) and isinstance(value_node.value, str):
                return value_node.value
    return None


def main() -> int:
    """命令入口：四处版本一致且 history 齐全时返回 0，否则返回 1。"""
    errors: list[str] = []

    # 1) 汇总各根清单中同一插件的版本，确保根清单之间也一致
    root_versions: dict[str, dict[str, str]] = {}
    for pkg_file in ROOT_PACKAGE_FILES:
        pkg = _load_json(pkg_file)
        if pkg is None:
            errors.append(f"{pkg_file}: 文件不存在")
            continue
        for plugin_id, meta in pkg.items():
            if not isinstance(meta, dict):
                continue
            version = str(meta.get("version") or "").strip()
            root_versions.setdefault(plugin_id, {})[pkg_file.name] = version
            # history 必须包含当前版本记录
            history = meta.get("history") or {}
            if version and f"v{version}" not in history:
                errors.append(f"{pkg_file}: {plugin_id} 的 history 缺少版本 v{version} 记录")

    for plugin_id, versions in root_versions.items():
        distinct = set(versions.values())
        if len(distinct) > 1:
            joined = ", ".join(f"{name}={v}" for name, v in versions.items())
            errors.append(f"{plugin_id}: 根清单间版本不一致（{joined}）")

    # 2) 将根清单版本与插件目录清单、源码 plugin_version 逐一比对
    for plugin_id, versions in root_versions.items():
        expected = next(iter(set(versions.values())))
        plugin_dir = _plugin_dir(plugin_id)

        dir_pkg = _load_json(plugin_dir / "package.v2.json")
        if dir_pkg is None:
            errors.append(f"{plugin_dir}/package.v2.json: 不存在")
        else:
            dir_version = str(dir_pkg.get(plugin_id, {}).get("version") or "").strip()
            if expected and dir_version and expected != dir_version:
                errors.append(
                    f"{plugin_id}: 根清单 version={expected} 与 插件目录 package.v2.json version={dir_version} 不一致"
                )

        init_file = plugin_dir / "__init__.py"
        if not init_file.exists():
            errors.append(f"{init_file}: 不存在")
        else:
            source_version = _source_version(init_file)
            if not source_version:
                errors.append(f"{init_file}: 未声明类级 plugin_version")
            elif expected and source_version != expected:
                errors.append(
                    f"{plugin_id}: 根清单 version={expected} 与 __init__.py plugin_version={source_version} 不一致"
                )

    if errors:
        print("插件版本门禁失败：")
        for error in errors:
            print(f"- {error}")
        return 1
    print("插件版本门禁通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
