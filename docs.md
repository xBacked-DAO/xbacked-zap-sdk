const vaultClient = new ZappVault(mnemonic, wallet);
const vault = new Vault("gALGO");

vaultClient.setVault(vault);

vaultClient.create({vault, collateral})

vaultClient.withdraw({vault, collateral})

vaultClient.deposit({vault, collateral});

vaultClient.liquidate({vault, debtAmount});

vaultClient.shutdownLiquidate({vault, debtAmount})