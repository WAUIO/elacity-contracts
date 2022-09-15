const { loadConfig } = require('../utils/configs');
const configs = loadConfig();

const AdminProxy = artifacts.require('ProxyAdmin');
const Auction = artifacts.require('FantomAuction');

module.exports = async function (deployer) {
  // Deploy the implementation first
  await deployer.deploy(Auction);
  const AuctionImpl = await Auction.deployed();
  console.log('FantomAuction deployed to:', AuctionImpl.address);

  // Upgrade proxy to new implementation
  const AdminProxyImpl = await AdminProxy.at(configs.PROXY_ADDRESS_MAINNET);
  await AdminProxyImpl.upgrade(configs.AUCTION, AuctionImpl.address);
  console.log('FantomAuction proxy upgraded to new address');

  AuctionImpl.initialize(configs.TREASURY_ADDRESS, '20');
  console.log('Auction Proxy initialized');
}