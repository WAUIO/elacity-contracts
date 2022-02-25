// file: ./verify.js
// Usage: npx truffle exec ./verify.js --network ropsten

const arg = require('arg');
const { verify } = require('truffle-source-verify/lib');

const args = arg({
  '--debug': arg.flag(() => true),
  '--network': String,
  '--license': String,
  '--forceConstructorArgs': String,
}, {
  // remove [exec, ./verify.js] from argv
  argv: process.argv.slice(4),
});

async function main() {
  const contractName = args['_'][0];
  if (!contractName) {
    return Promise.reject(new Error('contract/address argument missing'))
  }
  const network = args['--network'] || 'elastos';
  const license = args['--license'] || 'UNLICENSED';
  const options = { license };
  if (args['--forceConstructorArgs']) {
    options.forceConstructorArgs = args['--forceConstructorArgs']
  }
  if (args['--debug']) {
    options.debug = true
  }

  await verify([contractName], network, options);
}

module.exports = (cb) => main().then(cb).catch(cb);