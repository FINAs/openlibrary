import { debounce } from './nonjquery_utils.js';
import * as SearchUtils from './SearchUtils';

const RENDER_INSTANT_SEARCH_RESULT = {
    books(work) {
        const author_name = work.author_name ? work.author_name[0] : '';
        return `
            <li>
                <a href="${work.key}">
                    <img src="//covers.openlibrary.org/b/id/${work.cover_i}-S.jpg"/>
                    <span class="book-desc">
                        <div class="book-title">${work.title}</div> by <span class="book-author">${author_name}</span>
                    </span>
                </a>
            </li>`;
    },
    authors(author) {
        // Todo: default author img to: https://dev.openlibrary.org/images/icons/avatar_author-lg.png
        return `
            <li>
                <a href="/authors/${author.key}">
                    <img src="http://covers.openlibrary.org/a/olid/${author.key}-S.jpg"/>
                    <span class="author-desc"><div class="author-name">${author.name}</div></span>
                </a>
            </li>`;
    }
}

/**
 * Manages the interactions associated with the search bar in the header
 */
export class SearchBar {
    /**
     * @param {SearchState} searchState
     * @param {Object} urlParams
     */
    constructor(searchState, urlParams) {
        /** UI Elements */
        this.$component = $('header#header-bar .search-component');
        this.$form = this.$component.find('form.search-bar-input');
        this.$input = this.$form.find('input[type="text"]');
        this.$results = this.$component.find('ul.search-results');
        this.$facetSelect = this.$component.find('.search-facet-selector select');

        /** State */
        this.searchState = searchState;
        /** stores the state of the search result for resizing window */
        this.instantSearchResultState = false;
        /** Whether the search bar is expanded */
        this.searchExpansionActivated = false;
        /** ?? Not sure */
        this.enteredSearchMinimized = false;

        if (urlParams.q) {
            let q = urlParams.q.replace(/\+/g, ' ');
            if (searchState.facet === 'title' && q.indexOf('title:') != -1) {
                const parts = q.split('"');
                if (parts.length === 3) {
                    q = parts[1];
                }
            }
            this.$input.val(q);
        }

        if ($(window).width() < 568) {
            if (!this.enteredSearchMinimized) {
                this.$form.addClass('trigger');
            }
            this.enteredSearchMinimized = true;
        }

        // searches should be cancelled if you click anywhere in the page
        $(document.body).on('click', this.cancelSearch.bind(this));
        // but clicking search input should not empty search results.
        $(window).resize(this.handleResize.bind(this));
        this.$input.on('click', false);
        // Bind to changes in the search state
        this.searchState.sync('facet', this.handleFacetChange.bind(this));
        this.searchState.sync('searchMode', this.handleSearchModeChange.bind(this));
        this.$facetSelect.change(event => {
            const facet = this.$facetSelect.val();
            // Ignore advanced, because we don't want it to stick (since it acts like a button)
            if (facet == 'advanced') {
                event.preventDefault();
                window.location.assign('/advancedsearch');
            } else {
                this.searchState.facet = facet;
            }
        });

        this.$form.on('submit', () => {
            const q = this.$input.val();
            if (this.searchState.facetEndpoint === 'books') {
                this.$input.val(SearchBar.marshalBookSearchQuery(q));
            }
            // TODO can we remove this?
            SearchUtils.updateSearchMode(this.$form, this.searchState.searchMode);
        });

        this.$input.on('keyup', debounce(event => {
            this.instantSearchResultState = true;
            // ignore directional keys and enter for callback
            if (![13,37,38,39,40].includes(event.keyCode)) {
                this.renderInstantSearchResults($(event.target).val());
            }
        }, 500, false));

        this.$input.on('focus', debounce(event => {
            this.instantSearchResultState = true;
            event.stopPropagation();
            this.renderInstantSearchResults($(event.target).val());
        }, 300, false));

        $(document).on('submit','.trigger', event => {
            event.preventDefault();
            this.toggle();
            this.$input.focus();
        });
    }

