# Seeking Alpha Picks Capture

自动抓取 Seeking Alpha Alpha Picks 页面并上传至 Azure Blob Storage。

## 工作流程

1. 通过 CDP 连接到本地运行的 Chromium（端口 9222）
2. 访问 Alpha Picks 文章列表，用 SingleFile 扩展保存最新文章
3. 保存 Current Picks 和 Closed Picks 页面
4. 上传所有 HTML 文件到 Azure Blob Storage
5. 触发邮件通知

## 前置条件

- macOS
- Chromium 浏览器（已安装 [SingleFile MV3](https://github.com/nicehash/nicehash-plugin-install) 扩展）
- Python 3.10+
- `.env` 文件中配置 `AZURE_STORAGE_CONNECTION_STRING`

## 安装

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动 Chromium（远程调试模式）

```bash
/Applications/Chromium.app/Contents/MacOS/Chromium \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/chromium-debug-profile" &
```

验证调试端口是否可用：

```bash
curl -s http://localhost:9222/json/version
```

## 运行

```bash
python capture_seekingalpha_patchright.py
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `capture_seekingalpha_patchright.py` | 主脚本，使用 patchright（反检测 Playwright 分支）抓取页面 |
| `capture_seekingalpha.py` | 旧版脚本，使用 playwright + playwright-stealth |
| `_get_links.py` | 辅助脚本，列出文章列表页的链接信息 |
| `requirements.txt` | Python 依赖 |
| `articles/` | 保存的 HTML 文件目录 |

## 定时任务 (launchd)

已配置 launchd plist，每小时运行一次：

```
~/Library/LaunchAgents/com.jiayulou.capture-seekingalpha.plist
```

管理命令：

```bash
# 加载（启用定时任务）
launchctl load ~/Library/LaunchAgents/com.jiayulou.capture-seekingalpha.plist

# 卸载（暂停定时任务）
launchctl unload ~/Library/LaunchAgents/com.jiayulou.capture-seekingalpha.plist

# 查看状态
launchctl list | grep capture-seekingalpha
```

日志路径：
- 标准输出：`capture_seekingalpha.log`
- 错误输出：`capture_seekingalpha.err.log`
