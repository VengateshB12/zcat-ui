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

# snippets.html is GENERATED from the real pages, never hand-written — see the
# header of build-snippets.py for why. Regenerating here means it can never
# drift from the library the way COMPONENTS.md did.
python3 build-snippets.py

# The library itself.
#
# zcat.css is an @import shell, and every one of its imports carries a
# hand-written ?v=120. Static files are cached for a year, so bumping only the
# OUTER link achieves nothing: the fresh zcat.css still asks for
# organisms.css?v=120, which the CDN serves from cache. That is exactly how the
# chart components shipped and rendered with black slices — the page had the new
# markup and a stylesheet from before the components were written.
#
# Rewrite every ?v= inside the shell to one hash of ALL the CSS, so a change to
# any file gives every import a new URL. Nobody has to remember a number.
CSSV=$(cat zcat-ui/zcat.css $(find zcat-ui/src -name '*.css' | sort) | shasum -a 1 | cut -c1-8)
sed -E "s/\?v=[0-9]+'\)/?v=$CSSV')/g" zcat-ui/zcat.css > "$OUT/zcat.css"
cp zcat-ui/zcat.js "$OUT/"
cp -R zcat-ui/src "$OUT/src"

# Docs: the playground, the worked template and the icon set.
# docs/index.html is DELIBERATELY excluded — it is the superseded long-scroll
# page that documents markup which no longer exists. Shipping it would let the
# stale docs win at /docs/.
cp zcat-ui/docs/playground.html zcat-ui/docs/template.html zcat-ui/docs/snippets.html "$OUT/docs/"
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
# The sidebar's "Basic Template" link is NOT a literal href — the NAV registry
# stores it as '@template.html' and the renderer strips the '@'. It needs the
# same rewrite or it 404s from the site root.
# Static files are cached for a year, so a rebuilt page keeps serving the old
# one until the URL changes. CSS and JS already carry ?v=; the snippets link did
# not, so the docs kept handing people a stale component reference — 9 stale
# components while the deployed file held 22. Key it to the content, so it moves
# only when the page actually changes.
SNIPV=$(shasum -a 1 zcat-ui/docs/snippets.html | cut -c1-8)

sed -e 's|href="\.\./zcat\.css|href="zcat.css|g' \
    -e 's|src="\.\./zcat\.js|src="zcat.js|g' \
    -e 's|src="icons/|src="docs/icons/|g' \
    -e 's|href="template\.html"|href="docs/template.html"|g' \
    -e "s|href=\"snippets\.html\"|href=\"docs/snippets.html?v=$SNIPV\"|g" \
    -e "s|'@template\.html'|'@docs/template.html'|g" \
    zcat-ui/docs/playground.html > "$OUT/index.html"

# Slate needs this inside the deployed directory (CLI < 1.27 pattern).
mkdir -p "$OUT/.catalyst"
printf 'framework = "static"\ndeployment_name = "default"\n' > "$OUT/.catalyst/slate-config.toml"

echo "built $OUT/ — $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
