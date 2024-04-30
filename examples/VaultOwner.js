
const {Vault, VaultClient} = require("..");
const dotenv = require('dotenv');
var readlineSync = require('readline-sync');
dotenv.config()
//algod
const token =
"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
// const server = "http://localhost";
const server = "https://mainnet-api.algonode.cloud";
const port = 443;
// const port = "4001";

// indexer
const indexerToken =
"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
// const indexerServer = "http://localhost";
const indexerServer = "https://mainnet-idx.algonode.cloud";
const indexerPort = 443;
// const indexerPort = "8980";

(async()=>{
    const client =  new VaultClient({mnemonic: process.env.MNEMONIC, algodToken: token, algodServer: server, algodPort: port, indexerToken, indexerServer, indexerPort});
    console.log(client);
    const vault = new Vault("meldGold", "MainNet");
    console.log(client.address);
    while (true) {
        const todo = parseInt(readlineSync.question(`
       Do you want to:
       1.) Opt into stable coin
       2.) Create vault 
       3.) to withdraw collateral  
       4.) to deposit collateral
       5.) to return vault debt 
       6.) update price
       7.) update local state
       8.) Claim Rewards
      \n`));
    
        try {
            
        const collateral = 100 * (10 ** 8)
          switch (todo) {
            // should also opt into stable coin
            case 1: await client.optIntoToken(vault.liquidityToken);
              console.log('Opted into token');
              break;
            case 2: const isVaultCreated = await client.create({vault, collateral});
              console.log(`isVaultCreated: ${isVaultCreated}`);
              break;
            case 3: const isCollateralWithdrawn = await client.
                withdraw({vault, lpTokens: 1414213562, debt: 0});
              console.log(`isCollateralWithdrawn: ${isCollateralWithdrawn}`);
              break;
            case 4: const isCollateralDeposited = await client.
                deposit({collateral: collateral,
                  vault});
              console.log(`isCollateralDeposited: ${isCollateralDeposited}`);
              break;
            case 5: const isDebtReturned = await client.return({debt: 100,
                  vault});
              console.log(`isDebtReturned: ${isDebtReturned}`);
              break;
            case 6: const updatePrice = await client.updatePrice({price: 77500000,
              vault});
            console.log(`updatePrice: ${updatePrice}`);
            break; 
            case 7: const updateLocalState = await client.updateLocalState( "ETCCQVEA6QQDXSZ6AXYPUQNK2NUAGXPQRWYMKW6E2XCSOT2S47YH3OH2DE", vault);
            console.log(`updateLocalState: ${updateLocalState}`);
            break;
            case 8: const rewardsClaimed = await client.claimRewardsFromFarm( "ETCCQVEA6QQDXSZ6AXYPUQNK2NUAGXPQRWYMKW6E2XCSOT2S47YH3OH2DE", vault, 0);
            console.log(`rewardsClaimed: ${rewardsClaimed}`);
            break;
          }
        } catch (error) {
          console.error(error);
        }
      }
})()



