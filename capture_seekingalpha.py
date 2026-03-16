"""
Use Playwright with a persistent browser profile to visit
https://seekingalpha.com/alpha-picks/articles and trigger
SingleFile extension to save the page via its internal API.

Requires:
  - Chrome running with --remote-debugging-port=9222
  - SingleFile MV3 extension installed in that Chrome profile
"""

import asyncio
import shutil
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

# Force unbuffered output so prints appear immediately
sys.stdout.reconfigure(line_buffering=True)

CDP_URL = "http://localhost:9222"
TARGET_URL = "https://seekingalpha.com/alpha-picks/articles"
SAVE_DIR = Path(__file__).parent

# SingleFile extension ID — find yours at chrome://extensions
SF_EXT_ID = "jjhglkknljoaofaepgjgieoahbbiplom"


async def main():
    stealth = Stealth()

    async with async_playwright() as p:
        print(f"Connecting to Chrome via CDP at {CDP_URL} ...")
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        ctx = browser.contexts[0] if browser.contexts else await browser.new_context()

        # Apply stealth to every page
        for pg in ctx.pages:
            await stealth.apply_stealth_async(pg)
        ctx.on("page", lambda pg: asyncio.ensure_future(stealth.apply_stealth_async(pg)))

        # Reset download behavior — Playwright's connect_over_cdp hijacks it
        browser_cdp = await browser.new_browser_cdp_session()
        await browser_cdp.send("Browser.setDownloadBehavior", {
            "behavior": "default",
        })

        # ── 1. Navigate to the target page ──
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        print(f"Navigating to {TARGET_URL} ...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=30000)
        print(f"Page loaded: {page.url}")

        # Focus the target tab
        page_cdp = await page.context.new_cdp_session(page)
        await page_cdp.send("Page.bringToFront")
        await asyncio.sleep(0.5)

        # ── 2. Open SingleFile extension page for chrome.* API access ──
        ext_page = await ctx.new_page()
        await ext_page.goto(
            f"chrome-extension://{SF_EXT_ID}/src/ui/pages/options.html",
            wait_until="domcontentloaded",
            timeout=10000,
        )

        # Re-focus the target tab so SingleFile saves IT (not the options page)
        await page_cdp.send("Page.bringToFront")
        await asyncio.sleep(0.3)

        # ── 3. Trigger save and wait for download to complete ──
        print("Triggering SingleFile capture ...")
        try:
            result = await asyncio.wait_for(
                ext_page.evaluate("""
                    async () => {
                        try {
                            // Find the target tab (non-extension, active)
                            const tabs = await chrome.tabs.query({
                                active: true, lastFocusedWindow: true
                            });
                            let tab = tabs.find(t =>
                                !t.url.startsWith('chrome-extension://')
                                && !t.url.startsWith('chrome://')
                            );
                            if (!tab) tab = tabs[0];
                            if (!tab) return {error: "No active tab found"};

                            // Record last download ID before save
                            const beforeItems = await chrome.downloads.search({
                                orderBy: ['-startTime'], limit: 1
                            });
                            const lastIdBefore = beforeItems.length
                                ? beforeItems[0].id : 0;

                            // Import SingleFile business module and trigger save
                            const business = await import('/src/core/bg/business.js');
                            await business.saveTabs([tab]);

                            // Poll for the new download to complete
                            for (let i = 0; i < 300; i++) {  // up to ~5 min
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
                """),
                timeout=360,
            )
            print(f"Result: {result}")
        except asyncio.TimeoutError:
            print("ERROR: Overall timeout reached")
            result = None

        await ext_page.close()

        # ── 4. Copy the saved file to output dir ──
        if result and result.get("ok") and result.get("filename"):
            src = Path(result["filename"])
            if src.exists():
                dest = SAVE_DIR / src.name
                shutil.copy2(str(src), str(dest))
                size_kb = dest.stat().st_size / 1024
                print(f"Saved: {dest} ({size_kb:.1f} KB)")
            else:
                print(f"ERROR: File not found at {src}")
        elif result and result.get("error"):
            print(f"ERROR: {result['error']}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
