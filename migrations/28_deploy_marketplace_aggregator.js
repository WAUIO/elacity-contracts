const { loadConfig, saveConfig } = require('../utils/configs');
const configs = loadConfig();

const MarketplaceAggregator = artifacts.require('ElacityMarketplaceAggregator');
const AddressRegistry = artifacts.require('FantomAddressRegistry');
const AdminUpgradeabilityProxy = artifacts.require('AdminUpgradeabilityProxy');
const FantomMarketplace = artifacts.require('FantomMarketplace');
const FantomBundleMarketplace = artifacts.require('FantomBundleMarketplace');
const FantomAuction = artifacts.require('FantomAuction');

module.exports = async function (deployer) {
  // Deploy the implementation first
  await deployer.deploy(MarketplaceAggregator);
  const MarketplaceAggregatorImpl = await MarketplaceAggregator.deployed();
  console.log('MarketplaceAggregator deployed to:', MarketplaceAggregatorImpl.address);

  // Deploy the marketplace aggregator proxy
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    MarketplaceAggregatorImpl.address, // Point it to the marketplace aggregator implementation
    configs.PROXY_ADDRESS_MAINNET, // Set the proxy admin address
    []
  );
  const marketplaceAggregatorProxyImpl = await AdminUpgradeabilityProxy.deployed();
  console.log('MarketplaceAggregator Proxy deployed at ', marketplaceAggregatorProxyImpl.address);
  configs.MARKETPLACE_AGGREGATOR = marketplaceAggregatorProxyImpl.address;

  // Initialize
  const prroxiedMarketplaceAggregatorImpl = await MarketplaceAggregator.at(marketplaceAggregatorProxyImpl.address);
  prroxiedMarketplaceAggregatorImpl.initialize(configs.FANTOM_ADDRESS_REGISTRY);
  console.log('Marketplace Aggregator Proxy initialized');

  // update marketplace contract by adding aggregator address
  const mk = await FantomMarketplace.at(configs.MARKETPLACE);
  const au = await FantomAuction.at(configs.AUCTION);
  const bu = await FantomBundleMarketplace.at(configs.BUNDLE_MARKETPLACE);

  await mk.acknowledgeAggregator(marketplaceAggregatorProxyImpl.address);
  await au.acknowledgeAggregator(marketplaceAggregatorProxyImpl.address);
  await bu.acknowledgeAggregator(marketplaceAggregatorProxyImpl.address);

  // Persist configs
  saveConfig(configs);
}