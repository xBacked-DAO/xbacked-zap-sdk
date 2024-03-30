"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
class Vault {
    constructor(name, network) {
        const vaultData = utils_1.VAULTS_DATA[network][name];
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
exports.default = Vault;
