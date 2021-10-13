const { TREASURY_ADDRESS, PLATFORM_FEE } = require('../migrations/constants');
const ProxyAdmin = artifacts.require('ProxyAdmin');
const Marketplace = artifacts.require('FantomMarketplace');
const AdminUpgradeabilityProxyFactory = artifacts.require('AdminUpgradeabilityProxy');

module.exports = async function (deployer, network, accounts) {
  // First deploy the ProxyAdmin
  await deployer.deploy(ProxyAdmin, {overwrite: false});
  const proxyAdminContract = await ProxyAdmin.deployed();

  console.log('ProxyAdmin deployed to: ', proxyAdminContract.address);

  // Deploy the fantom marketplace contract
  await deployer.deploy(Marketplace);
  const MarketplaceContract = await Marketplace.deployed();

  console.log('FantomMarketplace deployed to:', MarketplaceContract.address);

  // Deploy the adminProxy contract and pass the contract addresses above
  await deployer.deploy(
    AdminUpgradeabilityProxyFactory,
    MarketplaceContract.address,
    proxyAdminContract.address,
    []
  );

  const MarketplaceProxyContract = await AdminUpgradeabilityProxyFactory.deployed();
  console.log('Marketplace Proxy deployed to: ', MarketplaceProxyContract.address);
  
  // Get a new contract for marketplace so that it has all correct ABI
  // but point it to the proxy so that it proxies the queries
  const MarketplaceProxyContractWithAbi = await Marketplace.at(MarketplaceProxyContract.address);
  
  // Init marketPlace contract with treasury address and platform fee
  await MarketplaceProxyContractWithAbi.initialize(TREASURY_ADDRESS, PLATFORM_FEE);
  console.log('Marketplace Proxy initialized');
}