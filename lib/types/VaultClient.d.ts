import Vault from "Vault";
import { AtomicTransactionComposer, Indexer } from "algosdk";
import { Algodv2 } from "algosdk";
import { LPAPP, UserState, UserVaultType, ZapGlobalState } from "interface";
import pactsdk from "@pactfi/pactsdk";
interface Signer {
    networkAccount: string;
    signTxns: (a: Uint8Array[]) => Promise<Uint8Array[]>;
}
declare class VaultClient {
    mnemonic?: string;
    connector?: Signer;
    address: string;
    client: Algodv2;
    indexer: Indexer;
    constructor(params: {
        algodToken: string;
        algodPort: string;
        algodServer: string;
        mnemonic?: string;
        connector?: Signer;
        indexerToken: string;
        indexerPort: string;
        indexerServer: string;
    });
    create(args: {
        vault: Vault;
        collateral: bigint;
    }): Promise<string>;
    signAndSend(atc: AtomicTransactionComposer): Promise<string>;
    deposit(args: {
        vault: Vault;
        collateral: bigint;
        userState?: UserState;
    }): Promise<String>;
    withdraw(args: {
        vault: Vault;
        lpTokens: bigint;
        debt: bigint;
    }): Promise<string>;
    liquidate(args: {
        vault: Vault;
        debt: bigint;
        addressToLiq: string;
        isLiquidateVaultInShutDown: boolean;
    }): Promise<string>;
    return(args: {
        debt: number;
        vault: Vault;
    }): Promise<string>;
    optIntoToken(token: number): Promise<string>;
    getGlobalState(params: {
        vault: Vault;
    }): Promise<any>;
    getUserState(params: {
        address: string;
        vault: Vault;
    }): Promise<UserState>;
    localVaultDataCalc(params: {
        lpAppState: LPAPP;
        zapGlobalState: ZapGlobalState;
        userState: UserVaultType;
        vault: Vault;
    }): {
        collateralRatio: number;
        collateralValue: number;
        liquidationPrice: number;
        debtAssetVal: number;
        collateralAssetVal: number;
    };
    getAllGlobalData(params: {
        vault: Vault;
    }): Promise<{
        zapGlobalState: ZapGlobalState;
        lpAppState: LPAPP;
        farmState: pactsdk.FarmState;
    }>;
    getVaultData(params: {
        vault: Vault;
        address: string;
    }): Promise<{
        collateralRatio: number;
        collateralValue: number;
        liquidationPrice: number;
        debtAssetVal: number;
        collateralAssetVal: number;
    }>;
    localAssumedVaultData(params: {
        lpAppState: LPAPP;
        zapGlobalState: ZapGlobalState;
        vault: Vault;
        vaultDebt?: number;
        collateral: number;
    }): {
        collateralRatio: number;
        totalValue: number;
        debt: number;
        lp: number;
    };
    getAssumedVaultData(params: {
        vault: Vault;
        vaultDebt?: number;
        collateral: number;
    }): Promise<{
        collateralRatio: number;
        totalValue: number;
        debt: number;
        lp: number;
    }>;
    getEquivalentDebtForCollateral(params: {
        vault: Vault;
        collateral: number;
        lpAppState: LPAPP;
    }): number;
    updateLocalState(address: string, vault: Vault): Promise<string>;
    claimRewardsFromFarm: (address: string, vault: Vault, rewardAsset: number) => Promise<string>;
    updatePrice(args: {
        vault: Vault;
        price: number;
    }): Promise<string>;
    getAllVaults(params: {
        vault: Vault;
    }): Promise<UserVaultType[]>;
    getUserAddress(): void;
}
export default VaultClient;
