const {loadConfig, saveConfig} = require('../utils/configs');
const configs = loadConfig();
const FNFT = artifacts.require("Artion");

module.exports = async function (deployer, network, account) {
  console.log('Treasury_address : ', configs.TREASURY_ADDRESS);
  await deployer.deploy(FNFT, configs.TREASURY_ADDRESS, '2000000000000000000');

  const contract = await FNFT.deployed();

  console.log('FantomArtion deployed at', contract.address);
  
  // Save it as a config
  configs.FNFT_ADRESS = contract.address;
  saveConfig(configs);
}