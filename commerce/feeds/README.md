# Downloaded feeds

Supplier files land here, dated, and they are **not committed**: a feed is
account-specific data, sometimes licensed, and always large. `.gitignore` keeps
everything except this file.

```bash
cd commerce

# what a supplier portal gives you, e.g. Dropship For You's documented pattern
npm run feed -- --url "https://www.dropshipforyou.co.uk/feeds/csv_feed.php?u=you@example.com" --name dropforyou
npm run feed -- --url "https://www.dropshipforyou.co.uk/feeds/stock_feed.php?u=you@example.com" --name dropforyou-stock

# a feed behind a header
FEED_URL="https://supplier.example/products.csv" FEED_AUTH_HEADER="Authorization: Bearer …" npm run feed -- --name supplier

# then build from it
npm run site -- feeds/dropforyou-2026-11-20.csv
```

`feeds/manifest.json` records what was downloaded and when: the redacted URL,
bytes, SHA-256, row count, columns and the detected supplier profile. Keep it;
it is how you answer "was this price real on Tuesday?".

**Credentials never go in git.** `FEED_URL`, `FEED_AUTH_HEADER`, `FEED_USER` and
`FEED_PASS` are read from the environment, used for one request and never
written down. If a token does end up in a URL, `redactUrl` blanks it before
anything is logged or recorded.
