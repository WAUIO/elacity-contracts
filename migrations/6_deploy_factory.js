const {loadConfig, saveConfig} = require('../utils/configs');
const configs = loadConfig();

const Factory = artifacts.require('FantomNFTFactory');
const PrivateFactory = artifacts.require('FantomNFTFactoryPrivate');

module.exports = async function(deployer) {
  await deployer.deploy(
    Factory,
    configs.AUCTION,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '10000000000000000000',
    configs.TREASURY_ADDRESS,
    '50000000000000000000'
  );
  const factoryImpl = await Factory.deployed();
  console.log('FantomNFTFactory deployed to:', factoryImpl.address);
  configs.NFT_FACTORY = factoryImpl.address;
  
  await deployer.deploy(
    PrivateFactory,
    configs.AUCTION,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '10000000000000000000',
    configs.TREASURY_ADDRESS,
    '50000000000000000000'
  );
  const privateFactoryImpl = await Factory.deployed();
  console.log('FantomNFTFactoryPrivate deployed to:', privateFactoryImpl.address);
  configs.PRIVATE_NFT_FACTORY = privateFactoryImpl.address;

  // Persist configs
    saveConfig(configs);
}