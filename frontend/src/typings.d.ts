declare module '../../utils/ethereum.js' {
    export function connectWallet(): Promise<string>;
    export function sendTip(message: string, amount: string): Promise<any>;
    export function getContractBalance(): Promise<string>;
    export function getTotalTips(): Promise<number>;
    export function getContractOwner(): Promise<string>;
    export function withdrawFunds(): Promise<any>;
    export function isMetaMaskInstalled(): boolean;
    export function checkNetwork(): Promise<boolean>;
    export function switchToSepolia(): Promise<boolean>;
    export function getContract(withSigner?: boolean): Promise<any>;
  }
  