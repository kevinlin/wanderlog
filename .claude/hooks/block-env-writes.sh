#!/usr/bin/env bash
#
# Blocks agent writes to .env files.
#
# .env.local holds SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) and
# ANTHROPIC_API_KEY. An edit there can clobber live credentials or echo them
# into the transcript. .env.local.example is a committed template, so it stays
# editable.
#
# Reads the PreToolUse payload on stdin; exit 2 denies the tool call.

set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0

case "$file" in
  *.example|*.sample)
    exit 0
    ;;
  .env|*/.env|.env.*|*/.env.*)
    echo "Blocked: $file holds SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY. Ask the user to edit it by hand; do not read or rewrite it." >&2
    exit 2
    ;;
esac

exit 0
