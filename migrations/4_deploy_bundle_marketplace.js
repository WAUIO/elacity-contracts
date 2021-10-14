const {
  TREASURY_ADDRESS, 
  PLATFORM_FEE,
  PROXY_ADDRESS_TESTNET,
  PROXY_ADDRESS_MAINNET // ProxyAdmin
} = require('../migrations/constants');

const ProxyAdmin = artifacts.require('ProxyAdmin');
const BundleMarketplace = artifacts.require('FantomBundleMarketplace');
const AdminUpgradeabilityProxyFactory = artifacts.require('AdminUpgradeabilityProxy');

module.exports = async function (deployer) {
  const ProxyAdminContract = await ProxyAdmin.deployed();
  // Use this instead of PROXY_ADRESS_MAINNET to avoid hardcoded addresses
  // Testing only, not sure it works in production
  const PROXY_ADMIN_ADDRESS = ProxyAdminContract.address;
  console.log('PROXY_ADMIN_ADRESS at: ', PROXY_ADMIN_ADDRESS);

  // Deploy implementation of bundleMarketplace
  await deployer.deploy(BundleMarketplace);
  const BundleMarketplaceContract = await BundleMarketplace.deployed();
  console.log('FantomBundleMarketplace deployed to:', BundleMarketplaceContract.address);

  // Deploy proxy for bundleMarketplace
  await deployer.deploy(
    AdminUpgradeabilityProxyFactory,
    BundleMarketplaceContract.address, // Set the implementation
    PROXY_ADMIN_ADDRESS, // Set the proxy admin address
    []
  );
  const BundleMarketplaceProxyContract = await AdminUpgradeabilityProxyFactory.deployed();
  console.log(
    'Bundle Marketplace Proxy deployed at ',
    BundleMarketplaceProxyContract.address
  );

  // Initialize a BundleMarketplaceContract but pointed at the proxy
  // so that the proxy forward the call to the implementation
  const ProxiedMarketplaceContract = await BundleMarketplace.at(
    BundleMarketplaceProxyContract.address
  );
  await ProxiedMarketplaceContract.initialize(TREASURY_ADDRESS, PLATFORM_FEE);
  console.log('Bundle Marketplace Proxy initialized');
}

