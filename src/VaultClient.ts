import { PeraWalletConnect } from "@perawallet/connect";
import Vault from "Vault";
import algosdk, { Address, AtomicTransactionComposer, Indexer } from "algosdk";
import {STABLE_COIN_ASSET, collateralRatio, contractJson, fetchAllVaults, getClient, getEquivalentDebt, getEquivalentLp, getIndexerClient, getLpCollateralValue, readBoxValue,
   readGlobalState, waitForConfirmation} from './utils'

import { SuggestedParams } from "algosdk/dist/types/types/transactions/base";
import { Algodv2 } from "algosdk";
import { LPAPP, UserState, UserVaultType, ZapGlobalState } from "interface";
import pactsdk from "@pactfi/pactsdk";


const textEncoder = new TextEncoder();


interface Signer{
  networkAccount: string,
  signTxns: (a: Uint8Array[])=> Promise<Uint8Array[]>
}


class VaultClient {
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
  }) {
    let account;
    this.client = getClient(
      params.algodToken,
      params.algodServer,
      params.algodPort
    );
    this.indexer = getIndexerClient(
      params.indexerToken,
      params.indexerServer,
      params.indexerPort
    );
    this.mnemonic = params.mnemonic;
    this.connector = params.connector;
    if (params.mnemonic) {
      account = algosdk.mnemonicToSecretKey(params.mnemonic);
      this.address = account.addr;
    } else if (params.connector) {
      this.address = this.connector!.networkAccount;
    } else {
      throw Error("must specify one of mnemonic or connector");
    }
  }

  async create(args: { vault: Vault; collateral: bigint }): Promise<string> {
    const { vault, collateral } = args;
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = vault;
    const params: SuggestedParams = await this.client
      .getTransactionParams()
      .do();
    const from = this.address;
    const boxInt64Type = new algosdk.ABIUintType(64);
    const boxSize = boxInt64Type.byteLen() * 5;
    const MINIMUM_BALANCE_PER_ACCOUNT = 100_000;
    const balanceForBoxCreated =
      2500 +
      400 * (new algosdk.ABIAddressType().byteLen() * 2 + boxSize + 32) +
      // minimum balance for creating another app
      MINIMUM_BALANCE_PER_ACCOUNT +
      //MINIMUM BALANCE BY gLOBAL STORAGE OF each uint in other app
      28500 * 3 +
      //MINIMUM BALANCE BY gLOBAL STORAGE OF each bytes in other app
      50000 * 4;
    //
    const globalState = await readGlobalState(this.indexer, appIndex);
    const appArgs = [
      textEncoder.encode(Buffer.from("create_vault").toString()),
      algosdk.encodeUint64(collateral),
    ];

    const assetIndex = collateralAsset;
    const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
    const appAddress = algosdk.getApplicationAddress(appIndex);

    const foreignApps = [lpApp, globalState.gas_station_id as number, farmApp];
    const foreignAccounts = undefined;
    const strType = algosdk.ABIAddressType.from("address");

    const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      appAddress,
      undefined,
      undefined,
      collateral,
      undefined,
      assetIndex,
      params
    );

    const boxFeePaymentTxn = algosdk.makePaymentTxnWithSuggestedParams(
      from,
      appAddress,
      balanceForBoxCreated + 1000000,
      undefined,
      undefined,
      params
    );

    params.fee = 1000;

    const appCallTxn = algosdk.makeApplicationNoOpTxn(
      from,
      params,
      appIndex,
      appArgs,
      foreignAccounts,
      foreignApps,
      foreignAssetsArray,
      undefined,
      undefined,
      undefined,
      [
        {
          appIndex,
          name: strType.encode(creatorAddress),
        },
        {
          appIndex,
          name: strType.encode(from),
        },
      ]
    );

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
    return await this.signAndSend(atc);
  }

  async signAndSend(atc: AtomicTransactionComposer): Promise<string> {
    const txns = atc.buildGroup().map((el) => el.txn);
    if (this.mnemonic) {
      let account = algosdk.mnemonicToSecretKey(this.mnemonic);
      //use mnemonic to sighnelse
      const signedTxns = txns.map((el) => el.signTxn(account.sk));
      const sentTX = await this.client.sendRawTransaction(signedTxns).do();
      await waitForConfirmation(this.client, sentTX.txId);
      const ptx = await this.client
        .pendingTransactionInformation(sentTX.txId)
        .do();
      return sentTX.txId;
    } else {
      // use connector to sign
      const encodedTxns = txns.map((el) =>
        algosdk.encodeUnsignedTransaction(el)
      );
      const signedTxns = await this.connector!.signTxns(encodedTxns);
      const sentTX = await this.client.sendRawTransaction(signedTxns).do();
      await waitForConfirmation(this.client, sentTX.txId);
      const ptx = await this.client
        .pendingTransactionInformation(sentTX.txId)
        .do();
      return sentTX.txId;
    }
  }
  async deposit(args: {
    vault: Vault;
    collateral: bigint;
    userState?: UserState;
  }): Promise<String> {
    const { vault, collateral } = args;
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = vault;
    const params: SuggestedParams = await this.client
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

    const boxValue = await readBoxValue(appIndex, from, this.client);
    const foreignApps = [lpApp, boxValue.escrow_id];
    const foreignAccounts = [appAddress, boxValue.escrow_address as string];
    const strType = algosdk.ABIAddressType.from("address");
    let userState;
    if (args.userState) {
      userState = args.userState;
    } else {
      userState = await this.getUserState({ address: this.address, vault });
    }

    const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      appAddress,
      undefined,
      undefined,
      collateral,
      undefined,
      assetIndex,
      params
    );

    const appCallTxn = algosdk.makeApplicationNoOpTxn(
      from,
      { ...params, fee: 1000 },
      appIndex,
      appArgs,
      foreignAccounts,
      foreignApps,
      foreignAssetsArray,
      undefined,
      undefined,
      undefined,
      [
        {
          appIndex,
          name: strType.encode(this.address),
        },
      ]
    );

    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
      txn: assetSendTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    atc.addTransaction({
      txn: appCallTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    const depositTxn = await this.signAndSend(atc);
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
      suggestedParams: { ...params, fee: 1000 },
      appAccounts: [userState.escrowAddress, userState.interfaceAddress],
      appForeignApps: [userState.escrowId],
      appForeignAssets: [liquidityToken],
    });
    await this.signAndSend(updateStateAtc);
    return depositTxn;
  }

  async withdraw(args: {
    vault: Vault;
    lpTokens: bigint;
    debt: bigint;
  }): Promise<string> {
    const { vault, lpTokens, debt } = args;
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
      network,
    } = vault;
    const params: SuggestedParams = await this.client
      .getTransactionParams()
      .do();
    const appArgs = [
      textEncoder.encode(Buffer.from("withdraw_collateral").toString()),
      algosdk.encodeUint64(lpTokens),
    ];

    const from = this.address;
    const accountAssets = await this.indexer.lookupAccountAssets(from).do();
    let assetOptedIn = accountAssets.assets.filter(
      (el: { ["asset-id"]: number }) =>
        el["asset-id"] == STABLE_COIN_ASSET[network as "TestNet" | "LocalHost"]
    );
    if (assetOptedIn.length == 0) {
      await this.optIntoToken(
        STABLE_COIN_ASSET[network as "TestNet" | "LocalHost"]
      );
    }
    assetOptedIn = accountAssets.assets.filter(
      (el: { ["asset-id"]: number }) => el["asset-id"] == liquidityToken
    );
    if (assetOptedIn.length == 0) {
      await this.optIntoToken(liquidityToken);
    }
    const foreignAssetsArray = [collateralAsset, debtAsset, liquidityToken];
    const appAddress = algosdk.getApplicationAddress(appIndex);
    const boxValue = await readBoxValue(appIndex, from, this.client);
    const foreignApps = [
      lpApp,
      boxValue.interface_app_id as number,
      boxValue.escrow_id as number,
      farmApp,
    ];
    const foreignAccounts = undefined;
    const strType = algosdk.ABIAddressType.from("address");
    const appCallTxn = algosdk.makeApplicationNoOpTxn(
      from,
      { ...params, fee: 1000 },
      appIndex,
      appArgs,
      foreignAccounts,
      foreignApps,
      foreignAssetsArray,
      undefined,
      undefined,
      undefined,
      [
        {
          appIndex,
          name: strType.encode(this.address),
        },
      ]
    );
    const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      appAddress,
      undefined,
      undefined,
      debt,
      undefined,
      debtAsset,
      params
    );
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
      txn: appCallTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    atc.addTransaction({
      txn: assetSendTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });

    return await this.signAndSend(atc);
  }

  async liquidate(args: {
    vault: Vault;
    debt: bigint;
    addressToLiq: string;
    isLiquidateVaultInShutDown: boolean;
  }): Promise<string> {
    const { vault, debt, addressToLiq, isLiquidateVaultInShutDown } = args;
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = vault;
    const params: SuggestedParams = await this.client
      .getTransactionParams()
      .do();
    const appArgs = [
      isLiquidateVaultInShutDown
        ? textEncoder.encode(
            Buffer.from("liquidate_during_shutdown").toString()
          )
        : textEncoder.encode(Buffer.from("liquidate_vault").toString()),
      algosdk.decodeAddress(addressToLiq).publicKey,
      //TODO: avoid repetition
      algosdk.encodeUint64(debt),
    ];
    const from = this.address;
    const boxValue = await readBoxValue(appIndex, addressToLiq, this.client);
    const foreignAssetsArray = [debtAsset, liquidityToken];
    const appAddress = algosdk.getApplicationAddress(appIndex);
    const foreignApps = [
      lpApp,
      boxValue.interface_app_id as number,
      boxValue.escrow_id as number,
      farmApp,
    ];
    const foreignAccounts = [addressToLiq];
    const strType = algosdk.ABIAddressType.from("address");
    const appCallTxn = algosdk.makeApplicationNoOpTxn(
      from,
      { ...params, fee: 1000 },
      appIndex,
      appArgs,
      foreignAccounts,
      foreignApps,
      foreignAssetsArray,
      undefined,
      undefined,
      undefined,
      [
        {
          appIndex,
          name: strType.encode(addressToLiq),
        },
      ]
    );
    const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      appAddress,
      undefined,
      undefined,
      debt,
      undefined,
      debtAsset,
      params
    );
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
      txn: appCallTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    atc.addTransaction({
      txn: assetSendTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    return await this.signAndSend(atc);
  }

  async return(args: { debt: number; vault: Vault }): Promise<string> {
    const { debt } = args;
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = args.vault;
    const textEncoder = new TextEncoder();
    const params: SuggestedParams = await this.client
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
    const appCallTxn = algosdk.makeApplicationNoOpTxn(
      from,
      { ...params, fee: 1000 },
      appIndex,
      appArgs,
      foreignAccounts,
      foreignApps,
      foreignAssetsArray,
      undefined,
      undefined,
      undefined,
      [
        {
          appIndex,
          name: strType.encode(from),
        },
      ]
    );
    const assetSendTxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      appAddress,
      undefined,
      undefined,
      debt,
      undefined,
      debtAsset,
      params
    );
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
      txn: appCallTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });
    atc.addTransaction({
      txn: assetSendTxn,
      signer: algosdk.makeEmptyTransactionSigner(),
    });

    return await this.signAndSend(atc);
  }

  async optIntoToken(token: number): Promise<string> {
    const from = this.address;
    const params = await this.client.getTransactionParams().do();
    const assetSendTxn1 = algosdk.makeAssetTransferTxnWithSuggestedParams(
      from,
      from,
      undefined,
      undefined,
      0,
      undefined,
      token,
      params
    );
    const atc = new algosdk.AtomicTransactionComposer();
    atc.addTransaction({
      txn: assetSendTxn1,
      signer: algosdk.makeEmptyTransactionSigner(),
    });

    return await this.signAndSend(atc);
  }

  async getGlobalState(params: { vault: Vault }): Promise<any> {
    const { appIndex } = params.vault;
    const globalState = await readGlobalState(this.indexer, appIndex);
    return {
      ...globalState,
    };
  }

  async getUserState(params: {
    address: string;
    vault: Vault;
  }): Promise<UserState> {
    const { appIndex, farmApp } = params.vault;

    const farm = await pactsdk.fetchFarmById(this.client, farmApp);
    const userState = await readBoxValue(appIndex, params.address, this.client);
    const userFarmState = await farm.fetchUserState(
      userState.interface_address as string
    );
    return {
      collateral: userState.lpt,
      vaultDebt: userState.debt,
      lastAccruedInterestTime: userState.lait,
      escrowId: userState.escrow_id,
      escrowAddress: userState.escrow_address as string,
      interfaceId: userState.interface_app_id,
      interfaceAddress: userState.interface_address as string,
      userFarmState,
    };
  }

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
  } {
    const { userState, lpAppState, zapGlobalState, vault } = params;
    const { collateralAsset, debtAsset } = vault;
    const { totalValue, debtAssetVal, collateralAssetVal } =
      getLpCollateralValue(
        userState.collateral,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
    const cR = collateralRatio(totalValue, userState.vaultDebt);
    return {
      collateralRatio: cR,
      collateralValue: totalValue,
      liquidationPrice: 100,
      debtAssetVal,
      collateralAssetVal,
    };
  }

  async getAllGlobalData(params: { vault: Vault }): Promise<{
    zapGlobalState: ZapGlobalState;
    lpAppState: LPAPP;
    farmState: pactsdk.FarmState;
  }> {
    const { vault } = params;
    const { lpApp, farmApp } = params.vault;
    let zapGlobalState = await this.getGlobalState({ vault });
    zapGlobalState = {
      totalVaultDebt: zapGlobalState.totalVaultDebt as number,
      interestRateAdmin: zapGlobalState.interestRateAdmin as string,
      minimumDebt: zapGlobalState.minimumDebt as number,
      collateralAssetPrice: zapGlobalState.whitelisted_asset_price as number,
      oracle: zapGlobalState.oracle as string,
      gasStationId: zapGlobalState.gas_station_id as number,
      accruedInterest: zapGlobalState.accrued_interest as number,
      admin: zapGlobalState.admin as string,
      interestRate: zapGlobalState.interestRate as number,
      minimumCR: zapGlobalState.scaled_min_cr as number,
      collateralAssetDecimals:
        zapGlobalState.whitelisted_asset_microunits as number,
      gasStationAddress: zapGlobalState.gas_station_address as string,
      contractState: zapGlobalState.contract_state as number,
    };
    let liqpAppState = await readGlobalState(this.indexer, lpApp);
    let lpAppState = {
      totalPrimary: liqpAppState.totalPrimary as number,
      totalSecondary: liqpAppState.totalSecondary as number,
      totalLiquidity: liqpAppState.totalLiquidity as number,
    };
    const farm = await pactsdk.fetchFarmById(this.client, farmApp);
    await farm.fetchAllAssets();
    let farmState = farm.state;
    return { zapGlobalState, lpAppState, farmState };
  }

  //TODO: fix liquidation price
  async getVaultData(params: { vault: Vault; address: string }): Promise<{
    collateralRatio: number;
    collateralValue: number;
    liquidationPrice: number;
    debtAssetVal: number;
    collateralAssetVal: number;
  }> {
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = params.vault;
    const userState = await this.getUserState(params);
    const { lpAppState, zapGlobalState } = await this.getAllGlobalData({
      vault: params.vault,
    });
    const { totalValue, debtAssetVal, collateralAssetVal } =
      getLpCollateralValue(
        userState.collateral,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
    const cR = collateralRatio(totalValue, userState.vaultDebt);
    return {
      collateralRatio: cR,
      collateralValue: totalValue,
      liquidationPrice: 100,
      debtAssetVal,
      collateralAssetVal,
    };
  }
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
  } {
    if (params.collateral == 0) {
      return { collateralRatio: 0, totalValue: 0, debt: 0, lp: 0 };
    }
    const { collateralAsset, debtAsset, lpApp } = params.vault;
    let cR = 0;
    let totalValue = 0;
    let lp = 0;

    const { lpAppState, zapGlobalState } = params;
    const debt = getEquivalentDebt(
      params.collateral,
      collateralAsset,
      debtAsset,
      lpAppState
    );

    if (params.vaultDebt) {
      lp = getEquivalentLp(
        params.collateral,
        params.vaultDebt,
        collateralAsset,
        debtAsset,
        lpAppState
      );
      const { totalValue: totalLpColateralValue } = getLpCollateralValue(
        lp,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
      totalValue = totalLpColateralValue;
      cR = collateralRatio(totalValue, params.vaultDebt);
    } else {
      lp = getEquivalentLp(
        params.collateral,
        debt,
        collateralAsset,
        debtAsset,
        lpAppState
      );
      const { totalValue: totalLpColateralValue } = getLpCollateralValue(
        lp,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
      totalValue = totalLpColateralValue;
      cR = collateralRatio(totalValue, debt);
    }

    return { collateralRatio: cR, totalValue, debt, lp };
  }

  //TODO: fix liquidation price
  async getAssumedVaultData(params: {
    vault: Vault;
    vaultDebt?: number;
    collateral: number;
  }): Promise<{
    collateralRatio: number;
    totalValue: number;
    debt: number;
    lp: number;
  }> {
    if (params.collateral == 0) {
      return { collateralRatio: 0, totalValue: 0, debt: 0, lp: 0 };
    }
    const {
      appIndex,
      collateralAsset,
      debtAsset,
      liquidityToken,
      farmApp,
      lpApp,
      creatorAddress,
    } = params.vault;

    let cR = 0;
    let totalValue = 0;
    let lp = 0;

    const { lpAppState, zapGlobalState } = await this.getAllGlobalData({
      vault: params.vault,
    });
    const debt = await getEquivalentDebt(
      params.collateral,
      collateralAsset,
      debtAsset,
      lpAppState
    );

    if (params.vaultDebt) {
      lp = getEquivalentLp(
        params.collateral,
        params.vaultDebt,
        collateralAsset,
        debtAsset,
        lpAppState
      );
      const { totalValue: totalLpColateralValue } = getLpCollateralValue(
        lp,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
      totalValue = totalLpColateralValue;
      cR = collateralRatio(totalValue, params.vaultDebt);
    } else {
      lp = getEquivalentLp(
        params.collateral,
        debt,
        collateralAsset,
        debtAsset,
        lpAppState
      );
      const { totalValue: totalLpColateralValue } = getLpCollateralValue(
        lp,
        collateralAsset,
        debtAsset,
        lpAppState,
        zapGlobalState
      );
      totalValue = totalLpColateralValue;
      cR = collateralRatio(totalValue, debt);
    }

    return { collateralRatio: cR, totalValue, debt, lp };
  }

  getEquivalentDebtForCollateral(params: {
    vault: Vault;
    collateral: number;
    lpAppState: LPAPP;
  }): number {
    const { lpAppState } = params;
    const { collateralAsset, debtAsset } = params.vault;
    const debt = getEquivalentDebt(
      params.collateral,
      collateralAsset,
      debtAsset,
      lpAppState
    );
    return debt;
  }

  async getAllVaults(params: {
    vault: Vault;
  }): Promise<(UserVaultType)[]> {
    const { appIndex} = params.vault;
    const allGlobalData = await this.getAllGlobalData({vault: params.vault});
    const allVaults =  await fetchAllVaults(appIndex, "begin", this.indexer, this.client);

    const adddedLpVaultState = allVaults.map((userVault)=>{
      const otherInfo = this.localVaultDataCalc({lpAppState: allGlobalData.lpAppState, zapGlobalState: allGlobalData.zapGlobalState, userState: userVault, vault: params.vault})
          return{
        ...userVault,
        ...otherInfo
      };
    })
    return adddedLpVaultState;
  }

  getUserAddress() {
    if (this.mnemonic) {
      //use mnemonic address
    } else {
      //use pera connect address
    }
  }
}

export default VaultClient;