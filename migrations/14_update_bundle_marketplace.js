const { loadConfig } = require('../utils/configs');
const configs = loadConfig();

const AdminProxy = artifacts.require('ProxyAdmin');
const BundleMarketplace = artifacts.require('FantomBundleMarketplace');

module.exports = async function (deployer) {
  // Use this instead of PROXY_ADRESS_MAINNET to avoid hardcoded addresses
  const PROXY_ADMIN_ADDRESS = configs.PROXY_ADDRESS_MAINNET;
  console.log('PROXY_ADMIN_ADRESS at: ', PROXY_ADMIN_ADDRESS);

  // Deploy implementation of bundleMarketplace
  await deployer.deploy(BundleMarketplace);
  const BundleMarketplaceContract = await BundleMarketplace.deployed();
  console.log('FantomBundleMarketplace deployed to:', BundleMarketplaceContract.address);

  // Upgrade proxy to new implementation
  const AdminProxyImpl = await AdminProxy.at(PROXY_ADMIN_ADDRESS);
  // const BundleMarketplaceProxyImpl = await AdminUpgradeabilityProxyFactory.at(configs.BUNDLE_MARKETPLACE);
  await AdminProxyImpl.upgrade(configs.BUNDLE_MARKETPLACE, BundleMarketplaceContract.address);
  console.log('Marketplace proxy upgraded to new address');

  await BundleMarketplaceContract.initialize(configs.TREASURY_ADDRESS, configs.PLATFORM_FEE);
  console.log('Bundle Marketplace Proxy initialized');  
}

