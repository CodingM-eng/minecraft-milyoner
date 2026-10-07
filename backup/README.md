# Minecraft Milyoner — Structured Backup Architecture

This directory represents the structured backup schema managed by `backupService` (`window.MCMServices.backupService`):

```
backup/
├── users/          # Sanitized user accounts (passwords never stored in plaintext; hashes stripped from exports)
├── parties/        # Active & historical tournament parties and participant rosters
├── licenses/       # License metadata, role assignments, and expiration states
├── transactions/   # Full Emerald Coin audit ledger (Transaction ID, User, Amount, Prev/New Balance, Source)
└── settings/       # Configurable economy rewards, VIP bonuses, and Extra Life rules
```

## Security & Privacy Rules
- Plaintext passwords are **never** stored anywhere in the application or backup snapshots.
- Normal players **cannot** access other users' backup data (`backupService` enforces `authGuard.requireRole(session, ['ADMIN'])`).
- Administrators can create versioned snapshots, inspect each namespace (`backup/users/`, `backup/parties/`, `backup/licenses/`, `backup/transactions/`, `backup/settings/`), export JSON backups, and restore snapshots from the **Admin Panel → Backups** page.
