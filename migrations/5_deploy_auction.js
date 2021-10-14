const { TREASURY_ADDRESS } = require('../migrations/constants');

const Auction = artifacts.require('FantomAuction');
const AdminUpgradeabilityProxy = artifacts.require('AdminUpgradeabilityProxy');
const ProxyAdmin = artifacts.require('ProxyAdmin');

module.exports = async function (deployer) {
  // Get the proxyAdmin
  const ProxyAdminImpl = await ProxyAdmin.deployed();
  const PROXY_ADMIN_ADDRESS = ProxyAdminImpl.address;

  // Deploy the implementation first
  await deployer.deploy(Auction);
  const AuctionImpl = await Auction.deployed();
  console.log('FantomAuction deployed to:', AuctionImpl.address);

  // Deploy the auction proxy
  await deployer.deploy(
    AdminUpgradeabilityProxy,
    AuctionImpl.address, // Point it to the auction implementation
    PROXY_ADMIN_ADDRESS, // Set the proxy admin address
    []
  );
  const auctionProxyImpl = await AdminUpgradeabilityProxy.deployed();
  console.log('Auction Proxy deployed at ', auctionProxyImpl.address);

  // Initialize the auction contract with Auction ABI but pointed at the proxy address
  // so that the proxy address forwards the calls
  // if we don't use the auction ABI, `initialize` is not available on the object
  const prroxiedAuctionImpl = await Auction.at(auctionProxyImpl.address);
  prroxiedAuctionImpl.initialize(TREASURY_ADDRESS);
  console.log('Auction Proxy initialized');
}