    handleResize() {
        if ($(window).width() < 568){
            if (!this.enteredSearchMinimized) {
                this.$form.addClass('trigger');
                this.$results.empty();
            }
            this.enteredSearchMinimized = true;
        } else {
            if (this.enteredSearchMinimized) {
                this.$form.removeClass('trigger');
                const search_query = this.$input.val();
                if (search_query && this.instantSearchResultState) {
                    this.renderInstantSearchResults(search_query);
                }
            }
            this.enteredSearchMinimized = false;
            this.searchExpansionActivated = false;
            $('header#header-bar .logo-component').removeClass('hidden');
            this.$component.removeClass('search-component-expand');
        }
    }

    cancelSearch() {
        this.instantSearchResultState = false;
        this.$results.empty();
    }

    /**
     * Expands/hides the searchbar
     */
    toggle() {
        this.searchExpansionActivated = !this.searchExpansionActivated;
        if (this.searchExpansionActivated) {
            $('header#header-bar .logo-component').addClass('hidden');
            this.$component.addClass('search-component-expand');
            this.$form.removeClass('trigger');
        } else {
            $('header#header-bar .logo-component').removeClass('hidden');
            this.$component.removeClass('search-component-expand');
            this.$form.addClass('trigger');
        }
    }

    /**
     * Compose search url for what?!? is the clickable? The autocomplete?!? WHAT?!?
     * @param {String} q query
     * @param {Boolean} [json]
     * @param {Number} [limit]
     */
    composeSearchUrl(q, json, limit) {
        const facet_value = this.searchState.facetEndpoint;
        let url = ((facet_value === 'books' || facet_value === 'all')? '/search' : `/search/${facet_value}`);
        if (json) {
            url += '.json';
        }
        url += `?q=${q}`;
        if (limit) {
            url += `&limit=${limit}`;
        }
        return `${url}&mode=${this.searchState.searchMode}`;
    }

    /**
     * Marshal into what? From what?
     * @param {String} q
     */
    static marshalBookSearchQuery(q) {
        if (q && q.indexOf(':') == -1 && q.indexOf('"') == -1) {
            q = `title: "${q}"`;
        }
        return q;
    }

    /**
     * Perform the query and update autocomplete results
     * @param {String} q
     */
    renderInstantSearchResults(q) {
        const facet_value = this.searchState.facetEndpoint;
        // Not implemented; also, this call is _expensive_ and should not be done!
        if (facet_value === 'inside') return;
        if (q === '') {
            return;
        }
        if (facet_value === 'books') {
            q = SearchBar.marshalBookSearchQuery(q);
        }

        this.$results.css('opacity', 0.5);
        $.getJSON(this.composeSearchUrl(q, true, 10), data => {
            const facet = facet_value === 'all' ? 'books' : facet_value;
            this.$results.css('opacity', 1).empty();
            for (let d in data.docs) {
                const html = RENDER_INSTANT_SEARCH_RESULT[facet](data.docs[d]);
                this.$results.append(html);
            }
        });
    }

    /**
     * Set the selected facet
     * @param {String} facet
     */
    handleFacetChange(newFacet) {
        $('header#header-bar .search-facet-selector select').val(newFacet)
        const text = $('header#header-bar .search-facet-selector select').find('option:selected').text()
        $('header#header-bar .search-facet-value').html(text);
        this.$results.empty()
        const q = this.$input.val();
        const url = this.composeSearchUrl(q);
        $('.search-bar-input').attr('action', url);
        this.renderInstantSearchResults(q);
    }

    handleSearchModeChange(newMode) {
        $('.instantsearch-mode').val(newMode);
        $(`input[name=mode][value=${newMode}]`).prop('checked', true);
        SearchUtils.updateSearchMode('.search-bar-input', this.searchState.searchMode);
    }
}
