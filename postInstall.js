/**
 * Script is ran right after install
 */

const { loadConfig } = require('./utils/configs');
// Create config if not exists yet by passing populate value to `TRUE`
loadConfig(true);
