var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export const VAULTS_DATA = {
    // TODO: APP iNDEX TO VAULT ID
    LocalHost: {
        meldGold: {
            collateralAsset: 1002,
            debtAsset: 1004,
            farmApp: 1031,
            lpApp: 1006,
            appIndex: 1034,
            liquidityToken: 1017,
            gasStationId: 1012,
            creatorAddress: "UGW3UJQ5BBMJRJKFZ2ZJEW64QPDCLTBO6O6MTGW6B6JUM23HZ3LFFOHZ2I",
            discountRate: 0.05,
            collateralAssetDecimals: 8,
            lpAssetDecimals: 6,
        },
    },
    TestNet: {
        meldGold: {
            collateralAsset: 228836101,
            debtAsset: 62281549,
            farmApp: 628722713,
            lpApp: 628722600,
            appIndex: 628722972,
            liquidityToken: 628722632,
            gasStationId: 628722688,
            creatorAddress: "KCVW6CW2ZZGHDF7I4MIF32O4NE66LKCCX46GDC7SDFOFZWEWRXPOEBU4EA",
            discountRate: 0.05,
            collateralAssetDecimals: 6,
            lpAssetDecimals: 6,
        },
    },
    MainNet: {
        meldGold: {
            collateralAsset: 246516580,
            debtAsset: 760037151,
            farmApp: 1150765092,
            lpApp: 1129082910,
            appIndex: 1750934368,
            liquidityToken: 1129082916,
            gasStationId: 1750927794,
            creatorAddress: "2SCZW64GEZMXV7IE7LE2KHJUMJGOVQP3TZJMUJQTJUJU44S5WYLMOX7GW4",
            discountRate: 0.05,
            collateralAssetDecimals: 6,
            lpAssetDecimals: 6,
        },
    },
};
export const STABLE_COIN_ASSET = {
    TestNet: 62281549,
    LocalHost: 62281549,
};
import algosdk from "algosdk";
const waitForConfirmation = function (algodclient, txId) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield algodclient.status().do();
        let lastround = response["last-round"];
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const pendingInfo = yield algodclient
                .pendingTransactionInformation(txId)
                .do();
            if (pendingInfo["confirmed-round"] !== null &&
                pendingInfo["confirmed-round"] > 0) {
                // Got the completed Transaction
                break;
            }
            lastround++;
            yield algodclient.statusAfterBlock(lastround).do();
        }
    });
};
function compileProgram(client, programSource) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const results = yield client.compile(programSource).do();
                const compiledBytes = new Uint8Array(Buffer.from(results.result, "base64"));
                resolve(compiledBytes);
            }
            catch (error) {
                reject(error);
            }
        }));
    });
}
const getClient = (token, server, port) => {
    const client = new algosdk.Algodv2(token, server, port);
    return client;
};
function getIndexerClient(token, server, port) {
    const client = new algosdk.Indexer(token, server, port);
    return client;
}
const readGlobalState = (client, index) => __awaiter(void 0, void 0, void 0, function* () {
    const applicationInfoResponse = yield client.lookupApplications(index).do();
    const globalState = applicationInfoResponse["application"]["params"]["global-state"];
    const data = {};
    for (let n = 0; n < globalState.length; n++) {
        const key = toUtf8(globalState[n].key);
        if (key == "creator") {
            data.creator = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key === "whitelisted_asset_price") {
            data.whitelisted_asset_price = globalState[n].value.uint;
        }
        if (key === "lp_asset_price_a_number") {
            data.lp_asset_price_a_number = globalState[n].value.uint;
        }
        if (key == "scaled_min_cr") {
            data.scaled_min_cr = globalState[n].value.uint;
        }
        if (key === "lp_asset_price_b_number") {
            data.lp_asset_price_b_number = globalState[n].value.uint;
        }
        if (key == "whitelisted_asset_microunits") {
            data.whitelisted_asset_microunits = globalState[n].value.uint;
        }
        if (key == "accrued_interest") {
            data.accrued_interest = globalState[n].value.uint;
        }
        if (key == "L") {
            data.totalLiquidity = globalState[n].value.uint;
        }
        if (key == "A") {
            data.totalPrimary = globalState[n].value.uint;
        }
        if (key == "B") {
            data.totalSecondary = globalState[n].value.uint;
        }
        if (key == "minimum_debt") {
            data.minimumDebt = globalState[n].value.uint;
        }
        if (key == "gas_station_address") {
            data.gas_station_address = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key == "gas_station_id") {
            data.gas_station_id = globalState[n].value.uint;
        }
        if (key == "owner") {
            data.interfaceOwner = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key == "admin") {
            data.admin = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key == "oracle") {
            data.oracle = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key == "contract_state") {
            data.contract_state = globalState[n].value.uint;
        }
        if (key == "interest_rate_admin") {
            data.interestRateAdmin = algosdk.encodeAddress(Buffer.from(globalState[n].value.bytes, "base64"));
        }
        if (key == "interest_rate") {
            data.interestRate = globalState[n].value.uint;
        }
        if (key == "total_vault_debt") {
            data.totalVaultDebt = globalState[n].value.uint;
        }
    }
    return data;
});
function toUtf8(str) {
    return Buffer.from(str, "base64").toString("ascii");
}
const readBoxValue = (appID, key, client) => __awaiter(void 0, void 0, void 0, function* () {
    const boxName = algosdk.decodeAddress(key).publicKey;
    const boxValue = yield client.getApplicationBoxByName(appID, boxName).do();
    const tupleCodec = new algosdk.ABITupleType([
        new algosdk.ABIUintType(64),
        new algosdk.ABIUintType(64),
        new algosdk.ABIUintType(64),
        new algosdk.ABIUintType(64),
        new algosdk.ABIUintType(64),
        new algosdk.ABIAddressType(),
        new algosdk.ABIAddressType(),
    ]);
    // algosdk.ABIType.from("((string),uint64[4])");
    const decodedBoxValue = tupleCodec.decode(boxValue.value);
    return {
        debt: Number(decodedBoxValue[0]),
        lpt: Number(decodedBoxValue[1]),
        lait: Number(decodedBoxValue[2]),
        interface_app_id: Number(decodedBoxValue[3]),
        escrow_id: Number(decodedBoxValue[4]),
        escrow_address: decodedBoxValue[5],
        interface_address: decodedBoxValue[6],
    };
});
const getLpCollateralValue = (lp, collataralAsset, debtAsset, lpAppState, globalState) => {
    const { debtAssetVal, collateralAssetVal } = getLpPrice(lp, collataralAsset, debtAsset, lpAppState);
    const primaryAssetValue = collateralValue(collateralAssetVal, globalState);
    return {
        primaryAssetValue,
        debtAssetVal,
        collateralAssetVal,
        totalValue: primaryAssetValue + debtAssetVal,
    };
};
export const getLpPrice = (lpTokensToPay, collataralAsset, debtAsset, lpAppState) => {
    const { totalLiquidity, totalPrimary, totalSecondary } = lpAppState;
    const primaryAssetVal = Math.floor((lpTokensToPay * totalPrimary) / totalLiquidity);
    const secondaryAssetVal = Math.floor((lpTokensToPay * totalSecondary) / totalLiquidity);
    const collateralAssetVal = collataralAsset > debtAsset ? secondaryAssetVal : primaryAssetVal;
    const debtAssetVal = collataralAsset > debtAsset ? primaryAssetVal : secondaryAssetVal;
    return { debtAssetVal, collateralAssetVal };
};
export const collateralValue = (collateral, globalState) => {
    return ((collateral * globalState.collateralAssetPrice) /
        globalState.collateralAssetDecimals);
};
export const collateralRatio = (collateralValue, debt) => {
    return (collateralValue) / debt;
};
const getEquivalentDebt = (collateralAmount, collateralAsset, debtAsset, lpAppState) => {
    const { totalPrimary, totalSecondary } = lpAppState;
    const debt = collateralAsset > debtAsset
        ? Math.floor((collateralAmount * totalPrimary) /
            totalSecondary)
        : Math.floor((collateralAmount * totalSecondary) /
            totalPrimary);
    return debt;
};
const getEquivalentLp = (collateral, debt, collateralAsset, debtAsset, lpAppState) => {
    const { totalLiquidity, totalPrimary, totalSecondary } = lpAppState;
    const addedPrimary = collateralAsset > debtAsset ? debt : collateral;
    const addedSecondary = collateralAsset > debtAsset ? collateral : debt;
    const ltA = Math.floor((addedPrimary * totalLiquidity) / totalPrimary);
    const ltB = Math.floor((addedSecondary * totalLiquidity) / totalSecondary);
    return ltA > ltB ? ltB : ltA;
};
export const contractJson = {
    name: "farm",
    methods: [
        {
            name: "add_reward_asset",
            desc: "Add reward asset",
            args: [{ type: "asset" }],
            returns: { type: "void" },
        },
        {
            name: "deposit_rewards",
            desc: "pay rewards into the farm",
            args: [{ type: "uint64[]" }, { type: "uint64" }],
            returns: { type: "void" },
        },
        {
            name: "update_global_state",
            desc: "pay rewards into the farm",
            args: [],
            returns: { type: "void" },
        },
        {
            name: "update_state",
            desc: "pay rewards into the farm",
            args: [
                { type: "application" },
                { type: "account" },
                { type: "account" },
                { type: "asset" },
            ],
            returns: { type: "void" },
        },
        {
            name: "claim_rewards",
            desc: "pay rewards into the farm",
            args: [{ type: "account" }, { type: "uint64[]" }],
            returns: { type: "void" },
        },
    ],
};
const fetchAllVaults = (appIndex, nextToken, indexer, algod) => __awaiter(void 0, void 0, void 0, function* () {
    if (!nextToken) {
        return [];
    }
    const allBoxes = yield indexer
        .searchForApplicationBoxes(appIndex)
        .nextToken(nextToken === "begin" ? "" : nextToken)
        .do();
    const allVaults = yield Promise.all(allBoxes.boxes.map((box) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const vault = yield readBoxValue(appIndex, algosdk.encodeAddress(box.name), algod);
            return {
                collateral: vault.lpt,
                vaultDebt: vault.debt,
                lastAccruedInterestTime: vault.lait,
                escrowId: vault.escrow_id,
                escrowAddress: vault.escrow_address,
                interfaceId: vault.interface_app_id,
                interfaceAddress: vault.interface_address,
                owner: algosdk.encodeAddress(box.name),
            };
        }
        catch (error) {
            return undefined;
        }
    })));
    const updatedListOfVaults = allVaults.concat(yield fetchAllVaults(appIndex, allBoxes.nextToken, indexer, algod));
    const allDefinedVaults = [];
    updatedListOfVaults.forEach((el) => {
        if (el != undefined) {
            allDefinedVaults.push(el);
        }
    });
    return allDefinedVaults;
});
export { waitForConfirmation, compileProgram, getClient, getIndexerClient, readGlobalState, toUtf8, readBoxValue, getEquivalentDebt, getEquivalentLp, fetchAllVaults, getLpCollateralValue };
