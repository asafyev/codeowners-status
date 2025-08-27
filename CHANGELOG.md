# Changelog

All notable changes to the "CODEOWNERS Status" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-12-XX

### Added
- Initial release of CODEOWNERS Status extension
- Status bar integration showing file owners from CODEOWNERS files
- Interactive status bar - click to navigate to relevant CODEOWNERS rule
- Support for CODEOWNERS files in root directory and `.github/` folder
- Real-time updates when switching files or modifying CODEOWNERS
- Configuration option `codeowners.showDebugLogs` for debug output
- Configuration option `codeowners.statusBarPriority` to control status bar position
- Configuration option `codeowners.additionalCodeownersPaths` for custom CODEOWNERS locations
- Configuration option `codeowners.allowMissingOwners` to support patterns without explicit owners
- Support for files without explicit owners (anyone can approve)
- Automatic CODEOWNERS file reloading when configuration changes
- Detailed logging with different levels (info, warn, error)
- Error handling with user-friendly messages

### Features
- **Status Bar Indicators**:
  - `👥 Owners: @team1, @team2` - File has specific owners
  - `👥 No owners` - File matches pattern but no explicit owners
  - `👥 No owners found` - No matching pattern found
- **Smart Navigation**: Opens CODEOWNERS file at the exact line defining ownership
- **Pattern Matching**: Uses minimatch for flexible file pattern matching
- **Performance Optimized**: Config caching and efficient file processing