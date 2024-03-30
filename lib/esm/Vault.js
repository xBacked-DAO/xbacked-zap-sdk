import { VAULTS_DATA } from "./utils";
class Vault {
    constructor(name, network) {
        const vaultData = VAULTS_DATA[network][name];
        this.debtAsset = vaultData.debtAsset;
        this.collateralAsset = vaultData.collateralAsset;
        this.farmApp = vaultData.farmApp;
        this.lpApp = vaultData.lpApp;
        this.appIndex = vaultData.appIndex;
        this.liquidityToken = vaultData.liquidityToken;
        this.creatorAddress = vaultData.creatorAddress;
        this.network = network;
    }
}
export default Vault;
