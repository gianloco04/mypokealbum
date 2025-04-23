// Constants
const API_BASE_URL = 'https://api.pokemontcg.io/v2';

// State Management
const state = {
    currentPage: 'albums',
    selectedSet: null,
    viewMode: 'all', // 'all' or 'owned'
    cards: [],
    sets: [],
    ownedCards: JSON.parse(localStorage.getItem('ownedCards')) || {},
    favoriteSets: JSON.parse(localStorage.getItem('favoriteSets')) || [],
    albumsView: 'all', // 'all' or 'favorites'
    filters: {
        name: '',
        types: [],
        set: '',
        illustrator: ''
    },
    currentCardId: null,
    pokemonTypes: [],
    illustrators: [],
    pagination: {
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 20
    },
    seriesMap: {} // Maps set to series
};

// DOM Elements
const mainContent = document.getElementById('main-content');
const albumsLink = document.getElementById('albums-link');
const cardsLink = document.getElementById('cards-link');
const cardModal = document.getElementById('card-modal');
const closeModal = document.getElementById('close-modal');

// Event Listeners
albumsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('albums');
});

cardsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('cards');
});

closeModal.addEventListener('click', () => {
    cardModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === cardModal) {
        cardModal.style.display = 'none';
    }
});

// Navigation
function navigateTo(page, params = {}) {
    state.currentPage = page;
    updateActiveNavLink();
    
    // Reset pagination when changing pages
    state.pagination.currentPage = 1;

    if (page === 'albums') {
        loadAlbumsPage();
    } else if (page === 'set-detail' && params.setId) {
        state.selectedSet = params.setId;
        loadSetDetailPage(params.setId);
    } else if (page === 'cards') {
        loadCardsPage();
    }
}

function updateActiveNavLink() {
    albumsLink.classList.remove('active');
    cardsLink.classList.remove('active');
    
    if (state.currentPage === 'albums' || state.currentPage === 'set-detail') {
        albumsLink.classList.add('active');
    } else if (state.currentPage === 'cards') {
        cardsLink.classList.add('active');
    }
}

// API Functions
async function fetchSets() {
    try {
        showLoader();
        const response = await fetch(`${API_BASE_URL}/sets`);
        const data = await response.json();
        state.sets = data.data;
        
        // Organize sets by series
        organizeSeries(data.data);
        
        return data.data;
    } catch (error) {
        console.error('Error fetching sets:', error);
        showError('Failed to load sets. Please try again later.');
        return [];
    } finally {
        hideLoader();
    }
}

// Function to organize sets by series
function organizeSeries(sets) {
    const seriesMap = {};

    sets.forEach(set => {
        const series = set.series || "Other"; // Usa el campo series directamente

        if (!seriesMap[series]) {
            seriesMap[series] = [];
        }

        seriesMap[series].push(set);
    });

    // Ordena los sets por fecha de lanzamiento dentro de cada serie
    for (const series in seriesMap) {
        seriesMap[series].sort((a, b) => {
            return new Date(b.releaseDate) - new Date(a.releaseDate);
        });
    }

    state.seriesMap = seriesMap;
}

async function fetchSetCards(setId) {
    try {
        showLoader();
        const response = await fetch(`${API_BASE_URL}/cards?q=set.id:${setId}`);
        const data = await response.json();
        state.cards = data.data;
        return data.data;
    } catch (error) {
        console.error('Error fetching set cards:', error);
        showError('Failed to load cards. Please try again later.');
        return [];
    } finally {
        hideLoader();
    }
}

async function fetchCards(filters = {}, page = 1) {
    try {
        showLoader();
        
        // Build query string
        let queryParams = [`page=${page}`, `pageSize=${state.pagination.itemsPerPage}`];
        let queryString = '';
        
        if (filters.name) {
            queryString += `name:"*${filters.name}*" `;
        }
        
        if (filters.set) {
            queryString += `set.id:${filters.set} `;
        }
        
        if (filters.types && filters.types.length > 0) {
            queryString += `types:${filters.types.join('|')} `;
        }
        
        if (filters.illustrator) {
            queryString += `artist:"*${filters.illustrator}*" `;
        }
        
        if (queryString) {
            queryParams.push(`q=${encodeURIComponent(queryString.trim())}`);
        }
        
        const response = await fetch(`${API_BASE_URL}/cards?${queryParams.join('&')}`);
        const data = await response.json();
        
        // Update pagination
        state.pagination.totalPages = Math.ceil(data.totalCount / state.pagination.itemsPerPage);
        state.pagination.currentPage = page;
        
        state.cards = data.data;
        return data.data;
    } catch (error) {
        console.error('Error fetching cards:', error);
        showError('Failed to load cards. Please try again later.');
        return [];
    } finally {
        hideLoader();
    }
}

