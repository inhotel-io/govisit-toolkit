# GoVisit Toolkit v0.2.3

Adds `govisit-search-availability` to All and Travel Planner. It reads provider-reported rates and availability for eligible one-room stays and can return a link to the hotel’s checkout. The underlying HTTP API stays on v1.

Aligns descriptions across 25 skills and clarifies GoVisit’s travel and hospitality positioning. Packs contain 25 All, 21 Travel Planner, 13 Destination, and 10 Local Business skills.

# GoVisit Toolkit v0.2.2

Adds two public blog skills to the All and Travel Planner packages:
`govisit-search-blog-posts` searches eligible cards on a rendered company or
place blog index, and `govisit-get-blog-post` reads an article or one heading
section. Both use the existing `/api/tools/v1/` interface and published
`pagePath` context.

Article results include public metadata, nullable localized keywords, authors,
images, language alternates, citations, rich content, FAQs and related posts. Content blocks preserve links,
lists, tables, code, quotes, images, media, disclosures and text templates.
Coverage flags report limits and unsupported content. Missing values remain
null where the contract declares them nullable.

Search examines at most 200 rendered cards before filtering and returning up
to 20 summaries. It returns matched and rendered counts, coverage and a next
page link. The skills do not crawl all blog pages or retrieve linked content
automatically. HTTP does not request drafts or forward browser credentials.

Includes 24 portable public read skills and four native packages: All (24),
Travel Planner (20), Destination (13), and Local Business (10). The explicit
Destination and Local Business selections retain their existing readers.
The WebMCP discovery cache revision advances to 0.3; API endpoints and result
schemaVersion remain at version 1.

This candidate includes the reviewed source export and passes local archive
verification. Human review is pending. No tag or public release has been
created, and website
discovery has not been promoted. Previous immutable releases retain their
published bytes. MIT covers toolkit files; hosted services and returned data
retain the separate GoVisit Data Use License.
