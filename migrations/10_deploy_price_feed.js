const {loadConfig, saveConfig} = require('../utils/configs');
const configs = loadConfig();

const PriceFeed = artifacts.require('FantomPriceFeed');

module.exports = async function(deployer) {
  await deployer.deploy(
    PriceFeed,
    configs.FANTOM_ADDRESS_REGISTRY,
    configs.MAIN_CURRENCY_ADDRESS
  );
  const PriceFeedImpl = await PriceFeed.deployed();
  console.log('FantomPriceFeed deployed to', PriceFeedImpl.address);

  configs.FANTOM_PRICE_FEED = PriceFeedImpl.address;

  // Persist configs
  saveConfig(configs);
}