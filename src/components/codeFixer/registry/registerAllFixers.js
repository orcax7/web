/**
 * @fileoverview Central registration point for all ESLint fixers
 * Import and register all available fixers here
 */

import { fixerRegistry } from './fixerRegistry.js';

// Import all fixer classes
import { CommaDangleFixer } from '../commaDangle.js';
import { IndentFixer } from '../indent.js';
import { NoVarFixer } from '../noVar.js';
import { PreferConstFixer } from '../preferConst.js';
import { NoConsoleFixer } from '../noConsole.js';
import { CurlyFixer } from '../curly.js';
import { BraceStyleFixer } from '../braceStyle.js';
import { SpaceBeforeBlocksFixer } from '../spaceBeforeBlocks.js';
import { NoPlusPlusFixer } from '../noPlusplus.js';
import { PreferTemplateFixer } from '../preferTemplate.js';
import { PreferForOfFixer } from '../preferForOf.js';
import { NoTernaryFixer } from '../noTernary.js';

/**
 * Register all available fixers with the registry
 * This function should be called once during application initialization
 */
export function registerAllFixers() {
  try {
    console.log('Starting fixer registration...');
    
    // Register all fixers
    fixerRegistry.register(new CommaDangleFixer());
    fixerRegistry.register(new IndentFixer());
    fixerRegistry.register(new NoVarFixer());
    fixerRegistry.register(new PreferConstFixer());
    fixerRegistry.register(new NoConsoleFixer());
    fixerRegistry.register(new CurlyFixer());
    fixerRegistry.register(new BraceStyleFixer());
    fixerRegistry.register(new SpaceBeforeBlocksFixer());
    fixerRegistry.register(new NoPlusPlusFixer());
    fixerRegistry.register(new PreferTemplateFixer());
    fixerRegistry.register(new PreferForOfFixer());
    fixerRegistry.register(new NoTernaryFixer());

    // Log all registered fixers
    const registeredRules = fixerRegistry.getFixableRules();
    console.log('All fixers registered successfully. Total:', registeredRules.length);
    console.log('Registered rules:', registeredRules.join(', '));
    
    return true;
  } catch (error) {
    console.error('Error registering fixers:', error);
    return false;
  }
}

/**
 * Get list of all registered fixer rule IDs
 * @returns {string[]} Array of rule IDs
 */
export function getRegisteredFixerRuleIds() {
  return [
    'comma-dangle',
    'indent',
    'no-var',
    'prefer-const',
    'no-console',
    'curly',
    'brace-style',
    'space-before-blocks',
    'no-plusplus',
    'prefer-template',
    'prefer-for-of',
    'no-ternary'
  ];
}

export default registerAllFixers;
