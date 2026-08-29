#!/usr/bin/env bash
# Assemble the deployable docs site for Catalyst Slate.
#
# The output is a BUILD ARTEFACT, rebuilt from zcat-ui/ on every run — never
# hand-edit it, and never let it become a second copy of the library that can
# drift. Run this before every deploy.
#
#   ./build-docs-site.sh && catalyst deploy slate zcat-docs -ni
#
# The directory shape mirrors zcat-ui/ exactly so every relative path inside
# playground.html keeps working untouched:
#   ../zcat.css        -> /zcat.css
#   icons/…            -> /docs/icons/…
#   ../../docs/icons/… -> /docs/icons/…
set -euo pipefail
cd "$(dirname "$0")"

OUT="slate-docs"
rm -rf "$OUT"
mkdir -p "$OUT/docs"

# The library itself
cp zcat-ui/zcat.css zcat-ui/zcat.js "$OUT/"
cp -R zcat-ui/src "$OUT/src"

# Docs: the playground, the worked template and the icon set.
# docs/index.html is DELIBERATELY excluded — it is the superseded long-scroll
# page that documents markup which no longer exists. Shipping it would let the
# stale docs win at /docs/.
cp zcat-ui/docs/playground.html zcat-ui/docs/template.html "$OUT/docs/"
cp -R zcat-ui/docs/icons "$OUT/docs/icons"
cp zcat-ui/ONBOARDING.md "$OUT/docs/" 2>/dev/null || true

# Root entry IS the playground — no redirect, so the site lives at the bare
# domain rather than sending everyone to /docs/playground.html.
#
# Only four path classes need rewriting when the file moves up one level. The
# mask-icon URLs are deliberately NOT touched: `url('../../docs/icons/…')`
# resolves against the stylesheet that consumes it (src/components/shell.css),
# not against this document, so it already points at /docs/icons/. Rewriting it
# here would break every icon — see the trap in HANDOFF §5.
sed -e 's|href="\.\./zcat\.css|href="zcat.css|g' \
    -e 's|src="\.\./zcat\.js|src="zcat.js|g' \
    -e 's|src="icons/|src="docs/icons/|g' \
    -e 's|href="template\.html"|href="docs/template.html"|g' \
    zcat-ui/docs/playground.html > "$OUT/index.html"

# Slate needs this inside the deployed directory (CLI < 1.27 pattern).
mkdir -p "$OUT/.catalyst"
printf 'framework = "static"\ndeployment_name = "default"\n' > "$OUT/.catalyst/slate-config.toml"

echo "built $OUT/ — $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
