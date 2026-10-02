#!/usr/bin/env bash
# Guardrail: this repository is public. Fail if anything tracked by git mentions
# the private companion repository, local absolute paths, or obvious secrets.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

# 1. No references to the private repo's name or local filesystem paths.
#    The pattern is assembled at runtime so this script does not trip itself.
private_name="metastack""-cloud"
if git grep -n -I -E "${private_name}|/home/[a-z]+/|/Users/[a-z]+/" -- . ':!scripts/check-public.sh' ; then
  echo "::error::Found references to private paths or the private repository name."
  fail=1
fi

# 2. No .env files other than .env.example.
if git ls-files | grep -E '(^|/)\.env(\..+)?$' | grep -v '\.env\.example$' ; then
  echo "::error::An .env file is tracked by git."
  fail=1
fi

# 3. Cheap secret pattern check (gitleaks runs separately in CI with its full ruleset).
if git grep -n -I -E '(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}|postgres(ql)?://[^ ]+:[^ ]+@)' -- . ':!scripts/check-public.sh' ; then
  echo "::error::Something that looks like a credential is tracked by git."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "check-public: ok"
