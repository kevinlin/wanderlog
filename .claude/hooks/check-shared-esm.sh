#!/usr/bin/env bash
#
# Enforces invariant 5 from CLAUDE.md on modules reachable from api/.
#
# The Vercel function runtime is Node ESM: it rewrites neither tsconfig path
# aliases nor extensionless relative specifiers. A violation compiles, passes
# `pnpm build`, passes the test suite (Vitest resolves both), and then 500s in
# production. Nothing else in the toolchain catches it, so this hook does.
#
# Reads the PostToolUse payload on stdin; exit 2 sends the message back to
# Claude so it can fix the import it just wrote.

set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null)}"
rel="${file#"$root"/}"

case "$rel" in
  # Tests run under Vitest, which resolves @/ and extensionless specifiers.
  *__tests__/*|*.test.ts|*.test.tsx)
    exit 0
    ;;
  # Browser-only barrel. Nothing in api/ imports it; `export * from './map'`
  # here is fine and predates this hook.
  src/types/index.ts)
    exit 0
    ;;
  # The shared set named in CLAUDE.md invariant 5, plus everything in api/.
  api/*|src/services/entityRows.ts|src/services/tripWrites.ts|src/services/tripBundleInsert.ts|src/services/supabaseMappers.ts|src/services/tripImportService.ts|src/schemas/*|src/types/*)
    ;;
  *)
    exit 0
    ;;
esac

# `import type` / `export type` lines are erased at compile time, so they may
# use the @/ alias and may omit the .js extension. Only value imports matter.
type_only='^[0-9]+:[[:space:]]*(import|export)[[:space:]]+type[[:space:]]'

alias_hits=$(grep -nE "from '@/" "$file" | grep -vE "$type_only" || true)
ext_hits=$(grep -nE "from '\.\.?/[^']*'" "$file" | grep -v "\.js'" | grep -vE "$type_only" || true)

[ -z "$alias_hits" ] && [ -z "$ext_hits" ] && exit 0

{
  echo "CLAUDE.md invariant 5 violated in $rel (reachable from api/, runs under Node ESM)."
  if [ -n "$alias_hits" ]; then
    echo
    echo "Value imports through the @/ alias — the Vercel runtime does not resolve it:"
    printf '%s\n' "$alias_hits" | sed 's/^/  /'
    echo "  Fix: use a relative specifier with a .js extension, or make it 'import type' if only types are used."
  fi
  if [ -n "$ext_hits" ]; then
    echo
    echo "Extensionless relative imports — Node ESM does not resolve them:"
    printf '%s\n' "$ext_hits" | sed 's/^/  /'
    echo "  Fix: append .js to the specifier ('./foo' -> './foo.js')."
  fi
} >&2

exit 2
