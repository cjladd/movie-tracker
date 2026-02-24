let homeModalMovieData = null;
let homeUserGroups = [];

function homeCardA11yAttrs(label, action) {
    return `role="button" tabindex="0" aria-label="${escapeHtml(label)}" onclick="${action}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${action}}"`;
}

function showHomepageLoadError(message) {
    const heroSection = document.getElementById('hero-section');
    const featuredSection = document.getElementById('featured-movies');
    const trendingSection = document.getElementById('trending-movies');
    const fallback = escapeHtml(message || 'Unable to load movies right now.');

    if (heroSection && heroSection.classList.contains('loading')) {
        heroSection.innerHTML = `<div class="error" role="alert" aria-live="assertive">${fallback}</div>`;
        heroSection.classList.remove('loading');
    }
    if (featuredSection && featuredSection.classList.contains('loading')) {
        featuredSection.innerHTML = `<div class="error" role="alert" aria-live="assertive">${fallback}</div>`;
        featuredSection.classList.remove('loading');
    }
    if (trendingSection && trendingSection.classList.contains('loading')) {
        trendingSection.innerHTML = `<div class="error" role="alert" aria-live="assertive">${fallback}</div>`;
        trendingSection.classList.remove('loading');
    }
}

async function loadHomepageContent() {
    try {
        if (shouldSeedMovies()) {
            await seedDatabaseWithTMDBMovies();
            localStorage.setItem(LAST_SEED_KEY, String(Date.now()));
        }

        const [featuredMovies, trending] = await Promise.all([
            getFeaturedMovies(),
            getTrendingMovies(),
        ]);

        const trendingResults = Array.isArray(trending && trending.results) ? trending.results : [];

        if (featuredMovies && featuredMovies.length > 0) {
            displayHeroMovie(featuredMovies[0]);
            displayFeaturedMovies(featuredMovies);
        } else if (trendingResults.length > 0) {
            const heroTrending = trendingResults[0];
            displayHeroMovie({
                title: heroTrending.title || heroTrending.name || 'Unknown',
                poster_url: heroTrending.poster_path ? `https://image.tmdb.org/t/p/w500${heroTrending.poster_path}` : '',
                release_year: (heroTrending.release_date || '').slice(0, 4) || 'Unknown',
                rating: heroTrending.vote_average || null,
            });
            displayFeaturedFromTrending(trendingResults.slice(0, 8));
        } else {
            showHomepageLoadError('No movies found. Please try again later.');
        }

        if (trendingResults.length > 0) {
            displayTrendingMovies(trendingResults.slice(0, 8));
        } else {
            const trendingSection = document.getElementById('trending-movies');
            if (trendingSection) {
                renderStandardState(
                    trendingSection,
                    'empty',
                    'No trending movies',
                    'Trending results are temporarily unavailable.'
                );
                trendingSection.classList.remove('loading');
            }
        }
    } catch (error) {
        console.error('Error loading homepage content:', error);
        showHomepageLoadError('Failed to load content. Please try again later.');
    }
}

function displayHeroMovie(movie) {
    const heroSection = document.getElementById('hero-section');
    if (!heroSection) return;

    let ratingDisplay = 'N/A';
    if (movie.rating !== null && movie.rating !== undefined && !Number.isNaN(Number(movie.rating))) {
        ratingDisplay = Number(movie.rating).toFixed(1);
    }

    const posterUrl = movie.poster_url || '';
    const title = escapeHtml(movie.title);
    const year = escapeHtml(String(movie.release_year || 'Unknown'));

    heroSection.innerHTML = `
        <div class="hero-content card">
            <div class="hero-text" data-animate>
                <span class="hero-eyebrow">Tonight's Hero Pick</span>
                <h2 class="hero-title">Plan a <span class="gradient">Movie Night</span> that everyone actually wants.</h2>
                <p class="hero-subtitle">
                    Build group watchlists, vote fast, and lock in a plan with less back-and-forth.
                </p>
                <div class="hero-actions">
                    <a class="btn btn-primary" href="Binge_Bank.html">Discover Movies</a>
                    <a class="btn btn-secondary" href="Stream_team.html">Open Groups</a>
                </div>
            </div>
            <div class="hero-poster" data-animate>
                ${posterUrl
                    ? `<img src="${posterUrl}" alt="${title}" loading="eager" fetchpriority="high" decoding="async">`
                    : '<div class="loading">No poster available</div>'}
                <div class="hero-meta">
                    <h3>${title} (${year})</h3>
                    <div class="rating">${ratingDisplay}/10</div>
                </div>
            </div>
        </div>
    `;
    heroSection.classList.remove('loading');
    heroSection.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('is-visible'));
}

