# Minecraft Milyoner — Versioned Backup Architecture (`backup/`)

This directory defines the structured backup schema managed by `backupService` in `services.js`.

## Directory & Namespace Structure

```text
backup/
├── users/          # Sanitized user account records (IDs, usernames, roles, ranks, VIP status, Emeralds, points, settings)
├── parties/        # Active & historical tournament parties, participants, and invite codes
├── licenses/       # Managed license records, role assignments, and expiration metadata
├── transactions/   # Immutable Emerald Coin ledger & Extra Life audit history
├── payments/       # Stripe checkout sessions, webhook statuses (PENDING, PAID, FAILED, REFUNDED), and idempotency records
└── settings/       # Economy reward configuration, Emerald packages (5 Emeralds = 1 TL), and system settings
```

## Security & Privacy Rules
1. **No Plaintext Passwords**: User passwords are hashed with salted SHA-256 (`passwordHash`) upon creation/update and stripped from all backup exports.
2. **User Isolation**: Normal players and VIP users cannot read or export backup snapshots.
3. **Admin-Only Management**: Only authenticated `ADMIN` sessions can create, inspect, download, or restore versioned backups from the Admin Panel (`Backups` tab).
