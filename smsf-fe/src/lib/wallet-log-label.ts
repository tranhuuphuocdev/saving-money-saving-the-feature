export function getWalletLogLabel(action: string): string {
    if (action === 'credit') return '+ Thu vào';
    if (action === 'debit') return '- Chi ra';
    if (action === 'create') return 'Khởi tạo ví';
    if (action === 'initial-setup') return 'Thiết lập ban đầu';
    if (action === 'transfer-in') return '+ Chuyển vào';
    if (action === 'transfer-out') return '- Chuyển ra';
    if (action === 'update-apply') return 'Cập nhật giao dịch';
    if (action === 'update-revert') return 'Hoàn tác cập nhật';
    if (action === 'delete') return 'Xóa giao dịch';
    if (action === 'balance-set') return 'Điều chỉnh số dư';
    if (action === 'wallet-unavailable') return 'Ví không khả dụng';

    return action;
}

export function isWalletLogCredit(action: string): boolean {
    return action === 'credit' || action === 'transfer-in' || action === 'initial-setup' || action === 'create';
}