function displayFeaturedMovies(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) return;

    const movieCards = movies.map((movie, index) => {
        const posterUrl = movie.poster_url || '';
        const title = escapeHtml(movie.title);
        const year = escapeHtml(String(movie.release_year || 'Unknown'));
        const rating = movie.rating ? `${Number(movie.rating).toFixed(1)}/10` : 'NR';

        const tmdbId = movie.tmdb_id ? Number(movie.tmdb_id) : 'null';
        const movieId = movie.movie_id ? Number(movie.movie_id) : 'null';
        const action = `showHomeMovieDetails(${tmdbId}, ${movieId})`;

        return `
            <article class="movie-card-overlay animate-fade-in-up stagger-${Math.min(index + 1, 8)}" data-movie-id="${movie.movie_id}" ${homeCardA11yAttrs(`Open details for ${title}`, action)}>
                ${posterUrl
                    ? `<img src="${posterUrl}" alt="${title}" loading="lazy" decoding="async">`
                    : '<div class="loading" style="aspect-ratio:2/3;">No Poster</div>'}
                <div class="card-overlay">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}</p>
                </div>
            </article>
        `;
    }).join('');

    featuredSection.innerHTML = `<div class="featured-row">${movieCards}</div>`;
    featuredSection.classList.remove('loading');
}

function displayTrendingMovies(movies) {
    const trendingSection = document.getElementById('trending-movies');
    if (!trendingSection) return;

    const cards = movies.map((movie, index) => {
        const title = escapeHtml(movie.title || movie.name || 'Unknown title');
        const year = escapeHtml((movie.release_date || '').slice(0, 4) || 'Unknown');
        const rating = movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'NR';
        const poster = movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : '';
        const action = `showHomeMovieDetails(${movie.id}, null)`;

        return `
            <article class="trending-card card animate-fade-in-up stagger-${Math.min(index + 1, 8)}" ${homeCardA11yAttrs(`Open details for ${title}`, action)}>
                ${poster ? `<img src="${poster}" alt="${title}" loading="lazy" decoding="async">` : '<div class="loading">No poster</div>'}
                <div class="trending-overlay">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}/10</p>
                </div>
            </article>
        `;
    }).join('');

    trendingSection.innerHTML = `<div class="trending-grid">${cards}</div>`;
    trendingSection.classList.remove('loading');
}

function displayFeaturedFromTrending(movies) {
    const featuredSection = document.getElementById('featured-movies');
    if (!featuredSection) return;

    const movieCards = movies.map((movie, index) => {
        const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '';
        const title = escapeHtml(movie.title || movie.name || 'Unknown');
        const year = escapeHtml((movie.release_date || '').slice(0, 4) || 'Unknown');
        const rating = movie.vote_average ? `${Number(movie.vote_average).toFixed(1)}/10` : 'NR';
        const action = `showHomeMovieDetails(${movie.id}, null)`;

        return `
            <article class="movie-card-overlay animate-fade-in-up stagger-${Math.min(index + 1, 8)}" ${homeCardA11yAttrs(`Open details for ${title}`, action)}>
                ${posterUrl
                    ? `<img src="${posterUrl}" alt="${title}" loading="lazy" decoding="async">`
                    : '<div class="loading" style="aspect-ratio:2/3;">No Poster</div>'}
                <div class="card-overlay">
                    <h4>${title}</h4>
                    <p>${year} · ${rating}</p>
                </div>
            </article>
        `;
    }).join('');

    featuredSection.innerHTML = `<div class="featured-row">${movieCards}</div>`;
    featuredSection.classList.remove('loading');
}

function normalizeLocalMovieForModal(movie) {
    const genres = movie.genre
        ? String(movie.genre).split(',').map((name) => ({ name: name.trim() })).filter((g) => g.name)
        : [];

    return {
        id: movie.tmdb_id || null,
        title: movie.title || 'Unknown title',
        release_date: movie.release_year ? `${movie.release_year}-01-01` : null,
        runtime: movie.runtime_minutes || null,
        vote_average: movie.rating !== null && movie.rating !== undefined ? Number(movie.rating) : null,
        overview: movie.description || '',
        genres,
        cast: [],
        backdrop_url: movie.poster_url || null,
        poster_url: movie.poster_url || null,
        __source: 'local',
        __localMovieId: movie.movie_id || null,
    };
}

