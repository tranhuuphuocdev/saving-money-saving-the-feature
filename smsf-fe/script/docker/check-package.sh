PACKAGE_PATH=/app/smsf-fe/package.json
TEMP_PATH=/tmp/package.json

#!/bin/sh
set -eu

NODE_CMD='p=JSON.parse(require("fs").readFileSync(0));delete p.version;console.log(JSON.stringify(p,null,2))'

TMP1=$(mktemp)
TMP2=$(mktemp)

trap 'rm -f "$TMP1" "$TMP2"' EXIT

node -e "$NODE_CMD" < "$PACKAGE_PATH" > "$TMP1"
node -e "$NODE_CMD" < "$TEMP_PATH"   > "$TMP2"

if diff "$TMP1" "$TMP2" > /dev/null; then
    echo "package.json matched, skipping rebuild."
    rm "$TEMP_PATH"
    exit 0
else
    echo
    echo "package.json has changed!, rebuild required."
    echo "---------------------------------------------------"
    echo "Differences (ignoring version):"
    diff "$TMP2" "$TMP1"
    echo "---------------------------------------------------"
    
    rm "$TEMP_PATH"
    exit 1
fi
