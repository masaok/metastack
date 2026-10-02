#!/usr/bin/env bash
# Proof-of-failure test for scripts/check-public.sh.
# Builds throwaway git repositories and asserts the guardrail passes on a clean
# tree and fails on each condition it exists to detect, including untracked files.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
check="$here/check-public.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

make_repo() {
  local dir="$tmp/$1"
  mkdir -p "$dir/scripts"
  git -C "$dir" init -q
  git -C "$dir" config user.email t@example.com
  git -C "$dir" config user.name t
  cp "$check" "$dir/scripts/check-public.sh"
  echo "# clean" > "$dir/README.md"
  git -C "$dir" add -A
  git -C "$dir" commit -q -m init
  echo "$dir"
}

expect_pass() {
  local dir="$1" label="$2"
  if CHECK_PUBLIC_ROOT="$dir" bash "$check" > /dev/null 2>&1; then
    echo "ok   - passes: $label"
  else
    echo "FAIL - should pass: $label"; exit 1
  fi
}

expect_fail() {
  local dir="$1" label="$2"
  if CHECK_PUBLIC_ROOT="$dir" bash "$check" > /dev/null 2>&1; then
    echo "FAIL - should fail: $label"; exit 1
  else
    echo "ok   - fails:  $label"
  fi
}

r="$(make_repo clean)"
expect_pass "$r" "clean repository"

r="$(make_repo private-name-tracked)"
printf 'see ../%s%s/notes\n' "metastack" "-cloud" > "$r/docs.md"
git -C "$r" add -A && git -C "$r" commit -q -m x
expect_fail "$r" "tracked file mentions the private repository"

r="$(make_repo private-name-untracked)"
printf 'see ../%s%s/notes\n' "metastack" "-cloud" > "$r/new.md"
expect_fail "$r" "untracked file mentions the private repository"

r="$(make_repo local-path)"
echo "/home/someone/projects/x" > "$r/paths.txt"
expect_fail "$r" "local absolute path"

r="$(make_repo env-file)"
echo "SECRET=1" > "$r/.env.local"
expect_fail "$r" "untracked .env file that is not ignored"

r="$(make_repo env-example-ok)"
echo "# names only" > "$r/.env.example"
expect_pass "$r" ".env.example is allowed"

r="$(make_repo env-ignored-ok)"
echo ".env*" > "$r/.gitignore"
echo "SECRET=1" > "$r/.env.local"
expect_pass "$r" "ignored .env file is allowed"

r="$(make_repo aws-key)"
echo "key = AKIAABCDEFGHIJKLMNOP" > "$r/config.txt"
expect_fail "$r" "AWS access key pattern"

r="$(make_repo db-url)"
echo "postgres://user:pass@db.example.com/x" > "$r/db.txt"
expect_fail "$r" "database URL with credentials"

echo "check-public.test: all assertions passed"