async function fetchPokemonTypes() {
    try {
        const response = await fetch(`${API_BASE_URL}/types`);
        const data = await response.json();
        state.pokemonTypes = data.data;
        return data.data;
    } catch (error) {
        console.error('Error fetching types:', error);
        return [];
    }
}

// Favorite Management
function toggleFavorite(setId) {
    const index = state.favoriteSets.indexOf(setId);
    
    if (index === -1) {
        state.favoriteSets.push(setId);
    } else {
        state.favoriteSets.splice(index, 1);
    }
    
    // Save to localStorage
    localStorage.setItem('favoriteSets', JSON.stringify(state.favoriteSets));
    
    // Redraw the albums page if we're on it
    if (state.currentPage === 'albums') {
        loadAlbumsPage();
    }
}

// Page Rendering Functions
async function loadAlbumsPage() {
    showLoader();
    
    if (state.sets.length === 0) {
        await fetchSets();
    }
    
    // Create HTML for a set card
    function createSetCard(set) {
        const isFavorite = state.favoriteSets.includes(set.id);
        return `
            <div class="set-card" data-set-id="${set.id}">
                <div class="favorite-btn ${isFavorite ? 'active' : ''}" data-set-id="${set.id}">
                    <i class="fas fa-star"></i>
                </div>
                <img src="${set.images.logo}" alt="${set.name}">
                <div class="set-info">
                    <h3>${set.name}</h3>
                    <p>${set.releaseDate} • ${set.total} cards</p>
                </div>
            </div>
        `;
    }

    let html = `
        <div class="page albums-page">
            <div class="tabs">
                <div class="tab ${state.albumsView === 'all' ? 'active' : ''}" data-view="all">All Sets</div>
                <div class="tab ${state.albumsView === 'favorites' ? 'active' : ''}" data-view="favorites">Favorites</div>
            </div>
    `;

    // If in favorites view, only show favorite sets
    if (state.albumsView === 'favorites' && state.favoriteSets.length > 0) {
        html += `
            <div class="series-container">
                <div class="series-header">
                    <h2>Favorite Sets</h2>
                </div>
                <div class="sets-container">
                    ${state.sets
                        .filter(set => state.favoriteSets.includes(set.id))
                        .map(set => createSetCard(set))
                        .join('')}
                </div>
            </div>
        `;
    } 
    else if (state.albumsView === 'favorites' && state.favoriteSets.length === 0) {
        html += `
            <div class="series-container">
                <div class="series-header">
                    <h2>Favorite Sets</h2>
                </div>
                <p>You haven't added any sets to your favorites yet. Star sets to add them here!</p>
            </div>
        `;
    }

    // If in all view, show sets grouped by series
    if (state.albumsView === 'all') {
        // Sort series by most recent set release date
        const sortedSeries = Object.keys(state.seriesMap).sort((a, b) => {
            if (a === "Other") return 1;  // push "Other" down
            if (b === "Other") return -1; // keep b down if b is "Other"
        
            const aDate = state.seriesMap[a][0]?.releaseDate || '';
            const bDate = state.seriesMap[b][0]?.releaseDate || '';
            return new Date(bDate) - new Date(aDate); // sort by newest first
        });
        

        sortedSeries.forEach(series => {
            const sets = state.seriesMap[series];
            html += `
            <div class="series-container" id="series-${slugify(series)}">
                <div class="series-header">
                    <h2>${series}</h2>
                    <span class="series-toggle" data-series="${slugify(series)}">
                        <i class="fas fa-chevron-up"></i>
                    </span>
                </div>
                <div class="sets-container" style="display: none;">
                    ${sets.map(set => createSetCard(set)).join('')}
                </div>
            </div>
        `;
        });
    }

    html += `</div>`;
    
    mainContent.innerHTML = html;
    hideLoader();
    
    // Add event listeners to set cards
    document.querySelectorAll('.set-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Prevent clicking on favorite button from navigating
            if (!e.target.closest('.favorite-btn')) {
                const setId = card.getAttribute('data-set-id');
                navigateTo('set-detail', { setId });
            }
        });
    });

    // Add event listeners to favorite buttons
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling to parent
            const setId = btn.getAttribute('data-set-id');
            toggleFavorite(setId);
            btn.classList.toggle('active');
        });
    });

    // Add event listeners to tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.albumsView = tab.getAttribute('data-view');
            loadAlbumsPage();
        });
    });

    // Add event listeners to series toggles
    document.querySelectorAll('.series-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const seriesId = toggle.getAttribute('data-series');
            const setsContainer = document.querySelector(`#series-${seriesId} .sets-container`);
            
            if (setsContainer.style.display === 'none') {
                setsContainer.style.display = 'grid';
                toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                setsContainer.style.display = 'none';
                toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        });
    });
}

