import { VAULTS_DATA } from "./utils";

class Vault {
  debtAsset: number;
  collateralAsset: number;
  farmApp: number;
  lpApp: number;
  appIndex: number;
  liquidityToken: number;
  creatorAddress: string;
  network: string;
  constructor(name: "meldGold", network: "LocalHost" | "TestNet" | "MainNet") {
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
