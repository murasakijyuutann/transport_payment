// Cards page functionality

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const userId = getUserId();
    await loadUserCards(userId);
    setupEventListeners();
    populateExpiryYears();
});

async function loadUserCards(userId) {
    const container = document.getElementById('cardsContainer');
    
    try {
        const response = await CardAPI.getUserCards(userId);
        const cards = response.data || [];
        
        if (cards.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-credit-card fa-4x text-muted mb-3"></i>
                    <h4 class="text-muted">No cards added yet</h4>
                    <p class="text-muted">Add your first card to start making payments</p>
                    <button class="btn btn-primary mt-3" data-bs-toggle="modal" data-bs-target="#addCardModal">
                        <i class="fas fa-plus-circle"></i> Add Card
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = cards.map(card => createCardHTML(card)).join('');
    } catch (error) {
        showAlert('alert-container', 'Failed to load cards: ' + error.message, 'danger');
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-danger">
                <i class="fas fa-exclamation-circle fa-3x mb-3"></i>
                <p>Failed to load cards</p>
            </div>
        `;
    }
}

function createCardHTML(card) {
    const isDefault = card.isDefault;
    const cardClass = card.cardType === 'DEBIT' ? 'card-debit' : '';
    const defaultClass = isDefault ? 'card-default' : '';
    
    return `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="payment-card ${cardClass} ${defaultClass}">
                <div class="card-chip"></div>
                <div class="mb-3">
                    <small class="opacity-75">${card.cardType} CARD</small>
                    ${isDefault ? '<span class="badge bg-warning text-dark float-end">DEFAULT</span>' : ''}
                </div>
                <div class="card-number mb-4">${maskCardNumber(card.cardNumber)}</div>
                <div class="d-flex justify-content-between align-items-end">
                    <div>
                        <small class="opacity-75">EXPIRES</small><br>
                        <span>${card.expiryMonth}/${card.expiryYear}</span>
                    </div>
                    <div>
                        ${getStatusBadge(card.status)}
                    </div>
                </div>
                <div class="mt-3 pt-3 border-top border-light border-opacity-25">
                    <div class="btn-group w-100" role="group">
                        ${!isDefault && card.status === 'ACTIVE' ? `
                            <button class="btn btn-sm btn-light" onclick="setAsDefault(${card.id})">
                                <i class="fas fa-star"></i> Set Default
                            </button>
                        ` : ''}
                        ${card.status === 'ACTIVE' ? `
                            <button class="btn btn-sm btn-outline-light" onclick="blockCard(${card.id})">
                                <i class="fas fa-ban"></i> Block
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-light" onclick="deleteCard(${card.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function populateExpiryYears() {
    const yearSelect = document.getElementById('expiryYear');
    const currentYear = new Date().getFullYear();
    
    for (let i = 0; i < 10; i++) {
        const year = currentYear + i;
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function setupEventListeners() {
    const addCardForm = document.getElementById('addCardForm');
    const confirmBtn = document.getElementById('confirmAddCard');
    const cardNumberInput = document.getElementById('cardNumber');

    // Format card number input
    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\s/g, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        e.target.value = formattedValue;
    });

    confirmBtn.addEventListener('click', async () => {
        if (!addCardForm.checkValidity()) {
            addCardForm.reportValidity();
            return;
        }

        const userId = getUserId();
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const expiryMonth = document.getElementById('expiryMonth').value;
        const expiryYear = document.getElementById('expiryYear').value;
        const cardType = document.getElementById('cardType').value;
        const setDefault = document.getElementById('setDefault').checked;

        if (cardNumber.length !== 16) {
            showAlert('alert-container', 'Card number must be 16 digits', 'danger');
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        try {
            const cardData = {
                cardNumber,
                expiryMonth,
                expiryYear,
                cardType,
                isDefault: setDefault
            };

            await CardAPI.addCard(userId, cardData);
            
            showAlert('alert-container', 'Card added successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addCardModal')).hide();
            addCardForm.reset();
            
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            showAlert('alert-container', 'Failed to add card: ' + error.message, 'danger');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-check"></i> Add Card';
        }
    });
}

async function setAsDefault(cardId) {
    if (!confirm('Set this card as your default payment method?')) return;

    try {
        await CardAPI.setDefaultCard(cardId);
        showAlert('alert-container', 'Default card updated!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showAlert('alert-container', 'Failed to set default card: ' + error.message, 'danger');
    }
}

async function blockCard(cardId) {
    if (!confirm('Are you sure you want to block this card?')) return;

    // Note: You'll need to add this endpoint to your backend
    alert('Block card feature - endpoint needs to be implemented in backend');
}

async function deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this card? This action cannot be undone.')) return;

    try {
        await CardAPI.deleteCard(cardId);
        showAlert('alert-container', 'Card deleted successfully!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        showAlert('alert-container', 'Failed to delete card: ' + error.message, 'danger');
    }
}
