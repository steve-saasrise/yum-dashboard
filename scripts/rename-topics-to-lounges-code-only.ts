#!/usr/bin/env node

/**
 * Script to rename Topics to Lounges in the codebase (CODE ONLY - no database changes)
 * This handles file renames and code updates
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Find all TypeScript/JavaScript files
function findFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (
      stat.isDirectory() &&
      !item.startsWith('.') &&
      item !== 'node_modules' &&
      item !== '.next'
    ) {
      files.push(...findFiles(fullPath, pattern));
    } else if (stat.isFile() && pattern.test(item)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  log('\n🔄 Starting Topics → Lounges Code Rename\n', colors.bright);
  log('⚠️  This script will NOT touch your database\n', colors.yellow);

  let changesMade = false;

  // Step 1: Rename directories
  log('📁 Step 1: Checking for directories to rename', colors.yellow);

  const directoryRenames = [
    { from: 'components/topics', to: 'components/lounges' },
    { from: 'app/api/lounges', to: 'app/api/lounges' },
  ];

  for (const { from, to } of directoryRenames) {
    const fromPath = path.join(rootDir, from);
    const toPath = path.join(rootDir, to);
    if (fs.existsSync(fromPath)) {
      fs.renameSync(fromPath, toPath);
      log(`✓ Renamed ${from} → ${to}`, colors.green);
      changesMade = true;
    } else {
      log(`⏭️  Directory ${from} not found, skipping`, colors.blue);
    }
  }

  // Step 2: Rename files
  log('\n📄 Step 2: Checking for files to rename', colors.yellow);

  // First, handle the lounge-selector.tsx file if directories were renamed
  const topicSelectorOldPath = path.join(
    rootDir,
    'components/lounges/lounge-selector.tsx'
  );
  const topicSelectorNewPath = path.join(
    rootDir,
    'components/lounges/lounge-selector.tsx'
  );

  if (fs.existsSync(topicSelectorOldPath)) {
    fs.renameSync(topicSelectorOldPath, topicSelectorNewPath);
    log(`✓ Renamed lounge-selector.tsx → lounge-selector.tsx`, colors.green);
    changesMade = true;
  }

  // Rename types file
  const topicTypesPath = path.join(rootDir, 'types/topic.ts');
  const loungeTypesPath = path.join(rootDir, 'types/lounge.ts');

  if (fs.existsSync(topicTypesPath)) {
    fs.renameSync(topicTypesPath, loungeTypesPath);
    log(`✓ Renamed types/topic.ts → types/lounge.ts`, colors.green);
    changesMade = true;
  }

  // Step 3: Update code references
  log('\n🔍 Step 3: Updating code references', colors.yellow);

  // Find all code files
  const codeFiles = findFiles(rootDir, /\.(ts|tsx|js|jsx)$/);
  log(`Found ${codeFiles.length} code files to check`, colors.blue);

  // Define replacement patterns
  const replacements = [
    // Import statements
    {
      pattern: /from ['"]@\/components\/topics\//g,
      replacement: "from '@/components/lounges/",
    },
    { pattern: /from ['"]\.\.\/topics\//g, replacement: "from '../lounges/" },
    { pattern: /from ['"]\.\/topics\//g, replacement: "from './lounges/" },
    {
      pattern: /from ['"]@\/types\/topic['"];?/g,
      replacement: "from '@/types/lounge'",
    },
    {
      pattern: /'@\/components\/topics\/lounge-selector'/g,
      replacement: "'@/components/lounges/lounge-selector'",
    },

    // Component names
    { pattern: /LoungeSelector/g, replacement: 'LoungeSelector' },
    { pattern: /lounge-selector/g, replacement: 'lounge-selector' },

    // Type/Interface names (but not LoungeSelectorProps which becomes LoungeSelectorProps)
    { pattern: /type Lounge([^S])/g, replacement: 'type Lounge$1' },
    { pattern: /interface Lounge([^S])/g, replacement: 'interface Lounge$1' },
    { pattern: /: Lounge\[\]/g, replacement: ': Lounge[]' },
    { pattern: /: Lounge\b/g, replacement: ': Lounge' },
    { pattern: /Topic\[\]/g, replacement: 'Lounge[]' },
    { pattern: /LoungeSelectorProps/g, replacement: 'LoungeSelectorProps' },

    // API routes
    { pattern: /\/api\/topics/g, replacement: '/api/lounges' },

    // UI strings (be selective to avoid breaking things)
    { pattern: /"Lounges"/g, replacement: '"Lounges"' },
    { pattern: /'Lounges'/g, replacement: "'Lounges'" },
    { pattern: />Lounges</g, replacement: '>Lounges<' },
    { pattern: /Select lounges/g, replacement: 'Select lounges' },
    { pattern: /No lounges found/g, replacement: 'No lounges found' },
    { pattern: /Loading lounges/g, replacement: 'Loading lounges' },
    {
      pattern: /Search or create lounges/g,
      replacement: 'Search or create lounges',
    },
    {
      pattern: /select the top 50–100 creators per lounge/g,
      replacement: 'select the top 50–100 creators per lounge',
    },

    // Variable names (be very careful here)
    { pattern: /selectedLounges/g, replacement: 'selectedLounges' },
    { pattern: /onCreateLounge/g, replacement: 'onCreateLounge' },
  ];

  let filesUpdated = 0;
  let totalReplacements = 0;

  for (const file of codeFiles) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      let originalContent = content;
      let fileReplacements = 0;

      for (const { pattern, replacement } of replacements) {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, replacement);
          fileReplacements += matches.length;
        }
      }

      if (content !== originalContent) {
        fs.writeFileSync(file, content);
        filesUpdated++;
        totalReplacements += fileReplacements;
        log(
          `✓ Updated ${path.relative(rootDir, file)} (${fileReplacements} changes)`,
          colors.green
        );
        changesMade = true;
      }
    } catch (error) {
      log(
        `⚠️  Error processing ${path.relative(rootDir, file)}: ${error}`,
        colors.red
      );
    }
  }

  log(
    `\n✓ Updated ${filesUpdated} files with ${totalReplacements} total changes`,
    colors.green
  );

  // Step 4: Summary
  log('\n📊 Summary', colors.bright);

  if (changesMade) {
    log('✅ Code changes completed successfully!', colors.green);

    log('\n📝 What this script did:', colors.yellow);
    log('  • Renamed topic directories to lounge directories', colors.blue);
    log('  • Renamed lounge-selector.tsx to lounge-selector.tsx', colors.blue);
    log('  • Updated all import statements', colors.blue);
    log('  • Changed LoungeSelector to LoungeSelector', colors.blue);
    log('  • Updated UI text from "Lounges" to "Lounges"', colors.blue);

    log('\n❗ What you still need to do:', colors.yellow);
    log('  1. Review the changes: git diff', colors.blue);
    log('  2. Test that the app still works: npm run dev', colors.blue);
    log('  3. Use Supabase MCP to rename database tables:', colors.blue);
    log('     • topics → lounges', colors.blue);
    log('     • creator_topics → creator_lounges', colors.blue);
    log('     • user_topics → user_lounges', colors.blue);
    log(
      '  4. Update database queries in the code to use new table names',
      colors.blue
    );
    log('  5. Commit the changes when ready', colors.blue);
  } else {
    log(
      '⚠️  No changes were needed - topics may have already been renamed',
      colors.yellow
    );
  }

  log('\n✨ Done!', colors.bright + colors.green);
}

// Run the script
main().catch((error) => {
  log('\n❌ Script failed:', colors.red);
  console.error(error);
  process.exit(1);
});
