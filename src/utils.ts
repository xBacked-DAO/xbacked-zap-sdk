



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
      creatorAddress:
        "UGW3UJQ5BBMJRJKFZ2ZJEW64QPDCLTBO6O6MTGW6B6JUM23HZ3LFFOHZ2I",
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
      creatorAddress:
        "KCVW6CW2ZZGHDF7I4MIF32O4NE66LKCCX46GDC7SDFOFZWEWRXPOEBU4EA",
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
      creatorAddress:
        "2SCZW64GEZMXV7IE7LE2KHJUMJGOVQP3TZJMUJQTJUJU44S5WYLMOX7GW4",
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






import pactsdk from "@pactfi/pactsdk";
import algosdk, { Algodv2, Indexer, ABIValue } from "algosdk";
import IndexerClient from "algosdk/dist/types/client/v2/indexer/indexer";
import { LPAPP, UserVaultType, ZapGlobalState } from "interface";
const waitForConfirmation = async function (
  algodclient: Algodv2,
  txId: string
): Promise<void> {
  const response = await algodclient.status().do();
  let lastround = response["last-round"];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pendingInfo = await algodclient
      .pendingTransactionInformation(txId)
      .do();
    if (
      pendingInfo["confirmed-round"] !== null &&
      pendingInfo["confirmed-round"] > 0
    ) {
      // Got the completed Transaction
      break;
    }
    lastround++;
    await algodclient.statusAfterBlock(lastround).do();
  }
};

async function compileProgram(
  client: Algodv2,
  programSource: string
): Promise<Uint8Array> {
  return new Promise<Uint8Array>(async (resolve, reject) => {
    try {
      const results = await client.compile(programSource).do();
      const compiledBytes = new Uint8Array(
        Buffer.from(results.result, "base64")
      );
      resolve(compiledBytes);
    } catch (error) {
      reject(error);
    }
  });
}

const getClient = (token: string, server: string, port: string): Algodv2 => {
  const client = new algosdk.Algodv2(token, server, port);
  return client;
};

function getIndexerClient(
  token: string,
  server: string,
  port: string
): Indexer {

  const client = new algosdk.Indexer(token, server, port);
  return client;
}

const readGlobalState = async (
  client: IndexerClient,
  index: number
): Promise<Record<string, number | string>> => {
  const applicationInfoResponse = await client.lookupApplications(index).do();
  const globalState =
    applicationInfoResponse["application"]["params"]["global-state"];
  const data: Record<string, number | string> = {};
  for (let n = 0; n < globalState.length; n++) {
    const key = toUtf8(globalState[n].key);
    if (key == "creator") {
      data.creator = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
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
      data.gas_station_address = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
    }
    if (key == "gas_station_id") {
      data.gas_station_id = globalState[n].value.uint;
    }
    if (key == "owner") {
      data.interfaceOwner = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
    }
    if (key == "admin") {
      data.admin = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
    }
    if (key == "oracle") {
      data.oracle = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
    }
    if (key == "contract_state") {
      data.contract_state = globalState[n].value.uint;
    }
    if (key == "interest_rate_admin") {
      data.interestRateAdmin = algosdk.encodeAddress(
        Buffer.from(globalState[n].value.bytes, "base64")
      );
    }
    if (key == "interest_rate") {
      data.interestRate = globalState[n].value.uint;
    }
    if (key == "total_vault_debt") {
      data.totalVaultDebt = globalState[n].value.uint;
    }

  }
  return data;
};

function toUtf8(str: string): string {
  return Buffer.from(str, "base64").toString("ascii");
}
const readBoxValue = async (appID: number, key: string, client: Algodv2) => {
  const boxName = algosdk.decodeAddress(key).publicKey;
  const boxValue = await client.getApplicationBoxByName(appID, boxName).do();
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
  const decodedBoxValue: ABIValue[] = tupleCodec.decode(boxValue.value) as ABIValue[];
  return {
    debt: Number(decodedBoxValue[0]),
    lpt: Number(decodedBoxValue[1]),
    lait: Number(decodedBoxValue[2]),
    interface_app_id: Number(decodedBoxValue[3]),
    escrow_id: Number(decodedBoxValue[4]),
    escrow_address: decodedBoxValue[5] as string,
    interface_address: decodedBoxValue[6] as string,
  };
};


 const getLpCollateralValue =  (
  lp: number,
  collataralAsset: number,
  debtAsset: number,
  lpAppState: LPAPP,
  globalState: ZapGlobalState
): {
  totalValue: number;
  primaryAssetValue: number;
  debtAssetVal: number;
  collateralAssetVal: number
} => {
  const { debtAssetVal, collateralAssetVal } =  getLpPrice(
    lp,
    collataralAsset,
    debtAsset,
    lpAppState
  );
  const primaryAssetValue =  collateralValue(
    collateralAssetVal,
    globalState
  );
  return {
    primaryAssetValue,
    debtAssetVal,
    collateralAssetVal,
    totalValue: primaryAssetValue + debtAssetVal,
  };
};


