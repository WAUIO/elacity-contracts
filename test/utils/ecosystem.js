const {
  constants,
  BN,
} = require('@openzeppelin/test-helpers');

const PayToken = artifacts.require('MockERC20');
const FantomTokenRegistry = artifacts.require('FantomTokenRegistry');
const FantomAddressRegistry = artifacts.require('FantomAddressRegistry');

const FantomNFT = artifacts.require('MockERC721');
const FantomMarketplace = artifacts.require('FantomMarketplace');
const FantomAuction = artifacts.require('FantomAuction');
const FantomBundleMarketplace = artifacts.require('FantomBundleMarketplace');
const PriceFeed = artifacts.require('FantomPriceFeed');

async function prepareTokenBy({ owner, buyer, feeRecipient }, tokenSupply, pricePerItem) {
  this.payToken = await PayToken.new(
    'Wrapped Token',
    'wTK',
    tokenSupply
  );

  this.addressRegistry = await FantomAddressRegistry.deployed();
  this.tokenRegistry = await FantomTokenRegistry.deployed();

  // add the token registry addr into address registry contract
  await this.addressRegistry.updateTokenRegistry(this.tokenRegistry.address, { from: owner });

  // register the ERC20 token into token registry contract
  await this.tokenRegistry.add(this.payToken.address, { from: owner });

  this.priceFeed = await PriceFeed.new(
    this.addressRegistry.address,
    this.payToken.address,
    { from: owner }
  );
  await this.addressRegistry.updatePriceFeed(this.priceFeed.address);

  // create marketplace contract instance, them register it
  // this.marketplace = await FantomMarketplace.deployed();
  this.marketplace = await FantomMarketplace.new();
  await this.marketplace.initialize(
    feeRecipient,
    '20',
    { from: owner }
  );

  await this.addressRegistry.updateMarketplace(this.marketplace.address, { from: owner });
  await this.marketplace.updateAddressRegistry(
    this.addressRegistry.address,
    { from: owner }
  );

  // handle auction contract
  this.auction = await FantomAuction.new();
  await this.auction.initialize(
    feeRecipient,
    '20',
    { from: owner }
  );

  await this.addressRegistry.updateAuction(this.auction.address, { from: owner });
  await this.auction.updateAddressRegistry(
    this.addressRegistry.address,
    { from: owner }
  );

  // bundle marketplace
  this.bundleMarketplace = await FantomBundleMarketplace.new();
  await this.bundleMarketplace.initialize(
    feeRecipient,
    '20',
    { from: owner }
  );

  await this.addressRegistry.updateBundleMarketplace(this.bundleMarketplace.address, { from: owner });
  await this.bundleMarketplace.updateAddressRegistry(
    this.addressRegistry.address,
    { from: owner }
  );

  // console.log('> ERC20 payToken overall test will be:', this.payToken.address)
  // console.log('--------------------------------------');
  // fill a bit the buyer wallet with the wrapped token we use
  await this.payToken.mint(
    buyer,
    new BN((pricePerItem * 1).toString()),
    { from: buyer }
  );
  await this.payToken.approve(
    this.marketplace.address,
    new BN((pricePerItem * 1).toString()),
    { from: buyer }
  );
}

async function prepareContracts(owner, feeRecipient, platformFee) {
  this.nft = await FantomNFT.new(feeRecipient, platformFee, { from: owner });

  // register the NFT contract as default one
  await this.addressRegistry.updateArtion(this.nft.address, { from: owner });
}

module.exports = {
  prepareTokenBy,
  prepareContracts,
}