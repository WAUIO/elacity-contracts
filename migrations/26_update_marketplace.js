const { loadConfig } = require('../utils/configs');
const configs = loadConfig();
const ProxyAdmin = artifacts.require('ProxyAdmin');
const Marketplace = artifacts.require('FantomMarketplace');

module.exports = async function (deployer, network, accounts) {
  // Deploy the new version of fantom marketplace contract
  await deployer.deploy(Marketplace);
  const MarketplaceImpl = await Marketplace.deployed();
  console.log('FantomMarketplace deployed to:', MarketplaceImpl.address);

  // Upgrade proxy
  const ProxyAdminImpl = await ProxyAdmin.at(configs.PROXY_ADDRESS_MAINNET);
  await ProxyAdminImpl.upgrade(configs.MARKETPLACE, MarketplaceImpl.address);
  console.log('Marketplace Proxy upgraded to new address');

  await MarketplaceImpl.initialize(configs.TREASURY_ADDRESS, '20');
  console.log('Marketplace Proxy initialized');
}