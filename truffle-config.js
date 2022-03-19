/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * trufflesuite.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require('@truffle/hdwallet-provider');
const PrivateKeyProvider = require("truffle-privatekey-provider");
//
const fs = require('fs');
const path = require('path');
const secret = fs.readFileSync(".secret").toString().trim();
require('dotenv').config({ path: path.resolve('.env') });

module.exports = {
  plugins: [
    'truffle-source-verify'
  ],
  api_keys: {
    etherscan: process.env.ETHSCAN_API_KEY,
    escscan: process.env.ESCSCAN_API_KEY
  },

  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
      from: '0xaB5028bDBB0826AD6F1885478E421dB677b0001A',
    },
    ganache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: 5777,
    },
    // before using this networ, run `npx truffle develop --log`
    develop: {
      host: "127.0.0.1",
      port: 9545,
      network_id: 5777,
    },
    ropsten: {
      provider: () => {
        if (secret.match(/^0x/ig)) {
          return new PrivateKeyProvider(secret, "https://ropsten.infura.io/v3/26f4a46701dd4819a4e2cda821dc8996");
        }
        return new HDWalletProvider(secret, `wss://ropsten.infura.io/ws/v3/26f4a46701dd4819a4e2cda821dc8996`)
      },
      network_id: 3,       // Ropsten's id
      gas: 6700000,        // Ropsten has a lower block limit than mainnet
      gasPrice: 100 * 1000000000, // 100 Gwei
      confirmations: 0,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 60,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true,     // Skip dry run before migrations? (default: false for public nets )
      networkCheckTimeout: 100000, // Avoid ESOCKETTIMEDOUT error for slow networks. COmment if you have quick network
      websockets: true
    },

    elastos: {
      provider: () => {
        if (secret.match(/^0x/ig)) {
          return new PrivateKeyProvider(secret, "https://api.elastos.io/eth");
        }

        return new HDWalletProvider({
          mnemonic: {
            phrase: secret
          },
          providerOrUrl: 'https://api.elastos.io/eth',
        })
      },
      network_id: 20,       // Ropsten's id
      gas: 6700000,        // Ropsten has a lower block limit than mainnet
      gasPrice: 100 * 1000000000, // 100 Gwei
      confirmations: 0,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 60,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true,     // Skip dry run before migrations? (default: false for public nets )
      networkCheckTimeout: 100000, // Avoid ESOCKETTIMEDOUT error for slow networks. COmment if you have quick network
      websockets: true
    },

    // Useful for private networks
    // private: {
    // provider: () => new HDWalletProvider(mnemonic, `https://network.io`),
    // network_id: 2111,   // This network is yours, in the cloud.
    // production: true    // Treats this network as if it was a public net. (default: false)
    // }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
    debug: false,
    fullTrace: true,
    file: "./test/**/*.test.js"
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.12",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        // evmVersion: "byzantium"
      }
    }
  },

  // Truffle DB is currently disabled by default; to enable it, change enabled:
  // false to enabled: true. The default storage location can also be
  // overridden by specifying the adapter settings, as shown in the commented code below.
  //
  // NOTE: It is not possible to migrate your contracts to truffle DB and you should
  // make a backup of your artifacts to a safe location before enabling this feature.
  //
  // After you backed up your artifacts you can utilize db by running migrate as follows: 
  // $ truffle migrate --reset --compile-all
  //
  // db: {
  // enabled: false,
  // host: "127.0.0.1",
  // adapter: {
  //   name: "sqlite",
  //   settings: {
  //     directory: ".db"
  //   }
  // }
  // }
};
