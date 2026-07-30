# GitHub 发布

Xunzhi PDF Editor 在 GitHub 上的发布信息与流程记录。

---

## 一、GitHub 账户信息

| 项 | 值 |
|---|---|
| GitHub 账号 | `dangxinxing090-svg` |
| Git 提交用户名 | `dangxinxing090-svg` |
| Git 提交邮箱 | `dangxinxing090@gmail.com` |
| 认证方式 | `gh` CLI（GitHub CLI），协议 HTTPS，token 存于系统 keyring |
| token 权限 | `gist` / `read:org` / `repo` / `workflow` |

> 认证状态可用 `gh auth status` 查看。如过期，运行 `gh auth login --hostname github.com --git-protocol https --web` 重新登录。

---

## 二、仓库信息

| 项 | 值 |
|---|---|
| 仓库名 | `xunzhi-pdf-editor` |
| 仓库地址 | https://github.com/dangxinxing090-svg/xunzhi-pdf-editor |
| SSH 地址 | `git@github.com:dangxinxing090-svg/xunzhi-pdf-editor.git` |
| 可见性 | Public（公开） |
| 默认分支 | `main` |
| 远程名 | `origin` |
| 描述 | Xunzhi PDF Editor - Electron + Vite + React + TypeScript desktop PDF editor |

### 分支

| 分支 | 用途 | 跟踪远程 |
|---|---|---|
| `main` | 稳定主分支（仓库默认分支） | `origin/main` |
| `feat/pdf-editor` | 功能开发分支，包含全部功能 + 打包配置 | `origin/feat/pdf-editor` |

### 查看分支与提交

```bash
git branch -vv              # 查看本地分支与跟踪关系
git log --oneline -10       # 查看最近提交
```

---

## 三、当前发布情况

### v0.1.0（已发布）

| 项 | 值 |
|---|---|
| tag | `v0.1.0` |
| Release 地址 | https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/tag/v0.1.0 |
| 发布时间 | 2026-07-30 03:25 UTC |
| 发布者 | `github-actions[bot]`（CI 自动发布） |
| 类型 | 正式发布（非 draft、非 prerelease） |
| 产物 | `XunzhiPDFEditor-portable-win-x64.zip` |
| 产物大小 | 约 187 MB（196,889,398 字节） |
| 下载地址 | https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases/download/v0.1.0/XunzhiPDFEditor-portable-win-x64.zip |
| SHA256 | `539542d85d19a0979a3255bf9173197160877539e4c7927619f9d59d340a48e0` |

**产物说明：** Windows 64 位便携版。解压后双击 `Xunzhi PDF Editor.exe` 即可运行，无需安装。首次运行 Windows SmartScreen 会提示"未知发布者"，点"更多信息" -> "仍要运行"即可（应用未签名）。

### v0.1.0 对应的关键提交

```
5d94dde fix(ci): grant contents:write for Release + bump node to 22
fd49fcf build: Windows portable packaging via electron-builder + CI
4043331 feat: PDF editor core - annotations, crop, page ops, reader mode
798dc28 feat: crop tool + content inspector + applyAnnotations tests
153f454 feat: bake annotations to PDF + watermark/header/footer forms
d296e8b feat: content-edit annotation interaction layer (no bake)
c26fb44 feat: three-mode switcher + read mode skeleton
8adaa82 feat: UI - edit toolbar buttons, page right-click menu, merge button
```

---

## 四、CI 自动构建机制

### 工作流文件

`.github/workflows/build-windows.yml`

### 触发条件

| 触发方式 | 说明 |
|---|---|
| 推送 `v*` 开头的 tag | 正式触发：构建 + 打包 + 打 zip + 上传 artifact + **创建并发布 Release** |
| 手动触发（workflow_dispatch） | 测试用：构建 + 打包 + 上传 artifact，**不创建 Release** |

### 构建流程（windows-latest）

1. `actions/checkout@v4` 拉取代码
2. `actions/setup-node@v4` 安装 Node 22
3. `npm ci` 安装依赖
4. `npm run build` 构建（tsc + vite build + electron tsc）
5. `npx electron-builder --win` 打包（`dir` 目标，产出便携目录 `release/win-unpacked/`）
6. `Compress-Archive` 打成 `XunzhiPDFEditor-portable-win-x64.zip`
7. `actions/upload-artifact@v4` 上传 artifact（手动触发时可从 Actions 页面下载）
8. `softprops/action-gh-release@v2` 把 zip 附加到 GitHub Release（仅 tag 触发时执行）

