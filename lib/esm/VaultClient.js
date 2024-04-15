var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import algosdk from "algosdk";
import { STABLE_COIN_ASSET, collateralRatio, contractJson, fetchAllVaults, getClient, getEquivalentDebt, getEquivalentLp, getIndexerClient, getLpCollateralValue, readBoxValue, readGlobalState, waitForConfirmation } from './utils';
import pactsdk from "@pactfi/pactsdk";
const textEncoder = new TextEncoder();
class VaultClient {
    constructor(params) {
        let account;
        this.client = getClient(params.algodToken, params.algodServer, params.algodPort);
        this.indexer = getIndexerClient(params.indexerToken, params.indexerServer, params.indexerPort);
        this.mnemonic = params.mnemonic;
        this.connector = params.connector;
        if (params.mnemonic) {
            account = algosdk.mnemonicToSecretKey(params.mnemonic);
            this.address = account.addr;
        }
        else if (params.connector) {
            this.address = this.connector.networkAccount;
        }
        else {
            throw Error("must specify one of mnemonic or connector");
        }
    }
    create(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { vault, collateral } = args;
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = vault;
            const params = yield this.client
                .getTransactionParams()
                .do();
            const from = this.address;
            const boxInt64Type = new algosdk.ABIUintType(64);
            const boxSize = boxInt64Type.byteLen() * 5;
            const MINIMUM_BALANCE_PER_ACCOUNT = 100000;
            const balanceForBoxCreated = 2500 +
                400 * (new algosdk.ABIAddressType().byteLen() * 2 + boxSize + 32) +
                // minimum balance for creating another app
                MINIMUM_BALANCE_PER_ACCOUNT +
                //MINIMUM BALANCE BY gLOBAL STORAGE OF each uint in other app
                28500 * 3 +
                //MINIMUM BALANCE BY gLOBAL STORAGE OF each bytes in other app
                50000 * 4;
            //
            const globalState = yield readGlobalState(this.indexer, appIndex);
            const appArgs = [
                textEncoder.encode(Buffer.from("create_vault").toString()),
                algosdk.encodeUint64(collateral),
            ];
            const assetIndex = collateralAsset;
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk.getApplicationAddress(appIndex);
            const foreignApps = [lpApp, globalState.gas_station_id, farmApp];
            const foreignAccounts = undefined;
            const strType = algosdk.ABIAddressType.from("address");
            const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, collateral, undefined, assetIndex, params);
            const boxFeePaymentTxn = algosdk.makePaymentTxnWithSuggestedParams(from, appAddress, balanceForBoxCreated + 1000000, undefined, undefined, params);
            params.fee = 1000;
            const appCallTxn = algosdk.makeApplicationNoOpTxn(from, params, appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(creatorAddress),
                },
                {
                    appIndex,
                    name: strType.encode(from),
                },
            ]);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: boxFeePaymentTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    signAndSend(atc) {
        return __awaiter(this, void 0, void 0, function* () {
            const txns = atc.buildGroup().map((el) => el.txn);
            if (this.mnemonic) {
                let account = algosdk.mnemonicToSecretKey(this.mnemonic);
                //use mnemonic to sighnelse
                const signedTxns = txns.map((el) => el.signTxn(account.sk));
                const sentTX = yield this.client.sendRawTransaction(signedTxns).do();
                yield waitForConfirmation(this.client, sentTX.txId);
                const ptx = yield this.client
                    .pendingTransactionInformation(sentTX.txId)
                    .do();
                return sentTX.txId;
            }
            else {
                // use connector to sign
                const encodedTxns = txns.map((el) => algosdk.encodeUnsignedTransaction(el));
                const signedTxns = yield this.connector.signTxns(encodedTxns);
                const sentTX = yield this.client.sendRawTransaction(signedTxns).do();
                yield waitForConfirmation(this.client, sentTX.txId);
                const ptx = yield this.client
                    .pendingTransactionInformation(sentTX.txId)
                    .do();
                return sentTX.txId;
            }
        });
    }
    deposit(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { vault, collateral } = args;
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = vault;
            const params = yield this.client
                .getTransactionParams()
                .do();
            const appArgs = [
                textEncoder.encode(Buffer.from("deposit_collateral").toString()),
                algosdk.encodeUint64(collateral),
            ];
            const from = this.address;
            const assetIndex = collateralAsset;
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk.getApplicationAddress(appIndex);
            const boxValue = yield readBoxValue(appIndex, from, this.client);
            const foreignApps = [lpApp, boxValue.escrow_id];
            const foreignAccounts = [appAddress, boxValue.escrow_address];
            const strType = algosdk.ABIAddressType.from("address");
            let userState;
            if (args.userState) {
                userState = args.userState;
            }
            else {
                userState = yield this.getUserState({ address: this.address, vault });
            }
            const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, collateral, undefined, assetIndex, params);
            const appCallTxn = algosdk.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(this.address),
                },
            ]);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            const depositTxn = yield this.signAndSend(atc);
            const updateStateAtc = new algosdk.AtomicTransactionComposer();
            const contract = new algosdk.ABIContract(contractJson);
            updateStateAtc.addMethodCall({
                appID: farmApp,
                method: contract.getMethodByName("update_state"),
                sender: from,
                methodArgs: [
                    userState.escrowId,
                    userState.escrowAddress,
                    userState.interfaceAddress,
                    liquidityToken,
                ],
                signer: algosdk.makeEmptyTransactionSigner(),
                suggestedParams: Object.assign(Object.assign({}, params), { fee: 1000 }),
                appAccounts: [userState.escrowAddress, userState.interfaceAddress],
                appForeignApps: [userState.escrowId],
                appForeignAssets: [liquidityToken],
            });
            yield this.signAndSend(updateStateAtc);
            return depositTxn;
        });
    }
    withdraw(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { vault, lpTokens, debt } = args;
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, network, } = vault;
            const params = yield this.client
                .getTransactionParams()
                .do();
            const appArgs = [
                textEncoder.encode(Buffer.from("withdraw_collateral").toString()),
                algosdk.encodeUint64(lpTokens),
            ];
            const from = this.address;
            const accountAssets = yield this.indexer.lookupAccountAssets(from).do();
            let assetOptedIn = accountAssets.assets.filter((el) => el["asset-id"] == STABLE_COIN_ASSET[network]);
            if (assetOptedIn.length == 0) {
                yield this.optIntoToken(STABLE_COIN_ASSET[network]);
            }
            assetOptedIn = accountAssets.assets.filter((el) => el["asset-id"] == liquidityToken);
            if (assetOptedIn.length == 0) {
                yield this.optIntoToken(liquidityToken);
            }
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk.getApplicationAddress(appIndex);
            const boxValue = yield readBoxValue(appIndex, from, this.client);
            const foreignApps = [
                lpApp,
                boxValue.interface_app_id,
                boxValue.escrow_id,
                farmApp,
            ];
            const foreignAccounts = undefined;
            const strType = algosdk.ABIAddressType.from("address");
            const appCallTxn = algosdk.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(this.address),
                },
            ]);
            const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    liquidate(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { vault, debt, addressToLiq, isLiquidateVaultInShutDown } = args;
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = vault;
            const params = yield this.client
                .getTransactionParams()
                .do();
            const appArgs = [
                isLiquidateVaultInShutDown
                    ? textEncoder.encode(Buffer.from("liquidate_during_shutdown").toString())
                    : textEncoder.encode(Buffer.from("liquidate_vault").toString()),
                algosdk.decodeAddress(addressToLiq).publicKey,
                //TODO: avoid repetition
                algosdk.encodeUint64(debt),
            ];
            const from = this.address;
            const boxValue = yield readBoxValue(appIndex, addressToLiq, this.client);
            const foreignAssetsArray = [debtAsset, liquidityToken];
            const appAddress = algosdk.getApplicationAddress(appIndex);
            const foreignApps = [
                lpApp,
                boxValue.interface_app_id,
                boxValue.escrow_id,
                farmApp,
            ];
            const foreignAccounts = [addressToLiq];
            const strType = algosdk.ABIAddressType.from("address");
            const appCallTxn = algosdk.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(addressToLiq),
                },
            ]);
            const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    return(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { debt } = args;
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = args.vault;
            const textEncoder = new TextEncoder();
            const params = yield this.client
                .getTransactionParams()
                .do();
            const strType = algosdk.ABIAddressType.from("address");
            const from = this.address;
            const appArgs = [
                textEncoder.encode(Buffer.from("return_vault_debt").toString()),
                algosdk.decodeAddress(from).publicKey,
            ];
            const foreignAssetsArray = [debtAsset];
            const foreignAccounts = undefined;
            const foreignApps = undefined;
            const appAddress = algosdk.getApplicationAddress(appIndex);
            const appCallTxn = algosdk.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(from),
                },
            ]);
            const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    optIntoToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const from = this.address;
            const params = yield this.client.getTransactionParams().do();
            const assetSendTxn1 = algosdk.makeAssetTransferTxnWithSuggestedParams(from, from, undefined, undefined, 0, undefined, token, params);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn1,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    getGlobalState(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex } = params.vault;
            const globalState = yield readGlobalState(this.indexer, appIndex);
            return Object.assign({}, globalState);
        });
    }
    getUserState(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex, farmApp } = params.vault;
            const farm = yield pactsdk.fetchFarmById(this.client, farmApp);
            const userState = yield readBoxValue(appIndex, params.address, this.client);
            const userFarmState = yield farm.fetchUserState(userState.interface_address);
            return {
                collateral: userState.lpt,
                vaultDebt: userState.debt,
                lastAccruedInterestTime: userState.lait,
                escrowId: userState.escrow_id,
                escrowAddress: userState.escrow_address,
                interfaceId: userState.interface_app_id,
                interfaceAddress: userState.interface_address,
                userFarmState,
            };
        });
    }
    localVaultDataCalc(params) {
        const { userState, lpAppState, zapGlobalState, vault } = params;
        const { collateralAsset, debtAsset } = vault;
        const { totalValue, debtAssetVal, collateralAssetVal } = getLpCollateralValue(userState.collateral, collateralAsset, debtAsset, lpAppState, zapGlobalState);
        const cR = collateralRatio(totalValue, userState.vaultDebt);
        return {
            collateralRatio: cR,
            collateralValue: totalValue,
            liquidationPrice: 100,
            debtAssetVal,
            collateralAssetVal,
        };
    }
    getAllGlobalData(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { vault } = params;
            const { lpApp, farmApp } = params.vault;
            let zapGlobalState = yield this.getGlobalState({ vault });
            zapGlobalState = {
                totalVaultDebt: zapGlobalState.totalVaultDebt,
                interestRateAdmin: zapGlobalState.interestRateAdmin,
                minimumDebt: zapGlobalState.minimumDebt,
                collateralAssetPrice: zapGlobalState.whitelisted_asset_price,
                oracle: zapGlobalState.oracle,
                gasStationId: zapGlobalState.gas_station_id,
                accruedInterest: zapGlobalState.accrued_interest,
                admin: zapGlobalState.admin,
                interestRate: zapGlobalState.interestRate,
                minimumCR: zapGlobalState.scaled_min_cr,
                collateralAssetDecimals: zapGlobalState.whitelisted_asset_microunits,
                gasStationAddress: zapGlobalState.gas_station_address,
                contractState: zapGlobalState.contract_state,
            };
            let liqpAppState = yield readGlobalState(this.indexer, lpApp);
            let lpAppState = {
                totalPrimary: liqpAppState.totalPrimary,
                totalSecondary: liqpAppState.totalSecondary,
                totalLiquidity: liqpAppState.totalLiquidity,
            };
            const farm = yield pactsdk.fetchFarmById(this.client, farmApp);
            yield farm.fetchAllAssets();
            let farmState = farm.state;
            return { zapGlobalState, lpAppState, farmState };
        });
    }
    //TODO: fix liquidation price
    getVaultData(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = params.vault;
            const userState = yield this.getUserState(params);
            const { lpAppState, zapGlobalState } = yield this.getAllGlobalData({
                vault: params.vault,
            });
            const { totalValue, debtAssetVal, collateralAssetVal } = getLpCollateralValue(userState.collateral, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            const cR = collateralRatio(totalValue, userState.vaultDebt);
            return {
                collateralRatio: cR,
                collateralValue: totalValue,
                liquidationPrice: 100,
                debtAssetVal,
                collateralAssetVal,
            };
        });
    }
    localAssumedVaultData(params) {
        if (params.collateral == 0) {
            return { collateralRatio: 0, totalValue: 0, debt: 0, lp: 0 };
        }
        const { collateralAsset, debtAsset, lpApp } = params.vault;
        let cR = 0;
        let totalValue = 0;
        let lp = 0;
        const { lpAppState, zapGlobalState } = params;
        const debt = getEquivalentDebt(params.collateral, collateralAsset, debtAsset, lpAppState);
        if (params.vaultDebt) {
            lp = getEquivalentLp(params.collateral, params.vaultDebt, collateralAsset, debtAsset, lpAppState);
            const { totalValue: totalLpColateralValue } = getLpCollateralValue(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            totalValue = totalLpColateralValue;
            cR = collateralRatio(totalValue, params.vaultDebt);
        }
        else {
            lp = getEquivalentLp(params.collateral, debt, collateralAsset, debtAsset, lpAppState);
            const { totalValue: totalLpColateralValue } = getLpCollateralValue(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            totalValue = totalLpColateralValue;
            cR = collateralRatio(totalValue, debt);
        }
        return { collateralRatio: cR, totalValue, debt, lp };
    }
    //TODO: fix liquidation price
    getAssumedVaultData(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (params.collateral == 0) {
                return { collateralRatio: 0, totalValue: 0, debt: 0, lp: 0 };
            }
            const { appIndex, collateralAsset, debtAsset, liquidityToken, farmApp, lpApp, creatorAddress, } = params.vault;
            let cR = 0;
            let totalValue = 0;
            let lp = 0;
            const { lpAppState, zapGlobalState } = yield this.getAllGlobalData({
                vault: params.vault,
            });
            const debt = yield getEquivalentDebt(params.collateral, collateralAsset, debtAsset, lpAppState);
            if (params.vaultDebt) {
                lp = getEquivalentLp(params.collateral, params.vaultDebt, collateralAsset, debtAsset, lpAppState);
                const { totalValue: totalLpColateralValue } = getLpCollateralValue(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
                totalValue = totalLpColateralValue;
                cR = collateralRatio(totalValue, params.vaultDebt);
            }
            else {
                lp = getEquivalentLp(params.collateral, debt, collateralAsset, debtAsset, lpAppState);
                const { totalValue: totalLpColateralValue } = getLpCollateralValue(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
                totalValue = totalLpColateralValue;
                cR = collateralRatio(totalValue, debt);
            }
            return { collateralRatio: cR, totalValue, debt, lp };
        });
    }
    getEquivalentDebtForCollateral(params) {
        const { lpAppState } = params;
        const { collateralAsset, debtAsset } = params.vault;
        const debt = getEquivalentDebt(params.collateral, collateralAsset, debtAsset, lpAppState);
        return debt;
    }
    updatePrice(args) {
        return __awaiter(this, void 0, void 0, function* () {
            const { price, vault } = args;
            const params = yield this.client
                .getTransactionParams()
                .do();
            const whitelistedAssetPrice = price;
            const appArgs = [
                textEncoder.encode(Buffer.from("update_price").toString()),
                algosdk.encodeUint64(whitelistedAssetPrice),
            ];
            const from = this.address;
            const updateAppTxn = algosdk.makeApplicationNoOpTxn(from, params, vault.appIndex, appArgs);
            const atc = new algosdk.AtomicTransactionComposer();
            atc.addTransaction({
                txn: updateAppTxn,
                signer: algosdk.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    getAllVaults(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex } = params.vault;
            const allGlobalData = yield this.getAllGlobalData({ vault: params.vault });
            const allVaults = yield fetchAllVaults(appIndex, "begin", this.indexer, this.client);
            const adddedLpVaultState = allVaults.map((userVault) => {
                const otherInfo = this.localVaultDataCalc({ lpAppState: allGlobalData.lpAppState, zapGlobalState: allGlobalData.zapGlobalState, userState: userVault, vault: params.vault });
                return Object.assign(Object.assign({}, userVault), otherInfo);
            });
            return adddedLpVaultState;
        });
    }
    getUserAddress() {
        if (this.mnemonic) {
            //use mnemonic address
        }
        else {
            //use pera connect address
        }
    }
}
export default VaultClient;
