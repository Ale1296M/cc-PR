#!/usr/bin/env bash
# Snapshot the production database right before DNS cutover.
# Usage: PROD_DATABASE_URL="postgresql://..." ./scripts/pre-cutover-backup.sh
set -euo pipefail

: "${PROD_DATABASE_URL:?Set PROD_DATABASE_URL to the production connection string}"

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
FILE="$BACKUP_DIR/concarino_prod_precutover_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"

echo "→ Dumping production database..."
pg_dump "$PROD_DATABASE_URL" --format=plain --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$FILE"

SIZE=$(wc -c < "$FILE")
if [ "$SIZE" -lt 5000 ]; then
  echo "✗ Backup looks too small (${SIZE} bytes). ABORT cutover." >&2
  exit 1
fi
gzip -t "$FILE"
sha256sum "$FILE" > "$FILE.sha256"
echo "✓ Backup OK: $FILE (${SIZE} bytes)"

# Optional off-site copy:
# aws s3 cp "$FILE" "s3://<your-backup-bucket>/" --sse aws:kms

echo "✓ Safe to proceed with DNS cutover."
