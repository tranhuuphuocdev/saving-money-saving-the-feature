import { IWalletItem } from '@/types/calendar';

export function sortWalletsForSelection(wallets: IWalletItem[]): IWalletItem[] {
    return [
        ...wallets.filter((wallet) => wallet.type !== 'shared-fund'),
        ...wallets.filter((wallet) => wallet.type === 'shared-fund'),
    ];
}

export function getActiveSortedWallets(wallets: IWalletItem[]): IWalletItem[] {
    return sortWalletsForSelection(wallets.filter((wallet) => wallet.isActive !== false));
}