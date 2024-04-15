"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const algosdk_1 = __importDefault(require("algosdk"));
const utils_1 = require("./utils");
const pactsdk_1 = __importDefault(require("@pactfi/pactsdk"));
const textEncoder = new TextEncoder();
class VaultClient {
    constructor(params) {
        let account;
        this.client = (0, utils_1.getClient)(params.algodToken, params.algodServer, params.algodPort);
        this.indexer = (0, utils_1.getIndexerClient)(params.indexerToken, params.indexerServer, params.indexerPort);
        this.mnemonic = params.mnemonic;
        this.connector = params.connector;
        if (params.mnemonic) {
            account = algosdk_1.default.mnemonicToSecretKey(params.mnemonic);
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
            const boxInt64Type = new algosdk_1.default.ABIUintType(64);
            const boxSize = boxInt64Type.byteLen() * 5;
            const MINIMUM_BALANCE_PER_ACCOUNT = 100000;
            const balanceForBoxCreated = 2500 +
                400 * (new algosdk_1.default.ABIAddressType().byteLen() * 2 + boxSize + 32) +
                // minimum balance for creating another app
                MINIMUM_BALANCE_PER_ACCOUNT +
                //MINIMUM BALANCE BY gLOBAL STORAGE OF each uint in other app
                28500 * 3 +
                //MINIMUM BALANCE BY gLOBAL STORAGE OF each bytes in other app
                50000 * 4;
            //
            const globalState = yield (0, utils_1.readGlobalState)(this.indexer, appIndex);
            const appArgs = [
                textEncoder.encode(Buffer.from("create_vault").toString()),
                algosdk_1.default.encodeUint64(collateral),
            ];
            const assetIndex = collateralAsset;
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk_1.default.getApplicationAddress(appIndex);
            const foreignApps = [lpApp, globalState.gas_station_id, farmApp];
            const foreignAccounts = undefined;
            const strType = algosdk_1.default.ABIAddressType.from("address");
            const assetSendTxn = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, collateral, undefined, assetIndex, params);
            const boxFeePaymentTxn = algosdk_1.default.makePaymentTxnWithSuggestedParams(from, appAddress, balanceForBoxCreated + 1000000, undefined, undefined, params);
            params.fee = 1000;
            const appCallTxn = algosdk_1.default.makeApplicationNoOpTxn(from, params, appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(creatorAddress),
                },
                {
                    appIndex,
                    name: strType.encode(from),
                },
            ]);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: boxFeePaymentTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    signAndSend(atc) {
        return __awaiter(this, void 0, void 0, function* () {
            const txns = atc.buildGroup().map((el) => el.txn);
            if (this.mnemonic) {
                let account = algosdk_1.default.mnemonicToSecretKey(this.mnemonic);
                //use mnemonic to sighnelse
                const signedTxns = txns.map((el) => el.signTxn(account.sk));
                const sentTX = yield this.client.sendRawTransaction(signedTxns).do();
                yield (0, utils_1.waitForConfirmation)(this.client, sentTX.txId);
                const ptx = yield this.client
                    .pendingTransactionInformation(sentTX.txId)
                    .do();
                return sentTX.txId;
            }
            else {
                // use connector to sign
                const encodedTxns = txns.map((el) => algosdk_1.default.encodeUnsignedTransaction(el));
                const signedTxns = yield this.connector.signTxns(encodedTxns);
                const sentTX = yield this.client.sendRawTransaction(signedTxns).do();
                yield (0, utils_1.waitForConfirmation)(this.client, sentTX.txId);
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
                algosdk_1.default.encodeUint64(collateral),
            ];
            const from = this.address;
            const assetIndex = collateralAsset;
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk_1.default.getApplicationAddress(appIndex);
            const boxValue = yield (0, utils_1.readBoxValue)(appIndex, from, this.client);
            const foreignApps = [lpApp, boxValue.escrow_id];
            const foreignAccounts = [appAddress, boxValue.escrow_address];
            const strType = algosdk_1.default.ABIAddressType.from("address");
            let userState;
            if (args.userState) {
                userState = args.userState;
            }
            else {
                userState = yield this.getUserState({ address: this.address, vault });
            }
            const assetSendTxn = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, collateral, undefined, assetIndex, params);
            const appCallTxn = algosdk_1.default.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(this.address),
                },
            ]);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            const depositTxn = yield this.signAndSend(atc);
            const updateStateAtc = new algosdk_1.default.AtomicTransactionComposer();
            const contract = new algosdk_1.default.ABIContract(utils_1.contractJson);
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
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
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
                algosdk_1.default.encodeUint64(lpTokens),
            ];
            const from = this.address;
            const accountAssets = yield this.indexer.lookupAccountAssets(from).do();
            let assetOptedIn = accountAssets.assets.filter((el) => el["asset-id"] == utils_1.STABLE_COIN_ASSET[network]);
            if (assetOptedIn.length == 0) {
                yield this.optIntoToken(utils_1.STABLE_COIN_ASSET[network]);
            }
            assetOptedIn = accountAssets.assets.filter((el) => el["asset-id"] == liquidityToken);
            if (assetOptedIn.length == 0) {
                yield this.optIntoToken(liquidityToken);
            }
            const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
            const appAddress = algosdk_1.default.getApplicationAddress(appIndex);
            const boxValue = yield (0, utils_1.readBoxValue)(appIndex, from, this.client);
            const foreignApps = [
                lpApp,
                boxValue.interface_app_id,
                boxValue.escrow_id,
                farmApp,
            ];
            const foreignAccounts = undefined;
            const strType = algosdk_1.default.ABIAddressType.from("address");
            const appCallTxn = algosdk_1.default.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(this.address),
                },
            ]);
            const assetSendTxn = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
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
                algosdk_1.default.decodeAddress(addressToLiq).publicKey,
                //TODO: avoid repetition
                algosdk_1.default.encodeUint64(debt),
            ];
            const from = this.address;
            const boxValue = yield (0, utils_1.readBoxValue)(appIndex, addressToLiq, this.client);
            const foreignAssetsArray = [debtAsset, liquidityToken];
            const appAddress = algosdk_1.default.getApplicationAddress(appIndex);
            const foreignApps = [
                lpApp,
                boxValue.interface_app_id,
                boxValue.escrow_id,
                farmApp,
            ];
            const foreignAccounts = [addressToLiq];
            const strType = algosdk_1.default.ABIAddressType.from("address");
            const appCallTxn = algosdk_1.default.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(addressToLiq),
                },
            ]);
            const assetSendTxn = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
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
            const strType = algosdk_1.default.ABIAddressType.from("address");
            const from = this.address;
            const appArgs = [
                textEncoder.encode(Buffer.from("return_vault_debt").toString()),
                algosdk_1.default.decodeAddress(from).publicKey,
            ];
            const foreignAssetsArray = [debtAsset];
            const foreignAccounts = undefined;
            const foreignApps = undefined;
            const appAddress = algosdk_1.default.getApplicationAddress(appIndex);
            const appCallTxn = algosdk_1.default.makeApplicationNoOpTxn(from, Object.assign(Object.assign({}, params), { fee: 1000 }), appIndex, appArgs, foreignAccounts, foreignApps, foreignAssetsArray, undefined, undefined, undefined, [
                {
                    appIndex,
                    name: strType.encode(from),
                },
            ]);
            const assetSendTxn = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, appAddress, undefined, undefined, debt, undefined, debtAsset, params);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: appCallTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            atc.addTransaction({
                txn: assetSendTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    optIntoToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const from = this.address;
            const params = yield this.client.getTransactionParams().do();
            const assetSendTxn1 = algosdk_1.default.makeAssetTransferTxnWithSuggestedParams(from, from, undefined, undefined, 0, undefined, token, params);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: assetSendTxn1,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    getGlobalState(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex } = params.vault;
            const globalState = yield (0, utils_1.readGlobalState)(this.indexer, appIndex);
            return Object.assign({}, globalState);
        });
    }
    getUserState(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex, farmApp } = params.vault;
            const farm = yield pactsdk_1.default.fetchFarmById(this.client, farmApp);
            const userState = yield (0, utils_1.readBoxValue)(appIndex, params.address, this.client);
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
        const { totalValue, debtAssetVal, collateralAssetVal } = (0, utils_1.getLpCollateralValue)(userState.collateral, collateralAsset, debtAsset, lpAppState, zapGlobalState);
        const cR = (0, utils_1.collateralRatio)(totalValue, userState.vaultDebt);
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
            let liqpAppState = yield (0, utils_1.readGlobalState)(this.indexer, lpApp);
            let lpAppState = {
                totalPrimary: liqpAppState.totalPrimary,
                totalSecondary: liqpAppState.totalSecondary,
                totalLiquidity: liqpAppState.totalLiquidity,
            };
            const farm = yield pactsdk_1.default.fetchFarmById(this.client, farmApp);
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
            const { totalValue, debtAssetVal, collateralAssetVal } = (0, utils_1.getLpCollateralValue)(userState.collateral, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            const cR = (0, utils_1.collateralRatio)(totalValue, userState.vaultDebt);
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
        const debt = (0, utils_1.getEquivalentDebt)(params.collateral, collateralAsset, debtAsset, lpAppState);
        if (params.vaultDebt) {
            lp = (0, utils_1.getEquivalentLp)(params.collateral, params.vaultDebt, collateralAsset, debtAsset, lpAppState);
            const { totalValue: totalLpColateralValue } = (0, utils_1.getLpCollateralValue)(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            totalValue = totalLpColateralValue;
            cR = (0, utils_1.collateralRatio)(totalValue, params.vaultDebt);
        }
        else {
            lp = (0, utils_1.getEquivalentLp)(params.collateral, debt, collateralAsset, debtAsset, lpAppState);
            const { totalValue: totalLpColateralValue } = (0, utils_1.getLpCollateralValue)(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
            totalValue = totalLpColateralValue;
            cR = (0, utils_1.collateralRatio)(totalValue, debt);
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
            const debt = yield (0, utils_1.getEquivalentDebt)(params.collateral, collateralAsset, debtAsset, lpAppState);
            if (params.vaultDebt) {
                lp = (0, utils_1.getEquivalentLp)(params.collateral, params.vaultDebt, collateralAsset, debtAsset, lpAppState);
                const { totalValue: totalLpColateralValue } = (0, utils_1.getLpCollateralValue)(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
                totalValue = totalLpColateralValue;
                cR = (0, utils_1.collateralRatio)(totalValue, params.vaultDebt);
            }
            else {
                lp = (0, utils_1.getEquivalentLp)(params.collateral, debt, collateralAsset, debtAsset, lpAppState);
                const { totalValue: totalLpColateralValue } = (0, utils_1.getLpCollateralValue)(lp, collateralAsset, debtAsset, lpAppState, zapGlobalState);
                totalValue = totalLpColateralValue;
                cR = (0, utils_1.collateralRatio)(totalValue, debt);
            }
            return { collateralRatio: cR, totalValue, debt, lp };
        });
    }
    getEquivalentDebtForCollateral(params) {
        const { lpAppState } = params;
        const { collateralAsset, debtAsset } = params.vault;
        const debt = (0, utils_1.getEquivalentDebt)(params.collateral, collateralAsset, debtAsset, lpAppState);
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
                algosdk_1.default.encodeUint64(whitelistedAssetPrice),
            ];
            const from = this.address;
            const updateAppTxn = algosdk_1.default.makeApplicationNoOpTxn(from, params, vault.appIndex, appArgs);
            const atc = new algosdk_1.default.AtomicTransactionComposer();
            atc.addTransaction({
                txn: updateAppTxn,
                signer: algosdk_1.default.makeEmptyTransactionSigner(),
            });
            return yield this.signAndSend(atc);
        });
    }
    getAllVaults(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { appIndex } = params.vault;
            const allGlobalData = yield this.getAllGlobalData({ vault: params.vault });
            const allVaults = yield (0, utils_1.fetchAllVaults)(appIndex, "begin", this.indexer, this.client);
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
exports.default = VaultClient;
