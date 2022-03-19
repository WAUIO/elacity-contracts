const { loadConfig, saveConfig } = require('../utils/configs');
const configs = loadConfig();

const Auction = artifacts.require('FantomAuction');
const AdminUpgradeabilityProxy = artifacts.require('AdminUpgradeabilityProxy');

module.exports = async function (deployer) {
  // Get the proxyAdmin
  const PROXY_ADMIN_ADDRESS = configs.PROXY_ADDRESS_MAINNET;

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
  configs.AUCTION = auctionProxyImpl.address;

  // Initialize the auction contract with Auction ABI but pointed at the proxy address
  // so that the proxy address forwards the calls
  // if we don't use the auction ABI, `initialize` is not available on the object
  const prroxiedAuctionImpl = await Auction.at(auctionProxyImpl.address);
  prroxiedAuctionImpl.initialize(configs.TREASURY_ADDRESS, '20');
  console.log('Auction Proxy initialized');

  // Persist configs
  saveConfig(configs);
}