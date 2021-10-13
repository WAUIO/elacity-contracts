const {TREASURY_ADDRESS} = require('../migrations/constants');
const FNFT = artifacts.require("Artion");

module.exports = async function (deployer, network, account) {
  console.log('Treasury_address : ', TREASURY_ADDRESS);
  await deployer.deploy(FNFT, TREASURY_ADDRESS, '2000000000000000000');

  const contract = await FNFT.deployed();

  console.log('FantomArtion deployed at', contract.address);
}