### 关键配置

- `permissions: contents: write` — 必需，否则 CI 创建 Release 会失败（`Resource not accessible by integration`）。v0.1.0 首次构建时踩过这个坑，已在 `5d94dde` 修复。
- `asar: false` — 打包配置（在 package.json 的 `build` 字段），字体/worker 作为真实文件，规避 asar 内 `fetch(file://)` 加载字体不可靠。
- `target: "dir"` + `arch: ["x64"]` — 便携版目录，64 位 Windows。

---

## 五、以后发布新版本的流程

### 标准流程（推荐）

```bash
# 1. 确保在 feat/pdf-editor 分支，代码已提交并推送
git checkout feat/pdf-editor
git add .
git commit -m "feat: 你的改动说明"
git push

# 2. 打新版本 tag（版本号遵循语义化版本 v主.次.修订）
git tag -a v0.2.0 -m "v0.2.0 - 改动说明"

# 3. 推送 tag，触发 CI 自动构建并发布 Release
git push origin v0.2.0
```

推送 tag 后约 2 分钟 CI 构建完成，Release 自动附带 `XunzhiPDFEditor-portable-win-x64.zip`。

### 验证发布结果

```bash
# 查看 Release
gh release view v0.2.0 --repo dangxinxing090-svg/xunzhi-pdf-editor

# 查看 CI 运行状态
gh run list --repo dangxinxing090-svg/xunzhi-pdf-editor --limit 3

# 实时跟踪某次构建
gh run watch <run-id> --repo dangxinxing090-svg/xunzhi-pdf-editor
```

也可在浏览器查看：
- Actions：https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/actions
- Releases：https://github.com/dangxinxing090-svg/xunzhi-pdf-editor/releases

### 仅测试构建（不发布 Release）

在仓库 Actions 页面：
1. 进入 `Build Windows App` 工作流
2. 点 `Run workflow` -> 选择分支 -> 运行
3. 构建完成后从 run 详情页下载 artifact（不会创建 Release）

命令行触发：
```bash
gh workflow run build-windows.yml --repo dangxinxing090-svg/xunzhi-pdf-editor --ref feat/pdf-editor
```

### 重新发布同一版本（覆盖 Release）

如果构建失败或需要重新发布同一个 tag：

```bash
# 1. 删除本地和远程的旧 tag
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# 2. 删除 GitHub 上已创建的 Release（若有）
gh release delete v0.2.0 --repo dangxinxing090-svg/xunzhi-pdf-editor --yes

# 3. 在修复后的提交上重新打 tag 并推送
git tag -a v0.2.0 -m "v0.2.0 - 改动说明"
git push origin v0.2.0
```

---

## 六、版本号规则（语义化版本）

```
v 主版本 . 次版本 . 修订
```

| 变更类型 | 版本号变化 | 示例 |
|---|---|---|
| 不兼容的 API/功能大改 | 主版本 +1 | v0.1.0 -> v1.0.0 |
| 向下兼容的新功能 | 次版本 +1 | v0.1.0 -> v0.2.0 |
| 向下兼容的 bug 修复 | 修订 +1 | v0.1.0 -> v0.1.1 |

当前 0.x 阶段，次版本 +1 表示新功能，修订 +1 表示修复。

---

## 七、注意事项

1. **tag 必须打在 `feat/pdf-editor` 分支的最新提交上**（打包配置和功能代码都在该分支）。`main` 分支只有早期文档，不含功能代码。如需长期规范，建议把 `feat/pdf-editor` 合并到 `main` 后，从 `main` 打 tag。

2. **未签名**：当前应用未做代码签名，Windows SmartScreen 会拦截首次运行。如需消除提示，需购买 OV 代码签名证书（约 $200-400/年），详见 `docs/打包说明.md`。

3. **运行验证需 Windows 机器**：CI 在 windows-latest 上原生构建，产物结构已验证正确，但 macOS 无法运行 .exe。建议每次发版后在 Windows 机器上实际打开 PDF + 测试中文注释显示。

4. **`permissions: contents: write` 不能删**：删除后 tag 触发的 Release 创建会失败。

5. **本地构建命令**：`npm run package:win`（产出 `release/win-unpacked/`）。详见 `docs/打包说明.md`。

6. **产物名**：`XunzhiPDFEditor-portable-win-x64.zip`，由 `package.json` 的 `productName`（`Xunzhi PDF Editor`）和 CI 的 zip 步骤共同决定。改 `productName` 时需同步更新工作流里的 zip 文件名。
