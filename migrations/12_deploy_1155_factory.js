const { loadConfig, saveConfig } = require('../utils/configs');
const configs = loadConfig();

const Factory = artifacts.require('FantomArtFactory');
const PrivateFactory = artifacts.require('FantomArtFactoryPrivate');

module.exports = async function (deployer) {
  await deployer.deploy(
    Factory,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '20000000000000000',
    configs.TREASURY_ADDRESS,
    '10000000000000000'
  );
  const FactoryImpl = await Factory.deployed();
  console.log('FantomArtFactory deployed to:', FactoryImpl.address);
  configs.FANTOMART_FACTORY = FactoryImpl.address;

  await deployer.deploy(
    PrivateFactory,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '20000000000000000',
    configs.TREASURY_ADDRESS,
    '10000000000000000'
  );
  const FactoryPrivateImpl = await PrivateFactory.deployed();
  console.log('FantomArtFactory deployed to:', FactoryPrivateImpl.address);
  configs.FANTOMART_FACTORY_PRIVATE = FactoryPrivateImpl.address;

  // Persist configs
  saveConfig(configs);
};