function renderHomeMovieModal(movie) {
    const titleEl = document.getElementById('modalTitle');
    const metaEl = document.getElementById('modalMeta');
    const descriptionEl = document.getElementById('modalDescription');
    const modalHeader = document.getElementById('modalHeader');
    const watchProvidersEl = document.getElementById('watchProviders');

    if (!titleEl || !metaEl || !descriptionEl || !modalHeader) return;

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : (movie.release_year || 'Unknown');
    const runtime = movie.runtime ? `${movie.runtime} min` : '';
    const rating = movie.vote_average !== null && movie.vote_average !== undefined && !Number.isNaN(movie.vote_average)
        ? `Rating ${Number(movie.vote_average).toFixed(1)}/10`
        : 'Rating N/A';

    titleEl.textContent = movie.title || 'Unknown title';
    metaEl.innerHTML = `
        <span>${year}</span>
        <span>${runtime}</span>
        <span>${rating}</span>
    `;

    modalHeader.style.backgroundImage = movie.backdrop_url ? `url(${movie.backdrop_url})` : 'none';

    descriptionEl.innerHTML = `
        <p class="modal-overview">${movie.overview || 'No description available.'}</p>
        ${movie.genres && movie.genres.length > 0 ? `<p><strong>Genres:</strong> ${movie.genres.map((g) => g.name).join(', ')}</p>` : ''}
        ${movie.cast && movie.cast.length > 0 ? `<p><strong>Cast:</strong> ${movie.cast.slice(0, 5).map((c) => c.name).join(', ')}</p>` : ''}
    `;

    if (watchProvidersEl) {
        watchProvidersEl.innerHTML = renderWatchProviders(movie.watch_providers || null);
    }
}

async function loadHomeUserGroups() {
    if (!currentUser || homeUserGroups.length > 0) return;
    try {
        homeUserGroups = normalizeCollection(await getGroups());
    } catch (_error) {
        homeUserGroups = [];
    }
}

async function showHomeMovieDetails(tmdbId, movieId = null) {
    const modal = document.getElementById('movieModal');
    if (!modal) return;

    try {
        let movie = null;
        let tmdbError = null;

        if (tmdbId) {
            try {
                movie = await getMovieDetails(tmdbId);
                movie.__source = 'tmdb';
                movie.__localMovieId = movieId || null;
            } catch (error) {
                tmdbError = error;
            }
        }

        if (!movie && movieId) {
            const localMovie = await getMovie(movieId);
            if (localMovie) {
                movie = normalizeLocalMovieForModal(localMovie);
            }
        }

        if (!movie) {
            throw tmdbError || new Error('Movie details unavailable');
        }

        homeModalMovieData = movie;
        renderHomeMovieModal(movie);

        const groupSelector = document.getElementById('groupSelector');
        if (currentUser) {
            await loadHomeUserGroups();
            if (homeUserGroups.length > 0) {
                const groupList = document.getElementById('groupList');
                groupList.innerHTML = homeUserGroups.map((group) => `
                    <div class="group-option">
                        <span class="group-name">${escapeHtml(group.group_name)}</span>
                        <button class="btn btn-primary add-to-group-btn" onclick="addHomeMovieToGroup(${group.group_id})" type="button">Add</button>
                    </div>
                `).join('');
                groupSelector.style.display = 'block';
            } else {
                groupSelector.style.display = 'none';
            }
        } else {
            groupSelector.style.display = 'none';
        }

        modal.setAttribute('aria-hidden', 'false');
        modal.style.display = 'flex';
    } catch (error) {
        console.error('Failed to load movie details:', error);
        showToast(getErrorMessage(error, 'Failed to load movie details'), 'error');
    }
}

async function addHomeMovieToGroup(groupId) {
    if (!homeModalMovieData) return;
    try {
        if (homeModalMovieData.__source === 'tmdb') {
            await addMovieToGroup(homeModalMovieData, groupId);
        } else if (homeModalMovieData.__localMovieId) {
            await addToWatchlist(groupId, homeModalMovieData.__localMovieId);
        } else {
            throw new Error('This movie cannot be added to a group right now');
        }
        const groupName = homeUserGroups.find((g) => g.group_id === groupId)?.group_name || 'group';
        showToast(`Added to "${groupName}" watchlist`, 'success');
        closeHomeModal();
    } catch (error) {
        showToast(getErrorMessage(error, 'Failed to add movie to group'), 'error');
    }
}

function closeHomeModal() {
    const modal = document.getElementById('movieModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
}

document.addEventListener('click', (event) => {
    const modal = document.getElementById('movieModal');
    if (event.target === modal) closeHomeModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHomeModal();
});
