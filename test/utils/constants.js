const {
  BN,
} = require('@openzeppelin/test-helpers');

const nonExistentTokenId = new BN('99');
const platformFee = new BN('20');
const pricePerItem = new BN('1000000000000000000');
const newPrice = new BN('500000000000000000');
const tokenSupply = new BN('5000000000000000000000');
const randomTokenURI = 'ipfs://xxx';

const RECEIVER_MAGIC_VALUE = '0x150b7a02';

module.exports = {
  nonExistentTokenId,
  platformFee,
  pricePerItem,
  newPrice,
  tokenSupply,
  randomTokenURI,

  RECEIVER_MAGIC_VALUE,
}