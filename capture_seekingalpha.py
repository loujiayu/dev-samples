"""
Use Playwright with a persistent browser profile to visit
https://seekingalpha.com/alpha-picks/articles and run
browser-capture-bundle.js in the browser console.
"""

import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

# Force unbuffered output so prints appear immediately
sys.stdout.reconfigure(line_buffering=True)

PROFILE_DIR = Path.home() / ".seekingalpha_profile"
TARGET_URL = "https://seekingalpha.com/alpha-picks/articles"
JS_FILE = Path(__file__).parent / "browser-capture-bundle.js"

# Stealth args to avoid bot detection
BROWSER_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
]


async def main():
    js_code = JS_FILE.read_text(encoding="utf-8")
    stealth = Stealth()

    async with async_playwright() as p:
        # Try system Edge/Chrome first, fall back to Playwright Chromium
        channel = "chrome"

        print(f"Using channel: {channel}")
        context = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            channel=channel,
            args=BROWSER_ARGS,
            ignore_default_args=["--enable-automation", "--no-sandbox"],
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )

        # Apply stealth to every page (including the initial blank one)
        for pg in context.pages:
            await stealth.apply_stealth_async(pg)

        # Also apply stealth to any future pages/tabs
        context.on("page", lambda pg: asyncio.ensure_future(stealth.apply_stealth_async(pg)))

        page = context.pages[0] if context.pages else await context.new_page()

        print(f"Navigating to {TARGET_URL} ...")
        await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=5000)

        print("Page loaded. Running browser-capture-bundle.js ...")

        # Execute the bundled script in the page context
        result = await page.evaluate(js_code)
        print("Script executed.")
        if result is not None:
            print("Result:", result)

        # Keep the browser open so you can inspect the result
        print("Press Enter in the terminal to close the browser...")
        await asyncio.get_event_loop().run_in_executor(None, input)

        await context.close()


if __name__ == "__main__":
    asyncio.run(main())
