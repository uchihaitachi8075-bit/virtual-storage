#!/bin/bash
# ============================================================================
# bulk-upload.sh
# Uploads every file inside a folder (recursively) to your storage server,
# preserving the folder structure as the virtual "folderPath" for each file.
#
# USAGE:
#   export TOKEN="your-access-token"
#   ./bulk-upload.sh /path/to/your/photos
#
# Example:
#   ./bulk-upload.sh ~/Pictures
#   ./bulk-upload.sh "/Volumes/My Phone Backup/DCIM"
# ============================================================================

set -e

SERVER_URL="${SERVER_URL:-http://localhost:4000}"
SOURCE_DIR="$1"

if [ -z "$SOURCE_DIR" ]; then
  echo "Usage: ./bulk-upload.sh /path/to/folder"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  echo "Error: set your access token first, e.g.:"
  echo '  export TOKEN="eyJhbGciOi..."'
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: folder not found: $SOURCE_DIR"
  exit 1
fi

# Normalize so we can compute clean relative paths below
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"

TOTAL=0
UPLOADED=0
FAILED=0

echo "Scanning $SOURCE_DIR ..."

# Find every regular file, skipping hidden files/folders (like .DS_Store)
while IFS= read -r -d '' FILE; do
  TOTAL=$((TOTAL + 1))

  # Compute the virtual folder path relative to SOURCE_DIR
  # e.g. if SOURCE_DIR=/Users/you/Pictures and FILE=/Users/you/Pictures/2024/trip.jpg
  # then REL_DIR = /2024
  REL_PATH="${FILE#$SOURCE_DIR/}"
  REL_DIR="$(dirname "$REL_PATH")"
  if [ "$REL_DIR" = "." ]; then
    FOLDER_PATH="/"
  else
    FOLDER_PATH="/$REL_DIR"
  fi

  echo "[$TOTAL] Uploading: $REL_PATH  -> folderPath=$FOLDER_PATH"

  RESPONSE=$(curl -s -X POST "$SERVER_URL/files/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@${FILE}" \
    -F "folderPath=${FOLDER_PATH}")

  if echo "$RESPONSE" | grep -q '"success":true'; then
    UPLOADED=$((UPLOADED + 1))
  else
    FAILED=$((FAILED + 1))
    echo "   FAILED: $RESPONSE"
  fi
done < <(find "$SOURCE_DIR" -type f -not -name ".*" -print0)

echo ""
echo "Done. Total files found: $TOTAL | Uploaded: $UPLOADED | Failed: $FAILED"
