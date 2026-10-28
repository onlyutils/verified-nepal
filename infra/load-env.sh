# Source this file to load decrypted SSM parameters into the current shell.
# Usage: . infra/load-env.sh <ssm-path> [<var-prefix>]

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'usage: . infra/load-env.sh <ssm-path> [<var-prefix>]\n' >&2
  return 2
fi

_ssm_path=$1
_var_prefix=${2-}
_region=${AWS_REGION:-${AWS_DEFAULT_REGION:-}}
_aws_region_args=()
if [[ -n $_region ]]; then
  _aws_region_args+=(--region "$_region")
fi
_ssm_json=$(aws ssm get-parameters-by-path \
  --path "$_ssm_path" \
  --recursive \
  --with-decryption \
  "${_aws_region_args[@]}" \
  --output json) || return 1

if ! command -v jq >/dev/null 2>&1; then
  printf 'jq is required to load SSM parameters under %s\n' "$_ssm_path" >&2
  return 1
fi

_ssm_records=()
while IFS= read -r _ssm_record; do
  _ssm_records+=("$_ssm_record")
done < <(jq -r '.Parameters[]? | [.Name, (.Value | @base64)] | @tsv' <<<"$_ssm_json")

if [[ ${#_ssm_records[@]} -eq 0 ]]; then
  printf 'no SSM parameters found under %s\n' "$_ssm_path" >&2
  return 1
fi

_ssm_names=()
_ssm_values=()
_ssm_variables=()
for _ssm_record in "${_ssm_records[@]}"; do
  _ssm_name=${_ssm_record%%$'\t'*}
  _ssm_encoded=${_ssm_record#*$'\t'}
  _ssm_base=${_ssm_name##*/}
  _ssm_variable="${_var_prefix}${_ssm_base}"
  _ssm_value=''
  IFS= read -r -d '' _ssm_value < <(printf '%s' "$_ssm_encoded" | base64 --decode) || true
  _ssm_names+=("$_ssm_name")
  _ssm_values+=("$_ssm_value")
  _ssm_variables+=("$_ssm_variable")
done

if [[ ${GITHUB_ACTIONS:-false} == true ]]; then
  for _ssm_value in "${_ssm_values[@]}"; do
    printf '::add-mask::%s\n' "$_ssm_value"
    while IFS= read -r _ssm_line || [[ -n $_ssm_line ]]; do
      if [[ -n $_ssm_line ]]; then
        printf '::add-mask::%s\n' "$_ssm_line"
      fi
    done <<<"$_ssm_value"
  done
fi

for _ssm_index in "${!_ssm_records[@]}"; do
  _ssm_name=${_ssm_names[_ssm_index]}
  _ssm_variable=${_ssm_variables[_ssm_index]}
  if [[ ! $_ssm_variable =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
    printf 'skipped invalid shell variable name for parameter %s\n' "$_ssm_name" >&2
    continue
  fi
  printf -v "$_ssm_variable" '%s' "${_ssm_values[_ssm_index]}"
  export "$_ssm_variable"
  printf 'loaded %s\n' "$_ssm_variable" >&2
done

unset _ssm_path _var_prefix _region _aws_region_args _ssm_json _ssm_records _ssm_record
unset _ssm_names _ssm_values _ssm_variables _ssm_name _ssm_encoded
unset _ssm_base _ssm_variable _ssm_value _ssm_line _ssm_index
