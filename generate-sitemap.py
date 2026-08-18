#!/usr/bin/env python3
"""Generate sitemap.xml from the HTML files in this directory.

Rules it follows, so the sitemap stays consistent with the live site:

  - URLs are the extensionless canonical forms (/about, not /about.html),
    matching what Cloudflare Pages actually serves and what each page's
    <link rel="canonical"> declares.
  - Pages marked noindex are excluded. A sitemap is a list of pages you
    want indexed, so including a noindex page sends conflicting signals.
  - lastmod comes from the file's last git commit date, so it reflects
    real changes rather than the day the sitemap happened to be built.
  - changefreq/priority are omitted deliberately: Google ignores both.

Run:  python3 generate-sitemap.py
"""
import glob
import re
import subprocess
import sys
from datetime import date
from xml.sax.saxutils import escape

BASE = "https://corkhypnotherapy.com"

NOINDEX = re.compile(r'<meta\s+name=["\']robots["\'][^>]*noindex', re.I)


def url_for(filename):
    if filename == "index.html":
        return BASE + "/"
    return BASE + "/" + filename[:-len(".html")]


def lastmod_for(filename):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", filename],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        if out:
            return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return date.today().isoformat()


def main():
    entries, skipped = [], []

    for filename in sorted(glob.glob("*.html")):
        with open(filename, encoding="utf-8") as f:
            html = f.read()

        if NOINDEX.search(html):
            skipped.append(filename)
            continue

        entries.append((url_for(filename), lastmod_for(filename)))

    # Homepage first, then the rest alphabetically
    entries.sort(key=lambda e: (e[0] != BASE + "/", e[0]))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, lastmod in entries:
        lines += [
            "  <url>",
            f"    <loc>{escape(url)}</loc>",
            f"    <lastmod>{lastmod}</lastmod>",
            "  </url>",
        ]
    lines.append("</urlset>")

    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"sitemap.xml written with {len(entries)} URL(s)")
    for url, lastmod in entries:
        print(f"  {lastmod}  {url}")
    if skipped:
        print(f"\nexcluded as noindex: {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
