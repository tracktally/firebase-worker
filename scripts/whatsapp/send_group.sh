#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )


#
# Send to test chat group chat
#
phone="120363404262081632"
isGroup=true

"$SCRIPT_DIR/send.sh" --message "$1" --phone "$phone" --group $isGroup
