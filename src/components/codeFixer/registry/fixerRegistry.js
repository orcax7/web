/**
 * @fileoverview Fixer registry system for auto-discovery and management of ESLint fixers
 * Provides centralized registration and retrieval of all available fixers
 */

import FixerBase from '../shared/fixerBase.js';

/**
 * @typedef {Object} FixerInfo
 * @property {string} ruleId - The ESLint rule identifier
 * @property {'simple'|'complex'} complexity - Complexity level of the fixer
 * @property {string} modulePath - Path to the fixer module
 * @property {boolean} enabled - Whether the fixer is enabled
 */

/**
 * Registry for managing ESLint fixers
 * Provides auto-discovery, registration, and retrieval of fixers
 */
class FixerRegistry {
  constructor() {
    /** @type {Map<string, FixerBase>} */
    this.fixers = new Map();
    
    /** @type {Map<string, FixerInfo>} */
    this.fixerInfo = new Map();
    
    /** @type {boolean} */
    this.initialized = false;
    
    /** @type {string[]} */
    this.discoveryPaths = [
      '../simple/',
      '../complex/',
      '../existing/'
    ];
  }

  /**
   * Register a fixer instance
   * @param {FixerBase} fixer - The fixer instance to register
   * @throws {Error} If fixer is invalid or already registered
   */
  register(fixer) {
    if (!(fixer instanceof FixerBase)) {
      throw new Error('Fixer must extend FixerBase class');
    }

    if (!fixer.ruleId) {
      throw new Error('Fixer must have a ruleId property');
    }

    if (this.fixers.has(fixer.ruleId)) {
      console.log(`Fixer for rule '${fixer.ruleId}' is already registered, skipping`);
      return;
    }

    this.fixers.set(fixer.ruleId, fixer);
    this.fixerInfo.set(fixer.ruleId, {
      ruleId: fixer.ruleId,
      complexity: fixer.complexity || 'simple',
      modulePath: fixer.constructor.name,
      enabled: true
    });

    console.log(`Registered fixer for rule: ${fixer.ruleId}`);
  }

  /**
   * Get a fixer for the specified rule
   * @param {string} ruleId - The ESLint rule identifier
   * @returns {FixerBase|null} The fixer instance or null if not found
   */
  getFixer(ruleId) {
    const fixer = this.fixers.get(ruleId);
    
    if (!fixer) {
      return null;
    }

    const info = this.fixerInfo.get(ruleId);
    if (info && !info.enabled) {
      return null;
    }

    return fixer;
  }

  /**
   * Get all fixable rule IDs
   * @returns {string[]} Array of rule IDs that have registered fixers
   */
  getFixableRules() {
    return Array.from(this.fixers.keys()).filter(ruleId => {
      const info = this.fixerInfo.get(ruleId);
      return info && info.enabled;
    });
  }

  /**
   * Check if a rule is fixable
   * @param {string} ruleId - The ESLint rule identifier
   * @returns {boolean} True if the rule has a registered and enabled fixer
   */
  isFixable(ruleId) {
    const fixer = this.fixers.get(ruleId);
    if (!fixer) {
      return false;
    }

    const info = this.fixerInfo.get(ruleId);
    return info && info.enabled;
  }

  /**
   * Enable or disable a fixer
   * @param {string} ruleId - The ESLint rule identifier
   * @param {boolean} enabled - Whether to enable the fixer
   * @returns {boolean} True if the fixer was found and updated
   */
  setFixerEnabled(ruleId, enabled) {
    const info = this.fixerInfo.get(ruleId);
    if (!info) {
      return false;
    }

    info.enabled = enabled;
    console.log(`${enabled ? 'Enabled' : 'Disabled'} fixer for rule: ${ruleId}`);
    return true;
  }

  /**
   * Get information about all registered fixers
   * @returns {FixerInfo[]} Array of fixer information objects
   */
  getFixerInfo() {
    return Array.from(this.fixerInfo.values());
  }

