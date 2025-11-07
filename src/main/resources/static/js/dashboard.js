// Dashboard functionality

let stations = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const userId = getUserId();
    await loadDashboardData(userId);
    await loadStations();
    await checkActiveJourney(userId);
    setupEventListeners();
});

async function loadDashboardData(userId) {
    try {
        // Load user profile
        const userResponse = await UserAPI.getProfile(userId);
        if (userResponse.data) {
            updateBalanceDisplay(userResponse.data.balance);
        }

        // Load recent journeys
        await loadRecentJourneys(userId);

        // Load monthly stats
        await loadMonthlyStats(userId);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateBalanceDisplay(balance) {
    const balanceElement = document.getElementById('currentBalance');
    if (balanceElement) {
        balanceElement.textContent = formatCurrency(balance);
    }
}

async function loadRecentJourneys(userId) {
    const tbody = document.getElementById('recentJourneys');
    
    try {
        const response = await JourneyAPI.getUserJourneys(userId);
        const journeys = response.data || [];
        
        if (journeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No journeys yet</td></tr>';
            return;
        }

        // Show last 5 journeys
        const recentJourneys = journeys.slice(0, 5);
        tbody.innerHTML = recentJourneys.map(journey => `
            <tr>
                <td>${formatDateTime(journey.tapInTime)}</td>
                <td>${journey.entryStation?.name || 'N/A'}</td>
                <td>${journey.exitStation?.name || 'N/A'}</td>
                <td>${getStatusBadge(journey.status)}</td>
                <td>${journey.fare ? formatCurrency(journey.fare) : '-'}</td>
                <td>
                    ${journey.status === 'IN_PROGRESS' ? 
                        `<button class="btn btn-sm btn-danger" onclick="quickTapOut(${journey.id})">
                            <i class="fas fa-sign-out-alt"></i> Tap Out
                        </button>` : 
                        `<button class="btn btn-sm btn-info" onclick="viewJourneyDetails(${journey.id})">
                            <i class="fas fa-eye"></i> View
                        </button>`
                    }
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load journeys</td></tr>';
    }
}

async function loadMonthlyStats(userId) {
    try {
        const response = await JourneyAPI.getUserJourneys(userId);
        const journeys = response.data || [];
        
        // Filter journeys from this month
        const now = new Date();
        const thisMonth = journeys.filter(j => {
            const journeyDate = new Date(j.tapInTime);
            return journeyDate.getMonth() === now.getMonth() && 
                   journeyDate.getFullYear() === now.getFullYear();
        });

        document.getElementById('monthlyJourneys').textContent = thisMonth.length;
        
        const totalSpent = thisMonth.reduce((sum, j) => sum + (j.fare || 0), 0);
        document.getElementById('monthlySpent').textContent = formatCurrency(totalSpent);
    } catch (error) {
        console.error('Error loading monthly stats:', error);
    }
}

async function loadStations() {
    try {
        const response = await StationAPI.getAllStations();
        stations = response.data || [];
        
        // Populate station dropdowns
        populateStationDropdown('tapInStation');
        populateStationDropdown('tapOutStation');
    } catch (error) {
        console.error('Error loading stations:', error);
    }
}

function populateStationDropdown(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;

    select.innerHTML = '<option value="">Select a station...</option>' +
        stations.map(station => 
            `<option value="${station.id}">${station.name} (Zone ${station.zone})</option>`
        ).join('');
}

async function checkActiveJourney(userId) {
    try {
        const activeJourney = await JourneyAPI.getActiveJourney(userId);
        if (activeJourney) {
            const alertDiv = document.getElementById('activeJourneyAlert');
            const infoSpan = document.getElementById('activeJourneyInfo');
            
            infoSpan.textContent = ` You have an active journey from ${activeJourney.entryStation?.name || 'Unknown'}.`;
            alertDiv.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error checking active journey:', error);
    }
}

function setupEventListeners() {
    const userId = getUserId();

    // Top up balance
    document.getElementById('confirmTopUp').addEventListener('click', async () => {
        const selectedAmount = document.querySelector('input[name="amount"]:checked');
        const customAmount = document.getElementById('customAmount').value;
        
        const amount = customAmount || (selectedAmount ? selectedAmount.value : null);
        
        if (!amount || amount <= 0) {
            alert('Please select or enter a valid amount');
            return;
        }

        try {
            await UserAPI.addBalance(userId, amount);
            alert(`Successfully added ${formatCurrency(amount)} to your balance!`);
            
            // Close modal and reload
            bootstrap.Modal.getInstance(document.getElementById('topUpModal')).hide();
            location.reload();
        } catch (error) {
            alert('Failed to top up balance: ' + error.message);
        }
    });

    // Tap In
    document.getElementById('confirmTapIn').addEventListener('click', async () => {
        const stationId = document.getElementById('tapInStation').value;
        const cardId = document.getElementById('tapInCard').value;
        
        if (!stationId || !cardId) {
            alert('Please select both station and card');
            return;
        }

        try {
            await JourneyAPI.tapIn({
                userId: parseInt(userId),
                cardId: parseInt(cardId),
                entryStationId: parseInt(stationId)
            });
            
            alert('Tapped in successfully!');
            bootstrap.Modal.getInstance(document.getElementById('tapInModal')).hide();
            location.reload();
        } catch (error) {
            alert('Failed to tap in: ' + error.message);
        }
    });

    // Tap Out
    document.getElementById('confirmTapOut').addEventListener('click', async () => {
        const stationId = document.getElementById('tapOutStation').value;
        
        if (!stationId) {
            alert('Please select a station');
            return;
        }

        try {
            const activeJourney = await JourneyAPI.getActiveJourney(userId);
            if (!activeJourney) {
                alert('No active journey found');
                return;
            }

            await JourneyAPI.tapOut(activeJourney.id, parseInt(stationId));
            alert('Tapped out successfully!');
            bootstrap.Modal.getInstance(document.getElementById('tapOutModal')).hide();
            location.reload();
        } catch (error) {
            alert('Failed to tap out: ' + error.message);
        }
    });

    // Load user cards when tap in modal opens
    const tapInModal = document.getElementById('tapInModal');
    tapInModal.addEventListener('show.bs.modal', async () => {
        await loadUserCardsForTapIn();
    });
}

async function loadUserCardsForTapIn() {
    const select = document.getElementById('tapInCard');
    
    try {
        const response = await CardAPI.getUserCards(getUserId());
        const cards = response.data || [];
        const activeCards = cards.filter(c => c.status === 'ACTIVE');
        
        if (activeCards.length === 0) {
            select.innerHTML = '<option value="">No active cards available</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a card...</option>' +
            activeCards.map(card => 
                `<option value="${card.id}">${maskCardNumber(card.cardNumber)} ${card.isDefault ? '(Default)' : ''}</option>`
            ).join('');
    } catch (error) {
        select.innerHTML = '<option value="">Failed to load cards</option>';
    }
}

async function quickTapOut(journeyId) {
    const stationId = prompt('Enter exit station ID:');
    if (!stationId) return;

    try {
        await JourneyAPI.tapOut(journeyId, parseInt(stationId));
        alert('Tapped out successfully!');
        location.reload();
    } catch (error) {
        alert('Failed to tap out: ' + error.message);
    }
}

function viewJourneyDetails(journeyId) {
    window.location.href = `/journeys.html?id=${journeyId}`;
}
