#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

phone="120363421146964189"
isGroup=true

"$SCRIPT_DIR/send.sh" --message "$1" --phone "$phone" --group $isGroup