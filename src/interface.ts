import pactsdk from "@pactfi/pactsdk";

export interface LPAPP{
    totalPrimary: number;
    totalSecondary: number;
    totalLiquidity: number;
}
export interface ZapGlobalState {
  totalVaultDebt: number;
  interestRateAdmin: string;
  minimumDebt: number;
  collateralAssetPrice: number;
  oracle: string;
  gasStationId: number;
  accruedInterest: number;
  admin: string;
  interestRate: number;
  minimumCR: number;
  collateralAssetDecimals: number;
  gasStationAddress: string;
  contractState: number;
}

export interface UserState {
  collateral: number;
  vaultDebt: number;
  lastAccruedInterestTime: number;
  escrowId: number;
  escrowAddress: string;
  interfaceId: number;
  interfaceAddress: string;
  userFarmState: pactsdk.FarmUserState | null;
}
export type UserVaultType = {
  collateral: number;
  vaultDebt: number;
  lastAccruedInterestTime: number;
  escrowId: number;
  escrowAddress: string;
  interfaceId: number;
  interfaceAddress: string;
};