"""
Use Playwright with a persistent browser profile to:
1. Visit https://seekingalpha.com/alpha-picks/articles — download the first article
2. Download https://seekingalpha.com/alpha-picks/picks/current
3. Download https://seekingalpha.com/alpha-picks/picks/removed
4. Upload all saved pages to Azure Blob Storage, then delete local files

Requires:
  - Chromium running with --remote-debugging-port=9222
  - SingleFile MV3 extension installed in that Chromium profile
  - pip install azure-storage-blob python-dotenv
  - .env file with AZURE_STORAGE_CONNECTION_STRING
"""

import asyncio
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

load_dotenv()

# Force unbuffered output so prints appear immediately
sys.stdout.reconfigure(line_buffering=True)

CDP_URL = "http://localhost:9222"
ARTICLES_URL = "https://seekingalpha.com/alpha-picks/articles"
PICKS_CURRENT_URL = "https://seekingalpha.com/alpha-picks/picks/current"
PICKS_REMOVED_URL = "https://seekingalpha.com/alpha-picks/picks/removed"
ARTICLES_DIR = Path(__file__).parent / "articles"

# SingleFile extension ID — find yours at chrome://extensions
SF_EXT_ID = "jjhglkknljoaofaepgjgieoahbbiplom"

# Azure Blob config
AZURE_CONTAINER_NAME = "alphapicksub"
AZURE_BLOB_DIR = "alphapickfiles"


# ─── Helper functions ──────────────────────────────────────────────


def clean_singlefile_html(filepath: Path):
    """Remove the SingleFile comment from saved HTML."""
    html = filepath.read_text(encoding="utf-8")
    html = re.sub(
        r"<!--\s*\n\s*Page saved with SingleFile\s*\n.*?-->",
        "",
        html,
        count=1,
        flags=re.DOTALL,
    )
    filepath.write_text(html, encoding="utf-8")


