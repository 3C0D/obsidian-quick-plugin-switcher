#!/usr/bin/env tsx

console.log(`
🎯 Obsidian Plugin - Quick Help
Available commands in this autonomous plugin

═══════════════════════════════════════════════════════════════════

📋 MAIN COMMANDS

DEVELOPMENT:
  yarn start                       # Install dependencies + start dev
  yarn dev                         # Build dev mode with hot reload
  yarn build                       # Build production
  yarn real                        # Build + install in real vault
  yarn lint, lint:fix             # ESLint verification/correction

VERSION & RELEASE:
  yarn v, update-version           # Update version (package.json + manifest.json)
  yarn release, r                  # Create GitHub release with tag

GIT OPERATIONS:
  yarn acp                         # Add, commit, push (with Git sync)
  yarn bacp                        # Build + add, commit, push
  yarn run help, h                 # This help

═══════════════════════════════════════════════════════════════════

🚀 TYPICAL WORKFLOW

  1. yarn start                    # Initial setup
  2. yarn dev                      # Daily development
  3. yarn build                    # Test production build
  4. yarn v                        # Update version
  5. yarn release                  # Publish GitHub release

═══════════════════════════════════════════════════════════════════

⚙️ CONFIGURATION

ENVIRONMENT:
  - Edit .env to define TEST_VAULT and REAL_VAULT
  - Autonomous scripts (no external dependencies)
  - Automatic Git sync verification before push

AUTONOMOUS PLUGIN:
  ✅ Independent local scripts
  ✅ Integrated TypeScript and ESLint configuration
  ✅ GitHub Actions workflows with Yarn
  ✅ No dependency on obsidian-plugin-config
`);
