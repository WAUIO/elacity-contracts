const { loadConfig, saveConfig } = require('../utils/configs');
const configs = loadConfig();

const ArtTradable = artifacts.require('FantomArtTradable');
const ArtTradablePrivate = artifacts.require('FantomArtTradablePrivate');

module.exports = async function (deployer) {
  await deployer.deploy(
    ArtTradable,
    'FantomArt',
    'FART',
    '20000000000000000',
    configs.TREASURY_ADDRESS,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE
  );
  const ArtTradableImpl = await ArtTradable.deployed();
  console.log('FantomArtTradable deployed to:', ArtTradableImpl.address);
  configs.ART_TRADABLE = ArtTradableImpl.address;

  await deployer.deploy(
    ArtTradablePrivate,
    'FantomArt',
    'FART',
    '20000000000000000',
    configs.TREASURY_ADDRESS,
    configs.MARKETPLACE,
    configs.BUNDLE_MARKETPLACE
  );
  const ArtTradablePrivateImpl = await ArtTradablePrivate.deployed();
  console.log('FantomArtTradablePrivate deployed to:', ArtTradablePrivateImpl.address);
  configs.ART_TRADABLE_PRIVATE = ArtTradablePrivateImpl.address;

  // Persist configs
  saveConfig(configs);
}