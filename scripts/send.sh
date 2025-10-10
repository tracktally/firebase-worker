#!/usr/bin/env bash
set -euo pipefail

set -x
session="challenge"
key='$2b$10$L1vRtms9R0iwdje7EzxhnOejYp_8ouhTugpenGtyMoo3IQYBMu.3S'
# host="http://localhost:21465"
host="http://192.168.178.30:21465"
set +x

phone=""
group=true
message=""

if [[ $# -eq 0 ]]; then
  echo "$0 --message X --phone Y --group true"; exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || { echo "Error: invalid message"; exit 1; }
      message="$2";
      shift 2;;
    -p|--phone)
      [[ $# -ge 2 ]] || { echo "Error: invalid phone"; exit 1; }
      phone="$2";
      shift 2;;
    -g|--group)
      [[ $# -ge 2 ]] || { echo "Error: invalid group"; exit 1; }
      group="$2";
      shift 2;;
    *)
      echo "Unknown option: $1" >&2;
      exit 1;;
  esac
done

if [[ -n "$message" ]]; then
  printf -v message '%b' "$message"
fi

# Validate group
case "$group" in
  true|false) : ;;
  *)
    echo "Error: --group must be 'true' or 'false' (got: $group)";
    exit 1;;
esac


payload=$(jq -n \
  --arg phone "$phone" \
  --arg message "$message" \
  --argjson group "$group" \
  '{phone:$phone,isGroup:$group,message:$message}')


set -x
curl -X POST "${host}/api/${session}/send-message" \
     -H 'accept: */*' \
     -H "Authorization: Bearer ${key}" \
     -H 'Content-Type: application/json' \
     -d "$payload"

status=$?
set +x
exit $status
