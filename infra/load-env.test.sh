#!/usr/bin/env bash
set -euo pipefail

test_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

aws() {
  local path=''
  while (($#)); do
    if [[ $1 == --path ]]; then
      path=$2
      break
    fi
    shift
  done
  if [[ $path == /empty ]]; then
    printf '{"Parameters":[]}'
  else
    printf '%s' '{"Parameters":[{"Name":"/t/multi","Value":"line one\nline two\nline three"},{"Name":"/t/single","Value":"  spaced \"quoted\" $x"}]}'
  fi
}
export -f aws

fail() {
  printf 'not ok: %s\n' "$1" >&2
  exit 1
}

ok() {
  printf 'ok: %s\n' "$1"
}

# Capture only stdout: any non-command line here is a value leaked to the log.
gh_output=$(GITHUB_ACTIONS=true; source "$test_dir/load-env.sh" /t 2>/dev/null)
while IFS= read -r line; do
  [[ $line == ::add-mask::* ]] || fail "GitHub Actions stdout leaked an unmasked line: <$line>"
done <<<"$gh_output"
ok 'GitHub Actions stdout contains only add-mask lines'

for expected in 'line one' 'line two' 'line three' '  spaced "quoted" $x'; do
  [[ $gh_output == *"::add-mask::$expected"* ]] || fail "missing exact add-mask line: <$expected>"
done
ok 'all secret lines, including the exact single-line value, are masked'

multi_joined=$'line one\nline two\nline three'
while IFS= read -r line; do
  [[ $line != "$multi_joined" ]] || fail 'stdout contains the multi-line value joined as one line'
done <<<"$gh_output"
ok 'multi-line value is not emitted as one joined stdout line'

plain_output=$(unset GITHUB_ACTIONS; source "$test_dir/load-env.sh" /t 2>/dev/null)
[[ -z $plain_output ]] || fail 'non-GitHub invocation wrote to stdout'
ok 'non-GitHub invocation writes no stdout'

(
  unset GITHUB_ACTIONS
  source "$test_dir/load-env.sh" /t >/dev/null 2>/dev/null
  [[ $multi == $'line one\nline two\nline three' ]] || exit 1
  [[ $single == '  spaced "quoted" $x' ]] || exit 1
  [[ $(declare -p multi) == 'declare -x multi='* ]] || exit 1
  [[ $(declare -p single) == 'declare -x single='* ]] || exit 1
) || fail 'loaded variables do not preserve exact contents and exports'
ok 'both loaded variables are exported with exact contents'

empty_stderr=$(source "$test_dir/load-env.sh" /empty 2>&1 >/dev/null) && fail 'empty SSM path unexpectedly succeeded'
[[ $empty_stderr == *'/empty'* ]] || fail 'empty-path error does not name the path'
ok 'empty path fails and names the path on stderr'
