const fs = require('fs');
const path = require('path');
const ROOT_PATH = path.resolve(path.join(__dirname, '../'));
const CONFIG_PATH = path.resolve(path.join(ROOT_PATH, 'generated/config.json'));
require('dotenv').config({path: path.resolve(path.join(ROOT_PATH, '.env'))});

const DEFAULT_CONFIG = {
  TREASURY_ADDRESS: process.env.TREASURY_ADDRESS || '',
  PLATFORM_FEE: process.env.PLATFORM_FEE || '0',
  MAIN_CURRENCY_ADDRESS: process.env.MAIN_CURRENCY_ADDRESS,
}

/**
 * Save this config in file
 * MUST pass full object in conf param
 * @param {object} conf // if nothing is passed, it will save default datas
 * @returns {object} Returns new config
 */
function saveConfig(conf = {}) {
  if (typeof conf !== 'object') {
    throw new Error('Config MUST be an object');
  }

  let dataToSave = {};

  if (conf && Object.keys(conf).length === 0) {
    dataToSave = Object.assign({}, DEFAULT_CONFIG);
  } else {
    dataToSave = conf;
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(dataToSave));

  return Object.assign({}, dataToSave);
}

/**
 * Load the configs
 * @param {boolean} populate // if true, will create file if not exists 
 * @returns {object} 
 */
function loadConfig (populate = false) {
  const fileExists = fs.existsSync(CONFIG_PATH);
  if (!fileExists && !populate) {
    throw new Error(`Config not found at path [${CONFIG_PATH}]`);
  }

  // Populate config if needed
  if (!fileExists && populate) {
    // WIll save default datas as no parameters is passed
    return saveConfig();
  }

  // Read file and returns the datas
  const fileDatas = fs.readFileSync(CONFIG_PATH);

  return JSON.parse(fileDatas);
}

module.exports = {
  saveConfig,
  loadConfig
}