export const getLpPrice = (
  lpTokensToPay: number,
  collataralAsset: number,
  debtAsset: number,
  lpAppState: LPAPP
): { debtAssetVal: number; collateralAssetVal: number } => {
  const { totalLiquidity, totalPrimary, totalSecondary } = lpAppState;
  const primaryAssetVal = Math.floor(
    (lpTokensToPay * (totalPrimary as number)) / (totalLiquidity as number)
  );

  const secondaryAssetVal = Math.floor(
    (lpTokensToPay * (totalSecondary as number)) / (totalLiquidity as number)
  );

  const collateralAssetVal =
    collataralAsset > debtAsset ? secondaryAssetVal : primaryAssetVal;
  const debtAssetVal =
    collataralAsset > debtAsset ? primaryAssetVal : secondaryAssetVal;

  return { debtAssetVal, collateralAssetVal };
};

export const collateralValue =  (
  collateral: number,
  globalState: ZapGlobalState
): number => {
  return (
    (collateral * (globalState.collateralAssetPrice as number)) /
    (globalState.collateralAssetDecimals as number)
  );
};

export const collateralRatio = (
  collateralValue: number,
  debt: number,
): number => {
  return (collateralValue) / debt;
};

const getEquivalentDebt = (
  collateralAmount: number,
  collateralAsset: number,
  debtAsset: number,
  lpAppState: LPAPP
) => {
  const { totalPrimary, totalSecondary } = lpAppState;

  const debt =
    collateralAsset > debtAsset
      ? Math.floor(
          (collateralAmount * (totalPrimary as number)) /
            (totalSecondary as number)
        )
      : Math.floor(
          (collateralAmount * (totalSecondary as number)) /
            (totalPrimary as number)
        );
  return debt;
};

const getEquivalentLp = (
  collateral: number,
  debt: number,
  collateralAsset: number,
  debtAsset: number,
  lpAppState: LPAPP
): number => {
  const { totalLiquidity, totalPrimary, totalSecondary } = lpAppState;

  const addedPrimary = collateralAsset > debtAsset ? debt : collateral;
  const addedSecondary = collateralAsset > debtAsset ? collateral : debt;

  const ltA = Math.floor(
    (addedPrimary * (totalLiquidity as number)) / (totalPrimary as number)
  );
  const ltB = Math.floor(
    (addedSecondary * (totalLiquidity as number)) / (totalSecondary as number)
  );
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
const fetchAllVaults = async (
  appIndex: number,
  nextToken: string | undefined,
  indexer: Indexer,
  algod: Algodv2
): Promise<(UserVaultType)[]> => {
  if (!nextToken) {
    return [];
  }
  const allBoxes = await indexer
    .searchForApplicationBoxes(appIndex)
    .nextToken(nextToken === "begin" ? "" : nextToken)
    .do();
  const allVaults: (UserVaultType | undefined)[] = await Promise.all(
    allBoxes.boxes.map(async (box) => {
      try {
        const vault = await readBoxValue(
          appIndex,
          algosdk.encodeAddress(box.name),
          algod
        );
        return {
          collateral: vault.lpt,
          vaultDebt: vault.debt,
          lastAccruedInterestTime: vault.lait,
          escrowId: vault.escrow_id,
          escrowAddress: vault.escrow_address as string,
          interfaceId: vault.interface_app_id,
          interfaceAddress: vault.interface_address as string,
          owner: algosdk.encodeAddress(box.name),
        };
      } catch (error) {
        return undefined;
      }
    })
  );
  const updatedListOfVaults = allVaults.concat(
    await fetchAllVaults(appIndex, allBoxes.nextToken, indexer, algod)
  );
  const allDefinedVaults: UserVaultType[] = [];
   updatedListOfVaults.forEach((el) => {
    if(el != undefined){
      allDefinedVaults.push(el)
    }});

  return allDefinedVaults;
};


export {
  waitForConfirmation,
  compileProgram,
  getClient,
  getIndexerClient,
  readGlobalState,
  toUtf8,
  readBoxValue,
  getEquivalentDebt,
  getEquivalentLp,
  fetchAllVaults,
  getLpCollateralValue
};
