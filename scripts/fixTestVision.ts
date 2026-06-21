/**
 * Script to add vision field to test GameState objects.
 * Adds a fully-explored vision grid to all test files that need it.
 */
const fs = require('fs');
const path = require('path');

const testDir = '/home/z/my-project/repo/src/__tests__';

const files = [
  'blockoutDamage.test.ts',
  'blockoutMovement.test.ts',
  'blockoutObstacles.test.ts',
  'blockoutScenario.test.ts',
  'blockoutSelectionAim.test.ts',
  'blockoutVehicleState.test.ts',
  'blockoutWeaponVfx.test.ts',
  'buildSiteSelection.test.ts',
  'builder.test.ts',
  'construction.test.ts',
  'mapValidation.test.ts',
  'occupancy.test.ts',
  'pathfinding.test.ts',
  'production.test.ts',
  'separatorProcessing.test.ts',
  'statusHelpers.test.ts',
];

let fixCount = 0;

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find the map dimensions - look for mapWidth and mapHeight in the test state
  // Default to 48x48 if not found
  let width = 48;
  let height = 48;
  
  // Check if file already has vision import
  if (content.includes('createInitialVisionState') || content.includes('vision:')) {
    console.log(`SKIP: ${file} already has vision`);
    continue;
  }
  
  // Add import for createInitialVisionState
  // Find the last import line and add after it
  const importLine = "import { createInitialVisionState } from '../state/visibility';";
  
  // Find where to insert the import - after the last import line
  const lines = content.split('\n');
  let lastImportIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) lastImportIdx = i;
  }
  lines.splice(lastImportIdx + 1, 0, importLine);
  
  // Now find the production field in GameState and add vision after it
  // Pattern: production: { ... },
  content = lines.join('\n');
  
  // Find "production:" and add vision after the closing of that field
  // Strategy: find the line with "production:" and add vision field after the production object ends
  // Simpler: add vision field right before the closing of the GameState object
  
  // For tests that use `as GameState` or typed objects, we need to add vision before the closing
  // Find patterns like:
  //   production: { factories: [] },
  // and add vision after them
  
  // Add vision field after production field
  // This regex finds the production field line and adds vision after it
  const visionField = `    vision: createInitialVisionState(${width}, ${height}),`;
  
  // Replace production line + add vision line
  // Look for production: followed by closing of that field
  content = content.replace(
    /(production:\s*\{[^}]*\},?\n)/g,
    `$1${visionField}\n`
  );
  
  // Also handle production: { factories: [] } on one line within larger objects
  if (!content.includes('vision:')) {
    // Try another pattern - production field followed by closing brace
    content = content.replace(
      /(production:\s*\{[^}]*\}\s*,?\s*\n)/g,
      `$1${visionField}\n`
    );
  }
  
  if (content.includes('vision:')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED: ${file}`);
    fixCount++;
  } else {
    console.log(`MANUAL: ${file} - could not auto-fix`);
  }
}

console.log(`\nFixed ${fixCount} of ${files.length} files`);
