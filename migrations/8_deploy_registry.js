const {loadConfig, saveConfig} = require('../utils/configs');
const configs = loadConfig();

const Registry = artifacts.require('FantomTokenRegistry');

module.exports = async function(deployer) {
  await deployer.deploy(Registry);
  const RegistryImpl = await Registry.deployed();

  console.log('FantomTokenRegistry deployed to', RegistryImpl.address);
  configs.FANTOM_TOKEN_REGISTRY = RegistryImpl.address;

  // Persist configs
  saveConfig(configs);
}