def parse_date_prefix(date_str: str) -> str:
    """Convert 'Mar. 15, 2026' or 'March 15, 2026' to '2026-03-15'."""
    date_str = date_str.strip()
    for fmt in ("%b. %d, %Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def safe_filename(name: str) -> str:
    """Sanitize a string for use as a filename."""
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip()


# ─── SingleFile save logic ─────────────────────────────────────────

SINGLEFILE_JS = """
async () => {
    try {
        const tabs = await chrome.tabs.query({
            active: true, lastFocusedWindow: true
        });
        let tab = tabs.find(t =>
            !t.url.startsWith('chrome-extension://')
            && !t.url.startsWith('chrome://')
        );
        if (!tab) tab = tabs[0];
        if (!tab) return {error: "No active tab found"};

        const beforeItems = await chrome.downloads.search({
            orderBy: ['-startTime'], limit: 1
        });
        const lastIdBefore = beforeItems.length ? beforeItems[0].id : 0;

        const business = await import('/src/core/bg/business.js');
        await business.saveTabs([tab]);

        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const items = await chrome.downloads.search({
                orderBy: ['-startTime'], limit: 5
            });
            const done = items.find(d =>
                d.id > lastIdBefore
                && d.state === 'complete'
                && d.filename
            );
            if (done) {
                return {
                    ok: true,
                    filename: done.filename,
                    fileSize: done.fileSize,
                    downloadId: done.id,
                    url: tab.url,
                };
            }
            const failed = items.find(d =>
                d.id > lastIdBefore
                && d.state === 'interrupted'
            );
            if (failed) {
                return {error: "Download failed", reason: failed.error};
            }
        }
        return {error: "Timeout waiting for download"};
    } catch(e) {
        return {error: e.message, stack: e.stack?.substring(0, 500)};
    }
}
"""


async def singlefile_save(page, ctx, page_cdp) -> dict | None:
    """Trigger SingleFile save on the currently focused page."""
    await page_cdp.send("Page.bringToFront")
    await asyncio.sleep(0.3)

    ext_page = await ctx.new_page()
    await ext_page.goto(
        f"chrome-extension://{SF_EXT_ID}/src/ui/pages/options.html",
        wait_until="domcontentloaded",
        timeout=10000,
    )
    await page_cdp.send("Page.bringToFront")
    await asyncio.sleep(0.3)

    print("  Triggering SingleFile capture ...")
    try:
        result = await asyncio.wait_for(
            ext_page.evaluate(SINGLEFILE_JS),
            timeout=360,
        )
    except asyncio.TimeoutError:
        print("  ERROR: Overall timeout reached")
        result = None
    finally:
        await ext_page.close()

    return result


async def _detect_captcha(page) -> bool:
    """Check all frames (main + iframes) for the Press & Hold captcha."""
    # Check for #px-captcha container on main page
    px = await page.query_selector("#px-captcha")
    if px:
        return True
    # Check text in every frame (main frame + iframes)
    for frame in page.frames:
        try:
            found = await frame.evaluate(
                "document.body && ("
                "document.body.innerText.includes('Press & Hold')"
                " || document.body.innerText.includes('Press &amp; Hold'))"
            )
            if found:
                return True
        except Exception:
            continue
    return False


async def solve_press_hold_captcha(page, max_retries=3):
    """Detect and solve the PerimeterX 'Press & Hold' captcha if present."""
    for attempt in range(max_retries):
        if not await _detect_captcha(page):
            return True  # no captcha

        print(f"  CAPTCHA detected (attempt {attempt + 1}/{max_retries}), solving ...")
        await asyncio.sleep(2)

        try:
            solved = False

            # Find the button with aria-label="Press & Hold" inside iframes
            for frame in page.frames:
                if frame == page.main_frame:
                    continue
                try:
                    btn = await frame.query_selector('[aria-label="Press & Hold"]')
                    if btn:
                        box = await btn.bounding_box()
                        if box:
                            x = box["x"] + box["width"] / 2
                            y = box["y"] + box["height"] / 2
                            await page.mouse.move(x, y)
                            await page.mouse.down()
                            await asyncio.sleep(12)
                            await page.mouse.up()
                            solved = True
                            break
                except Exception:
                    continue

            # Last fallback: press & hold on #px-captcha container itself
            if not solved:
                captcha = await page.query_selector("#px-captcha")
                if captcha:
                    box = await captcha.bounding_box()
                    if box:
                        x = box["x"] + box["width"] / 2
                        y = box["y"] + box["height"] / 2
                        await page.mouse.move(x, y)
                        await page.mouse.down()
                        await asyncio.sleep(12)
                        await page.mouse.up()
                        solved = True

            await asyncio.sleep(5)
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass

        except Exception as e:
            print(f"  CAPTCHA solve error: {e}")

    if await _detect_captcha(page):
        print("  ERROR: Could not solve captcha after retries")
        return False
    return True


async def goto_with_captcha(page, url: str) -> bool:
    """Navigate to url and solve captcha if present. Returns True if page is ready."""
    print(f"  Navigating to {url} ...")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)
    if not await solve_press_hold_captcha(page):
        print(f"  ERROR: Blocked by captcha on {url}")
        return False
    print(f"  Page loaded: {page.url}")
    return True


async def save_page(
    page, ctx, page_cdp, url: str, dest_path: Path
) -> Path | None:
    """Navigate to url, trigger SingleFile, clean & move to dest_path."""
    if not await goto_with_captcha(page, url):
        return None

    result = await singlefile_save(page, ctx, page_cdp)

    if not result or not result.get("ok") or not result.get("filename"):
        err = result.get("error", "unknown") if result else "timeout"
        print(f"  ERROR: {err}")
        return None

    src = Path(result["filename"])
    if not src.exists():
        print(f"  ERROR: File not found at {src}")
        return None

    clean_singlefile_html(src)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest_path))
    size_kb = dest_path.stat().st_size / 1024
    print(f"  Saved: {dest_path.name} ({size_kb:.1f} KB)")
    return dest_path


# ─── Azure Blob upload ─────────────────────────────────────────────


def upload_to_azure_blob(local_path: Path, blob_name: str):
    """Upload a local file to Azure Blob Storage."""
    from azure.storage.blob import BlobServiceClient, ContentSettings

    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING env var is not set")

    blob_service = BlobServiceClient.from_connection_string(conn_str)
    container = blob_service.get_container_client(AZURE_CONTAINER_NAME)

    blob_client = container.get_blob_client(blob_name)
    with open(local_path, "rb") as f:
        blob_client.upload_blob(
            f,
            overwrite=True,
            content_settings=ContentSettings(content_type="text/html"),
        )

    print(f"  Uploaded: {blob_name}")


# ─── Main ──────────────────────────────────────────────────────────


