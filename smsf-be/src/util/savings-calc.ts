/**
 * savings-calc.ts
 * Tất cả công thức tính tỷ lệ tiết kiệm được tập trung tại đây.
 */

export interface ISavingsRateInput {
    /** Tổng thu nhập trong tháng (tính đến thời điểm hiện tại) */
    totalIncome: number;
    /** Tổng chi tiêu trong tháng (tính đến thời điểm hiện tại) */
    totalExpense: number;
    /** Số tiền user muốn tiết kiệm trong tháng */
    savingsGoal: number;
    /** Tháng mục tiêu */
    targetMonth: number;
    /** Năm mục tiêu */
    targetYear: number;
    /** Ngày tham chiếu (mặc định là Date.now()) */
    referenceDate?: Date;
}

export interface ISavingsRateResult {
    /** Tổng số ngày trong tháng */
    daysInMonth: number;
    /** Số ngày đã trôi qua kể từ đầu tháng (tính cả hôm nay) */
    daysPassed: number;
    /** Số ngày còn lại đến cuối tháng */
    daysRemaining: number;
    /** Số tiền user muốn tiết kiệm */
    savingsGoal: number;
    /** Tổng thu nhập trong tháng */
    totalIncome: number;
    /** Tổng chi tiêu trong tháng */
    totalExpense: number;
    /** Số tiền trung bình mỗi ngày còn có thể chi để vẫn đạt mục tiêu tiết kiệm */
    avgDailyAllowance: number;
    /**
     * Trung bình chi tiêu thực tế mỗi ngày (tính đến hôm nay)
     * = totalExpense / daysPassed
     */
    avgDailyExpense: number;
    /**
     * Số tiền tiết kiệm dự phóng nếu duy trì nhịp chi tiêu hiện tại đến cuối tháng
     * = totalIncome - (avgDailyExpense * daysInMonth)
     */
    projectedSaving: number;
    /**
     * Tỷ lệ % khả năng giữ được 100% mục tiêu tiết kiệm (0 – 100)
     * Nếu savingsGoal = 0: dùng tỷ lệ thu nhập còn lại
     */
    savingsRate: number;
}

/**
 * Tính số ngày trong tháng của một thời điểm nhất định.
 */
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function compareMonthYear(
    leftMonth: number,
    leftYear: number,
    rightMonth: number,
    rightYear: number,
): number {
    const left = leftYear * 100 + leftMonth;
    const right = rightYear * 100 + rightMonth;

    if (left === right) {
        return 0;
    }

    return left > right ? 1 : -1;
}

/**
 * Tính tỷ lệ tiết kiệm từ các dữ liệu đầu vào.
 */
export function computeSavingsRate(input: ISavingsRateInput): ISavingsRateResult {
    const ref = input.referenceDate ?? new Date();
    const year = input.targetYear;
    const month = input.targetMonth;

    const daysInMonth = getDaysInMonth(year, month);
    const monthComparison = compareMonthYear(
        month,
        year,
        ref.getMonth() + 1,
        ref.getFullYear(),
    );

    const daysPassed =
        monthComparison < 0
            ? daysInMonth
            : monthComparison > 0
              ? 0
              : Math.max(1, ref.getDate());

    const daysRemaining =
        monthComparison < 0
            ? 0
            : monthComparison > 0
              ? daysInMonth
              : Math.max(0, daysInMonth - ref.getDate());

    const { totalIncome, totalExpense, savingsGoal } = input;

    // Hạn mức chi tiêu còn lại trung bình mỗi ngày từ bây giờ đến cuối tháng
    const remainingSpendable = totalIncome - totalExpense - savingsGoal;
    const avgDailyAllowance =
        daysRemaining > 0 ? remainingSpendable / daysRemaining : remainingSpendable;

    // Chi tiêu trung bình thực tế mỗi ngày
    const avgDailyExpense = daysPassed > 0 ? totalExpense / daysPassed : 0;

    // Dự phóng tổng chi tiêu đến cuối tháng nếu giữ nguyên nhịp hiện tại
    const projectedTotalExpense = totalExpense + avgDailyExpense * daysRemaining;

    // Số tiền tiết kiệm dự phóng
    const projectedSaving = totalIncome - projectedTotalExpense;

    // Tỷ lệ tiết kiệm: 100% = giữ trọn savingsGoal
    let savingsRate: number;
    if (savingsGoal > 0) {
        savingsRate = Math.min(100, Math.max(0, (projectedSaving / savingsGoal) * 100));
    } else if (totalIncome > 0) {
        // Fallback: tỷ lệ còn lại / thu nhập
        savingsRate = Math.min(100, Math.max(0, (projectedSaving / totalIncome) * 100));
    } else {
        savingsRate = 0;
    }

    return {
        daysInMonth,
        daysPassed,
        daysRemaining,
        savingsGoal,
        totalIncome,
        totalExpense,
        avgDailyAllowance: Math.round(avgDailyAllowance),
        avgDailyExpense: Math.round(avgDailyExpense),
        projectedSaving: Math.round(projectedSaving),
        savingsRate: Math.round(savingsRate * 10) / 10,
    };
}
