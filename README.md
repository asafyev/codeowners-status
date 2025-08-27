# CODEOWNERS Status

A VS Code extension that displays code ownership information from CODEOWNERS files directly in the status bar.

## Features

- **Status Bar Integration**: Shows the owners of the currently open file in the VS Code status bar
- **Interactive Navigation**: Click the status bar to jump directly to the relevant line in your CODEOWNERS file
- **Multiple CODEOWNERS Locations**: Supports CODEOWNERS files in root directory and `.github/` folder
- **Flexible Ownership Rules**: Option to treat files without explicit owners as "open for approval by anyone"
- **Real-time Updates**: Automatically updates when you switch files or modify CODEOWNERS

## How It Works

When you open a file, the extension:
1. Finds the matching pattern in your CODEOWNERS file
2. Displays the owners in the status bar (e.g., `👥 Owners: @team1, @team2`)
3. Makes the status bar clickable to navigate to the exact CODEOWNERS rule

## Status Bar Indicators

- `👥 Owners: @team1, @team2` - File has specific owners (clickable)
- `👥 No owners` - File matches a pattern but has no explicit owners (clickable)
- `👥 No owners found` - No matching pattern found (not clickable)

## Extension Settings

This extension contributes the following settings:

- `codeowners.showDebugLogs`: Show debug logs in output channel (default: `false`)
- `codeowners.statusBarPriority`: Priority of the status bar item, higher numbers appear more to the left (default: `100`)
- `codeowners.additionalCodeownersPaths`: Additional paths to search for CODEOWNERS files, relative to workspace root (default: `[]`)
- `codeowners.allowMissingOwners`: Allow CODEOWNERS lines with path patterns but no owners, indicates files can be approved by anyone (default: `true`)

## Example Configuration

```json
{
  "codeowners.showDebugLogs": false,
  "codeowners.statusBarPriority": 1,
  "codeowners.additionalCodeownersPaths": ["docs/CODEOWNERS"],
  "codeowners.allowMissingOwners": true
}
```

## CODEOWNERS File Support

The extension supports standard CODEOWNERS syntax:

```
# Global owners
* @global-team

# Frontend files
/src/components/** @frontend-team
/src/styles/** @frontend-team @design-team

# Backend files
/src/api/** @backend-team
/src/database/** @backend-team @dba-team

# Files without specific owners (anyone can approve)
/scripts/
/docs/
```

## Requirements

- A CODEOWNERS file in your repository root or `.github/` directory
- VS Code 1.99.0 or higher

## Release Notes

### 0.0.1

Initial release of CODEOWNERS Status extension.

---

**Enjoy better code ownership visibility!**