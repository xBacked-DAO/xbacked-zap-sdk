
const {Vault, VaultClient} = require("..");
const dotenv = require('dotenv');
var readlineSync = require('readline-sync');
dotenv.config()
//algod
const token =
"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
// const server = "http://localhost";
const server = "https://testnet-api.algonode.cloud";
const port = 443;
// const port = "4001";

// indexer
const indexerToken =
"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
// const indexerServer = "http://localhost";
const indexerServer = "https://testnet-idx.algonode.cloud";
const indexerPort = 443;
// const indexerPort = "8980";


(async()=>{
    const client =  new VaultClient({mnemonic: process.env.MNEMONIC, algodToken: token, algodServer: server, algodPort: port, indexerToken, indexerServer, indexerPort});
    console.log(client);
    const vault = new Vault("gALGO", "TestNet");
    const userAddress = client.address;
    console.log(client.address);
    while (true) {
        const todo = parseInt(readlineSync.question(`
       Do you want to:
       1.) get Global State
       2.) Read User State 
       3.) Get Vault Data
       4.) assumed vault data
       5.) Fetch all vault data\n`));
    
        try {
            
        const collateral = 100 * (10 ** 8)
          switch (todo) {
            // should also opt into stable coin
            case 1: const globalState =  await client.getAllGlobalData({vault});
              console.log(globalState);
              break;
            case 2: const isVaultCreated = await client.getUserState({vault, address: userAddress});
              console.log(isVaultCreated);
              break;
            case 3: const vaultData = await client.getVaultData({vault, address: userAddress});
            console.log({vaultData});
              break;
            case 4: const assumedVaultData = await client.getAssumedVaultData({vault, collateral: 100000000, vaultDebt: undefined});
                    console.log(assumedVaultData);
            break;
            case 5: const allVaultS = await client.getAllVaults({vault});
              console.log(allVaultS)
          }
        } catch (error) {
          console.error(error);
        }
      }
})()