  /**
   * Get statistics about registered fixers
   * @returns {Object} Statistics object
   */
  getStats() {
    const total = this.fixers.size;
    const enabled = Array.from(this.fixerInfo.values()).filter(info => info.enabled).length;
    const complexityStats = Array.from(this.fixerInfo.values()).reduce((stats, info) => {
      stats[info.complexity] = (stats[info.complexity] || 0) + 1;
      return stats;
    }, {});

    return {
      total,
      enabled,
      disabled: total - enabled,
      complexity: complexityStats
    };
  }

  /**
   * Auto-discover and register fixers from known directories
   * This method would be enhanced in a real implementation to dynamically import modules
   * For now, it provides the structure for manual registration
   */
  async autoDiscoverFixers() {
    if (this.initialized) {
      console.log('Fixer registry already initialized');
      return;
    }

    console.log('Starting fixer auto-discovery...');

    try {
      // In a real implementation, this would dynamically import all fixer modules
      // For now, we'll register the existing fixers manually
      await this.registerExistingFixers();
      
      this.initialized = true;
      console.log(`Fixer discovery complete. Registered ${this.fixers.size} fixers.`);
    } catch (error) {
      console.error('Error during fixer discovery:', error);
      throw error;
    }
  }

  /**
   * Register existing fixers that are already in the codebase
   * This is a placeholder for the actual implementation
   * @private
   */
  async registerExistingFixers() {
    // This would be replaced with dynamic imports in a real implementation
    // For now, we'll create placeholder registrations for known rules
    
    const knownRules = [
      'quotes',
      'semi',
      'no-unused-vars',
      'eol-last',
      'eqeqeq',
      'no-extra-semi',
      'no-trailing-spaces'
    ];

    // Create placeholder fixer info for existing rules
    knownRules.forEach(ruleId => {
      this.fixerInfo.set(ruleId, {
        ruleId,
        complexity: 'simple',
        modulePath: `../existing/${ruleId}.js`,
        enabled: true
      });
    });

    console.log(`Registered ${knownRules.length} existing fixers`);
  }

  /**
   * Manually register a fixer by rule ID and constructor
   * Useful for testing and explicit registration
   * @param {string} ruleId - The ESLint rule identifier
   * @param {Function} FixerClass - The fixer class constructor
   * @param {Object} [options] - Additional options
   */
  registerFixer(ruleId, FixerClass, options = {}) {
    try {
      const fixer = new FixerClass(ruleId, options.complexity);
      this.register(fixer);
    } catch (error) {
      console.error(`Failed to register fixer for rule '${ruleId}':`, error);
      throw error;
    }
  }

  /**
   * Unregister a fixer
   * @param {string} ruleId - The ESLint rule identifier
   * @returns {boolean} True if the fixer was found and removed
   */
  unregister(ruleId) {
    const removed = this.fixers.delete(ruleId);
    this.fixerInfo.delete(ruleId);
    
    if (removed) {
      console.log(`Unregistered fixer for rule: ${ruleId}`);
    }
    
    return removed;
  }

  /**
   * Clear all registered fixers
   */
  clear() {
    this.fixers.clear();
    this.fixerInfo.clear();
    this.initialized = false;
    console.log('Cleared all registered fixers');
  }

  /**
   * Validate all registered fixers
   * @returns {Object} Validation results
   */
  validateFixers() {
    const results = {
      valid: [],
      invalid: []
    };

    for (const [ruleId, fixer] of this.fixers) {
      try {
        // Basic validation checks
        if (typeof fixer.canFix !== 'function') {
          throw new Error('Missing canFix method');
        }
        
        if (typeof fixer.fix !== 'function') {
          throw new Error('Missing fix method');
        }
        
        if (typeof fixer.validate !== 'function') {
          throw new Error('Missing validate method');
        }

        results.valid.push(ruleId);
      } catch (error) {
        results.invalid.push({
          ruleId,
          error: error.message
        });
      }
    }

    return results;
  }
}

// Create and export a singleton instance
const fixerRegistry = new FixerRegistry();

export default fixerRegistry;
export { FixerRegistry, fixerRegistry };