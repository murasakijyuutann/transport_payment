// Journeys page functionality

let allJourneys = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const userId = getUserId();
    await loadJourneys(userId);
    setupEventListeners();
});

async function loadJourneys(userId) {
    const tbody = document.getElementById('journeysTable');
    
    try {
        const response = await JourneyAPI.getUserJourneys(userId);
        allJourneys = response.data || [];
        
        if (allJourneys.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <i class="fas fa-route fa-3x text-muted mb-3"></i>
                        <p class="text-muted">No journeys recorded yet</p>
                    </td>
                </tr>
            `;
            updateStats([]);
            return;
        }

        displayJourneys(allJourneys);
        updateStats(allJourneys);
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                    <p>Failed to load journeys: ${error.message}</p>
                </td>
            </tr>
        `;
    }
}

function displayJourneys(journeys) {
    const tbody = document.getElementById('journeysTable');
    
    if (journeys.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No journeys found matching the filter criteria
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = journeys.map(journey => {
        const duration = calculateDuration(journey.tapInTime, journey.tapOutTime);
        
        return `
            <tr>
                <td><small class="text-muted">#${journey.id}</small></td>
                <td>${formatDateTime(journey.tapInTime)}</td>
                <td>
                    <i class="fas fa-map-marker-alt text-success me-1"></i>
                    ${journey.entryStation?.name || 'N/A'}
                    <br><small class="text-muted">Zone ${journey.entryStation?.zone || '-'}</small>
                </td>
                <td>
                    <i class="fas fa-map-marker-alt text-danger me-1"></i>
                    ${journey.exitStation?.name || 'N/A'}
                    <br><small class="text-muted">Zone ${journey.exitStation?.zone || '-'}</small>
                </td>
                <td>${duration}</td>
                <td class="fw-bold">${journey.fare ? formatCurrency(journey.fare) : '-'}</td>
                <td>${getStatusBadge(journey.status)}</td>
            </tr>
        `;
    }).join('');
}

function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return '-';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
        return `${diffMins} min`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
}

function updateStats(journeys) {
    // Total journeys
    document.getElementById('totalJourneys').textContent = journeys.length;
    
    // Completed journeys
    const completed = journeys.filter(j => j.status === 'COMPLETED');
    document.getElementById('completedJourneys').textContent = completed.length;
    
    // In progress journeys
    const inProgress = journeys.filter(j => j.status === 'IN_PROGRESS');
    document.getElementById('inProgressJourneys').textContent = inProgress.length;
    
    // Total spent
    const totalSpent = journeys.reduce((sum, j) => sum + (j.fare || 0), 0);
    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);
}

function setupEventListeners() {
    const applyFilterBtn = document.getElementById('applyFilter');
    
    applyFilterBtn.addEventListener('click', () => {
        applyFilters();
    });
}

function applyFilters() {
    const status = document.getElementById('filterStatus').value;
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    let filtered = [...allJourneys];
    
    // Filter by status
    if (status) {
        filtered = filtered.filter(j => j.status === status);
    }
    
    // Filter by date range
    if (fromDate) {
        const from = new Date(fromDate);
        filtered = filtered.filter(j => new Date(j.tapInTime) >= from);
    }
    
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(j => new Date(j.tapInTime) <= to);
    }
    
    displayJourneys(filtered);
    updateStats(filtered);
}
