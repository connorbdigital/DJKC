# Deliverables index

Everything named here is in this repository, so it survives the session that
built it. Where a doc and code disagree, the tests are right and the doc is a bug.

| Document | What it answers |
| --- | --- |
| [shop-round-2026-11-20.md](shop-round-2026-11-20.md) | This round's shop work: the name, the 12-department taxonomy, SEO/AEO/GEO, the four product-source routes, and how each piece was checked |
| [../commerce/README.md](../commerce/README.md) | The storefront framework, the research it is built from, and what `npm run site` produces |
| [../commerce/COMMISSION.md](../commerce/COMMISSION.md) | The money: resale margin worked line by line, marketplace commission, affiliate rates, and the four routes (Alibaba, AliExpress, Amazon, eBay) with their caps and gates |
| [../commerce/SUPPLIERS.md](../commerce/SUPPLIERS.md) | Where product feeds come from, what each contains, what it costs, and the vetting questions |
| [../commerce/GAPS.md](../commerce/GAPS.md) | What a real shop has that this one does not, ranked, with effort estimates |
| [../studio/PROCESSES.md](../studio/PROCESSES.md) | Every process the Studio can generate, including the product-catalogue one |
| [../studio/README.md](../studio/README.md) | The Studio: inventory, feature library, draft → PR → checks → merge gate |
| [../README.md](../README.md) | The DJKC site itself and the two products that live beside it |

## Generated, not stored

`commerce/catalogue/dist/` is built by `npm run site` and is git-ignored:

```bash
cd commerce
npm run site
npm run serve:catalogue   # http://localhost:4300
```

50 HTML pages, 33 placeholder SVGs, `products.json`, `search-index.json`,
`google-feed.csv`, `llms.txt`, `llms-full.txt`, `sitemap.xml`, `robots.txt`.
