const { loadConfig } = require('../utils/configs');
const configs = loadConfig();
const ProxyAdmin = artifacts.require('ProxyAdmin');
const BundleMarketplace = artifacts.require('FantomBundleMarketplace');

module.exports = async function (deployer) {
  // Deploy implementation of bundleMarketplace
  await deployer.deploy(BundleMarketplace);
  const BundleMarketplaceImpl = await BundleMarketplace.deployed();
  console.log('FantomBundleMarketplace deployed to:', BundleMarketplaceImpl.address);

  // Upgrade proxy to new implementation
  const ProxyAdminImpl = await ProxyAdmin.at(configs.PROXY_ADDRESS_MAINNET);
  await ProxyAdminImpl.upgrade(configs.BUNDLE_MARKETPLACE, BundleMarketplaceImpl.address);
  console.log('BundleMarketplace proxy upgraded to new address');

  await BundleMarketplaceImpl.initialize(configs.TREASURY_ADDRESS, '20');
  console.log('BundleMarketplace Proxy initialized');
}

