// Transactions page functionality

let allTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const userId = getUserId();
    await loadTransactions(userId);
    setupEventListeners();
});

async function loadTransactions(userId) {
    const tbody = document.getElementById('transactionsTable');
    
    try {
        const response = await TransactionAPI.getUserTransactions(userId);
        allTransactions = response.data || [];
        
        if (allTransactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                        <p class="text-muted">No transactions recorded yet</p>
                    </td>
                </tr>
            `;
            updateStats([]);
            return;
        }

        displayTransactions(allTransactions);
        updateStats(allTransactions);
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Failed to load transactions: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

function displayTransactions(transactions) {
    const tbody = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No transactions found matching the filter criteria
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(transaction => {
        const isCredit = transaction.transactionType === 'TOP_UP' || transaction.transactionType === 'REFUND';
        const amountClass = isCredit ? 'text-success' : 'text-danger';
        const amountPrefix = isCredit ? '+' : '-';
        
        return `
            <tr>
                <td><small class="text-muted">#${transaction.id}</small></td>
                <td>${formatDateTime(transaction.transactionDate)}</td>
                <td>
                    <div class="transaction-icon ${transaction.transactionType.toLowerCase().replace('_', '-')}">
                        <i class="fas fa-${getTransactionIcon(transaction.transactionType)}"></i>
                    </div>
                </td>
                <td>
                    <strong>${formatTransactionType(transaction.transactionType)}</strong>
                    <br><small class="text-muted">${transaction.description || '-'}</small>
                </td>
                <td class="${amountClass} fw-bold">
                    ${amountPrefix}${formatCurrency(transaction.amount)}
                </td>
                <td>${formatCurrency(transaction.balanceAfter)}</td>
                <td>${getStatusBadge(transaction.status)}</td>
            </tr>
        `;
    }).join('');
}

function getTransactionIcon(type) {
    const icons = {
        'TOP_UP': 'arrow-down',
        'PAYMENT': 'arrow-up',
        'REFUND': 'undo',
        'ADJUSTMENT': 'exchange-alt'
    };
    return icons[type] || 'circle';
}

function formatTransactionType(type) {
    return type.replace('_', ' ').toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function updateStats(transactions) {
    // Calculate top-ups
    const topUps = transactions
        .filter(t => t.transactionType === 'TOP_UP' || t.transactionType === 'REFUND')
        .reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('totalTopUps').textContent = formatCurrency(topUps);
    
    // Calculate payments
    const payments = transactions
        .filter(t => t.transactionType === 'PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('totalPayments').textContent = formatCurrency(payments);
    
    // Total count
    document.getElementById('transactionCount').textContent = transactions.length;
}

function setupEventListeners() {
    const applyFilterBtn = document.getElementById('applyFilter');
    
    applyFilterBtn.addEventListener('click', () => {
        applyFilters();
    });
}

function applyFilters() {
    const type = document.getElementById('filterType').value;
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    let filtered = [...allTransactions];
    
    // Filter by type
    if (type) {
        filtered = filtered.filter(t => t.transactionType === type);
    }
    
    // Filter by date range
    if (fromDate) {
        const from = new Date(fromDate);
        filtered = filtered.filter(t => new Date(t.transactionDate) >= from);
    }
    
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(t => new Date(t.transactionDate) <= to);
    }
    
    displayTransactions(filtered);
    updateStats(filtered);
}