async function loadSetDetailPage(setId) {
    showLoader();
    const cards = await fetchSetCards(setId);
    const set = state.sets.find(s => s.id === setId);
    
    if (!set) {
        showError('Set not found');
        return;
    }
    
    const html = `
        <div class="page set-detail-page">
            <a href="#" class="back-button" id="back-to-albums">
                <i class="fas fa-arrow-left"></i> Back to Albums
            </a>
            
            <div class="set-header">
                <img src="${set.images.logo}" alt="${set.name}">
                <h2>${set.name}</h2>
                <p>Released on ${set.releaseDate} • ${set.total} cards</p>
            </div>
            
            <div class="view-toggle">
                <button class="${state.viewMode === 'all' ? 'active' : ''}" data-view="all">All Cards</button>
                <button class="${state.viewMode === 'owned' ? 'active' : ''}" data-view="owned">Owned Only</button>
            </div>
            
            <div class="cards-container">
                ${cards.map(card => {
                    const isOwned = state.ownedCards[card.id] === true;
                    const shouldDisplay = state.viewMode === 'all' || (state.viewMode === 'owned' && isOwned);
                    
                    return shouldDisplay ? `
                        <div class="card-item ${isOwned ? 'owned' : 'not-owned'}" data-card-id="${card.id}">
                            <img src="${card.images.small}" alt="${card.name}">
                            ${isOwned ? '<span class="owned-indicator">Owned</span>' : ''}
                        </div>
                    ` : '';
                }).join('')}
            </div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    hideLoader();
    
    // Event listeners
    document.getElementById('back-to-albums').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('albums');
    });
    
    document.querySelectorAll('.view-toggle button').forEach(button => {
        button.addEventListener('click', () => {
            state.viewMode = button.getAttribute('data-view');
            loadSetDetailPage(setId);
        });
    });
    
    document.querySelectorAll('.card-item').forEach(cardItem => {
        cardItem.addEventListener('click', () => {
            const cardId = cardItem.getAttribute('data-card-id');
            showCardDetail(cardId);
        });
    });
}

async function loadCardsPage() {
    showLoader();
    
    // Fetch necessary data
    await Promise.all([
        fetchPokemonTypes(),
        fetchCards(state.filters, state.pagination.currentPage)
    ]);
    
    // Get unique illustrators
    const uniqueIllustrators = new Set();
    state.cards.forEach(card => {
        if (card.artist) {
            uniqueIllustrators.add(card.artist);
        }
    });
    state.illustrators = Array.from(uniqueIllustrators).sort();
    
    const html = `
        <div class="page cards-page">
            <h2>Browse Cards</h2>
            
            <div class="filters">
                <h2>Filters</h2>
                <div class="filter-group">
                    <div class="filter-item">
                        <label for="name-filter">Pokémon Name</label>
                        <input type="text" id="name-filter" placeholder="Search by name" value="${state.filters.name}">
                    </div>
                    
                    <div class="filter-item">
                        <label for="type-filter">Type</label>
                        <select id="type-filter">
                            <option value="">All Types</option>
                            ${state.pokemonTypes.map(type => `<option value="${type}" ${state.filters.types.includes(type) ? 'selected' : ''}>${type}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-item">
                        <label for="set-filter">Set</label>
                        <select id="set-filter">
                            <option value="">All Sets</option>
                            ${state.sets.map(set => `<option value="${set.id}" ${state.filters.set === set.id ? 'selected' : ''}>${set.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-item">
                        <label for="illustrator-filter">Illustrator</label>
                        <input type="text" id="illustrator-filter" list="illustrators" placeholder="Search by illustrator" value="${state.filters.illustrator}">
                        <datalist id="illustrators">
                            ${state.illustrators.map(artist => `<option value="${artist}">`).join('')}
                        </datalist>
                    </div>
                </div>
                
                <div class="filter-buttons">
                    <button class="reset-filters" id="reset-filters">Reset</button>
                    <button class="apply-filters" id="apply-filters">Apply Filters</button>
                </div>
            </div>
            
            <div class="cards-container">
                ${state.cards.map(card => {
                    const isOwned = state.ownedCards[card.id] === true;
                    return `
                        <div class="card-item ${isOwned ? 'owned' : 'not-owned'}" data-card-id="${card.id}">
                            <img src="${card.images.small}" alt="${card.name}">
                            ${isOwned ? '<span class="owned-indicator">Owned</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="pagination" id="pagination">
                <button id="prev-page" ${state.pagination.currentPage <= 1 ? 'disabled' : ''}>Previous</button>
                <span>Page ${state.pagination.currentPage} of ${state.pagination.totalPages}</span>
                <button id="next-page" ${state.pagination.currentPage >= state.pagination.totalPages ? 'disabled' : ''}>Next</button>
            </div>
        </div>
    `;
    
    mainContent.innerHTML = html;
    hideLoader();
    
    // Event listeners
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    
    document.querySelectorAll('.card-item').forEach(cardItem => {
        cardItem.addEventListener('click', () => {
            const cardId = cardItem.getAttribute('data-card-id');
            showCardDetail(cardId);
        });
    });
    
    document.getElementById('prev-page').addEventListener('click', () => {
        if (state.pagination.currentPage > 1) {
            fetchCards(state.filters, state.pagination.currentPage - 1)
                .then(() => loadCardsPage());
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        if (state.pagination.currentPage < state.pagination.totalPages) {
            fetchCards(state.filters, state.pagination.currentPage + 1)
                .then(() => loadCardsPage());
        }
    });
}

function showCardDetail(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    state.currentCardId = cardId;
    const isOwned = state.ownedCards[cardId] === true;
    
    const cardDetailHtml = `
        <div class="card-detail-header">
            <div class="card-detail-img-glow">
                <img src="${card.images.large}" alt="${card.name}" class="card-detail-img">
            </div>
            <h3 class="card-detail-name">${card.name}</h3>
            <p class="card-detail-set">${card.set.name} • ${card.rarity || 'Unknown rarity'}</p>
        </div>

        <div class="card-detail-info-grid">
            ${card.subtypes ? `<div><strong>Subtypes:</strong><span>${card.subtypes.join(', ')}</span></div>` : ''}
            ${card.types ? `<div><strong>Types:</strong><span>${card.types.join(', ')}</span></div>` : ''}
            ${card.artist ? `<div><strong>Illustrator:</strong><span>${card.artist}</span></div>` : ''}
        </div>

        <div class="card-actions">
            ${isOwned ?
                `<button class="mark-not-owned" id="toggle-ownership">Mark as Not Owned</button>` :
                `<button class="mark-owned" id="toggle-ownership">Mark as Owned</button>`
            }
        </div>
    `;

    
    document.getElementById('card-detail').innerHTML = cardDetailHtml;
    cardModal.style.display = 'block';
    
    // Add event listener to toggle ownership
    document.getElementById('toggle-ownership').addEventListener('click', toggleCardOwnership);
}

// Utility Functions
function applyFilters() {
    state.filters.name = document.getElementById('name-filter').value.trim();
    
    const typeSelect = document.getElementById('type-filter');
    state.filters.types = typeSelect.value ? [typeSelect.value] : [];
    
    state.filters.set = document.getElementById('set-filter').value;
    state.filters.illustrator = document.getElementById('illustrator-filter').value.trim();
    
    state.pagination.currentPage = 1;
    fetchCards(state.filters).then(() => loadCardsPage());
}

function resetFilters() {
    state.filters = {
        name: '',
        types: [],
        set: '',
        illustrator: ''
    };
    
    state.pagination.currentPage = 1;
    fetchCards(state.filters).then(() => loadCardsPage());
}

const SECRET_CODE = "caca"; // Puedes cambiarlo
state.accessGranted = localStorage.getItem('accessGranted') === 'true';

function checkSecretCode() {
    const input = document.getElementById('secret-code').value;
    const status = document.getElementById('access-status');
    
    if (input === SECRET_CODE) {
        state.accessGranted = true;
        localStorage.setItem('accessGranted', 'true');
        status.textContent = "✔ Access granted";
        status.style.color = "green";
    } else {
        state.accessGranted = false;
        localStorage.setItem('accessGranted', 'false');
        status.textContent = "✖ Wrong code";
        status.style.color = "red";
    }
}

function toggleCardOwnership() {
    if (!state.currentCardId) return;

    if (!state.accessGranted) {
        alert("You must enter the correct secret code to change ownership.");
        return;
    }

    const isCurrentlyOwned = state.ownedCards[state.currentCardId] === true;
    state.ownedCards[state.currentCardId] = !isCurrentlyOwned;

    // Save to localStorage
    localStorage.setItem('ownedCards', JSON.stringify(state.ownedCards));

    // Update the UI
    const button = document.getElementById('toggle-ownership');
    if (isCurrentlyOwned) {
        button.textContent = 'Mark as Owned';
        button.classList.remove('mark-not-owned');
        button.classList.add('mark-owned');
    } else {
        button.textContent = 'Mark as Not Owned';
        button.classList.remove('mark-owned');
        button.classList.add('mark-not-owned');
    }

    // Refresh the current page to reflect changes
    updateCardUI(state.currentCardId);

    // If modal is open, also update the card detail view
    if (cardModal.style.display === 'block') {
        showCardDetail(state.currentCardId);
    }

    // Close the modal after toggling
    setTimeout(() => {
        cardModal.style.display = 'none';
    }, 1000);
}

function updateCardUI(cardId) {
    const cardElement = document.querySelector(`.card[data-id="${cardId}"]`);
    if (!cardElement) return;

    const isOwned = state.ownedCards[cardId] === true;
    const ownershipBadge = cardElement.querySelector('.ownership-badge');

    if (ownershipBadge) {
        ownershipBadge.textContent = isOwned ? '✓ Owned' : '✗ Not Owned';
        ownershipBadge.className = `ownership-badge ${isOwned ? 'owned' : 'not-owned'}`;
    }

    const toggleButton = cardElement.querySelector('.toggle-ownership-btn');
    if (toggleButton) {
        toggleButton.textContent = isOwned ? 'Mark as Not Owned' : 'Mark as Owned';
    }
}

function showLoader() {
    mainContent.innerHTML = `
        <div class="loader">
            <i class="fas fa-spinner"></i> Loading...
        </div>
    `;
}

function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.remove();
    }
}

function showError(message) {
    mainContent.innerHTML += `
        <div class="error-message">
            <p><i class="fas fa-exclamation-circle"></i> ${message}</p>
        </div>
    `;
}

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // reemplaza todo lo que no sea alfanumérico por guión
        .replace(/^-+|-+$/g, '');    // quita guiones al inicio y final
}

document.getElementById('refresh-cards-button').addEventListener('click', () => {
    if (state.currentPage === 'set-detail') {
        loadSetDetailPage(state.selectedSet);
    } else if (state.currentPage === 'cards') {
        loadCardsPage();
    }
});


// Initialize the app
async function init() {
    try {
        // Fetch sets first for use in filters
        await fetchSets();
        
        // Initialize with default page
        navigateTo('albums');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please refresh the page.');
    }
}

function exportData() {
    const data = {
        ownedCards: state.ownedCards,
        favoriteSets: state.favoriteSets
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.json';
    link.click();
    
    // Liberar el URL
    URL.revokeObjectURL(url);
}


// Cargar estado desde localStorage al iniciar
function loadState() {
    const storedAccessGranted = localStorage.getItem('accessGranted');
    if (storedAccessGranted) {
        state.accessGranted = storedAccessGranted === 'true';
    } else {
        state.accessGranted = false;
    }

    const storedOwnedCards = localStorage.getItem('ownedCards');
    if (storedOwnedCards) {
        state.ownedCards = JSON.parse(storedOwnedCards);
    } else {
        state.ownedCards = {}; // Si no hay datos, inicializar vacío
    }

    const storedFavoriteSets = localStorage.getItem('favoriteSets');
    if (storedFavoriteSets) {
        state.favoriteSets = JSON.parse(storedFavoriteSets);
    } else {
        state.favoriteSets = []; // Si no hay datos, inicializar vacío
    }
}




// Start the app
init();

// Llamar esta función cuando la página se carga
loadState();
