const {
  constants,
  BN,
} = require('@openzeppelin/test-helpers');

const PayToken = artifacts.require('MockERC20');
const FantomTokenRegistry = artifacts.require('FantomTokenRegistry');
const FantomAddressRegistry = artifacts.require('FantomAddressRegistry');
const PriceFeed = artifacts.require('FantomPriceFeed');

const FantomNFT = artifacts.require('MockERC721');
const FantomMarketplace = artifacts.require('FantomMarketplace');
const FantomAuction = artifacts.require('FantomAuction');
const FantomBundleMarketplace = artifacts.require('FantomBundleMarketplace');

const FantomArtFactory = artifacts.require('FantomArtFactory');
const FantomArtFactoryPrivate = artifacts.require('FantomArtFactoryPrivate');
const FantomNFTFactory = artifacts.require('FantomNFTFactory');
const FantomNFTFactoryPrivate = artifacts.require('FantomNFTFactoryPrivate');


async function prepareTokenBy({ owner, buyer, feeRecipient }, tokenSupply, pricePerItem) {
  this.payToken = await PayToken.new(
    'Wrapped Token',
    'wTK',
    tokenSupply
  );

  // this one will not be registered in token registry to ensure it;s invalid
  this.invalidPayToken = await PayToken.new(
    'Invalid Token',
    'wINV',
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

  // register factories
  this.factory721Pub = await FantomNFTFactory.deployed();
  this.factory721Priv = await FantomNFTFactoryPrivate.deployed();
  this.factory1155Pub = await FantomArtFactory.deployed();
  this.factory1155Priv = await FantomArtFactoryPrivate.deployed();
  await this.addressRegistry.updateNFTFactory(
    this.factory721Pub.address
  );
  await this.addressRegistry.updateNFTFactoryPrivate(
    this.factory721Priv.address
  );
  await this.addressRegistry.updateArtFactory(
    this.factory1155Pub.address
  );
  await this.addressRegistry.updateArtFactoryPrivate(
    this.factory1155Priv.address
  );

  // console.log('> ERC20 payToken overall test will be:', this.payToken.address)
  // console.log('--------------------------------------');
}

async function prepareContracts(owner, feeRecipient, platformFee) {
  this.nft = await FantomNFT.new(feeRecipient, platformFee, { from: owner });
  this.wrongNFT = await FantomNFT.new(feeRecipient, platformFee, { from: owner });
  this.externalNFT = await FantomNFT.new(feeRecipient, platformFee, { from: owner });

  // register the NFT contract as default one
  await this.addressRegistry.updateArtion(this.nft.address, { from: owner });
}

module.exports = {
  prepareTokenBy,
  prepareContracts,
}