async def main():
    stealth = Stealth()
    saved_files: list[Path] = []

    async with async_playwright() as p:
        print(f"Connecting to Chromium via CDP at {CDP_URL} ...")
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0] if browser.contexts else await browser.new_context()

        for pg in ctx.pages:
            await stealth.apply_stealth_async(pg)
        ctx.on("page", lambda pg: asyncio.ensure_future(stealth.apply_stealth_async(pg)))

        browser_cdp = await browser.new_browser_cdp_session()
        await browser_cdp.send("Browser.setDownloadBehavior", {"behavior": "default"})

        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.set_viewport_size({"width": 1440, "height": 900})
        page_cdp = await page.context.new_cdp_session(page)

        ARTICLES_DIR.mkdir(exist_ok=True)

        # ── Step 1: Download the latest article ───────────────────
        print(f"\n{'='*60}")
        print("Step 1: Find and download the latest article")
        print(f"{'='*60}")

        print(f"Navigating to {ARTICLES_URL} ...")
        if not await goto_with_captcha(page, ARTICLES_URL):
            print("ERROR: Blocked by captcha on articles page")
        else:
            first_article = await page.evaluate("""
                () => {
                    const item = document.querySelector('[data-test-id="post-list-item"]');
                    if (!item) return null;
                    const titleLink = item.querySelector('[data-test-id="post-list-item-title"]');
                    const date = item.querySelector('[data-test-id="post-list-date"]');
                    if (!titleLink) return null;
                    return {
                        title: titleLink.textContent.trim(),
                        href: titleLink.href.split('#')[0],
                        date: date ? date.textContent.trim() : '',
                    };
                }
            """)

            if not first_article:
                print("ERROR: No article found on the page")
            else:
                print(f"First article: {first_article['title']}")
                print(f"  Date: {first_article['date']}")
                print(f"  URL:  {first_article['href']}")

                article_slug = first_article["href"].rstrip("/").split("/")[-1]
                existing = [
                    f for f in ARTICLES_DIR.glob("*.html")
                    if article_slug in f.name
                    or first_article["title"].split(":")[0].strip() in f.name
                ]
                if existing:
                    print(f"SKIP: Already saved as {existing[0].name}")
                else:
                    date_prefix = parse_date_prefix(first_article.get("date", ""))
                    title = safe_filename(first_article.get("title", "article"))
                    dest = ARTICLES_DIR / f"{date_prefix} {title}.html"

                    result = await save_page(
                        page, ctx, page_cdp, first_article["href"], dest
                    )
                    if result:
                        saved_files.append(result)
                        # New article downloaded — clean up old article files
                        PICKS_NAMES = {
                            "Current ｜ Alpha Picks ｜ Seeking Alpha.html",
                            "Closed ｜ Alpha Picks ｜ Seeking Alpha.html",
                        }
                        for old in ARTICLES_DIR.glob("*.html"):
                            if old != result and old.name not in PICKS_NAMES:
                                old.unlink()
                                print(f"  Deleted old: {old.name}")

        # ── Step 2: Download picks/current ────────────────────────
        print(f"\n{'='*60}")
        print("Step 2: Download picks/current")
        print(f"{'='*60}")

        today = datetime.now().strftime("%Y-%m-%d")
        dest = ARTICLES_DIR / "Current ｜ Alpha Picks ｜ Seeking Alpha.html"
        result = await save_page(page, ctx, page_cdp, PICKS_CURRENT_URL, dest)
        if result:
            saved_files.append(result)

        # ── Step 3: Download picks/removed ────────────────────────
        print(f"\n{'='*60}")
        print("Step 3: Download picks/removed")
        print(f"{'='*60}")

        dest = ARTICLES_DIR / "Closed ｜ Alpha Picks ｜ Seeking Alpha.html"
        result = await save_page(page, ctx, page_cdp, PICKS_REMOVED_URL, dest)
        if result:
            saved_files.append(result)

        await browser.close()

    # ── Step 4: Upload to Azure & delete local files ──────────────
    if saved_files:
        print(f"\n{'='*60}")
        print(f"Step 4: Upload {len(saved_files)} file(s) to Azure Blob Storage")
        print(f"{'='*60}")

        for f in saved_files:
            blob_name = f"{AZURE_BLOB_DIR}/{f.name}"
            try:
                upload_to_azure_blob(f, blob_name)
            except Exception as e:
                print(f"  ERROR uploading {f.name}: {e}")
    else:
        print("\nNo new files to upload.")

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
