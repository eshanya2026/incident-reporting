#!/usr/bin/env bash
# ==============================================================================
# Adhiparasakthi Hospitals - Incident Management System
# Database Backup & Restore Utility
#
# Usage:
#   ./scripts/backup_restore.sh backup [output_dir]
#   ./scripts/backup_restore.sh restore <backup_archive_or_dir> [--force]
#   ./scripts/backup_restore.sh check
#
# Environment variables:
#   MONGO_URI : MongoDB connection string (defaults to server/.env or localhost)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
ENV_FILE="${ROOT_DIR}/server/.env"

# Extract MONGO_URI from server/.env if not already set
if [[ -z "${MONGO_URI:-}" && -f "${ENV_FILE}" ]]; then
  EXTRACTED_URI=$(grep -E '^MONGO_URI=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r"' || true)
  if [[ -n "${EXTRACTED_URI}" ]]; then
    MONGO_URI="${EXTRACTED_URI}"
  fi
fi

MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/incident_db}"

# Strip credentials for safe logging
SAFE_URI=$(echo "${MONGO_URI}" | sed -E 's/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/mongodb\1:\/\/\2:****@/')

print_header() {
  echo "=================================================================="
  echo "  Adhiparasakthi Hospitals - Database Utility"
  echo "  Target: ${SAFE_URI}"
  echo "=================================================================="
}

check_tools() {
  local missing=0
  if ! command -v mongodump &> /dev/null; then
    echo "⚠️  'mongodump' command not found in PATH."
    missing=1
  else
    echo "✅ 'mongodump' is available ($(mongodump --version | head -n 1))"
  fi

  if ! command -v mongorestore &> /dev/null; then
    echo "⚠️  'mongorestore' command not found in PATH."
    missing=1
  else
    echo "✅ 'mongorestore' is available ($(mongorestore --version | head -n 1))"
  fi

  if [[ ${missing} -eq 1 ]]; then
    echo ""
    echo "To install MongoDB Database Tools:"
    echo "  - Windows: choco install mongodb-database-tools OR download from mongodb.com/try/download/database-tools"
    echo "  - Ubuntu/Debian: sudo apt-get install mongodb-database-tools"
    echo "  - macOS: brew tap mongodb/brew && brew install mongodb-database-tools"
    return 1
  fi
  return 0
}

do_backup() {
  print_header
  if ! check_tools; then
    exit 1
  fi

  local target_dir="${1:-${BACKUP_DIR}}"
  mkdir -p "${target_dir}"

  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  local archive_name="incident_db_backup_${timestamp}.gz"
  local archive_path="${target_dir}/${archive_name}"

  echo ""
  echo "📦 Initiating database backup..."
  echo "   Destination: ${archive_path}"
  echo ""

  mongodump --uri="${MONGO_URI}" --archive="${archive_path}" --gzip

  local size
  size=$(ls -lh "${archive_path}" | awk '{print $5}')
  echo ""
  echo "✅ Backup successfully created!"
  echo "   File: ${archive_path} (${size})"
  echo "   To restore this backup, run:"
  echo "   ./scripts/backup_restore.sh restore \"${archive_path}\""
}

do_restore() {
  print_header
  if ! check_tools; then
    exit 1
  fi

  local target_file="${1:-}"
  local force="${2:-}"

  if [[ -z "${target_file}" ]]; then
    echo "❌ Error: Backup file path required."
    echo "   Usage: ./scripts/backup_restore.sh restore <path_to_backup.gz> [--force]"
    exit 1
  fi

  if [[ ! -f "${target_file}" && ! -d "${target_file}" ]]; then
    echo "❌ Error: Backup file or directory does not exist: ${target_file}"
    exit 1
  fi

  echo ""
  echo "⚠️  WARNING: Restoring will overwrite existing collections in:"
  echo "   ${SAFE_URI}"
  echo ""

  if [[ "${force}" != "--force" && "${force}" != "-y" ]]; then
    read -r -p "Are you sure you want to proceed with database restore? [y/N]: " confirm
    if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
      echo "Operation cancelled by user."
      exit 0
    fi
  fi

  echo ""
  echo "🔄 Restoring database..."
  if [[ -f "${target_file}" ]]; then
    mongorestore --uri="${MONGO_URI}" --archive="${target_file}" --gzip --drop
  else
    mongorestore --uri="${MONGO_URI}" "${target_file}" --drop
  fi

  echo ""
  echo "✅ Database restore completed successfully!"
}

# Subcommand routing
COMMAND="${1:-}"
shift || true

case "${COMMAND}" in
  backup)
    do_backup "${1:-}"
    ;;
  restore)
    do_restore "${1:-}" "${2:-}"
    ;;
  check)
    print_header
    check_tools
    ;;
  *)
    echo "Adhiparasakthi Incident Reporting - Database Backup / Restore Utility"
    echo ""
    echo "Usage:"
    echo "  $0 backup [output_dir]               Create a timestamped compressed backup"
    echo "  $0 restore <backup.gz> [--force]     Restore database from compressed archive"
    echo "  $0 check                             Verify mongodump and mongorestore tools"
    echo ""
    exit 1
    ;;
esac
