const WALLET_TYPE_LABELS: Record<string, string> = {
    cash: 'Tiền mặt',
    bank: 'Ngân hàng',
    momo: 'Momo',
    'shared-fund': 'Quỹ chung',
    custom: 'Ví khác',
};

export function getWalletTypeLabel(type?: string): string {
    if (!type) {
        return 'Ví';
    }

    return WALLET_TYPE_LABELS[type] || type;
}