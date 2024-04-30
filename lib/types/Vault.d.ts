declare class Vault {
    debtAsset: number;
    collateralAsset: number;
    farmApp: number;
    lpApp: number;
    appIndex: number;
    liquidityToken: number;
    creatorAddress: string;
    network: string;
    constructor(name: "meldGold", network: "LocalHost" | "TestNet" | "MainNet");
}
export default Vault;
