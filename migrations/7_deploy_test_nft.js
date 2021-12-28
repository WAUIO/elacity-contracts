const { loadConfig, saveConfig } = require('../utils/configs');
const configs = loadConfig();

const NFTTradable = artifacts.require('FantomNFTTradable');
const NFTTradablePrivate = artifacts.require('FantomNFTTradablePrivate');

module.exports = async function (deployer) {
  await deployer.deploy(
    NFTTradable,
    'Artion',
    'ELAC',
    configs.AUCTION,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '200000000000000000',
    configs.TREASURY_ADDRESS
  );
  const NFTTradableImpl = await NFTTradable.deployed();
  console.log('FantomNFTTradable deployed to:', NFTTradableImpl.address);
  configs.NFT_TRADABLE = NFTTradableImpl.address;

  await deployer.deploy(
    NFTTradablePrivate,
    'IArtion',
    'IART',
    configs.AUCTION,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE,
    '200000000000000000',
    configs.TREASURY_ADDRESS
  );
  const NFTTradablePrivateImpl = await NFTTradablePrivate.deployed();
  console.log('FantomNFTTradablePrivate deployed to:', NFTTradablePrivateImpl.address);
  configs.NFT_TRADABLE_PRIVATE = NFTTradablePrivateImpl.address;

  // Persist config
  saveConfig(configs);
}