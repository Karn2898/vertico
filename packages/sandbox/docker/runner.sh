set -e

if[-z "$SANDBOX_CODE"]; then
  echo "No code provided" > 82
  exit 1
fi

if  [ "$SANDBOX_LANG" = "python" ]; then
    echo "$SANDBOX_CODE" | python3
elif [ "$SANDBOX_LANG" = "node" ]; then
    echo "$SANDBOX_CODE" | node

else 
    echo  "Unsupported language: $SANDBOX_LANG" >&2
    exit 1
fi