import runInitBudgetES from './budget-template';
import runInitCategoryES from './category-template';
import runInitTransactionES from './transaction-template';
import runInitUserES from './user-template';
import runInitWalletES from './wallet-template';

export {
    runInitBudgetES,
    runInitCategoryES,
    runInitTransactionES,
    runInitUserES,
    runInitWalletES,
};

export default async function runInitAllEsTemplates(isUpdateCurrentIndex = true) {
    // await runInitUserES(isUpdateCurrentIndex);
    await runInitCategoryES(isUpdateCurrentIndex);
    // await runInitTransactionES(isUpdateCurrentIndex);
    // await runInitBudgetES(isUpdateCurrentIndex);
    // await runInitWalletES(isUpdateCurrentIndex);
}

runInitAllEsTemplates();
