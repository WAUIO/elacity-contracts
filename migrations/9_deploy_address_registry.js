const {loadConfig, saveConfig} = require('../utils/configs');
const configs = loadConfig();

const Registry = artifacts.require('FantomAddressRegistry');

module.exports = async function(deployer) {
  await deployer.deploy(Registry);
  const RegistryImpl = await Registry.deployed();

  console.log('FantomAddressRegistry deployed to', RegistryImpl.address);
  configs.FANTOM_ADDRESS_REGISTRY = RegistryImpl.address;

  // Persist configs
  saveConfig(configs);
}