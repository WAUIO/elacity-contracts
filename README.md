<h3 align="center">
  A tool for creating a local blockchain for fast Ethereum development.
</h3>

#### Getting started

Make sure to use nodejs version 14.16.1 first. 
Then install dependencies : 

```console
npm install
```

Install global tools used for development. We use Truffle and ganache for development.

```console
npm install -g ganache-cli truffle
```

Then start ganache in your project root. If it is the first time, you run ganache for this project, start it like : 

```console
ganache-cli -a 10 -e 1000 --db ./ganache-db --allowUnlimitedContractSize  --gasLimit 0xFFFFFFFFFFFF --networkId 123456
```

You will then see the running cli on your console. Take note of the mnemonic (the list of words)

Then, stop ganache with `Ctrl+C` and you can run it again with below command to retain your addresses. Setting the `--db` option ensures you don't lose your datas when you close ganache.

```console
ganache-cli -a 10 -e 1000 --db ./ganache-db -m "<YOUR_MNEMONIC_LIST>" --allowUnlimitedContractSize  --gasLimit 0xFFFFFFFFFFFF --networkId 123456
```

Also take note of the first address you see in the ganache screen as it is used by default to deploy the contracts. Then also use that address as the `TREASURY_ADDRESS` in .env.

Then do the deployment like : 

```console
npm run migrate-initial
```


