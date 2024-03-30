export declare const VAULTS_DATA: {
    LocalHost: {
        gALGO: {
            collateralAsset: number;
            debtAsset: number;
            farmApp: number;
            lpApp: number;
            appIndex: number;
            liquidityToken: number;
            gasStationId: number;
            creatorAddress: string;
            discountRate: number;
            collateralAssetDecimals: number;
            lpAssetDecimals: number;
        };
    };
    TestNet: {
        gALGO: {
            collateralAsset: number;
            debtAsset: number;
            farmApp: number;
            lpApp: number;
            appIndex: number;
            liquidityToken: number;
            gasStationId: number;
            creatorAddress: string;
            discountRate: number;
            collateralAssetDecimals: number;
            lpAssetDecimals: number;
        };
    };
};
export declare const STABLE_COIN_ASSET: {
    TestNet: number;
    LocalHost: number;
};
import { Algodv2, Indexer } from "algosdk";
import IndexerClient from "algosdk/dist/types/client/v2/indexer/indexer";
import { LPAPP, UserVaultType, ZapGlobalState } from "interface";
declare const waitForConfirmation: (algodclient: Algodv2, txId: string) => Promise<void>;
declare function compileProgram(client: Algodv2, programSource: string): Promise<Uint8Array>;
declare const getClient: (token: string, server: string, port: string) => Algodv2;
declare function getIndexerClient(token: string, server: string, port: string): Indexer;
declare const readGlobalState: (client: IndexerClient, index: number) => Promise<Record<string, number | string>>;
declare function toUtf8(str: string): string;
declare const readBoxValue: (appID: number, key: string, client: Algodv2) => Promise<{
    debt: number;
    lpt: number;
    lait: number;
    interface_app_id: number;
    escrow_id: number;
    escrow_address: string;
    interface_address: string;
}>;
declare const getLpCollateralValue: (lp: number, collataralAsset: number, debtAsset: number, lpAppState: LPAPP, globalState: ZapGlobalState) => {
    totalValue: number;
    primaryAssetValue: number;
    debtAssetVal: number;
    collateralAssetVal: number;
};
export declare const getLpPrice: (lpTokensToPay: number, collataralAsset: number, debtAsset: number, lpAppState: LPAPP) => {
    debtAssetVal: number;
    collateralAssetVal: number;
};
export declare const collateralValue: (collateral: number, globalState: ZapGlobalState) => number;
export declare const collateralRatio: (collateralValue: number, debt: number) => number;
declare const getEquivalentDebt: (collateralAmount: number, collateralAsset: number, debtAsset: number, lpAppState: LPAPP) => number;
declare const getEquivalentLp: (collateral: number, debt: number, collateralAsset: number, debtAsset: number, lpAppState: LPAPP) => number;
export declare const contractJson: {
    name: string;
    methods: {
        name: string;
        desc: string;
        args: {
            type: string;
        }[];
        returns: {
            type: string;
        };
    }[];
};
declare const fetchAllVaults: (appIndex: number, nextToken: string | undefined, indexer: Indexer, algod: Algodv2) => Promise<(UserVaultType)[]>;
export { waitForConfirmation, compileProgram, getClient, getIndexerClient, readGlobalState, toUtf8, readBoxValue, getEquivalentDebt, getEquivalentLp, fetchAllVaults, getLpCollateralValue };
