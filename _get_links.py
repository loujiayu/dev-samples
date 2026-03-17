import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        ctx = browser.contexts[0]
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        await page.goto(
            "https://seekingalpha.com/alpha-picks/articles",
            wait_until="networkidle",
            timeout=30000,
        )
        await asyncio.sleep(5)

        print("Title:", await page.title())
        print("URL:", page.url)

        # Use SeekingAlpha's own data-test-id selectors
        links = await page.evaluate("""
            () => {
                const items = document.querySelectorAll('[data-test-id="post-list-item"]');
                return Array.from(items).map(article => {
                    const titleLink = article.querySelector('[data-test-id="post-list-item-title"]');
                    const date = article.querySelector('[data-test-id="post-list-date"]');
                    const comments = article.querySelector('[data-test-id="post-list-comments"]');
                    return {
                        title: titleLink?.textContent?.trim() || '',
                        href: titleLink?.href || '',
                        date: date?.textContent?.trim() || '',
                        comments: comments?.textContent?.trim() || '',
                    };
                });
            }
        """)
        for i, l in enumerate(links):
            print(f"\n{i}: {l['title']}")
            print(f"   Date: {l['date']}  {l['comments']}")
            print(f"   {l['href']}")

        await browser.close()

asyncio.run(main())
